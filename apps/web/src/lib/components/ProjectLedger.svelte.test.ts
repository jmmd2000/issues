import { describe, it, expect } from "vitest";
import { render } from "vitest-browser-svelte";
import { userEvent } from "vitest/browser";
import { makeHomeProject, makeLockedProject } from "$lib/test-utils/fixtures";
import ProjectLedger from "./ProjectLedger.svelte";

const projects = [makeHomeProject({ id: "1", key: "DOCS", name: "Contributor Docs" }), makeLockedProject({ id: "2", key: "OPS", name: "Release Infrastructure" })];

describe("ProjectLedger", () => {
  it("focuses the filter when the slash key is pressed", async () => {
    const screen = await render(ProjectLedger, { projects });
    await userEvent.keyboard("/");
    await expect.element(screen.getByRole("searchbox", { name: "Filter projects" })).toHaveFocus();
  });

  it("keeps a slash typed into the filter as text", async () => {
    const screen = await render(ProjectLedger, { projects });
    const filter = screen.getByRole("searchbox", { name: "Filter projects" });
    await filter.click();
    await userEvent.keyboard("a/b");
    await expect.element(filter).toHaveValue("a/b");
  });

  it("shows a locked project as a row that does not open", async () => {
    const screen = await render(ProjectLedger, { projects });
    await expect.element(screen.getByRole("link", { name: /Contributor Docs/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Release Infrastructure/ }).elements()).toHaveLength(0);
    await expect.element(screen.getByText("Release Infrastructure")).toBeInTheDocument();
  });
});
