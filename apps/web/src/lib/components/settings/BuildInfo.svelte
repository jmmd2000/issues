<script lang="ts">
  import { Check, Copy, TriangleAlert } from "@lucide/svelte";
  import type { BuildInfo } from "@issues/api";
  import { apiBuildRows, buildDetailsText, buildStatement, webBuild, webBuildRows, type BuildRow } from "$lib/buildInfo";
  import { pushToast } from "$lib/stores/toast.svelte";
  import Button from "$lib/components/ui/Button.svelte";

  let { apiBuild }: { apiBuild: BuildInfo | null } = $props();

  const webRows = $derived(webBuildRows(webBuild));
  const apiRows = $derived(apiBuild ? apiBuildRows(apiBuild) : null);
  const statement = $derived(buildStatement(webBuild, apiBuild));

  async function copyDetails() {
    try {
      await navigator.clipboard.writeText(buildDetailsText(webBuild.siteVersion, webRows, apiRows));
      pushToast({ message: "Build details copied", kind: "success" });
    } catch {
      pushToast({ message: "The build details could not be copied", kind: "error" });
    }
  }
</script>

{#snippet buildColumn(title: string, rows: BuildRow[])}
  <section class="build-column" aria-label={title}>
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
  <div class="build-head">
    <p class="site-version">Site version <code>{webBuild.siteVersion}</code></p>
    <Button type="button" variant="secondary" size="sm" onclick={copyDetails}><Copy size={13} strokeWidth={2} /> Copy build details</Button>
  </div>

  <p class="statement" data-type={statement.type}>
    {#if statement.type === "success"}
      <Check size={14} strokeWidth={2.5} />
    {:else}
      <TriangleAlert size={14} strokeWidth={2.5} />
    {/if}
    {statement.text}
  </p>

  <div class="build-grid">
    {@render buildColumn("Web", webRows)}
    {#if apiRows}
      {@render buildColumn("API", apiRows)}
    {/if}
  </div>
</div>

<style>
  .build-info {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .build-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
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

  .statement {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0;
    font-size: 0.875rem;

    &[data-type="success"] {
      color: var(--colour-success);
    }

    &[data-type="error"] {
      color: var(--colour-error);
    }
  }

  .build-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    gap: 1.5rem;
  }

  .build-column {
    min-width: 0;

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
