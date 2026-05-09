<script lang="ts">
  import type { Comment } from "@issues/api";
  import { client } from "$lib/api/client";
  import { formatAbsolute, timeAgo } from "$lib/time";
  import Button from "$lib/components/ui/Button.svelte";
  import MarkdownEditor from "$lib/components/markdown/MarkdownEditor.svelte";
  import MarkdownRenderer from "$lib/components/markdown/MarkdownRenderer.svelte";
  import UserAvatar from "$lib/components/UserAvatar.svelte";

  interface CommentThreadProps {
    comments: Comment[];
    projectKey: string;
    ticketNumber: number;
    currentUserID: string;
    onmutated: () => void | Promise<void>;
  }

  let { comments, projectKey, ticketNumber, currentUserID, onmutated }: CommentThreadProps = $props();

  let draft = $state("");
  let posting = $state(false);
  let postError = $state<string | null>(null);
  let composing = $state(false);

  let editingID = $state<string | null>(null);
  let editDraft = $state("");
  let savingID = $state<string | null>(null);
  let editError = $state<string | null>(null);

  let deletingID = $state<string | null>(null);
  let confirmDeleteID = $state<string | null>(null);

  const numParam = $derived(String(ticketNumber));

  async function postComment() {
    const body = draft.trim();
    if (!body || posting) return;

    posting = true;
    postError = null;
    try {
      const res = await client.api.projects[":key"].tickets[":num"].comments.$post({
        param: { key: projectKey, num: numParam },
        json: { body },
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        postError = data.message ?? "Failed to post comment.";
        return;
      }

      draft = "";
      composing = false;
      await onmutated();
    } finally {
      posting = false;
    }
  }

  function startComposing() {
    composing = true;
    postError = null;
  }

  function cancelComposing() {
    composing = false;
    draft = "";
    postError = null;
  }

  function startEdit(comment: Comment) {
    editingID = comment.id;
    editDraft = comment.body ?? "";
    editError = null;
  }

  function cancelEdit() {
    editingID = null;
    editDraft = "";
    editError = null;
  }

  async function saveEdit(commentID: string) {
    const body = editDraft.trim();
    if (!body || savingID) return;

    savingID = commentID;
    editError = null;
    try {
      const res = await client.api.projects[":key"].tickets[":num"].comments[":id"].$patch({
        param: { key: projectKey, num: numParam, id: commentID },
        json: { body },
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        editError = data.message ?? "Failed to save comment.";
        return;
      }

      editingID = null;
      editDraft = "";
      await onmutated();
    } finally {
      savingID = null;
    }
  }

  async function deleteComment(commentID: string) {
    if (deletingID) return;

    deletingID = commentID;
    try {
      const res = await client.api.projects[":key"].tickets[":num"].comments[":id"].$delete({
        param: { key: projectKey, num: numParam, id: commentID },
      });

      if (!res.ok) return;

      confirmDeleteID = null;
      await onmutated();
    } finally {
      deletingID = null;
    }
  }
</script>

<section class="comment-thread card" aria-label="Comments">
  <header class="thread-header">
    <h2>Comments</h2>
    <span class="thread-count">{comments.length}</span>
  </header>

  {#if comments.length === 0}
    <p class="thread-empty">No comments yet.</p>
  {:else}
    <ol class="comment-list">
      {#each comments as comment (comment.id)}
        <li class="comment" class:is-deleted={comment.isDeleted}>
          <div class="comment-avatar">
            <UserAvatar name={comment.author.name} avatarURL={comment.author.avatarURL} size="md" />
          </div>

          <article class="comment-body">
            <header class="comment-meta">
              <span class="comment-author">{comment.author.name}</span>
              <time class="comment-time" datetime={comment.createdAt} title={formatAbsolute(comment.createdAt)}>{timeAgo(comment.createdAt)}</time>
              {#if comment.editedAt && !comment.isDeleted}
                <span class="comment-edited" title={formatAbsolute(comment.editedAt)}>(edited)</span>
              {/if}

              {#if !comment.isDeleted && comment.authorID === currentUserID && editingID !== comment.id}
                <div class="comment-actions">
                  <button type="button" class="action-button" onclick={() => startEdit(comment)}>Edit</button>
                  {#if confirmDeleteID === comment.id}
                    <button type="button" class="action-button destructive" onclick={() => void deleteComment(comment.id)} disabled={deletingID === comment.id}>
                      {deletingID === comment.id ? "Deleting..." : "Confirm delete"}
                    </button>
                    <button type="button" class="action-button" onclick={() => (confirmDeleteID = null)}>Cancel</button>
                  {:else}
                    <button type="button" class="action-button destructive" onclick={() => (confirmDeleteID = comment.id)}>Delete</button>
                  {/if}
                </div>
              {/if}
            </header>

            {#if comment.isDeleted}
              <p class="comment-tombstone">Comment deleted.</p>
            {:else if editingID === comment.id}
              <div class="comment-edit">
                <MarkdownEditor bind:value={editDraft} minHeight="8rem" autofocus onsubmit={() => void saveEdit(comment.id)} attachmentContext={{ projectKey, ticketNumber }} />
                {#if editError}
                  <p class="comment-error" role="alert">{editError}</p>
                {/if}
                <div class="comment-edit-actions">
                  <Button type="button" variant="secondary" onclick={cancelEdit} disabled={savingID === comment.id}>Cancel</Button>
                  <Button type="button" onclick={() => void saveEdit(comment.id)} disabled={savingID === comment.id || !editDraft.trim()}>
                    {savingID === comment.id ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            {:else}
              <div class="comment-content">
                <MarkdownRenderer source={comment.body ?? ""} />
              </div>
            {/if}
          </article>
        </li>
      {/each}
    </ol>
  {/if}

  {#if composing}
    <form
      class="comment-composer"
      onsubmit={(event) => {
        event.preventDefault();
        void postComment();
      }}
    >
      <h3 class="composer-title">Add a comment</h3>
      <MarkdownEditor bind:value={draft} placeholder="Leave a comment..." minHeight="8rem" autofocus onsubmit={() => void postComment()} attachmentContext={{ projectKey, ticketNumber }} />
      {#if postError}
        <p class="comment-error" role="alert">{postError}</p>
      {/if}
      <div class="composer-actions">
        <Button type="button" variant="secondary" onclick={cancelComposing} disabled={posting}>Cancel</Button>
        <Button type="submit" disabled={posting || !draft.trim()}>{posting ? "Posting..." : "Comment"}</Button>
      </div>
    </form>
  {:else}
    <button type="button" class="composer-trigger" onclick={startComposing}>Add a comment</button>
  {/if}
</section>

<style>
  .comment-thread {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .thread-header {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;

    & h2 {
      color: var(--colour-text);
      font-size: 0.8rem;
      font-weight: 800;
    }
  }

  .thread-count {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--colour-muted);
    background: var(--colour-bg);
    border: var(--border);
    border-radius: 999px;
    padding: 0.1rem 0.5rem;
    line-height: 1.2;
  }

  .thread-empty {
    margin: 0;
    color: var(--colour-muted);
    font-size: 0.85rem;
    font-style: italic;
  }

  .comment-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .comment {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.75rem;
    align-items: start;

    &.is-deleted .comment-body {
      background: transparent;
      border-style: dashed;
    }
  }

  .comment-avatar {
    padding-top: 0.15rem;
  }

  .comment-body {
    min-width: 0;
    border: var(--border);
    border-radius: var(--border-radius-outer);
    background: var(--colour-bg);
    padding: 0.75rem 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;

    &:hover .comment-actions,
    &:focus-within .comment-actions {
      opacity: 1;
    }
  }

  .comment-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    font-size: 0.8rem;
    color: var(--colour-text-secondary);
  }

  .comment-author {
    font-weight: 700;
    color: var(--colour-text);
  }

  .comment-time {
    color: var(--colour-muted);
  }

  .comment-edited {
    color: var(--colour-muted);
    font-style: italic;
  }

  .comment-actions {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    opacity: 0;
    transition: opacity 120ms ease;
  }

  .action-button {
    background: transparent;
    border: 0;
    padding: 0.2rem 0.4rem;
    color: var(--colour-text-secondary);
    font-size: 0.75rem;
    font-weight: 600;
    font-family: inherit;
    border-radius: var(--border-radius-inner);
    cursor: pointer;

    &:hover {
      color: var(--colour-text);
      background: var(--colour-bg-lighter);
    }

    &.destructive:hover {
      color: var(--colour-error);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  .comment-tombstone {
    margin: 0;
    color: var(--colour-muted);
    font-style: italic;
    font-size: 0.85rem;
  }

  .comment-edit {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .comment-edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .comment-error {
    margin: 0;
    color: var(--colour-error);
    font-size: 0.8rem;
  }

  .comment-composer {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    padding-top: 0.5rem;
    border-top: var(--border);
  }

  .composer-title {
    color: var(--colour-text);
    font-size: 0.8rem;
    font-weight: 700;
  }

  .composer-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .composer-trigger {
    width: 100%;
    padding: 0.7rem 0.9rem;
    border: 1px dashed var(--colour-border);
    border-radius: var(--border-radius-inner);
    background: var(--colour-bg);
    color: var(--colour-muted);
    text-align: left;
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    transition:
      color 120ms ease,
      border-color 120ms ease,
      background 120ms ease;

    &:hover,
    &:focus-visible {
      color: var(--accent-base);
      border-color: var(--accent-tint-600);
      background: var(--accent-tint-900);
      outline: none;
    }
  }
</style>
