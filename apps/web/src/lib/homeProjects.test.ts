import { describe, it, expect } from "vitest";
import { makeHomeProject, makeLockedProject } from "$lib/test-utils/fixtures";
import { filterProjects, sortProjects } from "./homeProjects";

const docs = makeHomeProject({
  id: "1",
  key: "DOCS",
  name: "Contributor Docs",
  description: "A documentation refresh",
  stack: ["Markdown", "SvelteKit"],
  openCount: 80,
  lastActivityAt: "2026-10-20T10:00:00.000Z",
});
const dash = makeHomeProject({ id: "2", key: "DASH", name: "dashboard Rewrite", description: "Modern tooling", stack: ["React"], openCount: 80, lastActivityAt: "2026-10-20T12:00:00.000Z" });
const idle = makeHomeProject({ id: "3", key: "IDLE", name: "Idle project", description: "", stack: [], openCount: 3, lastActivityAt: null });
const locked = makeLockedProject({ id: "4", key: "OPS", name: "Release Infrastructure", description: "Deployment and backups", openCount: 81 });
const projects = [docs, dash, idle, locked];

describe("filterProjects", () => {
  it("returns every project for an empty or blank filter", () => {
    expect(filterProjects(projects, "")).toEqual(projects);
    expect(filterProjects(projects, "   ")).toEqual(projects);
  });

  it("matches the key, name, description and stack, ignoring case", () => {
    expect(filterProjects(projects, "dash")).toEqual([dash]);
    expect(filterProjects(projects, "DOCUMENTATION")).toEqual([docs]);
    expect(filterProjects(projects, "sveltekit")).toEqual([docs]);
    expect(filterProjects(projects, "  idle ")).toEqual([idle]);
  });

  it("matches a locked project on its key, name and description only", () => {
    expect(filterProjects(projects, "backups")).toEqual([locked]);
    expect(filterProjects(projects, "react")).toEqual([dash]);
  });

  it("returns nothing when no project matches", () => {
    expect(filterProjects(projects, "zzz")).toEqual([]);
  });
});

describe("sortProjects", () => {
  it("puts the latest activity first, and projects with no activity last in name order", () => {
    expect(sortProjects([idle, docs, locked, dash], "recent")).toEqual([dash, docs, idle, locked]);
  });

  it("sorts by name from A to Z, ignoring case", () => {
    expect(sortProjects(projects, "name")).toEqual([docs, dash, idle, locked]);
  });

  it("puts the most open tickets first and breaks ties by name", () => {
    expect(sortProjects(projects, "open")).toEqual([locked, docs, dash, idle]);
  });

  it("does not change the list it is given", () => {
    const original = [idle, dash];
    sortProjects(original, "name");
    expect(original).toEqual([idle, dash]);
  });
});
