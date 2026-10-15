/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as betterAuth_auth from "../betterAuth/auth.js";
import type * as crons from "../crons.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_devTools from "../lib/devTools.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_functions from "../lib/functions.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_uploadPolicy from "../lib/uploadPolicy.js";
import type * as lib_validators from "../lib/validators.js";
import type * as modules_diaspora_facet from "../modules/diaspora/facet.js";
import type * as modules_diaspora_facts from "../modules/diaspora/facts.js";
import type * as modules_diaspora_hubs from "../modules/diaspora/hubs.js";
import type * as modules_diaspora_manifest from "../modules/diaspora/manifest.js";
import type * as modules_diaspora_membership from "../modules/diaspora/membership.js";
import type * as modules_diaspora_seed from "../modules/diaspora/seed.js";
import type * as modules_diaspora_tables from "../modules/diaspora/tables.js";
import type * as modules_diaspora_validators from "../modules/diaspora/validators.js";
import type * as modules_engagement_engagement from "../modules/engagement/engagement.js";
import type * as modules_engagement_tables from "../modules/engagement/tables.js";
import type * as modules_files_admission from "../modules/files/admission.js";
import type * as modules_files_avProviders from "../modules/files/avProviders.js";
import type * as modules_files_inspect from "../modules/files/inspect.js";
import type * as modules_files_mutations from "../modules/files/mutations.js";
import type * as modules_files_policy from "../modules/files/policy.js";
import type * as modules_files_posedUploads from "../modules/files/posedUploads.js";
import type * as modules_files_queries from "../modules/files/queries.js";
import type * as modules_files_scan from "../modules/files/scan.js";
import type * as modules_files_storageGuard from "../modules/files/storageGuard.js";
import type * as modules_files_tables from "../modules/files/tables.js";
import type * as modules_files_verdict from "../modules/files/verdict.js";
import type * as modules_graph_connections from "../modules/graph/connections.js";
import type * as modules_graph_follows from "../modules/graph/follows.js";
import type * as modules_graph_graph from "../modules/graph/graph.js";
import type * as modules_graph_tables from "../modules/graph/tables.js";
import type * as modules_media_media from "../modules/media/media.js";
import type * as modules_networks_networks from "../modules/networks/networks.js";
import type * as modules_networks_tables from "../modules/networks/tables.js";
import type * as modules_people_admission from "../modules/people/admission.js";
import type * as modules_people_consents from "../modules/people/consents.js";
import type * as modules_people_directory from "../modules/people/directory.js";
import type * as modules_people_facets from "../modules/people/facets.js";
import type * as modules_people_memberships from "../modules/people/memberships.js";
import type * as modules_people_miniProfile from "../modules/people/miniProfile.js";
import type * as modules_people_persons from "../modules/people/persons.js";
import type * as modules_people_profile from "../modules/people/profile.js";
import type * as modules_people_tables from "../modules/people/tables.js";
import type * as modules_platform_authRateLimit from "../modules/platform/authRateLimit.js";
import type * as modules_platform_devTools from "../modules/platform/devTools.js";
import type * as modules_platform_tables from "../modules/platform/tables.js";
import type * as modules_posts_counters from "../modules/posts/counters.js";
import type * as modules_posts_postWrite from "../modules/posts/postWrite.js";
import type * as modules_posts_posts from "../modules/posts/posts.js";
import type * as modules_posts_tables from "../modules/posts/tables.js";
import type * as seeds_foundations from "../seeds/foundations.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "betterAuth/auth": typeof betterAuth_auth;
  crons: typeof crons;
  health: typeof health;
  http: typeof http;
  "lib/access": typeof lib_access;
  "lib/devTools": typeof lib_devTools;
  "lib/errors": typeof lib_errors;
  "lib/functions": typeof lib_functions;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/uploadPolicy": typeof lib_uploadPolicy;
  "lib/validators": typeof lib_validators;
  "modules/diaspora/facet": typeof modules_diaspora_facet;
  "modules/diaspora/facts": typeof modules_diaspora_facts;
  "modules/diaspora/hubs": typeof modules_diaspora_hubs;
  "modules/diaspora/manifest": typeof modules_diaspora_manifest;
  "modules/diaspora/membership": typeof modules_diaspora_membership;
  "modules/diaspora/seed": typeof modules_diaspora_seed;
  "modules/diaspora/tables": typeof modules_diaspora_tables;
  "modules/diaspora/validators": typeof modules_diaspora_validators;
  "modules/engagement/engagement": typeof modules_engagement_engagement;
  "modules/engagement/tables": typeof modules_engagement_tables;
  "modules/files/admission": typeof modules_files_admission;
  "modules/files/avProviders": typeof modules_files_avProviders;
  "modules/files/inspect": typeof modules_files_inspect;
  "modules/files/mutations": typeof modules_files_mutations;
  "modules/files/policy": typeof modules_files_policy;
  "modules/files/posedUploads": typeof modules_files_posedUploads;
  "modules/files/queries": typeof modules_files_queries;
  "modules/files/scan": typeof modules_files_scan;
  "modules/files/storageGuard": typeof modules_files_storageGuard;
  "modules/files/tables": typeof modules_files_tables;
  "modules/files/verdict": typeof modules_files_verdict;
  "modules/graph/connections": typeof modules_graph_connections;
  "modules/graph/follows": typeof modules_graph_follows;
  "modules/graph/graph": typeof modules_graph_graph;
  "modules/graph/tables": typeof modules_graph_tables;
  "modules/media/media": typeof modules_media_media;
  "modules/networks/networks": typeof modules_networks_networks;
  "modules/networks/tables": typeof modules_networks_tables;
  "modules/people/admission": typeof modules_people_admission;
  "modules/people/consents": typeof modules_people_consents;
  "modules/people/directory": typeof modules_people_directory;
  "modules/people/facets": typeof modules_people_facets;
  "modules/people/memberships": typeof modules_people_memberships;
  "modules/people/miniProfile": typeof modules_people_miniProfile;
  "modules/people/persons": typeof modules_people_persons;
  "modules/people/profile": typeof modules_people_profile;
  "modules/people/tables": typeof modules_people_tables;
  "modules/platform/authRateLimit": typeof modules_platform_authRateLimit;
  "modules/platform/devTools": typeof modules_platform_devTools;
  "modules/platform/tables": typeof modules_platform_tables;
  "modules/posts/counters": typeof modules_posts_counters;
  "modules/posts/postWrite": typeof modules_posts_postWrite;
  "modules/posts/posts": typeof modules_posts_posts;
  "modules/posts/tables": typeof modules_posts_tables;
  "seeds/foundations": typeof seeds_foundations;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
  engineCounters: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"engineCounters">;
  followerCounts: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"followerCounts">;
};
