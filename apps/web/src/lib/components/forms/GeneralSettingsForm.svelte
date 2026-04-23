<script lang="ts">
  import { client } from "$lib/api/client";
  import type { Project } from "@issues/api";
  import Button from "$lib/components/ui/Button.svelte";
  import FormMessage, { type FormMessage as FormMessageType } from "./FormMessage.svelte";

  let { project }: { project: Project } = $props();

  // svelte-ignore state_referenced_locally
  let form = $state({
    name: project.name,
    description: project.description ?? "",
    visibility: project.visibility,
    repo: project.repo ?? "",
    stack: project.stack,
    metadata: project.metadata ?? {},
  });
  let message = $state<FormMessageType | null>(null);
  let fieldErrors: Record<string, string> = $state({});
  let submitting = $state(false);

  async function handleSubmit() {
    if (submitting) return;

    submitting = true;
    message = null;
    fieldErrors = {};
    try {
      const res = await client.api.projects[":key"].$patch({
        param: { key: project.key },
        json: {
          name: form.name,
          description: form.description,
          visibility: form.visibility,
          repo: form.repo.trim() === "" ? null : form.repo,
          stack: form.stack,
          metadata: form.metadata,
        },
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string; fieldErrors?: Record<string, string> };
        message = { type: "error", text: data.message ?? "Failed to save changes" };
        fieldErrors = data.fieldErrors ?? {};
        return;
      }
      message = { type: "success", text: "Saved" };
    } catch {
      message = { type: "error", text: "Network error. Please try again." };
    } finally {
      submitting = false;
    }
  }
</script>

<form
  class="settings-card"
  novalidate
  onsubmit={(e) => {
    e.preventDefault();
    handleSubmit();
  }}
>
  <div>
    <label for="projectName" class="form-label">Project name</label>
    <input type="text" id="projectName" class="form-input" bind:value={form.name} placeholder="Enter project name..." required maxlength="25" />
    {#if fieldErrors.name}
      <span id="projectName-error" class="field-error">{fieldErrors.name}</span>
    {/if}
  </div>

  <div>
    <label for="projectDescription" class="form-label">Description</label>
    <textarea id="projectDescription" class="form-input form-textarea" bind:value={form.description} placeholder="Enter project description..." rows="4" maxlength="250"></textarea>
    {#if fieldErrors.description}
      <span id="projectDescription-error" class="field-error">{fieldErrors.description}</span>
    {/if}
  </div>

  <div class="form-row">
    <div class="form-row-copy">
      <label for="visibility" class="form-row-label">Visibility</label>
      <p id="visibility-help" class="form-row-help">Choose who can see this project.</p>
    </div>

    <div>
      <select id="visibility" class="form-input form-row-control" aria-describedby="visibility-help" bind:value={form.visibility} aria-invalid={!!fieldErrors.visibility}>
        <option value="private">Private</option>
        <option value="public">Public</option>
      </select>
      {#if fieldErrors.visibility}
        <span class="field-error">{fieldErrors.visibility}</span>
      {/if}
    </div>
  </div>

  <div>
    <label for="projectRepo" class="form-label">Repository URL</label>
    <input type="url" id="projectRepo" class="form-input" bind:value={form.repo} placeholder="Enter project repository URL..." maxlength="2048" />
    {#if fieldErrors.repo}
      <span id="projectRepo-error" class="field-error">{fieldErrors.repo}</span>
    {/if}
  </div>

  <div class="settings-card-footer">
    <FormMessage {message} />
    <Button type="submit" disabled={submitting}>
      {submitting ? "Saving..." : "Save changes"}
    </Button>
  </div>
</form>

<style>
  .settings-card-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 1em;
    padding-top: 1em;
    border-top: var(--border);
  }

  .settings-card-footer :global(.form-message) {
    flex: 1;
  }
</style>
