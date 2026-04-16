<script lang="ts">
  import type { PageProps } from "./$types";
  import { MoveLeft } from "@lucide/svelte";
  import { resolve } from "$app/paths";
  import "$lib/styles/form.css";
  import GeneralSettingsForm from "$lib/components/forms/GeneralSettingsForm.svelte";
  import LabelForm from "$lib/components/forms/LabelForm.svelte";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>{data.project.name} · Settings</title>
</svelte:head>

<div class="settings-page">
  <div class="heading-row">
    <a href={resolve("/projects/[key]", { key: data.project.key })} class="back-link"><span><MoveLeft size={16} strokeWidth={2} /> Back to project</span></a>
    <div class="heading-content">
      <h1>Project Settings</h1>
      <p>Manage your project settings, labels and statuses.</p>
    </div>
  </div>

  <section class="settings-card-container">
    <h2>General</h2>
    <GeneralSettingsForm project={data.project} />
  </section>
  <section class="settings-card-container">
    <h2>Labels</h2>
    <LabelForm labels={data.project.labels} projectKey={data.project.key} />
  </section>
  <section class="settings-card-container">
    <h2>Statuses</h2>
  </section>
</div>

<style>
  .settings-page {
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
    font-size: 0.9rem;
    transition: color 0.4s ease;

    & span {
      display: flex;
      align-items: center;
      gap: 0.5em;
    }

    &:hover {
      color: var(--accent-tint-300);
    }
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

  .settings-card-container {
    display: flex;
    flex-direction: column;
    gap: 1em;
  }

  .settings-card-container h2 {
    font-size: 1em;
    font-weight: 500;
    letter-spacing: -0.02em;
  }
</style>
