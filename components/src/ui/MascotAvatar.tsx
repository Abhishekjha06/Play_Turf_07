import { useState } from "react";
import { cn } from "@/lib/utils";
import { getAvatarById } from "@/lib/avatars";

/**
 * The single centralized mascot avatar renderer — every screen displays the
 * user's selected avatar through this component (never per-screen logic).
 *
 * - Fixed container: no layout shift while the image loads.
 * - Falls back to the default Yeti if the stored id is unknown or the file
 *   fails to load.
 * - Artwork is identical in both themes; only the subtle plate behind it uses
 *   the theme tokens.
 *
 * shape:
 *  - "circle" — round plate (header, profile chips, player lists)
 *  - "card"   — transparent, full-body mascot (selection cards, big profiles)
 */
export function MascotAvatar({
  avatarId,
  className,
  alt,
  shape = "circle",
}: {
  /** The stored `profiles.avatar_id` — missing/unknown resolves to the default. */
  avatarId?: string | null;
  /** Size classes, e.g. "h-9 w-9" or "h-24 w-24". */
  className?: string;
  alt?: string;
  shape?: "circle" | "card";
}) {
  const [failed, setFailed] = useState(false);
  const avatar = getAvatarById(avatarId);
  const src = failed ? getAvatarById(null).src : avatar.src;

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden",
        shape === "circle" ? "rounded-full bg-panel-2" : "rounded-2xl",
        className,
      )}
      data-avatar-id={avatar.id}
    >
      <img
        src={src}
        alt={alt ?? `${avatar.name} mascot`}
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setFailed(true)}
        className="h-full w-full select-none object-contain"
      />
    </div>
  );
}
