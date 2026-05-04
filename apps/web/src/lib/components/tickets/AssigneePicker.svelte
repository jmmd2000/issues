<script lang="ts">
  import { Check, ChevronDown, LoaderCircle, UserRound } from "@lucide/svelte";
  import type { ProjectMember } from "@issues/api";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import Popover from "$lib/components/ui/Popover.svelte";

  let {
    members,
    currentUserID,
    value = $bindable<string | undefined>(undefined),
    onselect,
    disabled = false,
    loading = false,
    size = "md",
    ariaLabel = "Assignee",
  }: {
    members: ProjectMember[];
    currentUserID?: string;
    value?: string | undefined;
    onselect?: (value: string | undefined, previousValue: string | undefined) => void;
    disabled?: boolean;
    loading?: boolean;
    size?: "sm" | "md";
    ariaLabel?: string;
  } = $props();

  let open = $state(false);
  let query = $state("");
  let searchInput: HTMLInputElement | null = $state(null);

  const otherMembers = $derived(currentUserID ? members.filter((member) => member.userID !== currentUserID) : members);

  const filtered = $derived.by(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return otherMembers;
    return otherMembers.filter((member) => member.user.name.toLowerCase().includes(needle));
  });

  const selectedMember = $derived(value ? (members.find((member) => member.userID === value) ?? null) : null);
  const selectedName = $derived(selectedMember?.user.name ?? null);
  const currentUserMember = $derived(currentUserID ? (members.find((member) => member.userID === currentUserID) ?? null) : null);

  $effect(() => {
    if (open) queueMicrotask(() => searchInput?.focus());
    else query = "";
  });

  function select(next: string | undefined) {
    if (disabled) return;

    const previousValue = value;
    onselect?.(next, previousValue);
    value = next;
    open = false;
  }
</script>

<Popover bind:open {disabled} menuLabel="Project members">
  {#snippet trigger({ toggle, open })}
    <button type="button" class="trigger" data-size={size} data-empty={!selectedMember && !loading} onclick={toggle} aria-expanded={open} aria-haspopup="listbox" aria-label={ariaLabel} {disabled}>
      {#if loading}
        <LoaderCircle size={14} strokeWidth={2} class="spinner" aria-label="Saving assignee" />
      {:else if selectedMember}
        <UserAvatar name={selectedMember.user.name} avatarURL={selectedMember.user.avatarURL} size="sm" />
      {:else}
        <span class="placeholder">
          <UserRound size={14} strokeWidth={2} />
        </span>
      {/if}
      <span class="label">{selectedName ?? "Unassigned"}</span>
      <ChevronDown size={14} strokeWidth={2} class="chevron" />
    </button>
  {/snippet}

  {#snippet menu()}
    <input bind:this={searchInput} class="search" type="text" placeholder="Search members..." bind:value={query} {disabled} />

    <button type="button" class="option" role="option" aria-selected={value === undefined} onclick={() => select(undefined)} {disabled}>
      <span class="check"
        >{#if value === undefined}<Check size={12} strokeWidth={3} />{/if}</span
      >
      <span class="placeholder">
        <UserRound size={14} strokeWidth={2} />
      </span>
      <span>Unassigned</span>
    </button>

    {#if currentUserID}
      <button type="button" class="option" role="option" aria-selected={value === currentUserID} onclick={() => select(currentUserID)} {disabled}>
        <span class="check"
          >{#if value === currentUserID}<Check size={12} strokeWidth={3} />{/if}</span
        >
        {#if currentUserMember}
          <UserAvatar name={currentUserMember.user.name} avatarURL={currentUserMember.user.avatarURL} size="sm" />
        {:else}
          <span class="placeholder">
            <UserRound size={14} strokeWidth={2} />
          </span>
        {/if}
        <span>Assign to me</span>
      </button>
    {/if}

    <div class="divider"></div>

    {#each filtered as member (member.userID)}
      <button type="button" class="option" role="option" aria-selected={value === member.userID} onclick={() => select(member.userID)} {disabled}>
        <span class="check"
          >{#if value === member.userID}<Check size={12} strokeWidth={3} />{/if}</span
        >
        <UserAvatar name={member.user.name} avatarURL={member.user.avatarURL} size="sm" />
        <span>{member.user.name}</span>
      </button>
    {:else}
      <p class="empty">No members match.</p>
    {/each}
  {/snippet}
</Popover>

<style>
  .trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.5em;
    border-radius: var(--border-radius-inner);
    color: var(--colour-text);
    font: inherit;
    white-space: nowrap;
    cursor: pointer;
  }

  .trigger[data-size="md"] {
    min-height: 2.4em;
    padding: 0.45em 0.7em;
    border: var(--border);
    background: var(--colour-bg);
    font-size: 0.85em;
  }

  .trigger[data-size="md"][data-empty="true"] .label,
  .trigger[data-size="md"][data-empty="true"] .placeholder {
    color: var(--colour-muted);
  }

  .trigger[data-size="md"][data-empty="true"] {
    font-weight: 500;
  }

  .trigger[data-size="md"]:hover,
  .trigger[data-size="md"]:focus-visible,
  .trigger[data-size="md"][aria-expanded="true"] {
    background: var(--colour-bg-hover);
  }

  .trigger[data-size="sm"] {
    min-height: 1.65rem;
    margin-left: -0.35rem;
    padding: 0.2rem 0.35rem;
    border: 1px solid transparent;
    background: transparent;
    font-size: 0.8rem;
    font-weight: 600;
  }

  .trigger[data-size="sm"]:hover,
  .trigger[data-size="sm"]:focus-visible,
  .trigger[data-size="sm"][aria-expanded="true"] {
    border-color: var(--colour-border);
    background: var(--colour-bg);
  }

  .trigger:disabled {
    cursor: not-allowed;
    opacity: 0.65;
  }

  .label {
    color: var(--colour-text);
    white-space: nowrap;
  }

  .placeholder {
    display: inline-grid;
    place-items: center;
    flex: 0 0 auto;
    width: 1.35rem;
    height: 1.35rem;
    color: var(--colour-text-secondary);
  }

  .trigger :global(.chevron) {
    color: var(--colour-text-secondary);
    margin-left: 0.15em;
  }

  .trigger :global(.spinner) {
    animation: spin 720ms linear infinite;
    color: var(--accent-base);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
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

  .search:disabled,
  .option:disabled {
    cursor: not-allowed;
    opacity: 0.65;
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
    background: var(--colour-border);
    margin: 0.2em 0;
  }

  .empty {
    margin: 0;
    padding: 0.45em 0.5em;
    color: var(--colour-muted);
    font-size: 0.8em;
  }
</style>
