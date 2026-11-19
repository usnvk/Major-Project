import React, { useEffect, useState } from 'react';
import { Activity, Database, Network, Server, Stethoscope } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchFLLiveStatus, fetchFLNodes, fetchFLCurrentModel } from '../services/api';

export default function HospitalDashboard() {
  const { user } = useAuth();
  const [liveStatus, setLiveStatus] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [model, setModel] = useState(null);

  const load = async () => {
    const [statusRes, nodesRes, modelRes] = await Promise.all([
      fetchFLLiveStatus(),
      fetchFLNodes(),
      fetchFLCurrentModel(),
    ]);
    if (statusRes.success) setLiveStatus(statusRes.data);
    if (nodesRes.success) setNodes(nodesRes.data);
    if (modelRes.success) setModel(modelRes.data);
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, []);

  const nodeId = user?.hospital_node?.includes('B') ? 'node_B' : 'node_A';
  const node = nodes.find((item) => item.node_id === nodeId);

  return (
    <div className="space-y-6 pb-16">
      <div className="bg-white p-6 rounded-2xl border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">{user?.name || 'Hospital Workspace'}</h1>
        <p className="text-sm text-slate-500 mt-1">Local dataset and federated client status</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric icon={Network} title="Connection" value={node?.status || 'offline'} />
        <Metric icon={Database} title="Local Samples" value={node?.dataset_size ?? 0} />
        <Metric icon={Activity} title="Round Stage" value={liveStatus?.stage || 'idle'} />
        <Metric icon={Server} title="Global Model" value={model?.version || 'v1'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <h2 className="font-bold text-slate-900 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-sky-600" />
            Hospital Client
          </h2>
          <div className="mt-4 space-y-2 text-xs text-slate-600">
            <div>Node: <span className="font-mono font-bold">{nodeId}</span></div>
            <div>IP: <span className="font-mono">{node?.ip_address || 'Not reported'}</span></div>
            <div>Loss: <span className="font-mono">{node?.last_loss ?? 'No update'}</span></div>
            <div>Accuracy: <span className="font-mono">{node?.last_acc ?? 'No update'}</span></div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <h2 className="font-bold text-slate-900">Federated Round</h2>
          <div className="mt-4 space-y-2 text-xs text-slate-600">
            <div>Round: <span className="font-mono">{liveStatus?.round_id || 'None'}</span></div>
            <div>Aggregation: <span className="font-mono">{liveStatus?.aggregation_method || 'FedAvg'}</span></div>
            <div>Active: <span className="font-mono">{liveStatus?.is_active ? 'Yes' : 'No'}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, title, value }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200">
      <Icon className="w-5 h-5 text-sky-600 mb-3" />
      <div className="text-[11px] uppercase font-bold text-slate-500">{title}</div>
      <div className="text-lg font-bold text-slate-900 mt-1 break-words">{String(value)}</div>
    </div>
  );
}
