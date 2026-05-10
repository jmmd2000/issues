<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { resolve } from "$app/paths";
  import { untrack } from "svelte";
  import type { Label, ProjectMember, Status, TicketDetail } from "@issues/api";
  import { client } from "$lib/api/client";
  import Modal from "$lib/components/ui/Modal.svelte";
  import Checkbox from "$lib/components/ui/Checkbox.svelte";
  import TicketForm, { type TicketFormSubmitResult, type TicketFormValues } from "$lib/components/forms/TicketForm.svelte";
  import { pushToast } from "$lib/stores/toast.svelte";

  interface TicketModalProps {
    open: boolean;
    /** "create" opens an empty form; "clone" prefills from `source` and posts to the clone endpoint. */
    mode: "create" | "clone";
    projectKey: string;
    statuses: Status[];
    labels: Label[];
    members: ProjectMember[];
    currentUserID: string;
    /** Required when `mode === "clone"`. Drives the prefill + the link/activity pair on submit. */
    source?: TicketDetail;
    /** Prefill applied to the underlying form -- used by the create flow (e.g. setting a parent for sub-ticket creation). Ignored for clones, which derive their prefill from `source`. */
    initialValues?: Partial<TicketFormValues>;
    excludeParentNumber?: number;
    /** Override the default modal heading. */
    title?: string;
    /** Override the default submit button label. */
    submitLabel?: string;
    /**
     * What to do after a successful create:
     *   - "navigate" (default for create): goto the created ticket
     *   - "stay": keep the user on the current page, refresh in place, push a confirmation toast
     * Clone always behaves as "stay" (with a toast offering View) -- the user might clone twice.
     */
    onSuccess?: "navigate" | "stay";
    oncreated?: (ticket: { id: string; number: number; title: string }) => void;
    onclose: () => void;
  }

  let { open, mode, projectKey, statuses, labels, members, currentUserID, source, initialValues, excludeParentNumber, title, submitLabel, onSuccess = "navigate", oncreated, onclose }: TicketModalProps = $props();

  let copyAttachments = $state(false);

  // Reset clone-only state every time the modal opens so a previous toggle
  // doesn't carry forward into the next clone. Also guards against the
  // caller opening clone mode without a source -- the form would otherwise
  // render with empty defaults and the user would not understand why.
  $effect(() => {
    if (!open) return;
    copyAttachments = false;
    if (mode === "clone" && !source) {
      onclose();
    }
  });

  // Snapshot the prefill once per open so the form -- which is keyed by `open`
  // via {#if open} -- always sees the freshest defaults at mount.
  const formPrefill = $derived.by<Partial<TicketFormValues>>(() => {
    if (mode === "clone" && source) {
      const backlogStatusID = (statuses.find((status) => status.category === "backlog") ?? statuses[0])?.id ?? "";
      return {
        title: `${source.title} - Copy`,
        description: source.description,
        statusID: backlogStatusID,
        priority: source.priority,
        assigneeID: undefined,
        labelIDs: source.labels.map((label) => label.id),
        parentTicket: null,
        visibility: source.visibility,
      };
    }
    return initialValues ?? {};
  });

  const headerText = $derived(title ?? (mode === "clone" && source ? `Clone ${projectKey}-${source.number}` : "New ticket"));
  const submitText = $derived(submitLabel ?? (mode === "clone" ? "Create clone" : "Create ticket"));
  const parentExclude = $derived(mode === "clone" && source ? source.number : excludeParentNumber);

  async function submitCreate(values: TicketFormValues): Promise<TicketFormSubmitResult> {
    const res = await client.api.projects[":key"].tickets.$post({
      param: { key: projectKey },
      json: {
        title: values.title,
        description: values.description || undefined,
        statusID: values.statusID,
        priority: values.priority,
        assigneeID: values.assigneeID || undefined,
        labelIDs: values.labelIDs.length ? values.labelIDs : undefined,
        parentTicketID: values.parentTicket?.id,
        visibility: values.visibility,
      },
    });

    if (!res.ok) return parseError(res, "Failed to create ticket.");

    const body = await res.json();
    onclose();

    if (onSuccess === "navigate") {
      await goto(resolve("/projects/[key]/tickets/[num]", { key: projectKey, num: String(body.ticket.number) }));
    } else {
      await invalidateAll();
      pushToast({ message: `Created ${projectKey}-${body.ticket.number}.`, kind: "success" });
    }

    oncreated?.(body.ticket);
    return { ok: true };
  }

  async function submitClone(values: TicketFormValues): Promise<TicketFormSubmitResult> {
    if (!source) return { ok: false, message: "Missing source ticket." };
    const res = await client.api.projects[":key"].tickets[":num"].clone.$post({
      param: { key: projectKey, num: String(source.number) },
      json: {
        ticket: {
          title: values.title,
          description: values.description || undefined,
          statusID: values.statusID,
          priority: values.priority,
          assigneeID: values.assigneeID || undefined,
          labelIDs: values.labelIDs.length ? values.labelIDs : undefined,
          parentTicketID: values.parentTicket?.id,
          visibility: values.visibility,
        },
        copyAttachments: untrack(() => copyAttachments),
      },
    });

    if (!res.ok) return parseError(res, "Failed to clone ticket.");

    const body = await res.json();
    const cloneNumber = body.ticket.number;
    onclose();
    pushToast({
      message: `Cloned to ${projectKey}-${cloneNumber}.`,
      kind: "success",
      action: {
        label: "View",
        run: async () => {
          await goto(resolve("/projects/[key]/tickets/[num]", { key: projectKey, num: String(cloneNumber) }));
        },
      },
    });
    oncreated?.(body.ticket);
    return { ok: true };
  }

  async function parseError(res: Response, fallback: string): Promise<TicketFormSubmitResult> {
    const errorBody = (await res.json().catch(() => ({}))) as { message?: string; fieldErrors?: Record<string, string> };
    if (res.status === 400) {
      return { ok: false, message: errorBody.message ?? "Please fix the highlighted fields.", fieldErrors: errorBody.fieldErrors };
    }
    return { ok: false, message: errorBody.message ?? fallback };
  }

  async function handleSubmit(values: TicketFormValues): Promise<TicketFormSubmitResult> {
    try {
      return mode === "clone" ? await submitClone(values) : await submitCreate(values);
    } catch {
      return { ok: false, message: "Network error. Please try again." };
    }
  }
</script>

<Modal {open} title={headerText} {onclose} maxWidth="44rem">
  {#if open}
    <TicketForm
      {statuses}
      {labels}
      {members}
      {currentUserID}
      {projectKey}
      initialValues={formPrefill}
      excludeParentNumber={parentExclude}
      submitLabel={submitText}
      onsubmit={handleSubmit}
      oncancel={onclose}
    >
      {#snippet extras()}
        {#if mode === "clone" && source}
          <Checkbox bind:checked={copyAttachments}>
            Copy attachments from {projectKey}-{source.number}
          </Checkbox>
        {/if}
      {/snippet}
    </TicketForm>
  {/if}
</Modal>
