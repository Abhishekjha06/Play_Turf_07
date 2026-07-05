import React, { useState, useRef } from "react";
import { Avatar, AvatarImage } from "@/ui/avatar";
import { updateUserAvatar } from "@/lib/auth";
import { Check, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/ui/dialog";
import { useAuth } from "@/hooks/use-auth";

const PREDEFINED_AVATARS = [
  "https://robohash.org/player1.png",
  "https://robohash.org/player2.png",
  "https://robohash.org/player3.png",
  "https://robohash.org/player4.png",
  "https://robohash.org/player5.png",
];

export function AvatarPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<string | undefined>(user?.picture);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelected(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (selected) {
      updateUserAvatar(selected);
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="relative w-[90%] max-w-sm card-panel rounded-3xl p-5 shadow-2xl border border-border/40 gap-0">
        <DialogTitle className="text-lg font-bold font-display text-foreground mb-1">Choose Avatar</DialogTitle>
        <DialogDescription className="text-xs text-muted2 mb-4">Select a profile picture for your account</DialogDescription>

        <div className="flex flex-wrap justify-center gap-4 mb-6">
          {/* Custom Image Upload Button */}
          <div className="relative">
            <button
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload avatar from device"
              className="relative rounded-full transition-transform hover:scale-110 active:scale-95 focus:outline-none flex items-center justify-center h-16 w-16 bg-muted/50 border-2 border-dashed border-border/50 hover:border-primary/50"
            >
              <Upload className="w-5 h-5 text-muted-foreground" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
          </div>

          {/* Show uploaded custom avatar if selected */}
          {selected && !PREDEFINED_AVATARS.includes(selected) && (
            <button
              onClick={() => setSelected(selected)}
              aria-label="Use uploaded custom avatar"
              className="relative rounded-full transition-transform hover:scale-110 active:scale-95 focus:outline-none"
            >
              <Avatar className="h-16 w-16 transition-all duration-300 ring-2 ring-primary ring-offset-2 ring-offset-background shadow-neon">
                <AvatarImage src={selected} alt="Custom Upload" />
              </Avatar>
              <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-1 shadow-lg">
                <Check className="w-3 h-3 text-primary-foreground" />
              </div>
            </button>
          )}

          {PREDEFINED_AVATARS.map((avatar, i) => {
            const isSelected = selected === avatar;
            return (
              <button
                key={i}
                onClick={() => setSelected(avatar)}
                aria-label={`Select avatar ${i + 1}`}
                className="relative rounded-full transition-transform hover:scale-110 active:scale-95 focus:outline-none"
              >
                <Avatar className={`h-16 w-16 transition-all duration-300 ${isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-neon" : "opacity-80 hover:opacity-100"}`}>
                  <AvatarImage src={avatar} alt={`Avatar ${i + 1}`} />
                </Avatar>
                {isSelected && (
                  <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-1 shadow-lg">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleSave}
          className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl shadow-neon transition-transform active:scale-95"
        >
          Save Avatar
        </button>
      </DialogContent>
    </Dialog>
  );
}
