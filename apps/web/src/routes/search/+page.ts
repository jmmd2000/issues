import { error } from "@sveltejs/kit";
import { loadSearchPageResult } from "$lib/api/search";
import type { PageLoad } from "./$types";

function searchLoadError(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Failed to load search.";
}

export const load: PageLoad = async ({ fetch, url }) => {
  try {
    return { search: await loadSearchPageResult({ fetch, url }) };
  } catch (cause) {
    error(500, searchLoadError(cause));
  }
};
