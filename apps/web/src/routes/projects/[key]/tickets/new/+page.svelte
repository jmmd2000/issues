<script lang="ts">
  import "$lib/styles/form.css";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { MoveLeft, Plus } from "@lucide/svelte";
  import type { Priority } from "@issues/api";
  import { client } from "$lib/api/client";
  import Button from "$lib/components/ui/Button.svelte";
  import MarkdownEditor from "$lib/components/markdown/MarkdownEditor.svelte";
  import AssigneePicker from "$lib/components/tickets/AssigneePicker.svelte";
  import LabelsPicker from "$lib/components/tickets/LabelsPicker.svelte";
  import ParentTicketCombobox from "$lib/components/tickets/ParentTicketCombobox.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  let title = $state("");
  let description = $state("");
  // svelte-ignore state_referenced_locally
  let statusID = $state<string>((data.statuses.find((status) => status.category === "backlog") ?? data.statuses[0])?.id ?? "");
  let priority = $state<Priority>("medium");
  // svelte-ignore state_referenced_locally
  let assigneeID = $state<string | undefined>(data.user.id);
  let labelIDs = $state<string[]>([]);
  let parentTicketID = $state<string | undefined>(undefined);
  let submitting = $state(false);
  let formMessage = $state<string | null>(null);
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
      const res = await client.api.projects[":key"].tickets.$post({
        param: { key: data.project.key },
        json: {
          title: trimmed,
          description: description || undefined,
          statusID,
          priority,
          assigneeID: assigneeID || undefined,
          labelIDs: labelIDs.length ? labelIDs : undefined,
          parentTicketID: parentTicketID || undefined,
        },
      });

      if (!res.ok) {
        const errorBody = (await res.json().catch(() => ({}))) as {
          message?: string;
          fieldErrors?: Record<string, string>;
        };
        if (res.status === 400) {
          formMessage = errorBody.message ?? "Please fix the highlighted fields.";
          fieldErrors = errorBody.fieldErrors ?? {};
        } else {
          formMessage = errorBody.message ?? "Failed to create ticket.";
        }
        return;
      }

      const body = await res.json();
      // eslint-disable-next-line svelte/no-navigation-without-resolve
      await goto(`/projects/${data.project.key}/tickets/${body.ticket.number}`);
    } catch {
      formMessage = "An error occurred while creating the ticket.";
    } finally {
      submitting = false;
    }
  }

  function handleCancel() {
    history.back();
  }
</script>

<svelte:head>
  <title>New ticket · {data.project.name} · Issues</title>
</svelte:head>

<div class="ticket-create-container">
  <a href={resolve("/projects/[key]", { key: data.project.key })} class="back-link">
    <MoveLeft size={14} strokeWidth={2} />
    <span>Back to {data.project.key}</span>
  </a>

  <form
    class="form-card ticket-create-form"
    onsubmit={(event) => {
      event.preventDefault();
      void handleSubmit();
    }}
  >
    <div class="form-heading">
      <h1 class="form-header">New ticket</h1>
      <p>Give the ticket a clear title and any context reviewers will need.</p>
    </div>

    <div class="input-row">
      <label class="form-label" for="title">Title</label>
      <input
        id="title"
        class="form-input"
        type="text"
        bind:value={title}
        bind:this={titleInput}
        maxlength="200"
        required
        placeholder="Short summary of the task"
        aria-invalid={fieldErrors.title ? "true" : undefined}
      />
      {#if fieldErrors.title}<span class="field-error">{fieldErrors.title}</span>{/if}
    </div>

    <div class="input-row">
      <span class="form-label">Description</span>
      <MarkdownEditor bind:value={description} placeholder="Add information, acceptance criteria, links etc." minHeight="12rem" onsubmit={() => void handleSubmit()} />
      {#if fieldErrors.description}<span class="field-error">{fieldErrors.description}</span>{/if}
    </div>

    <div class="form-grid">
      <div class="input-row">
        <label class="form-label" for="status">Status</label>
        <select id="status" class="form-input" bind:value={statusID}>
          {#each data.statuses as status (status.id)}
            <option value={status.id}>{status.name}</option>
          {/each}
        </select>
        {#if fieldErrors.statusID}<span class="field-error">{fieldErrors.statusID}</span>{/if}
      </div>

      <div class="input-row">
        <label class="form-label" for="priority">Priority</label>
        <select id="priority" class="form-input" bind:value={priority}>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="none">None</option>
        </select>
      </div>
    </div>

    <AssigneePicker members={data.members} currentUserID={data.user.id} bind:value={assigneeID} />
    <LabelsPicker labels={data.labels} bind:value={labelIDs} />
    <ParentTicketCombobox projectKey={data.project.key} bind:value={parentTicketID} />

    {#if formMessage}
      <p class="form-feedback error">{formMessage}</p>
    {/if}

    <div class="form-actions">
      <Button type="button" variant="secondary" onclick={handleCancel} disabled={submitting}>Cancel</Button>
      <Button type="submit" disabled={submitting}>
        <Plus size={13} strokeWidth={4} />
        {submitting ? "Creating..." : "Create ticket"}
      </Button>
    </div>
  </form>
</div>

<style>
  .ticket-create-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: clamp(0.5rem, 3vh, 2rem);
    gap: 1rem;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
    width: min(100%, 42rem);
    color: var(--colour-text-secondary);
    text-decoration: none;
    font-size: 0.8em;
    font-weight: 600;
  }

  .back-link:hover {
    color: var(--colour-text);
  }

  .ticket-create-form {
    width: min(100%, 42rem);
  }

  .form-heading {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-heading p {
    color: var(--colour-text-secondary);
    line-height: 1.5;
    font-size: 0.9em;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

  .input-row {
    display: flex;
    flex-direction: column;
  }

  .form-feedback {
    margin: 0;
    padding: 0.6em 0.8em;
    border-radius: var(--border-radius-inner);
    font-size: 0.85em;
  }

  .form-feedback.error {
    background: var(--colour-error-bg);
    color: var(--colour-error);
    border: 1px solid var(--colour-error-border);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
  }

  @media (max-width: 640px) {
    .form-grid {
      grid-template-columns: 1fr;
    }

    .form-actions {
      flex-direction: column-reverse;
    }
  }
</style>
