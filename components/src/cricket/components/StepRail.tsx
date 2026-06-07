import { CheckCircle2, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BookingStep } from "../types";

const labels = ["Pick Match", "Confirm Bet", "Success"];

export function StepRail({ step }: { step: BookingStep }) {
  return (
    <div className="glass mx-auto flex w-full max-w-3xl items-center justify-between rounded-2xl p-2">
      {labels.map((label, index) => {
        const current = index + 1;
        const active = current === step;
        const complete = current < step;
        return (
          <div key={label} className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl px-2 py-3 text-xs font-bold sm:text-sm", active && "bg-cyan-300/10 text-cyan-100", complete && "text-lime-200")}>
            {complete ? <CheckCircle2 className="h-4 w-4" /> : <CircleDot className={cn("h-4 w-4", active && "animate-pulse text-cyan-300")} />}
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
