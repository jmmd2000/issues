<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<h1>Protected Page</h1>
<p>Welcome, {data.user.name}!</p>
