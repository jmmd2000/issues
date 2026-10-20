import type { ProjectWithCount, PublicProject } from "@issues/api";

export type HomeProject = ProjectWithCount | PublicProject;
export type ProjectSort = "recent" | "name" | "open";

/** The technologies a project lists. A locked project shows none. */
export function projectStack(project: HomeProject): string[] {
  return "stack" in project ? project.stack : [];
}

/** Returns the projects whose key, name, description or stack contains the text, ignoring case. */
export function filterProjects(projects: HomeProject[], query: string): HomeProject[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return projects;
  return projects.filter(project => [project.key, project.name, project.description ?? "", ...projectStack(project)].some(text => text.toLowerCase().includes(needle)));
}

function byName(first: HomeProject, second: HomeProject) {
  return first.name.localeCompare(second.name, undefined, { sensitivity: "base" });
}

function activityTime(project: HomeProject) {
  return project.lastActivityAt ? Date.parse(project.lastActivityAt) : 0;
}

/**
 * Returns a sorted copy of the projects. Recent puts the latest activity first, and projects with no
 * activity come last. Open puts the most open tickets first. Ties are broken by name.
 */
export function sortProjects(projects: HomeProject[], sort: ProjectSort): HomeProject[] {
  const sorted = [...projects];
  if (sort === "name") return sorted.sort(byName);
  if (sort === "open") return sorted.sort((first, second) => second.openCount - first.openCount || byName(first, second));
  return sorted.sort((first, second) => activityTime(second) - activityTime(first) || byName(first, second));
}
