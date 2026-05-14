<script lang="ts">
  import type { PageProps } from "./$types";
  import SearchPage from "$lib/components/search/SearchPage.svelte";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Search · Issues</title>
</svelte:head>

<SearchPage search={data.search} />
