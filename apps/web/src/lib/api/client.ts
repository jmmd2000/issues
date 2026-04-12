import { hc } from "hono/client";
import type { AppType } from "@issues/api";
import { PUBLIC_API_URL } from "$env/static/public";

export const createClient = (fetch?: typeof globalThis.fetch) => hc<AppType>(PUBLIC_API_URL, { init: { credentials: "include" }, fetch });

export const client = createClient();
