import { error } from "@sveltejs/kit";
import { loadSearchPageResult } from "$lib/api/search";
import type { PageLoad } from "./$types";

function searchLoadError(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Failed to load project search.";
}

export const load: PageLoad = async ({ fetch, params, url }) => {
  const lockedProjectKey = params.key.toUpperCase();

  try {
    return {
      lockedProjectKey,
      search: await loadSearchPageResult({ fetch, url, lockedProjectKey }),
    };
  } catch (cause) {
    error(500, searchLoadError(cause));
  }
};
