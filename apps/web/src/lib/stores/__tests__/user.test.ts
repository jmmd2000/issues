import { client } from "$lib/api/client";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getUser, isLoaded, fetchUser, login, logout } from "$lib/stores/user.svelte";

vi.mock("$lib/api/client", () => ({
  client: {
    api: {
      auth: {
        me: { $get: vi.fn() },
        login: { $post: vi.fn() },
        logout: { $post: vi.fn() },
      },
    },
  },
}));

const mockGet = client.api.auth.me.$get as ReturnType<typeof vi.fn>;
const mockLoginPost = client.api.auth.login.$post as ReturnType<typeof vi.fn>;
const mockLogoutPost = client.api.auth.logout.$post as ReturnType<typeof vi.fn>;

function mockRes(data: unknown, ok = true) {
  return { ok, json: async () => data };
}

const fakeUser = { name: "James", email: "j@example.com", avatarURL: null, createdAt: "2026-01-01" };

describe("user store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetchUser sets user on success", async () => {
    mockGet.mockResolvedValue(mockRes({ user: fakeUser }));

    await fetchUser();
    expect(getUser()?.name).toBe("James");
    expect(isLoaded()).toBe(true);
  });

  it("fetchUser sets null on error response", async () => {
    mockGet.mockResolvedValue(mockRes(undefined, false));

    await fetchUser();
    expect(getUser()).toBeNull();
    expect(isLoaded()).toBe(true);
  });

  it("fetchUser sets null on network error", async () => {
    mockGet.mockRejectedValue(new Error("network"));

    await fetchUser();
    expect(getUser()).toBeNull();
    expect(isLoaded()).toBe(true);
  });

  it("login calls fetchUser on success", async () => {
    mockLoginPost.mockResolvedValue(mockRes({}));
    mockGet.mockResolvedValue(mockRes({ user: fakeUser }));

    await login("j@example.com", "pass");
    expect(getUser()?.name).toBe("James");
  });

  it("login throws on bad credentials", async () => {
    mockLoginPost.mockResolvedValue(mockRes({ message: "Invalid credentials." }, false));

    await expect(login("bad@example.com", "wrong")).rejects.toThrow("Invalid credentials.");
  });

  it("logout clears user", async () => {
    mockLogoutPost.mockResolvedValue(mockRes({ success: true }));

    await logout();
    expect(getUser()).toBeNull();
  });
});
