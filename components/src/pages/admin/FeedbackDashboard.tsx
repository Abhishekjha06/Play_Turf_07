import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, ExternalLink } from 'lucide-react';
import { Badge } from '@/ui/badge';

export const FeedbackDashboard = () => {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const data = await api.admin.listFeedback();
      setFeedbacks(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to load feedbacks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.admin.updateFeedbackStatus(id, { status });
      toast.success("Status updated");
      fetchFeedbacks();
    } catch (e: any) {
      toast.error(e.message || "Failed to update status");
    }
  };

  const updatePriority = async (id: string, priority: string) => {
    try {
      await api.admin.updateFeedbackStatus(id, { priority });
      toast.success("Priority updated");
      fetchFeedbacks();
    } catch (e: any) {
      toast.error(e.message || "Failed to update priority");
    }
  };

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold font-display">User Feedback</h2>
        <Badge variant="outline">{feedbacks.length} Total</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {feedbacks.map((f) => (
          <div key={f.id} className="card-panel rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">{f.name}</p>
                <p className="text-xs text-muted2">{f.email}</p>
              </div>
              <Badge variant="secondary" className="text-[10px]">{f.category}</Badge>
            </div>
            
            <p className="text-sm bg-black/20 p-3 rounded-xl min-h-[80px]">{f.message}</p>

            {f.screenshot_url && (
              <a href={f.screenshot_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline">
                <ExternalLink className="w-3 h-3" /> View Screenshot
              </a>
            )}

            <div className="text-[10px] text-muted2 flex flex-col gap-1 border-t border-white/5 pt-2 mt-2">
              <div className="flex justify-between">
                <span>Device: {f.device_type} / {f.os} / {f.browser}</span>
                <span>{f.screen_width}x{f.screen_height}</span>
              </div>
              <div className="flex justify-between">
                <span>Page: {f.page_url?.substring(0, 30)}...</span>
                <span>{new Date(f.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="flex gap-2 mt-auto pt-3">
              <select
                value={f.priority || 'Low'}
                onChange={(e) => updatePriority(f.id, e.target.value)}
                className="flex-1 bg-background border border-white/10 rounded-lg text-xs p-2 outline-none"
              >
                <option value="Low">Low Priority</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
              
              <select
                value={f.status || 'Open'}
                onChange={(e) => updateStatus(f.id, e.target.value)}
                className="flex-1 bg-background border border-white/10 rounded-lg text-xs p-2 outline-none"
              >
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
          </div>
        ))}
        {feedbacks.length === 0 && (
          <p className="text-soft text-sm text-center col-span-full p-10 border border-dashed border-white/10 rounded-2xl">
            No feedback received yet.
          </p>
        )}
      </div>
    </div>
  );
};
