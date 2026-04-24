<script lang="ts">
  import { Check, ChevronDown, UserRound } from "@lucide/svelte";
  import type { ProjectMember } from "@issues/api";

  let {
    members,
    currentUserID,
    value = $bindable<string | undefined>(undefined),
  }: {
    members: ProjectMember[];
    currentUserID?: string;
    value?: string;
  } = $props();

  let open = $state(false);
  let query = $state("");
  let searchInput: HTMLInputElement | null = $state(null);

  // Current user uses "Assign to me" - filter from the member list to avoid duplicate row
  const otherMembers = $derived(currentUserID ? members.filter((member) => member.userID !== currentUserID) : members);

  const filtered = $derived.by(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return otherMembers;
    return otherMembers.filter((member) => member.user.name.toLowerCase().includes(needle));
  });

  const selectedName = $derived(value ? (members.find((member) => member.userID === value)?.user.name ?? null) : null);

  $effect(() => {
    if (open) queueMicrotask(() => searchInput?.focus());
  });

  function select(next: string | undefined) {
    value = next;
    open = false;
    query = "";
  }

  function handleOutside(event: MouseEvent) {
    if (!open) return;
    const target = event.target as HTMLElement;
    if (!target.closest(".assignee-picker")) open = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (open && event.key === "Escape") open = false;
  }
</script>

<svelte:window onclick={handleOutside} onkeydown={handleKeydown} />

<div class="input-row">
  <span class="form-label">Assignee</span>

  <div class="assignee-picker">
    <button type="button" class="trigger" onclick={() => (open = !open)} aria-expanded={open} aria-haspopup="listbox">
      <UserRound size={14} strokeWidth={2} />
      <span class="trigger-label">{selectedName ?? "Unassigned"}</span>
      <ChevronDown size={14} strokeWidth={2} class="chevron" />
    </button>

    {#if open}
      <div class="menu" role="listbox" aria-label="Project members">
        <input bind:this={searchInput} class="search" type="text" placeholder="Search members..." bind:value={query} />

        <button type="button" class="option" role="option" aria-selected={value === undefined} onclick={() => select(undefined)}>
          <span class="check"
            >{#if value === undefined}<Check size={12} strokeWidth={3} />{/if}</span
          >
          <span>Unassigned</span>
        </button>

        {#if currentUserID}
          <button type="button" class="option" role="option" aria-selected={value === currentUserID} onclick={() => select(currentUserID)}>
            <span class="check"
              >{#if value === currentUserID}<Check size={12} strokeWidth={3} />{/if}</span
            >
            <span>Assign to me</span>
          </button>
        {/if}

        <div class="divider"></div>

        {#each filtered as member (member.userID)}
          <button type="button" class="option" role="option" aria-selected={value === member.userID} onclick={() => select(member.userID)}>
            <span class="check"
              >{#if value === member.userID}<Check size={12} strokeWidth={3} />{/if}</span
            >
            <span>{member.user.name}</span>
          </button>
        {:else}
          <p class="empty">No members match.</p>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .assignee-picker {
    position: relative;
    display: inline-block;
    width: fit-content;
    max-width: 100%;
  }

  .trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.5em;
    padding: 0.45em 0.7em;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg);
    color: var(--colour-text);
    font: inherit;
    font-size: 0.85em;
    cursor: pointer;
  }

  .trigger:hover {
    background: var(--colour-bg-hover);
  }

  .trigger-label {
    color: var(--colour-text);
  }

  .trigger :global(.chevron) {
    color: var(--colour-text-secondary);
    margin-left: 0.15em;
  }

  .menu {
    position: absolute;
    top: calc(100% + 0.35em);
    left: 0;
    min-width: 14em;
    max-width: 20em;
    background: var(--colour-bg-lighter);
    border: var(--border);
    border-radius: var(--border-radius-inner);
    box-shadow: var(--box-shadow);
    padding: 0.3em;
    display: flex;
    flex-direction: column;
    gap: 0.15em;
    z-index: 20;
  }

  .search {
    width: 100%;
    padding: 0.4em 0.55em;
    margin-bottom: 0.2em;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg);
    color: var(--colour-text);
    font: inherit;
    font-size: 0.8em;
    outline: none;
  }

  .search::placeholder {
    color: var(--colour-muted);
  }

  .option {
    display: flex;
    align-items: center;
    gap: 0.5em;
    padding: 0.45em 0.5em;
    border: none;
    border-radius: var(--border-radius-inner);
    background: none;
    color: var(--colour-text);
    font: inherit;
    font-size: 0.8em;
    text-align: left;
    cursor: pointer;
  }

  .option:hover {
    background: var(--colour-bg-hover);
  }

  .option[aria-selected="true"] {
    color: var(--accent-base);
    font-weight: 600;
  }

  .check {
    width: 0.9em;
    height: 0.9em;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-base);
    flex-shrink: 0;
  }

  .divider {
    height: 1px;
    background: var(--colour-border, var(--border));
    margin: 0.2em 0;
  }

  .empty {
    margin: 0;
    padding: 0.45em 0.5em;
    color: var(--colour-muted);
    font-size: 0.8em;
  }
</style>
