import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/ui/dialog";
import headsImg from "@/assets/heads.webp";
import tailsImg from "@/assets/tails.webp";
import { MeteorImpactBorder } from "@/app/component2/proui/meteor-impact-border";

/* ───────────────────────────────────────────────
   Toss Time — Clean & Minimal Coin Toss
   ─────────────────────────────────────────────── */

type TossResult = "HEADS" | "TAILS" | null;

interface TossModalProps {
    open: boolean;
    onClose: () => void;
}

export function TossModal({ open, onClose }: TossModalProps) {
    const [tossing, setTossing] = useState(false);
    const [result, setResult] = useState<TossResult>(null);
    const [showResult, setShowResult] = useState(false);
    // Holds either a resting angle (number) or a 3-point keyframe array
    // [start, preLanding, landing] while a toss is in flight.
    const [rotation, setRotation] = useState<number | number[]>(0);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const currentRotation = Array.isArray(rotation) ? rotation[rotation.length - 1] : rotation;

    // Clear any pending landing if the modal unmounts mid-flight
    useEffect(() => () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }, []);

    // Reset state when modal opens
    useEffect(() => {
        if (open) {
            setTossing(false);
            setResult(null);
            setShowResult(false);
            setRotation(0);
        }
    }, [open]);

    const doToss = useCallback(() => {
        // Prevent multiple tosses while one is in progress
        if (tossing) return;

        setTossing(true);
        setShowResult(false);
        setResult(null);

        const outcome: TossResult = Math.random() < 0.5 ? "HEADS" : "TAILS";

        // 10-second flight: a steady linear spin (≈14 turns) covering 92% of
        // the time, then a 0.8s ease-out settle of the final turn onto the
        // correct face. Keyframing this way avoids the long near-stationary
        // crawl an easeInOut tail produces, which read as a stuck toss.
        const currentSpins = Math.floor(currentRotation / 360);
        const nextTargetBase = (currentSpins + 14) * 360;
        const nextRotation = nextTargetBase + (outcome === "TAILS" ? 180 : 0);

        setRotation([currentRotation, nextRotation - 360, nextRotation]);

        // Landing logic — must match the flip transition duration below
        timeoutRef.current = setTimeout(() => {
            setResult(outcome);
            setTossing(false);
            setShowResult(true);
        }, 10000);
    }, [tossing, rotation]);

    const handleClose = useCallback(() => {
        if (tossing) return;
        onClose();
    }, [tossing, onClose]);

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            if (!isOpen && tossing) return;
            if (!isOpen) onClose();
        }}>
            <DialogContent
                className="border-0 bg-transparent shadow-none max-w-[360px] p-0 overflow-visible [&>button]:hidden"
                onPointerDownOutside={(e) => {
                    if (tossing) e.preventDefault();
                }}
                onEscapeKeyDown={(e) => {
                    if (tossing) e.preventDefault();
                }}
            >
                <DialogTitle className="sr-only">Coin Toss</DialogTitle>
                <div className="relative">
                    <button
                        onClick={(e) => { e.stopPropagation(); handleClose(); }}
                        disabled={tossing}
                        aria-label="Close toss modal"
                        className="absolute top-4 right-4 z-20 h-8 w-8 rounded-full flex items-center justify-center bg-white/5 text-white/40 hover:text-white transition-colors cursor-pointer border-none"
                    >
                        <X className="h-4 w-4" />
                    </button>

                    <MeteorImpactBorder className="rounded-[34px] w-full">
                        <div
                            onClick={doToss}
                            className={`w-full rounded-[32px] overflow-hidden shadow-2xl flex flex-col items-center
                                        ${!tossing ? 'cursor-pointer' : 'cursor-default'}`}
                            style={{ backgroundColor: "#0a0a0a" }}
                        >
                            {/* Title Section */}
                            <div className="pt-10 pb-6 text-center select-none">
                                <h2 className="text-[10px] tracking-[0.3em] uppercase text-primary font-bold mb-1">Play Turf</h2>
                                <h1 className="text-2xl font-black tracking-widest uppercase text-white">Toss Time</h1>
                            </div>

                            {/* Coin Section */}
                            <div className="py-8 md:py-10 flex items-center justify-center perspective-1000">
                                <div className="w-[35vw] h-[35vw] max-w-[160px] max-h-[160px] min-w-[120px] min-h-[120px] relative preserve-3d">
                                    {/* Glow halo while the coin is airborne — a sibling
                                        layer, because a filter on the preserve-3d element
                                        itself would flatten the 3D backface flip. */}
                                    <motion.div
                                        className="absolute -inset-5 rounded-full bg-primary/30 blur-xl pointer-events-none"
                                        animate={{ opacity: tossing ? 1 : 0 }}
                                        transition={{ duration: 0.8 }}
                                    />
                                    <motion.div
                                        className="w-full h-full relative preserve-3d"
                                        animate={{ rotateY: rotation }}
                                        transition={
                                            Array.isArray(rotation)
                                                ? { duration: 10, times: [0, 0.92, 1], ease: ["linear", "easeOut"] }
                                                : { duration: 0 }
                                        }
                                    >
                                        <div className="absolute inset-0 backface-hidden">
                                            <img src={headsImg} alt="Heads" className="w-full h-full object-contain rounded-full" loading="lazy" decoding="async" />
                                        </div>
                                        <div className="absolute inset-0 backface-hidden" style={{ transform: "rotateY(180deg)" }}>
                                            <img src={tailsImg} alt="Tails" className="w-full h-full object-contain rounded-full" loading="lazy" decoding="async" />
                                        </div>
                                    </motion.div>
                                </div>
                            </div>

                            {/* Result Section */}
                            <div className="h-24 flex items-center justify-center pb-8">
                                <AnimatePresence mode="wait">
                                    {showResult && result ? (
                                        <motion.div
                                            key="result"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="text-3xl font-black tracking-[0.3em] text-primary"
                                        >
                                            {result}
                                        </motion.div>
                                    ) : tossing ? (
                                        <motion.div
                                            key="flipping"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="text-[10px] text-white/60 font-bold tracking-[0.4em] uppercase"
                                        >
                                            Flipping...
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="idle"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="text-[10px] text-white/50 font-bold tracking-[0.4em] uppercase"
                                        >
                                            Click to flip
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </MeteorImpactBorder>
                </div>
            </DialogContent>
        </Dialog>
    );
}