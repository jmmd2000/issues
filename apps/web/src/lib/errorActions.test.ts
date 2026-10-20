import { describe, it, expect } from "vitest";
import { errorAction, hasSignedInUser } from "./errorActions";

describe("errorAction", () => {
  it("asks for a new sign in on a 401, signed in or not", () => {
    expect(errorAction(401, true)).toBe("sign-in-again");
    expect(errorAction(401, false)).toBe("sign-in-again");
  });

  it("offers sign in on a 403 or 404 only when nobody is signed in", () => {
    expect(errorAction(403, false)).toBe("sign-in");
    expect(errorAction(404, false)).toBe("sign-in");
    expect(errorAction(403, true)).toBe("none");
    expect(errorAction(404, true)).toBe("none");
  });

  it("offers a retry on a server error, signed in or not", () => {
    expect(errorAction(500, false)).toBe("retry");
    expect(errorAction(503, true)).toBe("retry");
  });

  it("offers nothing on other client errors", () => {
    expect(errorAction(400, false)).toBe("none");
    expect(errorAction(429, false)).toBe("none");
  });
});

describe("hasSignedInUser", () => {
  it("is true when the page data has a user", () => {
    expect(hasSignedInUser({ user: { id: "u-1" } })).toBe(true);
  });

  it("is false when the user is null or missing, or the data is not an object", () => {
    expect(hasSignedInUser({ user: null })).toBe(false);
    expect(hasSignedInUser({})).toBe(false);
    expect(hasSignedInUser(null)).toBe(false);
    expect(hasSignedInUser(undefined)).toBe(false);
    expect(hasSignedInUser("user")).toBe(false);
  });
});
