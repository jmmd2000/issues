<script lang="ts">
  import "$lib/styles/form.css";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { client } from "$lib/api/client";

  let key: string = $state("");
  let name: string = $state("");
  let description: string = $state("");
  let visibility: "public" | "private" = $state("public");
  let repo: string = $state("");
  let stackInput: string = $state("");
  let submitting = $state(false);
  let formMessage: { text: string; error: boolean } | null = $state(null);

  function getStackItems(value: string) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async function handleSubmit() {
    submitting = true;
    formMessage = null;

    try {
      const projectKey = key.trim().toUpperCase();
      const res = await client.api.projects.create.$post({
        json: {
          key: projectKey,
          name: name.trim(),
          description: description.trim(),
          visibility,
          repo: repo.trim() || null,
          stack: getStackItems(stackInput),
        },
      });

      if (!res.ok) {
        const errorData = (await res.json()) as { message?: string };
        formMessage = { text: errorData.message || "Failed to create project", error: true };
        return;
      }

      const { project }: { project: { key: string } } = await res.json();
      formMessage = { text: "Project created successfully!", error: false };
      setTimeout(() => goto(resolve("/projects/[key]", { key: project.key })), 1500);
    } catch {
      formMessage = { text: "An error occurred while creating the project", error: true };
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>New Project · Issues</title>
</svelte:head>

<div class="project-form-container">
  <form
    onsubmit={(e) => {
      e.preventDefault();
      handleSubmit();
    }}
    class="form-card project-form"
  >
    <div class="form-heading">
      <h1 class="form-header">New project</h1>
      <p>Create a new project for issue tracking.</p>
    </div>

    <div class="form-grid">
      <div class="input-row">
        <label for="key" class="form-label">Key</label>
        <input type="text" id="key" class="form-input" bind:value={key} placeholder="WEB" required minlength="2" maxlength="6" />
      </div>

      <div class="input-row">
        <label for="name" class="form-label">Name</label>
        <input type="text" id="name" class="form-input" bind:value={name} placeholder="Personal website" required maxlength="120" />
      </div>
    </div>

    <div class="input-row">
      <label for="description" class="form-label">Description</label>
      <textarea id="description" class="form-input form-textarea" bind:value={description} placeholder="Project description..." required rows="4"></textarea>
    </div>

    <div class="form-grid">
      <div class="input-row">
        <label for="visibility" class="form-label">Visibility</label>
        <select id="visibility" class="form-input" bind:value={visibility}>
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
      </div>

      <div class="input-row">
        <label for="repo" class="form-label">Repository</label>
        <input type="url" id="repo" class="form-input" bind:value={repo} placeholder="https://github.com/owner/repo" />
      </div>
    </div>

    <div class="input-row">
      <label for="stack" class="form-label">Stack</label>
      <input type="text" id="stack" class="form-input" bind:value={stackInput} placeholder="SvelteKit, Hono, PostgreSQL" />
    </div>

    {#if formMessage}
      <div class="form-feedback" class:error={formMessage.error}>
        {formMessage.text}
      </div>
    {/if}

    <button type="submit" disabled={submitting} class="form-button">
      {submitting ? "Creating project..." : "Create project"}
    </button>
  </form>
</div>

<style>
  .project-form-container {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: clamp(1rem, 4vh, 3rem);
    min-height: calc(100vh - 9rem);
  }

  .project-form {
    width: min(100%, 42rem);
  }

  .form-heading {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .form-heading p {
    color: var(--colour-text-secondary);
    line-height: 1.5;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

  .form-textarea {
    min-height: 7rem;
    resize: vertical;
  }

  @media (max-width: 640px) {
    .form-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
