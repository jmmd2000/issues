import { hc } from "hono/client";
import type { AppType } from "@issues/api";

export const client = hc<AppType>("/", {
  init: { credentials: "include" },
});
