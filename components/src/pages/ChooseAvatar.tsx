import { useSeo } from "@/hooks/use-seo";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MobileShell } from "@/layout/MobileShell";
import { BackButton } from "@/layout/BackButton";
import { MascotAvatar } from "@/ui/MascotAvatar";
import { AVATARS, DEFAULT_AVATAR_ID } from "@/lib/avatars";
import { updateUserAvatar } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

/**
 * Choose Your Avatar — the single selection surface for the mascot system.
 * Mobile-first grid, token-only colors (identical in Premium Teal and AMOLED
 * Black; the artwork itself never changes between themes).
 */
export default function ChooseAvatar() {
  useSeo({ title: "Choose Avatar", description: "Pick your player avatar.", path: "/avatar", noindex: true });

  const { user, loading } = useAuth();
  const [selectedId, setSelectedId] = useState<string>(user?.avatar_id || DEFAULT_AVATAR_ID);
  const [saving, setSaving] = useState(false);

  // Restore the previously saved avatar whenever the profile (re)loads.
  useEffect(() => {
    if (user) setSelectedId(user.avatar_id || DEFAULT_AVATAR_ID);
  }, [user?.avatar_id]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateUserAvatar(selectedId);
      const avatar = AVATARS.find((a) => a.id === selectedId);
      toast.success(`Say hello to ${avatar?.name ?? "your mascot"}! 🎉`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save your avatar. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileShell>
      <div className="px-5 pt-5">
        <BackButton />
      </div>

      <div className="px-5 pb-28 pt-4">
        {/* Header */}
        <div className="text-center">
          <h1 className="font-display text-3xl font-black tracking-tight text-foreground">
            Choose Your Avatar
          </h1>
          <p className="mt-2 text-sm text-soft">Pick a character to represent you on Play Turf.</p>
        </div>

        {loading ? (
          <div className="mt-16 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !user ? (
          /* Signed-out state */
          <div className="card-panel mt-10 rounded-3xl p-8 text-center">
            <MascotAvatar avatarId="yeti" shape="card" className="mx-auto h-32 w-32" alt="Yeti mascot" />
            <p className="mt-4 text-sm font-semibold text-foreground">Sign in to pick your mascot</p>
            <p className="mt-1 text-xs text-muted2">Your avatar travels with you across all of Play Turf.</p>
            <Link
              to="/login"
              className="pressable mt-5 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-neon"
            >
              Sign In
            </Link>
          </div>
        ) : (
          <>
            {/* Avatar grid */}
            <div
              className="mt-8 grid grid-cols-2 gap-3 min-[380px]:grid-cols-3 sm:gap-4 md:grid-cols-5"
              role="radiogroup"
              aria-label="Choose your avatar"
            >
              {AVATARS.map((avatar) => {
                const isSelected = selectedId === avatar.id;
                return (
                  <motion.button
                    key={avatar.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`Select ${avatar.name}`}
                    onClick={() => setSelectedId(avatar.id)}
                    whileTap={{ scale: 0.95 }}
                    animate={{ scale: isSelected ? 1.04 : 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 24 }}
                    className={cn(
                      "card-panel relative flex flex-col items-center rounded-3xl p-3 pt-4 transition-colors cursor-pointer",
                      isSelected
                        ? "border-2 border-primary shadow-neon"
                        : "opacity-85 hover:opacity-100 hover:border-primary/40",
                    )}
                    data-testid={`avatar-card-${avatar.id}`}
                  >
                    <MascotAvatar
                      avatarId={avatar.id}
                      shape="card"
                      className="h-20 w-full min-[380px]:h-24"
                      alt={`${avatar.name} mascot`}
                    />
                    <span
                      className={cn(
                        "mt-2 text-xs font-bold",
                        isSelected ? "text-primary" : "text-foreground",
                      )}
                    >
                      {avatar.name}
                    </span>

                    {/* Selected checkmark */}
                    {isSelected && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-primary shadow-neon"
                      >
                        <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3.5} />
                      </motion.span>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Save */}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="pressable mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 font-bold text-primary-foreground shadow-neon disabled:opacity-60"
              data-testid="save-avatar"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                "Save Avatar"
              )}
            </button>
            <p className="mt-3 text-center text-[11px] text-muted2">
              Your mascot shows up on your profile, bookings, games and player lists.
            </p>
          </>
        )}
      </div>
    </MobileShell>
  );
}
