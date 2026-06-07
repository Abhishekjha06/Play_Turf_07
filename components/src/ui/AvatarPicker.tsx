import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarImage } from "@/ui/Avatar";
import { updateUserAvatar } from "@/lib/auth";
import { X, Check, Upload } from "lucide-react";
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

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-[90%] max-w-sm card-panel rounded-3xl p-5 shadow-2xl border border-border/40"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-lg font-bold font-display text-foreground mb-4">Choose Avatar</h3>
            
            <div className="flex flex-wrap justify-center gap-4 mb-6">
              {/* Custom Image Upload Button */}
              <div className="relative">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="relative rounded-full transition-transform hover:scale-110 active:scale-95 focus:outline-none flex items-center justify-center h-16 w-16 bg-muted/50 border-2 border-dashed border-border/50 hover:border-primary/50"
                  title="Upload from device"
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
