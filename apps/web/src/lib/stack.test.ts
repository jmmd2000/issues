import { describe, it, expect } from "vitest";
import { addStackItem, getStackItems } from "./stack";

describe("getStackItems", () => {
  it("splits on commas and trims each item", () => {
    expect(getStackItems(" SvelteKit , Hono,, PostgreSQL ")).toEqual(["SvelteKit", "Hono", "PostgreSQL"]);
  });
});

describe("addStackItem", () => {
  it("adds a trimmed item to the end without changing the list it was given", () => {
    const items = ["Hono"];

    expect(addStackItem(items, "  Zod ")).toEqual(["Hono", "Zod"]);
    expect(items).toEqual(["Hono"]);
  });

  it("ignores an empty entry and a repeat, whatever its case", () => {
    expect(addStackItem(["Hono"], "   ")).toEqual(["Hono"]);
    expect(addStackItem(["Hono"], "hono")).toEqual(["Hono"]);
  });
});
