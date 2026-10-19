/**
 * PA10 : exploitation LOCALE de preuves déjà produites, sans client réseau,
 * sous-processus, déploiement, extraction d'archive ou écriture de fichier.
 *
 * node scripts/pa10-evidence.mjs load <releve.json>
 * node scripts/pa10-evidence.mjs restore <export-source-extrait> <export-restaure-extrait>
 *
 * Le second mode compare deux exports Convex extraits par le propriétaire.
 * Il ne crée pas de sauvegarde et ne restaure aucune base. Les composants et
 * les blobs sont comparés aussi, sans jamais afficher de ligne personnelle.
 */
import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { lstat, readFile, readdir, realpath } from "node:fs/promises"
import { resolve, join, relative } from "node:path"
import { createInterface } from "node:readline"
import { pathToFileURL } from "node:url"

const MAX_RECEIPT_BYTES = 16 * 1024 * 1024
const MAX_FILES = 50_000
const MAX_DOCUMENTS = 2_000_000
const MAX_LINE_BYTES = 8 * 1024 * 1024
const SHA = /^[a-f\d]{40}(?:[a-f\d]{24})?$/i
const SHA256 = /^[a-f\d]{64}$/i
const finite = (value) => typeof value === "number" && Number.isFinite(value)
const natural = (value) => Number.isSafeInteger(value) && value >= 0
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
const invalid = (field) => { throw new Error(`Preuve PA10 invalide : ${field}`) }

/** Percentile du rang le plus proche ; aucune interpolation avantageuse. */
export function percentile(values, fraction) {
  if (!values.length || !finite(fraction) || fraction <= 0 || fraction > 1 || values.some((n) => !finite(n) || n < 0)) return invalid("échantillons")
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.ceil(fraction * sorted.length) - 1]
}

/** N'accepte que des observations, jamais une durée globale divisée par N. */
export function summarizeLoadRun(receipt) {
  if (!object(receipt) || receipt.version !== 1 || !SHA.test(receipt.sourceSha ?? "")
    || !SHA256.test(receipt.inventoryBefore ?? "") || receipt.inventoryAfter !== receipt.inventoryBefore
    || !["local", "disposable-dev"].includes(receipt.targetKind)
    || !["local", "simulated-3g"].includes(receipt.networkProfile)
    || !finite(receipt.startedAt) || !finite(receipt.endedAt) || receipt.endedAt <= receipt.startedAt) return invalid("provenance")
  if (!Array.isArray(receipt.samples) || receipt.samples.length > 100_000 || !receipt.samples.length) return invalid("samples")
  const durations = { follow: [], reaction: [], feed: [] }
  let errors = 0, writeConflicts = 0, retries = 0
  for (const sample of receipt.samples) {
    if (!object(sample) || !Object.hasOwn(durations, sample.operation) || !finite(sample.durationMs) || sample.durationMs < 0
      || !natural(sample.writeConflicts) || !Number.isSafeInteger(sample.attempts) || sample.attempts < 1 || sample.attempts > 100
      || typeof sample.ok !== "boolean") return invalid("sample")
    durations[sample.operation].push(sample.durationMs)
    errors += sample.ok ? 0 : 1
    writeConflicts += sample.writeConflicts
    retries += sample.attempts - 1
  }
  if (!Array.isArray(receipt.reactionShards) || receipt.reactionShards.length !== 8) return invalid("reactionShards")
  const shards = new Map()
  for (const shard of receipt.reactionShards) {
    if (!object(shard) || !natural(shard.shard) || shard.shard > 7 || !natural(shard.count) || shards.has(shard.shard)) return invalid("shard")
    shards.set(shard.shard, shard.count)
  }
  const feedP95Ms = durations.feed.length ? percentile(durations.feed, 0.95) : null
  const measuredReactions = [...shards.values()].reduce((sum, count) => sum + count, 0)
  const workloadComplete = durations.follow.length >= 5_000 && durations.reaction.length >= 10_000 && durations.feed.length >= 100 && measuredReactions >= 10_000
  return {
    kind: "recorded_load_samples", sourceSha: receipt.sourceSha,
    targetKind: receipt.targetKind, networkProfile: receipt.networkProfile,
    startedAt: receipt.startedAt, endedAt: receipt.endedAt,
    counts: Object.fromEntries(Object.entries(durations).map(([kind, rows]) => [kind, rows.length])),
    errors, writeConflicts, retries, feedP95Ms,
    reactionShards: [...shards].sort(([a], [b]) => a - b).map(([shard, count]) => ({ shard, count })),
    workloadComplete,
    r8ThresholdsSatisfied: workloadComplete && errors === 0 && writeConflicts === 0 && feedP95Ms !== null && feedP95Ms < 1_500,
    // Cette conclusion ne prouve ni le réseau 3G réel, ni les droits, ni une
    // mise en production : ce sont des pièces distinctes du rapport.
    independentLaunchApproval: false,
  }
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (object(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`
  return JSON.stringify(value)
}

async function digestFile(path) {
  const hash = createHash("sha256")
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest("hex")
}

async function documentDigests(path) {
  const seen = new Set(), hashes = []
  const stream = createReadStream(path)
  const lines = createInterface({ input: stream, crlfDelay: Infinity })
  try {
    for await (const line of lines) {
      if (!line.trim()) continue
      if (Buffer.byteLength(line) > MAX_LINE_BYTES || hashes.length >= MAX_DOCUMENTS) return invalid("borne documents")
      let row
      try { row = JSON.parse(line) } catch { return invalid("document JSON") }
      if (!object(row) || typeof row._id !== "string" || seen.has(row._id)) return invalid("identifiant document")
      seen.add(row._id)
      hashes.push(createHash("sha256").update(canonical(row)).digest("hex"))
    }
  } finally { lines.close(); stream.destroy() }
  // Ordre des lignes indépendant de l'ordre de l'archive ; les identifiants
  // restent dans le digest : un même compte avec de nouveaux IDs ne passe pas.
  hashes.sort()
  return { count: hashes.length, sha256: createHash("sha256").update(hashes.join("\n")).digest("hex") }
}

async function snapshotInventory(directory) {
  const root = await realpath(directory)
  if (!(await lstat(root)).isDirectory()) return invalid("dossier export")
  const rows = [], pending = [root]
  while (pending.length) {
    const dir = pending.pop()
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isSymbolicLink()) return invalid("lien symbolique")
      if (entry.isDirectory()) { pending.push(path); continue }
      if (!entry.isFile() || rows.length >= MAX_FILES) return invalid("borne fichiers")
      const name = relative(root, path).split("\\").join("/")
      // On compare chaque fichier, y compris metadata/composants : aucune
      // exclusion permissive qui masquerait une perte de sauvegarde.
      rows.push({ path: name, ...(entry.name === "documents.jsonl" ? await documentDigests(path) : { count: null, sha256: await digestFile(path) }) })
    }
  }
  if (!rows.some((row) => row.path.endsWith("/documents.jsonl"))) return invalid("export Convex vide ou non reconnu")
  return { root, rows: rows.sort((a, b) => a.path.localeCompare(b.path)) }
}

export async function compareSnapshotDirectories(source, restored) {
  const left = await snapshotInventory(source), right = await snapshotInventory(restored)
  if (left.root === right.root || right.root.startsWith(`${left.root}/`) || left.root.startsWith(`${right.root}/`)) return invalid("exports distincts")
  const inventory = (rows) => createHash("sha256").update(canonical(rows)).digest("hex")
  const sourceDigest = inventory(left.rows), restoredDigest = inventory(right.rows)
  const tables = left.rows.filter((row) => row.count !== null)
  return {
    kind: "local_snapshot_parity", matching: sourceDigest === restoredDigest,
    sourceDigest, restoredDigest, files: left.rows.length,
    documentFiles: tables.length, documents: tables.reduce((sum, row) => sum + row.count, 0),
    // Une paire d'exports ne prouve pas que le second provient de la cible
    // annoncée : joindre séparément reçus Convex et assertions d'accès.
    targetProvenanceVerified: false, independentLaunchApproval: false,
  }
}

async function main(args) {
  if (args[0] === "load" && args.length === 2) {
    const path = resolve(args[1]), stat = await lstat(path)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_RECEIPT_BYTES) return invalid("fichier relevé")
    let receipt
    try { receipt = JSON.parse(await readFile(path, "utf8")) } catch { return invalid("relevé JSON") }
    const result = summarizeLoadRun(receipt)
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    if (!result.r8ThresholdsSatisfied) process.exitCode = 1
  } else if (args[0] === "restore" && args.length === 3) {
    const result = await compareSnapshotDirectories(resolve(args[1]), resolve(args[2]))
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    if (!result.matching) process.exitCode = 1
  } else {
    process.stdout.write("PA10 — outil local inerte. Modes : load <releve.json> ; restore <export-source-extrait> <export-restaure-extrait>. Aucune opération distante.\n")
    if (args.length) process.exitCode = 2
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(() => {
    // Le parseur ou le système de fichiers peuvent inclure des données privées
    // dans leur exception. Aucun message brut ne traverse la sortie.
    process.stderr.write("Preuve PA10 refusée : format, chemin ou lecture invalide.\n")
    process.exitCode = 1
  })
}
