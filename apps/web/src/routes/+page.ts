// Load function for "/"
import { error } from "@sveltejs/kit";
import type { GlobalActivity, ProjectWithCount, PublicProject } from "@issues/api";
import { createClient } from "$lib/api/client";
import type { PageLoad } from "./$types";

export type HomeFeed = { events: GlobalActivity[]; error: false } | { events: null; error: true };

export const load: PageLoad = async ({ fetch, parent }) => {
  const { user } = await parent();
  const api = createClient(fetch);

  if (user) {
    const projectsPromise = api.api.projects["with-counts"].$get();
    const feedPromise = api.api.feed.$get({ query: { limit: "8" } }).catch(() => null);

    const projectsRes = await projectsPromise;
    if (!projectsRes.ok) error(projectsRes.status, "Failed to load projects");
    const { projects }: { projects: ProjectWithCount[] } = await projectsRes.json();

    const feedRes = await feedPromise;
    const feed: HomeFeed = feedRes && feedRes.ok ? { events: (await feedRes.json()).events, error: false } : { events: null, error: true };

    return { projects, feed, registrationOpen: false };
  }

  const [publicRes, regRes] = await Promise.all([api.api.projects.public.$get(), api.api.auth["registration-status"].$get()]);

  if (!publicRes.ok) error(publicRes.status, "Failed to load projects");
  const { projects }: { projects: PublicProject[] } = await publicRes.json();

  const registrationOpen = regRes.ok ? (await regRes.json()).open : false;

  return { projects, feed: null, registrationOpen };
};
