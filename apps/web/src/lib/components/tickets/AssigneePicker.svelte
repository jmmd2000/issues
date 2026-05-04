<script lang="ts">
  import { Check, ChevronDown, LoaderCircle, UserRound } from "@lucide/svelte";
  import type { ProjectMember } from "@issues/api";
  import UserAvatar from "$lib/components/UserAvatar.svelte";
  import Popover from "$lib/components/ui/Popover.svelte";

  let {
    members,
    currentUserID,
    multi = false,
    value = $bindable<string | undefined>(undefined),
    selected = [],
    onselect,
    onChange,
    placeholder = "Assignee",
    disabled = false,
    loading = false,
    size = "md",
    ariaLabel = "Assignee",
  }: {
    members: ProjectMember[];
    currentUserID?: string;
    multi?: boolean;
    /** Single-mode value. Ignored when `multi` is true. */
    value?: string | undefined;
    /** Multi-mode selection. Ignored when `multi` is false. */
    selected?: string[];
    onselect?: (value: string | undefined, previousValue: string | undefined) => void;
    onChange?: (next: string[]) => void;
    /** Placeholder shown in multi mode when nothing is selected. */
    placeholder?: string;
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

  const selectedSet = $derived(new Set(selected));
  const selectedMembers = $derived(members.filter((member) => selectedSet.has(member.userID)));

  const singleMember = $derived(value ? (members.find((member) => member.userID === value) ?? null) : null);
  const singleName = $derived(singleMember?.user.name ?? null);
  const currentUserMember = $derived(currentUserID ? (members.find((member) => member.userID === currentUserID) ?? null) : null);

  $effect(() => {
    if (open) queueMicrotask(() => searchInput?.focus());
    else query = "";
  });

  function selectSingle(next: string | undefined) {
    if (disabled) return;
    const previousValue = value;
    onselect?.(next, previousValue);
    value = next;
    open = false;
  }

  function toggleMulti(next: string) {
    if (disabled) return;
    onChange?.(selectedSet.has(next) ? selected.filter((id) => id !== next) : [...selected, next]);
  }
</script>

<Popover bind:open {disabled} menuLabel="Project members">
  {#snippet trigger({ toggle, open })}
    <button
      type="button"
      class="trigger"
      data-size={size}
      data-empty={multi ? selectedMembers.length === 0 : !singleMember && !loading}
      data-multi={multi}
      onclick={toggle}
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-label={ariaLabel}
      {disabled}
    >
      {#if loading}
        <LoaderCircle size={14} strokeWidth={2} class="spinner" aria-label="Saving assignee" />
      {:else if multi}
        {#if selectedMembers.length === 0}
          <span class="placeholder-icon">
            <UserRound size={14} strokeWidth={2} />
          </span>
          <span class="placeholder">{placeholder}</span>
        {:else}
          <span class="chip-row" aria-label={`${selectedMembers.length} ${selectedMembers.length === 1 ? "assignee" : "assignees"} selected`}>
            {#each selectedMembers as member (member.userID)}
              <span class="multi-chip" title={member.user.name}>
                <UserAvatar name={member.user.name} avatarURL={member.user.avatarURL} size="sm" />
              </span>
            {/each}
          </span>
        {/if}
      {:else if singleMember}
        <UserAvatar name={singleMember.user.name} avatarURL={singleMember.user.avatarURL} size="sm" />
        <span class="label">{singleName}</span>
      {:else}
        <span class="placeholder-icon">
          <UserRound size={14} strokeWidth={2} />
        </span>
        <span class="label">Unassigned</span>
      {/if}
      <ChevronDown size={14} strokeWidth={2} class="chevron" />
    </button>
  {/snippet}

  {#snippet menu()}
    <input bind:this={searchInput} class="search" type="text" placeholder="Search members..." bind:value={query} {disabled} />

    {#if !multi}
      <button type="button" class="option" role="option" aria-selected={value === undefined} onclick={() => selectSingle(undefined)} {disabled}>
        <span class="check">
          {#if value === undefined}<Check size={12} strokeWidth={3} />{/if}
        </span>
        <span class="placeholder-icon">
          <UserRound size={14} strokeWidth={2} />
        </span>
        <span>Unassigned</span>
      </button>
    {/if}

    {#if !multi && currentUserID}
      <button type="button" class="option" role="option" aria-selected={value === currentUserID} onclick={() => selectSingle(currentUserID)} {disabled}>
        <span class="check">
          {#if value === currentUserID}<Check size={12} strokeWidth={3} />{/if}
        </span>
        {#if currentUserMember}
          <UserAvatar name={currentUserMember.user.name} avatarURL={currentUserMember.user.avatarURL} size="sm" />
        {:else}
          <span class="placeholder-icon">
            <UserRound size={14} strokeWidth={2} />
          </span>
        {/if}
        <span>Assign to me</span>
      </button>
    {/if}

    {#if !multi}
      <div class="divider"></div>
    {/if}

    {#each filtered as member (member.userID)}
      {@const isSelected = multi ? selectedSet.has(member.userID) : value === member.userID}
      <button
        type="button"
        class="option"
        role="option"
        aria-selected={isSelected}
        onclick={() => (multi ? toggleMulti(member.userID) : selectSingle(member.userID))}
        {disabled}
      >
        <span class="check">
          {#if isSelected}<Check size={12} strokeWidth={3} />{/if}
        </span>
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
  .trigger[data-size="md"][data-empty="true"] .placeholder,
  .trigger[data-size="md"][data-empty="true"] .placeholder-icon {
    color: var(--colour-text-secondary);
  }

  .trigger[data-size="md"][data-empty="true"] {
    font-weight: 600;
  }

  .trigger[data-size="md"]:hover,
  .trigger[data-size="md"]:focus-visible,
  .trigger[data-size="md"][aria-expanded="true"] {
    background: var(--colour-bg-hover);
  }

  .trigger[data-multi="true"]:not([data-empty="true"]) {
    flex-wrap: wrap;
    row-gap: 0.3em;
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
    color: var(--colour-text);
  }

  .placeholder-icon {
    display: inline-grid;
    place-items: center;
    flex: 0 0 auto;
    width: 1.35rem;
    height: 1.35rem;
    color: var(--colour-text-secondary);
  }

  .chip-row {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.35em;
    row-gap: 0.3em;
    max-width: 22em;
  }

  .multi-chip {
    display: inline-flex;
    align-items: center;
    line-height: 1;
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
