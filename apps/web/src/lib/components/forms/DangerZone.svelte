<script lang="ts">
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import type { Project } from "@issues/api";
  import { client } from "$lib/api/client";
  import { pushToast } from "$lib/stores/toast.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import Modal from "$lib/components/ui/Modal.svelte";

  let { project }: { project: Project } = $props();

  let confirmOpen = $state(false);
  let confirmKey = $state("");
  let deleting = $state(false);

  // Type-to-confirm guard: the danger button only enables once the typed value
  // matches the project key. Case-insensitive so the user is not punished for
  // forgetting the keys are stored uppercase.
  let canDelete = $derived(confirmKey.trim().toUpperCase() === project.key);

  function openConfirm() {
    confirmKey = "";
    confirmOpen = true;
  }

  function closeConfirm() {
    if (deleting) return;
    confirmOpen = false;
  }

  async function handleDelete() {
    if (!canDelete || deleting) return;

    deleting = true;
    try {
      const res = await client.api.projects[":key"].$delete({ param: { key: project.key } });
      if (!res.ok) {
        pushToast({ message: `Failed to delete ${project.key}.`, kind: "error" });
        return;
      }
      pushToast({ message: `Deleted ${project.name}.`, kind: "success" });
      await goto(resolve("/"));
    } catch {
      pushToast({ message: "Network error. Please try again.", kind: "error" });
    } finally {
      deleting = false;
    }
  }
</script>

<div class="settings-card danger-zone">
  <div class="danger-row">
    <div class="danger-copy">
      <h3>Delete this project</h3>
      <p>Permanently delete <strong>{project.name}</strong> and everything in it: tickets, comments, activity, links, labels and statuses. This cannot be undone.</p>
    </div>
    <Button type="button" variant="danger" onclick={openConfirm}>Delete project</Button>
  </div>
</div>

<Modal open={confirmOpen} title="Delete project?" onclose={closeConfirm} maxWidth="28rem">
  <div class="confirm-body">
    <p>This permanently deletes <strong>{project.name}</strong> and all of its tickets, comments, activity, links, labels and statuses. This cannot be undone.</p>
    <div>
      <label for="confirmProjectKey" class="confirm-label">Type <strong>{project.key}</strong> to confirm</label>
      <input id="confirmProjectKey" class="form-input" bind:value={confirmKey} placeholder={project.key} autocomplete="off" autocapitalize="characters" spellcheck="false" disabled={deleting} />
    </div>
  </div>
  {#snippet footer()}
    <Button type="button" variant="secondary" onclick={closeConfirm} disabled={deleting}>Cancel</Button>
    <Button type="button" variant="danger" disabled={!canDelete || deleting} onclick={() => void handleDelete()}>
      {deleting ? "Deleting..." : "Delete project"}
    </Button>
  {/snippet}
</Modal>

<style>
  .danger-zone {
    border-color: color-mix(in oklch, var(--colour-error) 40%, var(--colour-border));
  }

  .danger-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1.5em;
  }

  .danger-copy {
    display: flex;
    flex-direction: column;
    gap: 0.4em;
    max-width: 60ch;
  }

  .danger-copy h3 {
    font-size: 0.95em;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .danger-copy p {
    margin: 0;
    color: var(--colour-text-secondary);
    font-size: 0.85em;
    line-height: 1.5;
  }

  .confirm-body {
    display: flex;
    flex-direction: column;
    gap: 1em;
  }

  .confirm-body p {
    margin: 0;
    color: var(--colour-text);
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .confirm-label {
    display: block;
    margin-bottom: 0.5em;
    font-size: 0.85rem;
    color: var(--colour-text-secondary);
  }
</style>
