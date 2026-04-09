import { resolve } from "$app/paths";
import { goto } from "$app/navigation";
import { client } from "$lib/api/client";

interface User {
  name: string;
  email: string;
  avatarURL: string | null;
  createdAt: string;
}

let user: User | null = $state(null);
let loaded = $state(false);

/**
 * Get the currently logged in user if it exists.
 * @returns User or null
 */
export function getUser() {
  return user;
}

/**
 * Checks if the user data has finished loading.
 * @returns Boolean
 */
export function isLoaded() {
  return loaded;
}

/**
 * Calls the `login` endpoint and refreshes the user state.
 * @param email User's email
 * @param password User's password
 */
export async function login(email: string, password: string) {
  const res = await client.api.auth.login.$post({
    json: { email, password },
  });

  if (!res.ok) {
    const data = (await res.json()) as { message?: string };
    throw new Error(data.message || "Login failed");
  }

  await fetchUser();
}

/**
 * Calls the `logout` endpoint and wipes the user state.
 */
export async function logout() {
  await client.api.auth.logout.$post();
  user = null;
}

/**
 * Fetches the current user info from the API and updates the `user` and `loaded` state.
 */
export async function fetchUser() {
  try {
    const res = await client.api.auth.me.$get();
    if (!res.ok) {
      user = null;
    } else {
      const data = await res.json();
      user = data.user;
    }
  } catch {
    user = null;
  } finally {
    loaded = true;
  }
}

/**
 * Redirects to `/login` if the user is not authed.
 */
export function guardRoute() {
  $effect(() => {
    if (loaded && !user) goto(resolve("/login"));
  });
}
