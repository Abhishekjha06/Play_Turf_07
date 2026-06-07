import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Activity, Database, Server, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export const SystemHealthDashboard = () => {
  const [health, setHealth] = useState<{ latency: number; realtime: string; db_status: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchHealth = async () => {
    try {
      const data = await api.admin.getSystemHealth();
      setHealth(data);
      setLastUpdated(new Date());
    } catch (e) {
      setHealth({ latency: -1, realtime: 'Error', db_status: 'Error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // 30s auto-refresh
    return () => clearInterval(interval);
  }, []);

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'Healthy' || status === 'Connected') return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    if (status === 'Error' || status === 'Offline') return <AlertCircle className="w-5 h-5 text-red-500" />;
    return <RefreshCw className="w-5 h-5 text-yellow-500 animate-spin" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold font-display flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" /> System Health
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted2">Last check: {lastUpdated.toLocaleTimeString()}</span>
          <button 
            onClick={() => { setLoading(true); fetchHealth(); }}
            disabled={loading}
            className="p-2 rounded-full bg-panel-2 hover:bg-white/10 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary' : 'text-soft'}`} />
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="card-panel p-6 rounded-3xl border border-white/5 bg-panel-2 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-muted2 uppercase tracking-wider">Database Status</span>
            <Database className="w-4 h-4 text-soft" />
          </div>
          <div className="flex items-end gap-3 mt-2">
            <span className="text-3xl font-black font-display tracking-tight">
              {health?.db_status || 'Checking'}
            </span>
            <div className="mb-1"><StatusIcon status={health?.db_status || 'Checking'} /></div>
          </div>
          <p className="text-xs text-soft mt-1">Supabase DB connection health</p>
        </div>

        <div className="card-panel p-6 rounded-3xl border border-white/5 bg-panel-2 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-muted2 uppercase tracking-wider">API Latency</span>
            <Server className="w-4 h-4 text-soft" />
          </div>
          <div className="flex items-end gap-3 mt-2">
            <span className="text-3xl font-black font-display tracking-tight text-primary">
              {health ? (health.latency >= 0 ? `${health.latency}ms` : 'Error') : '--'}
            </span>
            {health && health.latency >= 0 && (
              <span className={`text-xs font-bold mb-1.5 ${health.latency < 200 ? 'text-green-500' : health.latency < 500 ? 'text-yellow-500' : 'text-red-500'}`}>
                {health.latency < 200 ? 'Fast' : health.latency < 500 ? 'Normal' : 'Slow'}
              </span>
            )}
          </div>
          <p className="text-xs text-soft mt-1">Round-trip time to database</p>
        </div>

        <div className="card-panel p-6 rounded-3xl border border-white/5 bg-panel-2 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-muted2 uppercase tracking-wider">Realtime Service</span>
            <Activity className="w-4 h-4 text-soft" />
          </div>
          <div className="flex items-end gap-3 mt-2">
            <span className="text-3xl font-black font-display tracking-tight">
              {health?.realtime || 'Checking'}
            </span>
            <div className="mb-1"><StatusIcon status={health?.realtime || 'Checking'} /></div>
          </div>
          <p className="text-xs text-soft mt-1">WebSocket connectivity</p>
        </div>
      </div>
    </div>
  );
};
