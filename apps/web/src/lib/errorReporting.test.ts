import { describe, expect, it } from "vitest";
import { cleanBreadcrumb, reduceRequest } from "./errorReporting";

describe("reduceRequest", () => {
  it("keeps the address without query or fragment, and the User-Agent only", () => {
    const request = reduceRequest({
      url: "https://issues.example.com/search?q=secret#results",
      headers: { "User-Agent": "TestBrowser/1.0", Referer: "https://issues.example.com/?token=secret", Cookie: "session=secret" },
      cookies: { session: "secret" },
      data: { password: "secret" },
      query_string: "q=secret",
    });

    expect(request).toEqual({ url: "https://issues.example.com/search", headers: { "User-Agent": "TestBrowser/1.0" } });
  });

  it("drops a request that has no address", () => {
    expect(reduceRequest({ headers: { "User-Agent": "TestBrowser/1.0" } })).toBeUndefined();
    expect(reduceRequest(undefined)).toBeUndefined();
  });
});

describe("cleanBreadcrumb", () => {
  it("drops typing breadcrumbs", () => {
    expect(cleanBreadcrumb({ category: "ui.input", message: "input#password" })).toBeNull();
  });

  it("cuts query strings and fragments off every address", () => {
    const breadcrumb = cleanBreadcrumb({
      category: "navigation",
      data: { from: "/search?q=secret", to: "/projects/ISSUE#top", url: "https://api.example.com/api/search?q=secret", status_code: 200 },
    });

    expect(breadcrumb?.data).toEqual({ from: "/search", to: "/projects/ISSUE", url: "https://api.example.com/api/search", status_code: 200 });
  });

  it("keeps a breadcrumb that has no data", () => {
    const breadcrumb = { category: "ui.click", message: "body > button.save" };

    expect(cleanBreadcrumb(breadcrumb)).toEqual(breadcrumb);
  });
});
