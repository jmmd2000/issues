const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

/** The name endings of databases a command may wipe: dev, test and end-to-end test. */
export const WIPEABLE_DATABASE_SUFFIXES = ["_dev", "_test", "_test_e2e"] as const;

function describeSuffixes(suffixes: readonly string[]): string {
  if (suffixes.length === 1) return suffixes[0];
  return `${suffixes.slice(0, -1).join(", ")} or ${suffixes[suffixes.length - 1]}`;
}

/**
 * Throws unless the database is on this machine and its name ends in one of
 * the allowed suffixes. Call it before anything that deletes data.
 * @param databaseURL The connection string of the database to wipe
 * @param allowedSuffixes The name endings to accept
 * @throws Error naming the rule that failed
 */
export function assertWipeableDatabase(databaseURL: string, allowedSuffixes: readonly string[] = WIPEABLE_DATABASE_SUFFIXES): void {
  const url = new URL(databaseURL);
  const databaseName = url.pathname.slice(1);

  if (!LOCAL_HOSTS.includes(url.hostname)) {
    throw new Error(`Refusing to wipe "${databaseName}": host "${url.hostname}" is not local`);
  }

  if (!allowedSuffixes.some(suffix => databaseName.endsWith(suffix))) {
    throw new Error(`Refusing to wipe "${databaseName}": the name must end in ${describeSuffixes(allowedSuffixes)}`);
  }
}
