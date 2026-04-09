<script lang="ts">
  import { guardRoute, getUser, isLoaded } from "$lib/stores/user.svelte";
  guardRoute();
  let user = $derived(getUser());
  let loaded = $derived(isLoaded());
</script>

{#if !loaded}
  <p>Loading...</p>
{:else if user}
  <h1>Protected Page</h1>
  <p>Welcome, {user.name}!</p>
{/if}
