<script lang="ts">
  import { invalidateAll } from "$app/navigation";
  import type { CurrentUser } from "@issues/api";
  import { deleteUserAvatar, uploadUserAvatar } from "$lib/uploads";
  import AvatarEditor from "./AvatarEditor.svelte";

  let { user }: { user: CurrentUser } = $props();

  async function save(file: File) {
    await uploadUserAvatar(file);
    await invalidateAll();
  }

  async function remove() {
    await deleteUserAvatar();
    await invalidateAll();
  }
</script>

<AvatarEditor name={user.name} avatarURL={user.avatarURL} onsave={save} onremove={remove} />
