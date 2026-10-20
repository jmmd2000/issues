<script lang="ts">
  import type { BuildInfo } from "@issues/api";
  import FormMessage, { type FormMessage as FormMessageType } from "$lib/components/forms/FormMessage.svelte";
  import { commitsDiffer, formatBuiltAt, shortHash, webBuild } from "$lib/buildInfo";

  interface BuildRow {
    label: string;
    value: string;
  }

  let { apiBuild }: { apiBuild: BuildInfo | null } = $props();

  const webRows = $derived<BuildRow[]>([
    { label: "Commit", value: shortHash(webBuild.gitSha) },
    { label: "Built", value: formatBuiltAt(webBuild.builtAt) },
    ...webBuild.packages.map(item => ({ label: item.name, value: item.version })),
  ]);

  const apiRows = $derived<BuildRow[]>(
    apiBuild
      ? [
          { label: "Commit", value: shortHash(apiBuild.gitSha) },
          { label: "Built", value: formatBuiltAt(apiBuild.builtAt) },
          { label: "Node", value: apiBuild.nodeVersion },
          { label: "Postgres", value: apiBuild.postgresVersion ?? "Unknown" },
          ...apiBuild.packages.map(item => ({ label: item.name, value: item.version ?? "Unknown" })),
        ]
      : []
  );

  const message = $derived.by<FormMessageType | null>(() => {
    if (!apiBuild) return { type: "error", text: "The API build could not be loaded. Only the web build is shown." };
    if (commitsDiffer(webBuild.gitSha, apiBuild.gitSha)) return { type: "error", text: "The web app and the API were built from different commits." };
    return null;
  });
</script>

{#snippet buildCard(title: string, rows: BuildRow[])}
  <section class="build-card" aria-label={title}>
    <h3>{title}</h3>
    <dl>
      {#each rows as row (row.label)}
        <div class="build-row">
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      {/each}
    </dl>
  </section>
{/snippet}

<div class="build-info">
  <p class="site-version">Site version <code>{webBuild.siteVersion}</code></p>

  <FormMessage {message} />

  <div class="build-grid">
    {@render buildCard("Web", webRows)}
    {#if apiBuild}
      {@render buildCard("API", apiRows)}
    {/if}
  </div>
</div>

<style>
  .build-info {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .site-version {
    margin: 0;
    font-size: 0.9em;
    color: var(--colour-text-secondary);

    & code {
      font-family: var(--font-mono);
      color: var(--colour-text);
    }
  }

  .build-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    gap: 1rem;
  }

  .build-card {
    min-width: 0;
    padding: 1rem;
    background: var(--colour-bg-lighter);
    border: var(--border);
    border-radius: var(--border-radius-inner);

    & h3 {
      margin: 0 0 0.5rem;
      font-size: 0.75em;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--colour-muted);
    }

    & dl {
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
  }

  .build-row {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.85em;

    & dt {
      color: var(--colour-text-secondary);
    }

    & dd {
      margin: 0;
      min-width: 0;
      font-family: var(--font-mono);
      text-align: right;
      overflow-wrap: anywhere;
    }
  }
</style>
