import { describe, it, expect } from "vitest";
import { renderMarkdown } from "./markdown";

function bodyText(html: string): string {
  const match = html.match(/<pre class="code-block__body"><code[^>]*>([\s\S]*?)<\/code><\/pre>/);
  if (!match) return "";
  return match[1]
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

describe("renderMarkdown — fenced code blocks", () => {
  it("falls back to plaintext when the language is unknown", () => {
    const html = renderMarkdown("```\njust some text\n```");
    expect(html).toMatch(/class="code-block__lang">plaintext</);
  });

  it("renders the source verbatim in the body so the copy handler can read it", () => {
    const html = renderMarkdown("```js\nfoo()\n```");
    expect(bodyText(html)).toBe("foo()");
  });

  it("preserves special characters in the rendered body", () => {
    const source = "const tag = `<div>&` + 'x';";
    const html = renderMarkdown("```js\n" + source + "\n```");
    expect(bodyText(html)).toBe(source);
  });

  it("does not break inline code rendering", () => {
    const html = renderMarkdown("Run `npm test` to start.");
    expect(html).toContain("<code>npm test</code>");
    expect(html).not.toContain("code-block");
  });
});
