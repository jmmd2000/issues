<script lang="ts">
  import Popover from "$lib/components/ui/Popover.svelte";

  let { items = ["One", "Two", "Three"] }: { items?: string[] } = $props();

  let open = $state(false);
</script>

<Popover bind:open menuRole="menu" menuLabel="Test menu">
  {#snippet trigger({ toggle })}
    <button type="button" onclick={toggle}>Open menu</button>
  {/snippet}
  {#snippet menu()}
    {#each items as item (item)}
      <button type="button" role="menuitem">{item}</button>
    {/each}
  {/snippet}
</Popover>
<button type="button">After</button>
