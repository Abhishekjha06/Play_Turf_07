import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, UserPlus, Mail } from 'lucide-react';
import { Badge } from '@/ui/badge';

export const BetaTestingDashboard = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [inviting, setInviting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.admin.listBetaUsers();
      setUsers(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to load beta users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setInviting(true);
    try {
      await api.admin.inviteBetaUser(email, notes);
      toast.success("Beta user invited successfully");
      setEmail("");
      setNotes("");
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message || "Failed to invite beta user");
    } finally {
      setInviting(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.admin.updateBetaUserStatus(id, status);
      toast.success("Status updated");
      fetchUsers();
    } catch (e: any) {
      toast.error(e.message || "Failed to update status");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        {/* Invite Form */}
        <div className="card-panel p-6 rounded-3xl md:col-span-1 border border-white/5 bg-panel-2">
          <h3 className="font-bold flex items-center gap-2 mb-4 font-display">
            <UserPlus className="w-5 h-5 text-primary" /> Invite Tester
          </h3>
          <form onSubmit={handleInvite} className="space-y-4">
            <label className="block">
              <span className="text-xs text-muted2 uppercase tracking-wider font-semibold">Email Address</span>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-soft" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-background border border-white/10 rounded-xl h-11 pl-10 pr-3 text-sm focus:border-primary outline-none"
                  placeholder="tester@example.com"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-xs text-muted2 uppercase tracking-wider font-semibold">Notes (Optional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full bg-background border border-white/10 rounded-xl p-3 text-sm focus:border-primary outline-none resize-none"
                rows={2}
                placeholder="e.g. Test Group A"
              />
            </label>
            <button
              disabled={inviting}
              type="submit"
              className="w-full h-11 bg-primary text-primary-foreground font-bold rounded-xl shadow-neon flex items-center justify-center disabled:opacity-50"
            >
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Invite"}
            </button>
          </form>
        </div>

        {/* User List */}
        <div className="card-panel p-6 rounded-3xl md:col-span-2 border border-white/5 bg-panel-2 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold font-display text-lg">Beta Users</h3>
            <Badge variant="outline">{users.length} Total</Badge>
          </div>
          
          <div className="flex-1 overflow-auto max-h-[500px]">
            {loading ? (
              <div className="flex justify-center p-10"><Loader2 className="animate-spin w-6 h-6 text-primary" /></div>
            ) : users.length === 0 ? (
              <div className="text-center p-10 border border-dashed border-white/10 rounded-2xl text-soft text-sm">
                No beta users invited yet.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase text-muted2 font-semibold">
                    <th className="pb-2 font-normal">Email</th>
                    <th className="pb-2 font-normal">Status</th>
                    <th className="pb-2 font-normal hidden md:table-cell">Date</th>
                    <th className="pb-2 font-normal">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-white/5">
                      <td className="py-3 font-medium">{u.email}<br/><span className="text-[10px] text-muted2 font-normal">{u.notes}</span></td>
                      <td className="py-3">
                        <Badge variant={u.status === 'Approved' || u.status === 'Active' ? 'default' : u.status === 'Rejected' ? 'destructive' : 'secondary'}>
                          {u.status}
                        </Badge>
                      </td>
                      <td className="py-3 hidden md:table-cell text-soft text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="py-3">
                        <select
                          value={u.status}
                          onChange={(e) => updateStatus(u.id, e.target.value)}
                          className="bg-background border border-white/10 rounded-lg text-[10px] p-1.5 outline-none"
                        >
                          <option value="Invited">Invited</option>
                          <option value="Approved">Approved</option>
                          <option value="Active">Active</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
