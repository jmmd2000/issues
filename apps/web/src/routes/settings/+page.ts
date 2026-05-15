// Load function for the per-user account settings page
import type { PageLoad } from "./$types";
import { requireAuth } from "$lib/auth";
import { createClient } from "$lib/api/client";
import type { ApiToken } from "@issues/api";

export const load: PageLoad = async ({ parent, url, fetch }) => {
  const { user } = await parent();
  requireAuth(user, url);

  const tokensRes = await createClient(fetch).api.auth.tokens.$get();
  const tokensData = tokensRes.ok ? ((await tokensRes.json()) as { apiTokens: ApiToken[] }) : { apiTokens: [] };

  return { user, apiTokens: tokensData.apiTokens };
};
