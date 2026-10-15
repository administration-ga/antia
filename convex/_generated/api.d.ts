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
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_devTools from "../lib/devTools.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_functions from "../lib/functions.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_validators from "../lib/validators.js";
import type * as modules_engagement_engagement from "../modules/engagement/engagement.js";
import type * as modules_engagement_tables from "../modules/engagement/tables.js";
import type * as modules_networks_networks from "../modules/networks/networks.js";
import type * as modules_networks_tables from "../modules/networks/tables.js";
import type * as modules_people_consents from "../modules/people/consents.js";
import type * as modules_people_facets from "../modules/people/facets.js";
import type * as modules_people_memberships from "../modules/people/memberships.js";
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
  health: typeof health;
  http: typeof http;
  "lib/access": typeof lib_access;
  "lib/devTools": typeof lib_devTools;
  "lib/errors": typeof lib_errors;
  "lib/functions": typeof lib_functions;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/validators": typeof lib_validators;
  "modules/engagement/engagement": typeof modules_engagement_engagement;
  "modules/engagement/tables": typeof modules_engagement_tables;
  "modules/networks/networks": typeof modules_networks_networks;
  "modules/networks/tables": typeof modules_networks_tables;
  "modules/people/consents": typeof modules_people_consents;
  "modules/people/facets": typeof modules_people_facets;
  "modules/people/memberships": typeof modules_people_memberships;
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
};
