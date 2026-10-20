<script lang="ts">
  import "$lib/styles/form.css";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { ChevronRight } from "@lucide/svelte";
  import type { Visibility } from "@issues/api";
  import type { PageProps } from "./$types";
  import { client } from "$lib/api/client";
  import { isValidKey, normaliseKey, suggestKey } from "$lib/projectKey";
  import Button from "$lib/components/ui/Button.svelte";
  import Toggle from "$lib/components/ui/Toggle.svelte";
  import FormMessage, { type FormMessage as FormMessageType } from "$lib/components/forms/FormMessage.svelte";
  import StackInput from "$lib/components/forms/StackInput.svelte";
  import VisibilityCards from "$lib/components/forms/VisibilityCards.svelte";

  let { data }: PageProps = $props();

  let name = $state("");
  let key = $state("");
  let keyTouched = $state(false);
  let description = $state("");
  let visibility = $state<Visibility>("public");
  let showOnHomePage = $state(false);
  let stack = $state<string[]>([]);
  let repo = $state("");

  let moreOpen = $state(false);
  let submitting = $state(false);
  let nameError = $state<string | null>(null);
  let keyError = $state<string | null>(null);
  let repoError = $state<string | null>(null);
  let formMessage = $state<FormMessageType | null>(null);

  let nameInput: HTMLInputElement | null = $state(null);
  let keyInput: HTMLInputElement | null = $state(null);

  const keyClash = $derived(data.existingProjects.find(project => project.key === key));
  const shownKeyError = $derived(keyError ?? (keyClash ? `${key} is already used by ${keyClash.name}.` : null));

  onMount(() => nameInput?.focus());

  function handleNameInput() {
    nameError = null;
    if (!keyTouched) key = suggestKey(name);
    keyError = null;
  }

  function handleKeyInput(event: Event) {
    key = normaliseKey((event.currentTarget as HTMLInputElement).value);
    keyTouched = key.length > 0;
    keyError = null;
  }

  function showServerErrors(status: number, body: { message?: string; fieldErrors?: Record<string, string> }) {
    if (status === 409) {
      keyError = body.message ?? "That key is already in use.";
      keyInput?.focus();
      return;
    }
    const fieldErrors = body.fieldErrors ?? {};
    nameError = fieldErrors.name ?? null;
    keyError = fieldErrors.key ?? null;
    repoError = fieldErrors.repo ?? null;
    if (repoError) moreOpen = true;
    if (!nameError && !keyError && !repoError) formMessage = { type: "error", text: body.message ?? "The project could not be created." };
  }

  async function handleSubmit() {
    if (submitting) return;

    formMessage = null;
    repoError = null;
    nameError = name.trim() ? null : "Add a name.";
    if (nameError) {
      nameInput?.focus();
      return;
    }
    keyError = isValidKey(key) ? null : "Use 2 to 6 letters or numbers.";
    if (keyError || keyClash) {
      keyInput?.focus();
      return;
    }

    submitting = true;
    try {
      const res = await client.api.projects.create.$post({
        json: {
          key,
          name: name.trim(),
          description: description.trim(),
          visibility,
          showOnHomePage: visibility === "private" && showOnHomePage,
          repo: repo.trim() || null,
          stack,
        },
      });

      if (!res.ok) {
        showServerErrors(res.status, (await res.json()) as { message?: string; fieldErrors?: Record<string, string> });
        return;
      }

      const { project }: { project: { key: string } } = await res.json();
      await goto(resolve("/projects/[key]", { key: project.key }));
    } catch {
      formMessage = { type: "error", text: "An error occurred while creating the project." };
    } finally {
      submitting = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void handleSubmit();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
  <title>New project · Issues</title>
</svelte:head>

<form
  class="quick"
  novalidate
  onsubmit={event => {
    event.preventDefault();
    void handleSubmit();
  }}
>
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href={resolve("/")}>Projects</a>
    <ChevronRight size={12} strokeWidth={2.5} />
    <span aria-current="page">New project</span>
  </nav>

  <div class="field">
    <label class="visually-hidden" for="name">Project name</label>
    <input
      id="name"
      class="name-huge"
      bind:this={nameInput}
      bind:value={name}
      oninput={handleNameInput}
      placeholder="Project name"
      maxlength="25"
      autocomplete="off"
      aria-invalid={nameError ? "true" : undefined}
    />
    {#if nameError}<span class="field-error">{nameError}</span>{/if}
  </div>

  <div class="field">
    <div class="key-inline">
      <label for="key">Key</label>
      <input
        id="key"
        class="form-input key-input"
        bind:this={keyInput}
        value={key}
        oninput={handleKeyInput}
        placeholder="PW"
        maxlength="6"
        autocomplete="off"
        aria-invalid={shownKeyError ? "true" : undefined}
      />
      <span class="help">Ticket keys look like {key || "KEY"}-12.</span>
    </div>
    {#if shownKeyError}<span class="field-error">{shownKeyError}</span>{/if}
  </div>

  <div>
    <button type="button" class="disclosure-toggle" aria-expanded={moreOpen} aria-controls="more-options" onclick={() => (moreOpen = !moreOpen)}>
      <ChevronRight size={14} strokeWidth={2} />
      More options
    </button>
    {#if moreOpen}
      <div id="more-options" class="more-options">
        <div class="field">
          <label class="form-label" for="description">Description <span class="optional">optional</span></label>
          <textarea id="description" class="form-input form-textarea" bind:value={description} placeholder="What the project is for, in a sentence or two" rows="3"></textarea>
        </div>

        <div class="field">
          <VisibilityCards bind:value={visibility} />
          {#if visibility === "private"}
            <div class="home-row">
              <div>
                <div class="home-title" id="home-title">Show on the home page</div>
                <div class="home-help">Visitors see the name, description and open ticket count on a locked row. They cannot open the project.</div>
              </div>
              <Toggle bind:checked={showOnHomePage} ariaLabel="Show on the home page" />
            </div>
          {/if}
        </div>

        <div class="field">
          <label class="form-label" for="stack">Stack <span class="optional">optional</span></label>
          <StackInput id="stack" bind:items={stack} />
        </div>

        <div class="field">
          <label class="form-label" for="repo">Repository <span class="optional">optional</span></label>
          <input id="repo" type="url" class="form-input" bind:value={repo} placeholder="https://github.com/owner/repo" aria-invalid={repoError ? "true" : undefined} />
          {#if repoError}<span class="field-error">{repoError}</span>{/if}
        </div>
      </div>
    {/if}
  </div>

  <FormMessage message={formMessage} />

  <div class="actions">
    <Button type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create project"}</Button>
    <Button href={resolve("/")} variant="secondary">Cancel</Button>
    <span class="shortcut"><kbd>Enter</kbd> to create</span>
  </div>
</form>

<style>
  .quick {
    display: grid;
    gap: 1.5rem;
    max-width: 34rem;
    margin: 3rem auto 4rem;
    padding: 0 1.5rem;
  }

  .crumbs {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    color: var(--colour-muted);
    font-size: 0.8125rem;

    & a {
      color: var(--accent-base);
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }

  .field {
    display: grid;
    gap: 0.375rem;
    align-content: start;
  }

  .name-huge {
    width: 100%;
    padding: 0.5rem 0;
    border: 0;
    border-bottom: 2px solid var(--colour-border-control);
    background: transparent;
    color: var(--colour-text);
    font-size: 1.5rem;
    font-weight: 600;
    letter-spacing: -0.015em;
    outline: none;

    &::placeholder {
      color: var(--colour-muted);
      font-weight: 500;
    }

    &:focus-visible {
      border-bottom-color: var(--colour-focus);
    }

    &[aria-invalid="true"] {
      border-bottom-color: var(--colour-error);
    }
  }

  .key-inline {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--colour-text-secondary);
    font-size: 0.875rem;

    & .key-input {
      width: 6.5rem;
      font-family: var(--font-mono);
      letter-spacing: 0.05em;
    }
  }

  .disclosure-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0;
    border: 0;
    background: transparent;
    color: var(--colour-text-secondary);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;

    &:hover {
      color: var(--colour-text);
    }

    & :global(svg) {
      transition: rotate var(--motion-fast) var(--ease-out-quart);
    }

    &[aria-expanded="true"] :global(svg) {
      rotate: 90deg;
    }
  }

  .more-options {
    display: grid;
    gap: 1.25rem;
    padding-top: 0.75rem;
  }

  .optional {
    margin-left: 0.25rem;
    color: var(--colour-muted);
    font-weight: 400;
  }

  .home-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding-top: 0.75rem;
  }

  .home-title {
    font-size: 0.9375rem;
    font-weight: 500;
  }

  .home-help {
    max-width: 40ch;
    color: var(--colour-text-secondary);
    font-size: 0.8125rem;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }

  .shortcut {
    margin-left: auto;
    color: var(--colour-muted);
    font-size: 0.8125rem;
  }

  kbd {
    padding: 0.05em 0.4em;
    border: 1px solid var(--colour-border-control);
    border-radius: var(--border-radius-inner);
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }
</style>
