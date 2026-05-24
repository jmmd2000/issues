import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { HTTPException } from "hono/http-exception";
import app from "../index";

const THROW_PATH = "/api/__test__/throw";
const HTTP_THROW_PATH = "/api/__test__/throw-http";

beforeAll(() => {
  app.get(THROW_PATH, () => {
    throw new Error("boom");
  });
  app.get(HTTP_THROW_PATH, () => {
    throw new HTTPException(418, { message: "teapot" });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("app.onError", () => {
  it("logs unhandled exceptions to stderr with path and method", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await app.request(THROW_PATH);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ message: "Internal server error" });

    expect(spy).toHaveBeenCalledTimes(1);
    const [label, err, context] = spy.mock.calls[0];
    expect(label).toBe("Unhandled error:");
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe("boom");
    expect(context).toEqual({ path: THROW_PATH, method: "GET" });
  });

  it("does not log HTTPException", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await app.request(HTTP_THROW_PATH);
    expect(res.status).toBe(418);
    expect(await res.json()).toEqual({ message: "teapot" });

    expect(spy).not.toHaveBeenCalled();
  });
});
