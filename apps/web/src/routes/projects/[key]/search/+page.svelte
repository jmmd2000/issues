<script lang="ts">
  import type { PageProps } from "./$types";
  import SearchPage from "$lib/components/search/SearchPage.svelte";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>{data.lockedProjectKey} search · Issues</title>
</svelte:head>

<SearchPage search={data.search} lockedProjectKey={data.lockedProjectKey} />
