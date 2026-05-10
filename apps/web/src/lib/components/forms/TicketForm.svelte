<script module lang="ts">
  import type { Priority } from "@issues/api";
  import type { TicketRef } from "$lib/components/tickets/TicketSearchCombobox.svelte";

  export interface TicketFormValues {
    title: string;
    description: string;
    statusID: string;
    priority: Priority;
    assigneeID: string | undefined;
    labelIDs: string[];
    parentTicket: TicketRef | null;
    visibility: "public" | "private";
  }

  /** Outcome shape returned by the parent's onsubmit handler. */
  export interface TicketFormSubmitResult {
    ok: boolean;
    message?: string;
    fieldErrors?: Record<string, string>;
  }
</script>

<script lang="ts">
  import { untrack, type Snippet } from "svelte";
  import type { Label, ProjectMember, Status } from "@issues/api";
  import FormMessage, { type FormMessage as FormMessageType } from "$lib/components/forms/FormMessage.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import VisibilityToggle from "$lib/components/ui/VisibilityToggle.svelte";
  import MarkdownEditor from "$lib/components/markdown/MarkdownEditor.svelte";
  import AssigneePicker from "$lib/components/tickets/AssigneePicker.svelte";
  import LabelsPicker from "$lib/components/tickets/LabelsPicker.svelte";
  import PriorityPicker from "$lib/components/tickets/PriorityPicker.svelte";
  import StatusPicker from "$lib/components/tickets/StatusPicker.svelte";
  import TicketSearchCombobox from "$lib/components/tickets/TicketSearchCombobox.svelte";

  interface TicketFormProps {
    statuses: Status[];
    labels: Label[];
    members: ProjectMember[];
    currentUserID: string;
    projectKey: string;
    initialValues?: Partial<TicketFormValues>;
    submitLabel?: string;
    cancelLabel?: string;
    /** Optional extra UI rendered between the form fields and the action row. */
    extras?: Snippet;
    /** Number excluded from the parent-ticket combobox (e.g. the source ticket on a clone). */
    excludeParentNumber?: number;
    onsubmit: (values: TicketFormValues) => Promise<TicketFormSubmitResult>;
    oncancel: () => void;
  }

  let { statuses, labels, members, currentUserID, projectKey, initialValues = {}, submitLabel = "Create ticket", cancelLabel = "Cancel", extras, excludeParentNumber, onsubmit, oncancel }: TicketFormProps = $props();

  // Snapshot defaults exactly once on mount. The form fields below are user-
  // editable from that point on, so we don't want a parent re-render to clobber
  // typing-in-progress. The modal that hosts this form unmounts/remounts on
  // open, which is when fresh defaults get picked up.
  const defaults = untrack(() => {
    const fallbackStatusID = (statuses.find((status) => status.category === "backlog") ?? statuses[0])?.id ?? "";
    return {
      title: initialValues.title ?? "",
      description: initialValues.description ?? "",
      statusID: initialValues.statusID ?? fallbackStatusID,
      priority: initialValues.priority ?? ("none" as Priority),
      assigneeID: initialValues.assigneeID,
      labelIDs: initialValues.labelIDs ?? [],
      parentTicket: initialValues.parentTicket ?? null,
      visibility: initialValues.visibility ?? ("public" as "public" | "private"),
    };
  });

  let title = $state(defaults.title);
  let description = $state(defaults.description);
  let statusID = $state(defaults.statusID);
  let priority = $state(defaults.priority);
  let assigneeID = $state<string | undefined>(defaults.assigneeID);
  let labelIDs = $state<string[]>([...defaults.labelIDs]);
  let parentTicket = $state(defaults.parentTicket);
  let visibility = $state(defaults.visibility);
  let submitting = $state(false);
  let formMessage = $state<FormMessageType | null>(null);
  let fieldErrors = $state<Record<string, string>>({});
  let titleInput: HTMLInputElement | null = $state(null);

  $effect(() => {
    titleInput?.focus();
  });

  async function handleSubmit() {
    if (submitting) return;
    const trimmed = title.trim();
    if (!trimmed) {
      fieldErrors = { ...fieldErrors, title: "Title is required." };
      return;
    }

    submitting = true;
    formMessage = null;
    fieldErrors = {};
    try {
      const result = await onsubmit({
        title: trimmed,
        description,
        statusID,
        priority,
        assigneeID,
        labelIDs,
        parentTicket,
        visibility,
      });

      if (!result.ok) {
        formMessage = { type: "error", text: result.message ?? "Please fix the highlighted fields." };
        fieldErrors = result.fieldErrors ?? {};
      }
    } finally {
      submitting = false;
    }
  }
</script>

<form
  class="ticket-form"
  novalidate
  onsubmit={(event) => {
    event.preventDefault();
    void handleSubmit();
  }}
>
  <div class="field">
    <label class="field-label" for="ticket-title">Title</label>
    <input
      bind:this={titleInput}
      bind:value={title}
      id="ticket-title"
      type="text"
      class="title-input"
      placeholder="Short summary of the work"
      maxlength="200"
      required
      aria-invalid={fieldErrors.title ? "true" : undefined}
    />
    {#if fieldErrors.title}<span class="field-error">{fieldErrors.title}</span>{/if}
  </div>

  <div class="field">
    <span class="field-label">Description</span>
    <MarkdownEditor bind:value={description} placeholder="Add information, acceptance criteria, links etc." minHeight="9rem" onsubmit={() => void handleSubmit()} />
    {#if fieldErrors.description}<span class="field-error">{fieldErrors.description}</span>{/if}
  </div>

  <div class="meta-grid">
    <div class="field">
      <span class="field-label">Status</span>
      <StatusPicker {statuses} bind:value={statusID} />
      {#if fieldErrors.statusID}<span class="field-error">{fieldErrors.statusID}</span>{/if}
    </div>

    <div class="field">
      <span class="field-label">Priority</span>
      <PriorityPicker bind:value={priority} />
    </div>

    <div class="field">
      <span class="field-label">Assignee</span>
      <AssigneePicker {members} {currentUserID} bind:value={assigneeID} />
    </div>

    <div class="field">
      <span class="field-label">Labels</span>
      <LabelsPicker {labels} bind:value={labelIDs} />
    </div>
  </div>

  <div class="field">
    <label class="field-label" for="ticket-parent">Parent ticket</label>
    <TicketSearchCombobox
      {projectKey}
      inputID="ticket-parent"
      excludeTicketNumber={excludeParentNumber}
      selected={parentTicket}
      onpicked={(ticket) => (parentTicket = ticket)}
      oncleared={() => (parentTicket = null)}
    />
  </div>

  <div class="field">
    <span class="field-label">Visibility</span>
    <VisibilityToggle bind:value={visibility} />
    <p class="field-help">
      {#if visibility === "private"}
        Only project members can see this ticket and its attachments.
      {:else}
        Anyone who can see the project can see this ticket.
      {/if}
    </p>
  </div>

  {#if extras}
    <div class="extras">
      {@render extras()}
    </div>
  {/if}

  <FormMessage message={formMessage} />

  <div class="actions">
    <Button type="button" variant="secondary" onclick={oncancel} disabled={submitting}>{cancelLabel}</Button>
    <Button type="submit" disabled={submitting}>
      {submitting ? "Saving..." : submitLabel}
    </Button>
  </div>
</form>

<style>
  .ticket-form {
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    min-width: 0;
  }

  .field-label {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--colour-text-secondary);
    letter-spacing: -0.01em;
  }

  .title-input {
    width: 100%;
    padding: 0.55rem 0.7rem;
    border: var(--border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg-lighter);
    color: var(--colour-text);
    font: inherit;
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    box-shadow: 0 1px 2px rgba(30, 34, 41, 0.05);
  }

  .title-input::placeholder {
    color: var(--colour-muted);
    font-weight: 500;
  }

  .title-input:focus-visible {
    outline: none;
    border-color: var(--accent-base);
    box-shadow: 0 0 0 3px rgba(53, 93, 212, 0.12);
  }

  .meta-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem 1.25rem;
  }

  .extras {
    padding: 0.75rem 0;
    border-top: var(--border);
  }

  .field-help {
    margin: 0;
    font-size: 0.75rem;
    color: var(--colour-muted);
    line-height: 1.45;
  }

  .field-error {
    color: var(--colour-error);
    font-size: 0.75rem;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding-top: 0.5rem;
    border-top: var(--border);
  }

  @media (max-width: 540px) {
    .meta-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
