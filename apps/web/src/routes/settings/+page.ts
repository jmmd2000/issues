// Load function for the per-user account settings page
import type { PageLoad } from "./$types";
import { requireAuth } from "$lib/auth";
import { createClient } from "$lib/api/client";
import type { ApiToken, ServiceUser } from "@issues/api";

export const load: PageLoad = async ({ parent, url, fetch }) => {
  const { user } = await parent();
  requireAuth(user, url);

  const api = createClient(fetch);

  const tokensRes = await api.api.auth.tokens.$get();
  const tokensData = tokensRes.ok ? ((await tokensRes.json()) as { apiTokens: ApiToken[] }) : { apiTokens: [] };

  const serviceRes = await api.api.users.service.$get();
  const canManageServiceUsers = serviceRes.ok;
  const serviceData = canManageServiceUsers ? ((await serviceRes.json()) as { serviceUsers: ServiceUser[] }) : { serviceUsers: [] };

  return { user, apiTokens: tokensData.apiTokens, canManageServiceUsers, serviceUsers: serviceData.serviceUsers };
};
