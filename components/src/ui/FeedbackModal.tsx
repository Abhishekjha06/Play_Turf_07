import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, CheckCircle2, Loader2, MessageSquarePlus } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  "Bug Report",
  "Feature Request",
  "Booking Issue",
  "Payment Issue",
  "UI Issue",
  "Performance Issue",
  "General Feedback"
];

function getBrowser() {
  const ua = navigator.userAgent;
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("SamsungBrowser")) return "Samsung Browser";
  if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
  if (ua.includes("Edge")) return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  return "Other";
}

function getOS() {
  const ua = navigator.userAgent;
  if (ua.includes("Win")) return "Windows";
  if (ua.includes("Mac")) return "MacOS";
  if (ua.includes("Linux")) return "Linux";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("like Mac")) return "iOS";
  return "Other";
}

function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        // Compress to webp at 80% quality
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: "image/webp" }));
            } else {
              reject(new Error("Compression failed"));
            }
          },
          "image/webp",
          0.8
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    category: CATEGORIES[0],
    message: ''
  });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) {
      toast.error("Only JPG, PNG, and WEBP formats are allowed.");
      return;
    }

    if (selected.size > 5 * 1024 * 1024) {
      toast.error("Screenshot size must be under 5MB.");
      return;
    }

    try {
      const compressed = await compressImage(selected);
      setFile(compressed);
      toast.success("Screenshot compressed & ready");
    } catch (e) {
      toast.error("Failed to compress image");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let screenshot_url;
      if (file) {
        screenshot_url = await api.uploadScreenshot(file);
      }

      await api.submitFeedback({
        ...form,
        screenshot_url,
        device_type: /Mobi|Android/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop',
        browser: getBrowser(),
        os: getOS(),
        app_version: '1.0.0', // Set to your actual version if available
        screen_width: window.innerWidth,
        screen_height: window.innerHeight,
        page_url: window.location.pathname + window.location.search
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setForm({ name: '', email: '', category: CATEGORIES[0], message: '' });
        setFile(null);
        onClose();
      }, 2000);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit feedback");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg pointer-events-auto"
            >
              <div className="card-panel relative flex flex-col gap-4 overflow-hidden rounded-3xl p-6 shadow-2xl bg-panel-2">
              <button
                onClick={onClose}
                className="absolute right-4 top-4 rounded-full bg-white/5 p-2 text-soft transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary">
                  <MessageSquarePlus className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-display">Send Feedback</h2>
                  <p className="text-xs text-muted2">Help us improve your experience</p>
                </div>
              </div>

              {success ? (
                <div className="py-10 flex flex-col items-center text-center space-y-3">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", bounce: 0.5 }}
                  >
                    <CheckCircle2 className="w-16 h-16 text-green-500" />
                  </motion.div>
                  <p className="text-lg font-bold">Feedback Submitted!</p>
                  <p className="text-sm text-soft">Thank you for helping us improve Play_Turf.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted2">Name</span>
                      <input 
                        required
                        type="text" 
                        value={form.name}
                        onChange={(e) => setForm({...form, name: e.target.value})}
                        className="mt-1 h-11 w-full rounded-2xl border border-white/10 bg-background px-3 text-sm outline-none focus:border-primary" 
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted2">Email</span>
                      <input 
                        required
                        type="email" 
                        value={form.email}
                        onChange={(e) => setForm({...form, email: e.target.value})}
                        className="mt-1 h-11 w-full rounded-2xl border border-white/10 bg-background px-3 text-sm outline-none focus:border-primary" 
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted2">Category</span>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({...form, category: e.target.value})}
                      className="mt-1 h-11 w-full rounded-2xl border border-white/10 bg-background px-3 text-sm outline-none focus:border-primary appearance-none"
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted2">Message</span>
                    <textarea 
                      required
                      rows={4}
                      value={form.message}
                      onChange={(e) => setForm({...form, message: e.target.value})}
                      placeholder="Tell us what happened or what you'd like to see..."
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-background p-3 text-sm outline-none focus:border-primary resize-none" 
                    />
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted2">Screenshot (Optional, auto-compressed)</span>
                    <div className="mt-1 relative flex items-center justify-center w-full h-24 border-2 border-dashed border-white/10 rounded-2xl hover:border-primary/50 transition-colors group cursor-pointer overflow-hidden">
                      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                      {file ? (
                        <div className="text-center">
                          <p className="text-sm font-semibold text-primary">{file.name}</p>
                          <p className="text-[10px] text-muted2">{(file.size / 1024).toFixed(1)} KB (WEBP)</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-soft group-hover:text-primary transition-colors">
                          <Upload className="w-5 h-5" />
                          <span className="text-xs">Tap to upload image (Max 5MB)</span>
                        </div>
                      )}
                    </div>
                  </label>

                  <button 
                    disabled={loading}
                    type="submit" 
                    className="w-full h-12 mt-4 rounded-full bg-primary font-bold text-primary-foreground shadow-neon disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {loading ? 'Submitting...' : 'Submit Feedback'}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      </>
      )}
    </AnimatePresence>
  );
};
