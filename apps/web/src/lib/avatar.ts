/** The image types an avatar can be. The picker and a dropped file both follow this list. */
export const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** The value for the `accept` attribute of the file picker. */
export const AVATAR_ACCEPT = AVATAR_TYPES.join(",");

export function isAvatarType(mimeType: string): boolean {
  return (AVATAR_TYPES as readonly string[]).includes(mimeType);
}
