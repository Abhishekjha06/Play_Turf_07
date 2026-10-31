import yetiSrc from "@/assets/avatars/yetiky.webp";
import skySrc from "@/assets/avatars/skylyt.webp";
import blushSrc from "@/assets/avatars/blushsy.webp";
import mintSrc from "@/assets/avatars/mintly.webp";
import buddySrc from "@/assets/avatars/budly.webp";

/**
 * Single source of truth for the Play Turf mascot avatar system.
 * `id` is the permanent value stored in `profiles.avatar_id` (Supabase);
 * `src` points at the bundled artwork — swap the file to upgrade the art
 * without touching any code. Add new mascots here only.
 */
export type AvatarId = "yeti" | "sky" | "blush" | "mint" | "buddy";

export interface AvatarDefinition {
  id: AvatarId;
  name: string;
  src: string;
}

export const DEFAULT_AVATAR_ID: AvatarId = "yeti";

export const AVATARS: AvatarDefinition[] = [
  { id: "yeti", name: "Yeti", src: yetiSrc },
  { id: "sky", name: "Sky", src: skySrc },
  { id: "blush", name: "Blush", src: blushSrc },
  { id: "mint", name: "Mint", src: mintSrc },
  { id: "buddy", name: "Buddy", src: buddySrc },
];

/** Resolves any stored avatar id to a definition — unknown/missing → Yeti (default). */
export function getAvatarById(id?: string | null): AvatarDefinition {
  return AVATARS.find((avatar) => avatar.id === id) ?? AVATARS[0];
}
