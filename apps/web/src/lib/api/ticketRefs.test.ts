import { afterEach, describe, expect, it, vi } from "vitest";
import { findVisibleTicketRefs } from "./ticketRefs";

describe("findVisibleTicketRefs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the refs the API found", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ refs: ["DASH-12"] })));

    expect(await findVisibleTicketRefs(["DASH-12", "UTF-8"])).toEqual(new Set(["DASH-12"]));
  });

  it("returns no refs when the API answers with an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ message: "Internal server error" }, { status: 500 })));

    expect(await findVisibleTicketRefs(["DASH-12"])).toEqual(new Set());
  });

  it("returns no refs when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    expect(await findVisibleTicketRefs(["DASH-12"])).toEqual(new Set());
  });
});
