<script lang="ts">
  import { onMount } from "svelte";
  import { resolve } from "$app/paths";
  import { MoveLeft } from "@lucide/svelte";

  let { sections }: { sections: { id: string; label: string }[] } = $props();

  /** A section counts as in view once its top passes this distance from the top of the window. */
  const VIEW_OFFSET = 140;

  let current = $state<string | null>(null);
  /** The section the person chose. A short page cannot always scroll it to the top, so it stays marked while it is in view. */
  let pinned: string | null = null;

  const activeID = $derived(current ?? sections[0]?.id);

  function isInView(id: string) {
    const rect = document.getElementById(id)?.getBoundingClientRect();
    return !!rect && rect.top < window.innerHeight * 0.75 && rect.bottom > 0;
  }

  function pin(id: string | null) {
    pinned = id;
    if (id) current = id;
  }

  function updateCurrent() {
    if (pinned) {
      current = pinned;
      return;
    }

    const scrolledToBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    if (scrolledToBottom) {
      current = sections[sections.length - 1]?.id ?? null;
      return;
    }

    let inView = sections[0]?.id ?? null;
    for (const section of sections) {
      const element = document.getElementById(section.id);
      if (element && element.getBoundingClientRect().top <= VIEW_OFFSET) inView = section.id;
    }
    current = inView;
  }

  function handleScrollEnd() {
    if (pinned && !isInView(pinned)) pinned = null;
    updateCurrent();
  }

  onMount(() => {
    const hashID = location.hash.slice(1);
    if (sections.some(section => section.id === hashID)) pin(hashID);
  });
</script>

<svelte:window onscroll={updateCurrent} onscrollend={handleScrollEnd} onresize={updateCurrent} onwheel={() => pin(null)} ontouchmove={() => pin(null)} onkeydown={() => pin(null)} />

<nav class="settings-nav" aria-label="Settings sections">
  <a class="back" href={resolve("/")}><MoveLeft size={14} strokeWidth={2} /> Projects</a>
  {#each sections as section (section.id)}
    <a class="link" href="#{section.id}" onclick={() => pin(section.id)} aria-current={activeID === section.id ? "true" : undefined}>{section.label}</a>
  {/each}
</nav>

<style>
  .settings-nav {
    position: sticky;
    top: 1rem;
    align-self: start;
    display: grid;
    gap: 0.125rem;
  }

  .back {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    margin-bottom: 1rem;
    color: var(--colour-muted);
    font-size: 0.8125rem;
    text-decoration: none;

    &:hover {
      color: var(--colour-text);
    }
  }

  .link {
    padding: 0.375rem 0.625rem;
    border-radius: var(--border-radius-inner);
    color: var(--colour-text-secondary);
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    white-space: nowrap;

    &:hover {
      background: var(--colour-bg-hover);
      color: var(--colour-text);
    }

    &[aria-current="true"] {
      background: var(--accent-tint-900);
      color: var(--colour-text);
      font-weight: 600;
    }
  }

  @media (max-width: 46rem) {
    .settings-nav {
      position: static;
      display: flex;
      gap: 0.25rem;
      overflow-x: auto;
    }

    .back {
      display: none;
    }
  }
</style>
