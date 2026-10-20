import { sql } from "drizzle-orm";
import { db } from "../db";
import { getEnv } from "../lib/env";
import { getInstalledVersion } from "../lib/installedVersion";
import type { BuildInfo } from "../lib/types";

const PACKAGE_NAMES = ["hono", "drizzle-orm", "pg", "zod"] as const;

export class BuildService {
  /**
   * Reports what this API is running on. The commit and build time are set
   * when the image is built. The Node, Postgres and package versions are read
   * from the running process.
   * @returns The API build info
   */
  static async getBuildInfo(): Promise<BuildInfo> {
    const { GIT_SHA, BUILT_AT } = getEnv();

    return {
      gitSha: GIT_SHA,
      builtAt: BUILT_AT ?? null,
      nodeVersion: process.versions.node,
      postgresVersion: await BuildService.getPostgresVersion(),
      packages: PACKAGE_NAMES.map(name => ({ name, version: getInstalledVersion(name) })),
    };
  }

  /**
   * Reads the version number from the database server, without the distribution suffix.
   * @returns The version, such as `16.4`, or `null` if the server does not report one
   */
  private static async getPostgresVersion(): Promise<string | null> {
    const result = await db.execute(sql`select current_setting('server_version') as version`);
    const version = result.rows[0]?.version;
    if (typeof version !== "string") return null;
    return version.split(" ")[0];
  }
}
