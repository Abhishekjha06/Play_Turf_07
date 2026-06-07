import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import { useCricketBooking } from "../BookingContext";
import { TeamAvatar } from "./TeamAvatar";
import { NeonButton } from "./NeonButton";

export function TeamManagerModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { state, addTeam, updateTeam, removeTeam } = useCricketBooking();
  const [newTeam, setNewTeam] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] overflow-auto border-cyan-300/20 bg-[#050810]/95 text-white shadow-[0_0_80px_rgba(34,211,238,.2)]">
        <DialogHeader>
          <DialogTitle>Manage Teams</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <input
            value={newTeam}
            onChange={(event) => setNewTeam(event.target.value)}
            className="h-12 flex-1 rounded-xl border border-white/10 bg-white/10 px-4 text-sm outline-none focus:border-cyan-300/70"
            placeholder="Add new team"
          />
          <NeonButton
            type="button"
            className="px-4"
            onClick={() => {
              addTeam(newTeam);
              setNewTeam("");
              toast.success("Team added");
            }}
          >
            <Plus className="h-4 w-4" />
          </NeonButton>
        </div>
        <div className="space-y-3">
          {state.teams.map((team) => (
            <TeamEditor key={team.id} teamId={team.id} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );

  function TeamEditor({ teamId }: { teamId: string }) {
    const team = state.teams.find((item) => item.id === teamId)!;
    const [name, setName] = useState(team.name);
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3">
        <TeamAvatar team={team} size="sm" />
        <input value={name} onChange={(event) => setName(event.target.value)} className="h-10 min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" />
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/20"
          onClick={() => {
            updateTeam(team.id, name);
            toast.success("Team updated");
          }}
        >
          <Save className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-xl bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
          onClick={() => {
            removeTeam(team.id);
            toast.success("Team removed");
          }}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }
}
