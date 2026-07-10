import type { GitBranchRef, GitObjectRef } from '@emdash/core/runtimes/git/api';
import { useQuery } from '@tanstack/react-query';
import {
  checkoutSelector,
  getSourceControlClient,
} from '@core/features/source-control/api/browser/client';
import { localRef, toRefString } from '@core/primitives/git/api';
import { computeCreatePrDefaults } from './pr-defaults';

/**
 * Fetch the commits in `base..branch` and derive the default PR title/body the
 * way the GitHub web UI does. Returns `undefined` while loading, when there is
 * no base branch to compare against, or on error, in which case the caller
 * should keep its own humanized-branch-name fallback.
 *
 * Only a single commit is fetched: the exact commit count comes from the
 * `totalCount` (`rev-list --count`) returned alongside it, and the commit's
 * content is only needed when there is exactly one.
 *
 * `headOid` (the branch tip) is part of the query key so the defaults are
 * recomputed whenever the branch gains commits — e.g. an agent commits while
 * the modal is open — rather than serving a stale cached range.
 */
export function useCreatePrDefaults(params: {
  projectId: string;
  workspaceId: string;
  branchName: string;
  base: GitBranchRef | undefined;
  headOid: string | undefined;
}): { title: string; body: string } | undefined {
  const { projectId, workspaceId, branchName, base, headOid } = params;
  const baseObjectRef: GitObjectRef | undefined = base
    ? { kind: 'branch', branch: base }
    : undefined;
  const baseRef = baseObjectRef ? toRefString(baseObjectRef) : undefined;

  const { data } = useQuery({
    queryKey: [projectId, workspaceId, 'create-pr-defaults', baseRef, branchName, headOid] as const,
    queryFn: async () => {
      if (!baseObjectRef) throw new Error('Missing base branch');
      const client = await getSourceControlClient();
      const result = await client.checkout.getLog({
        ...checkoutSelector(workspaceId),
        options: { limit: 1, skip: 0, base: baseObjectRef, head: localRef(branchName) },
      });
      if (!result.success) throw new Error('Failed to load commits');
      return computeCreatePrDefaults({
        branchName,
        commits: result.data.commits,
        aheadCount: result.data.totalCount,
      });
    },
    enabled: Boolean(base),
    staleTime: 5 * 60_000,
  });

  return data;
}
