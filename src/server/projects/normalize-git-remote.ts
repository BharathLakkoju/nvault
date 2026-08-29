/**
 * Normalizes both SSH ("git@github.com:org/repo.git") and HTTPS
 * ("https://github.com/org/repo.git") remotes to "github.com/org/repo" so
 * `nvault init` can match a project regardless of which remote form the
 * developer's git config uses.
 */
export function normalizeGitRemote(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return url
    .trim()
    .replace(/^git@/, "")
    .replace(/^https?:\/\//, "")
    .replace(/^ssh:\/\//, "")
    .replace(":", "/")
    .replace(/\.git$/, "")
    .replace(/\/$/, "")
    .toLowerCase();
}
