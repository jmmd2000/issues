import { describe, it, expect, beforeEach } from "vitest";
import app from "../index";
import { createAuthenticatedUser, createLinkTargets, createProject, createTicketInProject, resetDatabase } from "./helpers";

let cookies: string;
let projectID: string;

function lookUp(refs: string[], requestCookies?: string) {
  return app.request("/api/ticket-refs", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(requestCookies && { Cookie: requestCookies }) },
    body: JSON.stringify({ refs }),
  });
}

async function visibleRefs(refs: string[], requestCookies?: string): Promise<string[]> {
  const res = await lookUp(refs, requestCookies);
  expect(res.status).toBe(200);
  const body = await res.json();
  return body.refs;
}

describe("POST /api/ticket-refs", () => {
  beforeEach(async () => {
    await resetDatabase();
    ({ cookies } = await createAuthenticatedUser());
    ({ id: projectID } = await createProject(cookies));
    await createTicketInProject(cookies, "TEST", "A real ticket");
  });

  it("returns refs that exist and leaves out the rest", async () => {
    expect(await visibleRefs(["TEST-1", "TEST-999", "UTF-8"], cookies)).toEqual(["TEST-1"]);
  });

  it("answers an anonymous viewer for public tickets", async () => {
    expect(await visibleRefs(["TEST-1"])).toEqual(["TEST-1"]);
  });

  it("leaves out a deleted ticket", async () => {
    await app.request("/api/projects/TEST/tickets/1", { method: "DELETE", headers: { Cookie: cookies } });

    expect(await visibleRefs(["TEST-1"], cookies)).toEqual([]);
  });

  it("hides private tickets from viewers who cannot see them", async () => {
    const { viewerCookies } = await createLinkTargets(cookies, projectID);
    const refs = ["PRIV-1", "PUB-1", "PUB-2"];

    expect(await visibleRefs(refs, viewerCookies)).toEqual(["PUB-1"]);
    expect(await visibleRefs(refs)).toEqual(["PUB-1"]);
    expect((await visibleRefs(refs, cookies)).sort()).toEqual(refs);
  });

  it("treats a number too big for the database as not found", async () => {
    expect(await visibleRefs(["TEST-99999999999999"], cookies)).toEqual([]);
  });

  it("returns an empty list for no refs", async () => {
    expect(await visibleRefs([], cookies)).toEqual([]);
  });

  it("returns 400 for a value that is not a ticket ref", async () => {
    const res = await lookUp(["not-a-ref"], cookies);
    expect(res.status).toBe(400);
  });

  it("returns 400 for more refs than one lookup allows", async () => {
    const res = await lookUp(
      Array.from({ length: 101 }, (_, index) => `TEST-${index + 1}`),
      cookies
    );
    expect(res.status).toBe(400);
  });
});
