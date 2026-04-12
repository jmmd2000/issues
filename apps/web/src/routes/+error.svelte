<!-- Root level error page -->
<script lang="ts">
  import { page } from "$app/state";
  import { resolve } from "$app/paths";
</script>

<div class="error">
  <h1>{page.status}</h1>
  <p>{page.error?.message ?? "Something went wrong"}</p>
  <a href={resolve("/")}>Go home</a>
</div>

<style>
  .error {
    max-width: 32rem;
    margin: 4rem auto;
    padding: 2rem;
    text-align: center;
  }

  h1 {
    font-size: 4rem;
    margin: 0 0 0.5rem;
  }

  p {
    color: #666;
    margin: 0 0 1.5rem;
  }

  a {
    color: inherit;
  }
</style>
