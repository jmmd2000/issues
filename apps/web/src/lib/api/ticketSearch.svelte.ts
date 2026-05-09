import type { Ticket } from "@issues/api";
import { client } from "./client";

interface TicketSearchInputs<T> {
  projectKey: () => string;
  query: () => string;
  enabled?: () => boolean;
  includeClosed?: () => boolean;
  excludeNumbers?: () => readonly number[];
  mapper: (ticket: Ticket) => T;
}

export function createTicketSearch<T>(inputs: TicketSearchInputs<T>) {
  let results = $state<T[]>([]);
  let loading = $state(false);

  $effect(() => {
    const enabled = inputs.enabled ? inputs.enabled() : true;
    if (!enabled) {
      results = [];
      loading = false;
      return;
    }

    const term = inputs.query().trim();
    if (term.length < 2) {
      results = [];
      loading = false;
      return;
    }

    const projectKey = inputs.projectKey();
    const includeClosed = inputs.includeClosed?.() ?? false;
    const exclude = inputs.excludeNumbers?.() ?? [];

    let cancelled = false;
    loading = true;

    const timer = setTimeout(async () => {
      try {
        const res = await client.api.projects[":key"].tickets.$get({
          param: { key: projectKey },
          query: { titleSearch: term, perPage: "8", includeClosed: includeClosed ? "true" : "false" },
        });
        if (cancelled) return;
        if (!res.ok) {
          results = [];
          return;
        }
        const body = await res.json();
        if (cancelled) return;
        results = body.tickets.filter((ticket) => !exclude.includes(ticket.number)).map(inputs.mapper);
      } finally {
        if (!cancelled) loading = false;
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });

  return {
    get results() {
      return results;
    },
    get loading() {
      return loading;
    },
    reset() {
      results = [];
      loading = false;
    },
  };
}
