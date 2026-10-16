import type { ValidatorJSON } from "convex/values"
import schema from "../../schema"
import { DATA_TABLE_POLICIES } from "./dataPolicies"

export type DataRecord = Record<string, unknown> & { _id: string; _creationTime: number }
export const dataTableNames = () => Object.keys(schema.tables).sort()
export const unclassifiedDataTables = () => dataTableNames().filter((name) => !Object.prototype.hasOwnProperty.call(DATA_TABLE_POLICIES, name))

/** Le registre des références est dérivé des validateurs réels, y compris unions/collections. */
export function referencesIn(value: unknown, shape: ValidatorJSON): Array<{ table: string; id: string }> {
  if (value === undefined || value === null) return []
  switch (shape.type) {
    case "id": return typeof value === "string" ? [{ table: shape.tableName, id: value }] : []
    case "array": return Array.isArray(value) ? value.flatMap((item) => referencesIn(item, shape.value)) : []
    case "object": return typeof value === "object" && !Array.isArray(value) ? Object.entries(shape.value).flatMap(([key, field]) => referencesIn((value as Record<string, unknown>)[key], field.fieldType)) : []
    case "union": return shape.value.flatMap((member) => referencesIn(value, member))
    case "record": return typeof value === "object" && !Array.isArray(value) ? Object.values(value).flatMap((item) => referencesIn(item, shape.values.fieldType)) : []
    default: return []
  }
}

export function shapeFor(table: string): ValidatorJSON {
  const tables = schema.tables as unknown as Record<string, { validator: { json: ValidatorJSON } }>
  const definition = tables[table]
  if (!definition || !Object.prototype.hasOwnProperty.call(DATA_TABLE_POLICIES, table)) throw new Error("Unclassified data table")
  return definition.validator.json
}

export function directlyOwned(table: string, row: DataRecord, personId: string): boolean {
  const policy = DATA_TABLE_POLICIES[table]
  if (!policy || policy.shared || ["persons", "idnProofs", "devOtpCodes"].includes(table)) return false
  if (policy.owners) return policy.owners.some((field) => row[field] === personId)
  return referencesIn(row, shapeFor(table)).some((ref) => ref.table === "persons" && ref.id === personId)
}

/** Remplace les références obligatoires par l'identité anonyme commune ; vide les listes. */
export function anonymizeReferences(value: unknown, shape: ValidatorJSON, personId: string, anonymousId: string): unknown {
  if (value === undefined || value === null) return value
  switch (shape.type) {
    case "id": return shape.tableName === "persons" && value === personId ? anonymousId : value
    case "array": return Array.isArray(value) ? value.filter((item) => !(shape.value.type === "id" && shape.value.tableName === "persons" && item === personId)).map((item) => anonymizeReferences(item, shape.value, personId, anonymousId)) : value
    case "object": {
      if (typeof value !== "object" || Array.isArray(value)) return value
      const output = { ...(value as Record<string, unknown>) }
      for (const [key, field] of Object.entries(shape.value)) {
        if (field.optional && field.fieldType.type === "id" && field.fieldType.tableName === "persons" && output[key] === personId) delete output[key]
        else if (Object.prototype.hasOwnProperty.call(output, key)) output[key] = anonymizeReferences(output[key], field.fieldType, personId, anonymousId)
      }
      return output
    }
    case "union": return shape.value.reduce<unknown>((current, member) => anonymizeReferences(current, member, personId, anonymousId), value)
    case "record": return typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, anonymizeReferences(item, shape.values.fieldType, personId, anonymousId)])) : value
    default: return value
  }
}

const PRIVATE_EXPORT_FIELDS = new Set(["authuserid", "userid", "endpoint", "token", "auth", "p256dh", "keys", "contacts", "identitysubjects", "secret", "privatekey", "keyenvname", "credential", "sessionid", "password", "clientsecret", "accesstoken", "refreshtoken", "idtoken", "authorization", "bearer", "backupcodes"])

/** Les secrets sont retirés à toute profondeur, y compris dans les objets imbriqués. */
function redactExportValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactExportValue)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !PRIVATE_EXPORT_FIELDS.has(key.toLowerCase()) && !/(?:token|secret|password|credential|privatekey)$/i.test(key)).map(([key, item]) => [key, redactExportValue(item)]))
  }
  return value
}

function projectedRecord(row: DataRecord, fields: readonly string[]): Record<string, unknown> {
  return redactExportValue(Object.fromEntries(fields.filter((field) => Object.prototype.hasOwnProperty.call(row, field)).map((field) => [field, row[field]]))) as Record<string, unknown>
}

const RECORD_METADATA = ["_id", "_creationTime", "networkId", "createdAt", "updatedAt"] as const
const THREAD_METADATA = [...RECORD_METADATA, "personLow", "personHigh", "createdByPersonId", "initiatedByPersonId", "status", "archivedAt", "closedAt", "lastMessageAt"] as const
const REPORT_REFERENCE_FIELDS = [...RECORD_METADATA, "target", "targetKind", "targetId", "postId", "commentId", "status"] as const

/** Droits de propriété explicites, distincts de la découverte des dépendances d'effacement. */
const EXPORT_PERSON_FIELDS: Readonly<Record<string, readonly string[]>> = {
  identityLinks: ["personId"], networkMemberships: ["personId"], personFacets: ["personId"], consents: ["personId"], peopleDirectory: ["personId"], handleHistory: ["personId"],
  postReactions: ["personId"], personalMessageReactions: ["personId"], personalTyping: ["personId"], unreadTotals: ["personId"],
  thematicGroupMembers: ["personId"], groupMembers: ["personId"], groupMessageReactions: ["personId"], groupMessageHides: ["personId"], groupTyping: ["personId"],
  storyViews: ["viewerPersonId"], suggestionDismissals: ["personId"], pageFollows: ["personId"],
  callParticipants: ["personId"], callInvites: ["personId"], callPreferences: ["personId"], personPresence: ["personId"],
  liveSpeakers: ["personId"], liveViewerGrants: ["personId"], liveAntennaRequests: ["personId"], liveDelegations: ["personId"], liveInvitees: ["personId"], liveChatMutes: ["personId"], liveReactions: ["personId"], liveHostPresence: ["hostPersonId"],
  postMarks: ["personId"], mutes: ["personId"], consularAttestations: ["personId"], memberPrivacy: ["personId"],
  notificationPreferences: ["personId"], pushSubscriptions: ["personId"], notificationDeliveryJobs: ["recipientPersonId"], notificationWeeklyUsage: ["personId"], notificationDigestReceipts: ["personId"], dataExports: ["personId"],
}

/**
 * Une mention, une signature ou un geste d'administration n'ouvrent jamais le
 * document d'autrui. Les relations partagées ont leurs propres projections.
 */
export function exportableRecord(table: string, row: DataRecord, personId: string): Record<string, unknown> | null {
  const policy = DATA_TABLE_POLICIES[table]
  if (!policy) return null
  if (table === "persons") return row._id === personId ? redactExportValue(row) as Record<string, unknown> : null
  if (table === "personalThreads") return row.personLow === personId || row.personHigh === personId ? projectedRecord(row, THREAD_METADATA) : null
  if (table === "groupThreads") return row.createdByPersonId === personId ? projectedRecord(row, THREAD_METADATA) : null
  if (table === "connections") {
    // Le blocage reçu n'est ni une donnée divulguée par la relation ni une émission propre.
    if (row.status === "blocked" && row.blockedByPersonId !== personId) return null
    return row.personIdLow === personId || row.personIdHigh === personId ? projectedRecord(row, [...RECORD_METADATA, "personIdLow", "personIdHigh", "requestedByPersonId", "recipientPersonId", "status", "requestedAt", "respondedAt", "cancelledRequestedAt"]) : null
  }
  if (table === "personBlocks") return row.blockerPersonId === personId ? projectedRecord(row, [...RECORD_METADATA, "blockerPersonId", "targetPersonId"]) : null
  if (table === "follows") return row.followerPersonId === personId || row.targetPersonId === personId ? projectedRecord(row, [...RECORD_METADATA, "followerPersonId", "targetPersonId"]) : null
  if (table === "reports" || table === "contentReports") {
    if (row.reporterPersonId === personId) return projectedRecord(row, [...REPORT_REFERENCE_FIELDS, "reason", "note", "source"])
    if (table === "reports" && row.ownerPersonId === personId) return projectedRecord(row, [...REPORT_REFERENCE_FIELDS, "source", "decisionReason", "reviewedAt", "removedTarget"])
    return null
  }
  if (table === "engineAudit") return row.actorPersonId === personId ? projectedRecord(row, [...RECORD_METADATA, "action", "capacity", "subjectTable", "subjectId", "at"]) : null
  if (table === "dataErasureJobs") return row.personId === personId ? projectedRecord(row, ["_id", "personId", "phase", "requestedAt", "dueAt", "updatedAt"]) : null
  if (table === "pages" || table === "thematicGroups") return row.createdByPersonId === personId ? redactExportValue(row) as Record<string, unknown> : null
  if (policy.shared) return null
  const owners = policy.owners ?? EXPORT_PERSON_FIELDS[table]
  if (!owners?.some((field) => row[field] === personId)) return null
  if (table === "fileScans") return projectedRecord(row, [...RECORD_METADATA, "storageId", "uploadedByPersonId", "source", "status", "attempts", "scannedAt", "releasedAt"])
  // Une copie transférée n'ouvre pas l'original retiré/inaccessible par l'export self-scoped.
  if ((table === "personalMessages" || table === "groupMessages") && row.forwardedFrom) {
    const metadata = { ...row }
    delete metadata.content; delete metadata.attachmentFiles; delete metadata.forwardedFrom
    return redactExportValue(metadata) as Record<string, unknown>
  }
  return redactExportValue(row) as Record<string, unknown>
}

/** Compatibilité : une ligne non exportable devient vide, jamais une projection permissive. */
export function exportRecord(table: string, row: DataRecord, personId: string): Record<string, unknown> {
  return exportableRecord(table, row, personId) ?? {}
}
