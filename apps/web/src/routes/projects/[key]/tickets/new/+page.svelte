<script lang="ts">
  import "$lib/styles/form.css";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { MoveLeft, Plus } from "@lucide/svelte";
  import type { Priority } from "@issues/api";
  import { client } from "$lib/api/client";
  import FormMessage, { type FormMessage as FormMessageType } from "$lib/components/forms/FormMessage.svelte";
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
          formMessage = { type: "error", text: errorBody.message ?? "Please fix the highlighted fields." };
          fieldErrors = errorBody.fieldErrors ?? {};
        } else {
          formMessage = { type: "error", text: errorBody.message ?? "Failed to create ticket." };
        }
        return;
      }

      const body = await res.json();
      // eslint-disable-next-line svelte/no-navigation-without-resolve
      await goto(`/projects/${data.project.key}/tickets/${body.ticket.number}`);
    } catch {
      formMessage = { type: "error", text: "An error occurred while creating the ticket." };
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

<div class="ticket-create-page">
  <div class="heading-row">
    <a href={resolve("/projects/[key]", { key: data.project.key })} class="back-link">
      <span><MoveLeft size={16} strokeWidth={2} /> Back to project</span>
    </a>

    <div class="heading-content">
      <h1>New ticket</h1>
      <p>Give the ticket a clear title and any context reviewers will need.</p>
    </div>
  </div>

  <form
    class="settings-card ticket-create-form"
    novalidate
    onsubmit={(event) => {
      event.preventDefault();
      void handleSubmit();
    }}
  >
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

    <div class="ticket-form-footer">
      <FormMessage message={formMessage} />
      <div class="form-actions">
        <Button type="button" variant="secondary" onclick={handleCancel} disabled={submitting}>Cancel</Button>
        <Button type="submit" disabled={submitting}>
          <Plus size={13} strokeWidth={4} />
          {submitting ? "Creating..." : "Create ticket"}
        </Button>
      </div>
    </div>
  </form>
</div>

<style>
  .ticket-create-page {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .heading-row {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .back-link {
    text-decoration: none;
    color: var(--accent-base);
    font-weight: 500;
    font-size: 0.9em;
    transition: color 0.4s ease;
  }

  .back-link span {
    display: flex;
    align-items: center;
    gap: 0.5em;
  }

  .back-link:hover {
    color: var(--accent-tint-300);
  }

  .heading-content {
    margin-top: 2rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .heading-content h1 {
    font-size: 1.5em;
    font-weight: 600;
  }

  .heading-content p {
    color: var(--colour-text-secondary);
    font-weight: 300;
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

  .ticket-form-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 1em;
    padding-top: 1em;
    border-top: var(--border);
  }

  .ticket-form-footer :global(.form-message) {
    flex: 1;
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

    .ticket-form-footer {
      align-items: stretch;
      flex-direction: column;
    }
  }
</style>
