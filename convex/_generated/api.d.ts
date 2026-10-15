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
import type * as migrations from "../migrations.js";
import type * as modules_albums_access from "../modules/albums/access.js";
import type * as modules_albums_albums from "../modules/albums/albums.js";
import type * as modules_albums_tables from "../modules/albums/tables.js";
import type * as modules_albums_validators from "../modules/albums/validators.js";
import type * as modules_diaspora_attestation from "../modules/diaspora/attestation.js";
import type * as modules_diaspora_directory from "../modules/diaspora/directory.js";
import type * as modules_diaspora_facet from "../modules/diaspora/facet.js";
import type * as modules_diaspora_facts from "../modules/diaspora/facts.js";
import type * as modules_diaspora_hubs from "../modules/diaspora/hubs.js";
import type * as modules_diaspora_manifest from "../modules/diaspora/manifest.js";
import type * as modules_diaspora_membership from "../modules/diaspora/membership.js";
import type * as modules_diaspora_profile from "../modules/diaspora/profile.js";
import type * as modules_diaspora_seed from "../modules/diaspora/seed.js";
import type * as modules_diaspora_suggestions from "../modules/diaspora/suggestions.js";
import type * as modules_diaspora_tables from "../modules/diaspora/tables.js";
import type * as modules_diaspora_validators from "../modules/diaspora/validators.js";
import type * as modules_engagement_engagement from "../modules/engagement/engagement.js";
import type * as modules_engagement_tables from "../modules/engagement/tables.js";
import type * as modules_events_card from "../modules/events/card.js";
import type * as modules_events_events from "../modules/events/events.js";
import type * as modules_events_tables from "../modules/events/tables.js";
import type * as modules_files_admission from "../modules/files/admission.js";
import type * as modules_files_avProviders from "../modules/files/avProviders.js";
import type * as modules_files_inspect from "../modules/files/inspect.js";
import type * as modules_files_mutations from "../modules/files/mutations.js";
import type * as modules_files_notify from "../modules/files/notify.js";
import type * as modules_files_policy from "../modules/files/policy.js";
import type * as modules_files_posedUploads from "../modules/files/posedUploads.js";
import type * as modules_files_purge from "../modules/files/purge.js";
import type * as modules_files_queries from "../modules/files/queries.js";
import type * as modules_files_scan from "../modules/files/scan.js";
import type * as modules_files_storageGuard from "../modules/files/storageGuard.js";
import type * as modules_files_tables from "../modules/files/tables.js";
import type * as modules_files_verdict from "../modules/files/verdict.js";
import type * as modules_graph_connections from "../modules/graph/connections.js";
import type * as modules_graph_follows from "../modules/graph/follows.js";
import type * as modules_graph_graph from "../modules/graph/graph.js";
import type * as modules_graph_tables from "../modules/graph/tables.js";
import type * as modules_groups_access from "../modules/groups/access.js";
import type * as modules_groups_cascade from "../modules/groups/cascade.js";
import type * as modules_groups_invites from "../modules/groups/invites.js";
import type * as modules_groups_messages from "../modules/groups/messages.js";
import type * as modules_groups_tables from "../modules/groups/tables.js";
import type * as modules_groups_threads from "../modules/groups/threads.js";
import type * as modules_groups_typing from "../modules/groups/typing.js";
import type * as modules_groups_unread from "../modules/groups/unread.js";
import type * as modules_marks_marks from "../modules/marks/marks.js";
import type * as modules_marks_tables from "../modules/marks/tables.js";
import type * as modules_media_media from "../modules/media/media.js";
import type * as modules_messaging_attachmentStorage from "../modules/messaging/attachmentStorage.js";
import type * as modules_messaging_forward from "../modules/messaging/forward.js";
import type * as modules_messaging_forwardedFrom from "../modules/messaging/forwardedFrom.js";
import type * as modules_messaging_inbox from "../modules/messaging/inbox.js";
import type * as modules_messaging_messages from "../modules/messaging/messages.js";
import type * as modules_messaging_participation from "../modules/messaging/participation.js";
import type * as modules_messaging_pins from "../modules/messaging/pins.js";
import type * as modules_messaging_reactions from "../modules/messaging/reactions.js";
import type * as modules_messaging_tables from "../modules/messaging/tables.js";
import type * as modules_messaging_threads from "../modules/messaging/threads.js";
import type * as modules_messaging_typing from "../modules/messaging/typing.js";
import type * as modules_moderation_moderation from "../modules/moderation/moderation.js";
import type * as modules_moderation_tables from "../modules/moderation/tables.js";
import type * as modules_networks_networks from "../modules/networks/networks.js";
import type * as modules_networks_tables from "../modules/networks/tables.js";
import type * as modules_notifications_bell from "../modules/notifications/bell.js";
import type * as modules_notifications_fanout from "../modules/notifications/fanout.js";
import type * as modules_notifications_notify from "../modules/notifications/notify.js";
import type * as modules_notifications_tables from "../modules/notifications/tables.js";
import type * as modules_pages_access from "../modules/pages/access.js";
import type * as modules_pages_admin from "../modules/pages/admin.js";
import type * as modules_pages_claims from "../modules/pages/claims.js";
import type * as modules_pages_followedUpdates from "../modules/pages/followedUpdates.js";
import type * as modules_pages_follows from "../modules/pages/follows.js";
import type * as modules_pages_identity from "../modules/pages/identity.js";
import type * as modules_pages_pages from "../modules/pages/pages.js";
import type * as modules_pages_signatories from "../modules/pages/signatories.js";
import type * as modules_pages_tables from "../modules/pages/tables.js";
import type * as modules_pages_validators from "../modules/pages/validators.js";
import type * as modules_people_admission from "../modules/people/admission.js";
import type * as modules_people_consents from "../modules/people/consents.js";
import type * as modules_people_directory from "../modules/people/directory.js";
import type * as modules_people_facets from "../modules/people/facets.js";
import type * as modules_people_memberships from "../modules/people/memberships.js";
import type * as modules_people_miniProfile from "../modules/people/miniProfile.js";
import type * as modules_people_persons from "../modules/people/persons.js";
import type * as modules_people_profile from "../modules/people/profile.js";
import type * as modules_people_tables from "../modules/people/tables.js";
import type * as modules_platform_audit from "../modules/platform/audit.js";
import type * as modules_platform_authRateLimit from "../modules/platform/authRateLimit.js";
import type * as modules_platform_devTools from "../modules/platform/devTools.js";
import type * as modules_platform_tables from "../modules/platform/tables.js";
import type * as modules_posts_access from "../modules/posts/access.js";
import type * as modules_posts_contentRemoval from "../modules/posts/contentRemoval.js";
import type * as modules_posts_counters from "../modules/posts/counters.js";
import type * as modules_posts_postNotify from "../modules/posts/postNotify.js";
import type * as modules_posts_postWrite from "../modules/posts/postWrite.js";
import type * as modules_posts_posts from "../modules/posts/posts.js";
import type * as modules_posts_tables from "../modules/posts/tables.js";
import type * as modules_stories_stories from "../modules/stories/stories.js";
import type * as modules_stories_tables from "../modules/stories/tables.js";
import type * as modules_suggestions_suggestions from "../modules/suggestions/suggestions.js";
import type * as modules_suggestions_tables from "../modules/suggestions/tables.js";
import type * as modules_thematicGroups_access from "../modules/thematicGroups/access.js";
import type * as modules_thematicGroups_tables from "../modules/thematicGroups/tables.js";
import type * as modules_thematicGroups_thematicGroups from "../modules/thematicGroups/thematicGroups.js";
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
  migrations: typeof migrations;
  "modules/albums/access": typeof modules_albums_access;
  "modules/albums/albums": typeof modules_albums_albums;
  "modules/albums/tables": typeof modules_albums_tables;
  "modules/albums/validators": typeof modules_albums_validators;
  "modules/diaspora/attestation": typeof modules_diaspora_attestation;
  "modules/diaspora/directory": typeof modules_diaspora_directory;
  "modules/diaspora/facet": typeof modules_diaspora_facet;
  "modules/diaspora/facts": typeof modules_diaspora_facts;
  "modules/diaspora/hubs": typeof modules_diaspora_hubs;
  "modules/diaspora/manifest": typeof modules_diaspora_manifest;
  "modules/diaspora/membership": typeof modules_diaspora_membership;
  "modules/diaspora/profile": typeof modules_diaspora_profile;
  "modules/diaspora/seed": typeof modules_diaspora_seed;
  "modules/diaspora/suggestions": typeof modules_diaspora_suggestions;
  "modules/diaspora/tables": typeof modules_diaspora_tables;
  "modules/diaspora/validators": typeof modules_diaspora_validators;
  "modules/engagement/engagement": typeof modules_engagement_engagement;
  "modules/engagement/tables": typeof modules_engagement_tables;
  "modules/events/card": typeof modules_events_card;
  "modules/events/events": typeof modules_events_events;
  "modules/events/tables": typeof modules_events_tables;
  "modules/files/admission": typeof modules_files_admission;
  "modules/files/avProviders": typeof modules_files_avProviders;
  "modules/files/inspect": typeof modules_files_inspect;
  "modules/files/mutations": typeof modules_files_mutations;
  "modules/files/notify": typeof modules_files_notify;
  "modules/files/policy": typeof modules_files_policy;
  "modules/files/posedUploads": typeof modules_files_posedUploads;
  "modules/files/purge": typeof modules_files_purge;
  "modules/files/queries": typeof modules_files_queries;
  "modules/files/scan": typeof modules_files_scan;
  "modules/files/storageGuard": typeof modules_files_storageGuard;
  "modules/files/tables": typeof modules_files_tables;
  "modules/files/verdict": typeof modules_files_verdict;
  "modules/graph/connections": typeof modules_graph_connections;
  "modules/graph/follows": typeof modules_graph_follows;
  "modules/graph/graph": typeof modules_graph_graph;
  "modules/graph/tables": typeof modules_graph_tables;
  "modules/groups/access": typeof modules_groups_access;
  "modules/groups/cascade": typeof modules_groups_cascade;
  "modules/groups/invites": typeof modules_groups_invites;
  "modules/groups/messages": typeof modules_groups_messages;
  "modules/groups/tables": typeof modules_groups_tables;
  "modules/groups/threads": typeof modules_groups_threads;
  "modules/groups/typing": typeof modules_groups_typing;
  "modules/groups/unread": typeof modules_groups_unread;
  "modules/marks/marks": typeof modules_marks_marks;
  "modules/marks/tables": typeof modules_marks_tables;
  "modules/media/media": typeof modules_media_media;
  "modules/messaging/attachmentStorage": typeof modules_messaging_attachmentStorage;
  "modules/messaging/forward": typeof modules_messaging_forward;
  "modules/messaging/forwardedFrom": typeof modules_messaging_forwardedFrom;
  "modules/messaging/inbox": typeof modules_messaging_inbox;
  "modules/messaging/messages": typeof modules_messaging_messages;
  "modules/messaging/participation": typeof modules_messaging_participation;
  "modules/messaging/pins": typeof modules_messaging_pins;
  "modules/messaging/reactions": typeof modules_messaging_reactions;
  "modules/messaging/tables": typeof modules_messaging_tables;
  "modules/messaging/threads": typeof modules_messaging_threads;
  "modules/messaging/typing": typeof modules_messaging_typing;
  "modules/moderation/moderation": typeof modules_moderation_moderation;
  "modules/moderation/tables": typeof modules_moderation_tables;
  "modules/networks/networks": typeof modules_networks_networks;
  "modules/networks/tables": typeof modules_networks_tables;
  "modules/notifications/bell": typeof modules_notifications_bell;
  "modules/notifications/fanout": typeof modules_notifications_fanout;
  "modules/notifications/notify": typeof modules_notifications_notify;
  "modules/notifications/tables": typeof modules_notifications_tables;
  "modules/pages/access": typeof modules_pages_access;
  "modules/pages/admin": typeof modules_pages_admin;
  "modules/pages/claims": typeof modules_pages_claims;
  "modules/pages/followedUpdates": typeof modules_pages_followedUpdates;
  "modules/pages/follows": typeof modules_pages_follows;
  "modules/pages/identity": typeof modules_pages_identity;
  "modules/pages/pages": typeof modules_pages_pages;
  "modules/pages/signatories": typeof modules_pages_signatories;
  "modules/pages/tables": typeof modules_pages_tables;
  "modules/pages/validators": typeof modules_pages_validators;
  "modules/people/admission": typeof modules_people_admission;
  "modules/people/consents": typeof modules_people_consents;
  "modules/people/directory": typeof modules_people_directory;
  "modules/people/facets": typeof modules_people_facets;
  "modules/people/memberships": typeof modules_people_memberships;
  "modules/people/miniProfile": typeof modules_people_miniProfile;
  "modules/people/persons": typeof modules_people_persons;
  "modules/people/profile": typeof modules_people_profile;
  "modules/people/tables": typeof modules_people_tables;
  "modules/platform/audit": typeof modules_platform_audit;
  "modules/platform/authRateLimit": typeof modules_platform_authRateLimit;
  "modules/platform/devTools": typeof modules_platform_devTools;
  "modules/platform/tables": typeof modules_platform_tables;
  "modules/posts/access": typeof modules_posts_access;
  "modules/posts/contentRemoval": typeof modules_posts_contentRemoval;
  "modules/posts/counters": typeof modules_posts_counters;
  "modules/posts/postNotify": typeof modules_posts_postNotify;
  "modules/posts/postWrite": typeof modules_posts_postWrite;
  "modules/posts/posts": typeof modules_posts_posts;
  "modules/posts/tables": typeof modules_posts_tables;
  "modules/stories/stories": typeof modules_stories_stories;
  "modules/stories/tables": typeof modules_stories_tables;
  "modules/suggestions/suggestions": typeof modules_suggestions_suggestions;
  "modules/suggestions/tables": typeof modules_suggestions_tables;
  "modules/thematicGroups/access": typeof modules_thematicGroups_access;
  "modules/thematicGroups/tables": typeof modules_thematicGroups_tables;
  "modules/thematicGroups/thematicGroups": typeof modules_thematicGroups_thematicGroups;
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
