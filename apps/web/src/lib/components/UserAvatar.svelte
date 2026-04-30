<script lang="ts">
  let {
    name,
    avatarURL = null,
    size = "md",
  }: {
    name: string;
    avatarURL?: string | null;
    size?: "sm" | "md";
  } = $props();

  const initial = $derived(name.trim().slice(0, 1).toUpperCase() || "?");
</script>

{#if avatarURL}
  <img class="avatar {size}" src={avatarURL} alt={name} />
{:else}
  <span class="avatar fallback {size}" aria-label={name}>{initial}</span>
{/if}

<style>
  .avatar {
    display: inline-grid;
    place-items: center;
    flex: 0 0 auto;
    border-radius: 50%;
    object-fit: cover;
  }

  .sm {
    width: 1.35rem;
    height: 1.35rem;
    font-size: 0.65rem;
  }

  .md {
    width: 32px;
    height: 32px;
    font-size: 0.85rem;
  }

  .fallback {
    background-color: var(--accent-base);
    color: white;
    font-weight: 800;
  }
</style>
