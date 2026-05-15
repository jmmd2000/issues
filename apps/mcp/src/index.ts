#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { IssuesClient } from "./client.js";
import { loadEnv } from "./env.js";
import { registerAllTools } from "./tools/index.js";

async function main() {
  const { apiURL, apiToken } = loadEnv();
  const client = new IssuesClient(apiURL, apiToken);

  const server = new McpServer({ name: "issues", version: "0.0.1" });
  registerAllTools(server, client);

  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  process.stderr.write(`@issues/mcp: fatal error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
