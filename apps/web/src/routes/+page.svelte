<script lang="ts">
  import { client } from "$lib/api/client";

  let health: { status: string; timestamp: string } | null = $state(null);
  let error: string | null = $state(null);

  async function checkHealth() {
    try {
      const res = await client.api.health.$get();
      health = await res.json();
    } catch {
      error = "Failed to connect to API";
    }
  }

  $effect(() => {
    checkHealth();
  });
</script>

<h1>Issues</h1>

{#if health}
  <p>API status: <strong>{health.status}</strong></p>
  <p>Server time: {health.timestamp}</p>
{:else if error}
  <p style="color: red;">{error}</p>
{:else}
  <p>Connecting to API...</p>
{/if}
