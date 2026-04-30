import DOMPurify from "isomorphic-dompurify";
import { marked } from "marked";

// Matches ticket refs like `PROJ-123`. Project key: 2–6 uppercase letters, `\b` avoids matching inside words.
const TICKET_REF_RE = /\b([A-Z]{2,6})-(\d+)\b/g;
const SKIP_TAGS = new Set(["A", "CODE", "PRE"]);

marked.setOptions({
  gfm: true,
  breaks: true,
});

// Parse markdown -> HTML, then sanitise so DOMPurify strips anything dangerous before it hits {@html}.
export function renderMarkdown(source: string): string {
  const html = marked.parse(source ?? "", { async: false });
  // ensure html is a string, not promise<string>
  return DOMPurify.sanitize(html);
}

// Render then strip every tag to produce a single-line plaintext summary (e.g. list previews)
// Collapses any run of whitespace (spaces, tabs, newlines) to a single space, then truncates at word boundary.
export function stripMarkdown(source: string, max = 200): string {
  const plain = DOMPurify.sanitize(renderMarkdown(source), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).replace(/\s+/g, " ").trim();

  if (plain.length <= max) return plain;
  const slice = plain.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  const truncated = lastSpace > 0 ? slice.slice(0, lastSpace).trim() : slice.trim();
  return `${truncated}...`;
}

// Deduped list of `PROJ-123` refs found in the source — useful for persisting ticket_links on save.
export function extractTicketRefs(source: string): Array<{ projectKey: string; number: number }> {
  const seen = new Set<string>();
  const refs: Array<{ projectKey: string; number: number }> = [];

  for (const match of source.matchAll(TICKET_REF_RE)) {
    const projectKey = match[1];
    const number = Number(match[2]);
    const key = `${projectKey}-${number}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ projectKey, number });
  }

  return refs;
}

// Walks rendered markdown and turns bare `PROJ-123` occurrences into anchor tags.
// Done as a post-process (rather than in marked) so it works on text that was already sanitised.
export function decorateTicketRefs(root: HTMLElement) {
  // collect matching text nodes, can't mutate while the walker is live
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement;
    if (!parent || SKIP_TAGS.has(parent.tagName)) continue;
    if (!node.nodeValue?.match(TICKET_REF_RE)) continue;
    textNodes.push(node);
  }

  // rebuild each text node as a fragment of [text, <a>, text, <a>, ...] and swap it in
  for (const node of textNodes) {
    const fragment = document.createDocumentFragment();
    const text = node.nodeValue ?? "";
    let lastIndex = 0;

    for (const match of text.matchAll(TICKET_REF_RE)) {
      const full = match[0];
      const projectKey = match[1];
      const number = match[2];
      const index = match.index ?? 0;

      fragment.append(text.slice(lastIndex, index));

      const anchor = document.createElement("a");
      anchor.href = `/projects/${projectKey}/tickets/${number}`;
      anchor.textContent = full;
      fragment.append(anchor);

      lastIndex = index + full.length;
    }

    fragment.append(text.slice(lastIndex));
    node.parentNode?.replaceChild(fragment, node);
  }
}
