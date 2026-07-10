import type { Commit } from '@emdash/core/runtimes/git/api';

/**
 * Convert a branch name into a default PR title the way the GitHub web UI does:
 * replace `-` and `_` with spaces and capitalize the first letter. The full ref
 * is preserved, including any `prefix/` segment (e.g. `emdash/add-thing` becomes
 * `Emdash/add thing`).
 */
export function humanizeBranchName(branch: string): string {
  const spaced = branch.replace(/[-_]/g, ' ');
  if (spaced.length === 0) return spaced;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Compute the default PR title and body from the commits in the `base..head`
 * range, mirroring GitHub's web UI: a single commit seeds the title and body
 * from that commit, while zero or multiple commits fall back to a humanized
 * branch name with an empty body.
 *
 * `aheadCount` (an exact `rev-list --count`) is the source of truth for the
 * commit count; `commits` only needs to contain the single commit's content.
 */
export function computeCreatePrDefaults(params: {
  branchName: string;
  commits: Commit[];
  aheadCount: number;
}): { title: string; body: string } {
  const { branchName, commits, aheadCount } = params;
  const singleCommit = aheadCount === 1 ? commits[0] : undefined;
  if (singleCommit) {
    return { title: singleCommit.subject, body: singleCommit.body };
  }
  return { title: humanizeBranchName(branchName), body: '' };
}
