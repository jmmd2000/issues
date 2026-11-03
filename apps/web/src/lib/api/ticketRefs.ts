import { TICKET_REF_LOOKUP_MAX } from "@issues/shared";
import { createClient } from "./client";

/**
 * Asks the API which ticket refs name a ticket the viewer can see.
 * @param refs The refs to check, such as `DASH-12`. Refs past the lookup limit are not checked.
 * @returns The refs that exist. It is empty when the request fails, so nothing links to a ticket that may not exist.
 */
export async function findVisibleTicketRefs(refs: string[]): Promise<Set<string>> {
  try {
    const res = await createClient().api["ticket-refs"].$post({ json: { refs: refs.slice(0, TICKET_REF_LOOKUP_MAX) } });
    if (!res.ok) return new Set();
    const body = await res.json();
    return new Set(body.refs);
  } catch {
    return new Set();
  }
}
