<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<h1>Issues</h1>

<p>API status: <strong>{data.healthStatus.status}</strong></p>
<p>Server time: {data.healthStatus.timestamp}</p>
