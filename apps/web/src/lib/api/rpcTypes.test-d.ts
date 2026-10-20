import { expectTypeOf } from "vitest";
import { hc } from "hono/client";
import type { AppType, CurrentUser, ProjectDetail, TicketDetail } from "@issues/api";

/**
 * Compile-time checks for the API client types. Nothing here runs. The type
 * check fails when a route chain breaks and a response type becomes `unknown`.
 */
const rpcClient = hc<AppType>("");

export async function checkTicketDetailType() {
  const response = await rpcClient.api.projects[":key"].tickets[":num"].$get({ param: { key: "TEST", num: "1" } });
  if (!response.ok) return;
  expectTypeOf(await response.json()).toExtend<{ ticket: TicketDetail }>();
}

export async function checkCurrentUserType() {
  const response = await rpcClient.api.auth.me.$get();
  if (!response.ok) return;
  expectTypeOf(await response.json()).toExtend<{ user: CurrentUser }>();
}

export async function checkProjectDetailType() {
  const response = await rpcClient.api.projects[":key"].$get({ param: { key: "TEST" } });
  if (!response.ok) return;
  expectTypeOf(await response.json()).toExtend<{ project: ProjectDetail }>();
}
