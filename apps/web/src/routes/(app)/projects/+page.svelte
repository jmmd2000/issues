<script lang="ts">
  import ProjectList from "$lib/components/ProjectList.svelte";
  import type { Project } from "@issues/api";

  let { data }: { data: { projects: Project[] } } = $props();
</script>

<section class="container">
  {#if data.projects.length > 0}
    <ProjectList projects={data.projects} />
  {:else}
    <p>No projects found.</p>
  {/if}
</section>

<style>
  .container {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 2rem;
    min-height: calc(100vh - 9rem);
  }
</style>
