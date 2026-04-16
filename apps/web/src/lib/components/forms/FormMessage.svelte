<script lang="ts" module>
  export type FormMessage = {
    type: "error" | "success" | "info";
    text: string;
  };
</script>

<script lang="ts">
  let { message }: { message: FormMessage | null } = $props();
</script>

{#if message}
  <p class="form-message" data-type={message.type}>
    {message.text}
  </p>
{/if}

<style>
  .form-message {
    font-size: 0.875rem;
    padding: 0.5em 0.75em;
    border-radius: var(--border-radius-inner);
    border: 1px solid transparent;
  }

  .form-message[data-type="error"] {
    color: var(--colour-error);
    background: var(--colour-error-bg);
    border-color: var(--colour-error-border);
  }

  .form-message[data-type="success"] {
    color: var(--colour-success);
    background: var(--colour-success-bg);
    border-color: var(--colour-success-border);
  }

  .form-message[data-type="info"] {
    color: var(--accent-base);
    background: var(--accent-tint-800);
    border-color: var(--colour-accent-border);
  }
</style>
