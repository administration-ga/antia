// Dupliqué de socle/packages/api/src/hooks.ts @ ad2e7fdc2 — adaptations : arguments paginés typés par `PaginatedQueryArgs` (deux `any` retirés) ; les deux `any` restants (options TanStack) justifiés en commentaire, règle du moteur « jamais `any` sans justification ».
"use client";

import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import {
	type UseQueryResult,
	useMutation,
	useQuery,
} from "@tanstack/react-query";
import {
	type PaginatedQueryArgs,
	type PaginatedQueryReference,
	useAction,
	useConvexAuth,
	usePaginatedQuery,
} from "convex/react";
import type { FunctionReference, FunctionReturnType } from "convex/server";
import { useEffect, useState } from "react";

export { convexQuery, useConvexMutation };

/**
 * Version stabilisee de useConvexAuth.
 *
 * useConvexAuth peut transiter par (isLoading=false, isAuthenticated=false)
 * pendant que Better Auth echange le cookie de session contre un JWT Convex
 * et que ce JWT est applique au WebSocket Convex. Scenario typique : apres un
 * sign-in via le DevAccountSwitcher, window.location.reload() recharge la page
 * et les guards qui consomment useConvexAuth directement voient brievement
 * "non authentifie" et redirigent prematurement vers /sign-in.
 *
 * Ce hook attend `gracePeriodMs` (1500 ms par defaut) avant de conclure
 * "non authentifie", mais conclut "authentifie" immediatement. Une fois
 * authentifie, l'etat est sticky — un sign-out explicite doit demonter le
 * composant (window.location.href = "/") pour reinitialiser le state.
 */
export function useStableConvexAuth(options?: { gracePeriodMs?: number }) {
	const gracePeriodMs = options?.gracePeriodMs ?? 1500;
	const { isAuthenticated, isLoading } = useConvexAuth();
	const [resolved, setResolved] = useState<
		"pending" | "authenticated" | "unauthenticated"
	>("pending");

	useEffect(() => {
		if (isLoading) return;
		if (isAuthenticated) {
			setResolved("authenticated");
			return;
		}
		const timer = setTimeout(() => {
			setResolved((prev) => (prev === "authenticated" ? prev : "unauthenticated"));
		}, gracePeriodMs);
		return () => clearTimeout(timer);
	}, [isAuthenticated, isLoading, gracePeriodMs]);

	return {
		isAuthenticated: resolved === "authenticated",
		isUnauthenticated: resolved === "unauthenticated",
		isPending: resolved === "pending",
	};
}

/**
 * Paginated query for public (non-auth) Convex functions.
 * Supports "skip" as args to disable the query.
 */
export function usePaginatedConvexQuery<Query extends PaginatedQueryReference>(
	query: Query,
	args: PaginatedQueryArgs<Query> | "skip",
	options: { initialNumItems: number },
) {
	const { results, status, loadMore, isLoading } = usePaginatedQuery(
		query,
		args === "skip" ? "skip" : args,
		options,
	);

	return { results, status, loadMore, isLoading };
}

/**
 * Paginated query for Convex functions that require authentication.
 * Automatically skips the query when user is not authenticated.
 */
export function useAuthenticatedPaginatedQuery<
	Query extends PaginatedQueryReference,
>(
	query: Query,
	args: PaginatedQueryArgs<Query> | "skip",
	options: { initialNumItems: number },
) {
	const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();

	const { results, status, loadMore, isLoading } = usePaginatedQuery(
		query,
		args === "skip" || !isAuthenticated || isAuthLoading ? "skip" : args,
		options,
	);

	return { results, status, loadMore, isLoading: isLoading || isAuthLoading };
}

/**
 * Query a Convex function using TanStack Query.
 * Supports "skip" as args to disable the query.
 */
export function useConvexQuery<Query extends FunctionReference<"query">>(
	query: Query,
	args: Query["_args"] | "skip",
): UseQueryResult<FunctionReturnType<Query>> {
	const shouldSkip = args === "skip";
	const queryOptions = shouldSkip
		? { queryKey: ["convexQuery", query, "skip"] as const }
		: convexQuery(query, args);
	return useQuery({
		...queryOptions,
		enabled: !shouldSkip,
		// `any` justifié : les options « requête » et « skip » portent des clés de
		// types distincts que TanStack ne sait pas unir ; le résultat reste typé
		// (`UseQueryResult<FunctionReturnType<Query>>`).
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any);
}

/**
 * Query a Convex function that requires authentication.
 */
export function useAuthenticatedConvexQuery<
	Query extends FunctionReference<"query">,
>(
	query: Query,
	args: Query["_args"] | "skip",
): UseQueryResult<FunctionReturnType<Query>> {
	const { isAuthenticated, isLoading } = useConvexAuth();
	const shouldSkip = args === "skip" || !isAuthenticated || isLoading;
	const queryOptions = shouldSkip
		? { queryKey: ["convexQuery", query, "skip"] as const }
		: convexQuery(query, args);

	return useQuery({
		...queryOptions,
		enabled: !shouldSkip,
		// `any` justifié : les options « requête » et « skip » portent des clés de
		// types distincts que TanStack ne sait pas unir ; le résultat reste typé
		// (`UseQueryResult<FunctionReturnType<Query>>`).
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any);
}

/**
 * Mutate data using a Convex mutation with TanStack Query.
 */
export function useConvexMutationQuery<
	Mutation extends FunctionReference<"mutation">,
>(mutation: Mutation) {
	const mutationFn = useConvexMutation(mutation);
	return useMutation({
		mutationFn: async (args: Mutation["_args"]) => {
			return await mutationFn(args);
		},
	});
}

/**
 * Call a Convex action using TanStack Query.
 */
export function useConvexActionQuery<
	Action extends FunctionReference<"action">,
>(action: Action) {
	const actionFn = useAction(action);
	return useMutation({
		mutationFn: async (args: Action["_args"]) => {
			return await actionFn(args);
		},
	});
}
