import React, { useState } from 'react';
import { useStaff } from '../context/StaffContext';
import { Wrench, CheckCircle, Clock, AlertTriangle, PlusCircle, Loader2 } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';

interface MaintenanceTaskItem {
  maintId: number;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  coachId?: number;
  assignedStaffId?: number;
  createdAt: string;
}

export const MaintenanceTasksPage: React.FC = () => {
  const { createMaintenanceTask, updateMaintenanceStatus, activeStaff } = useStaff();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [coachId, setCoachId] = useState<number>(301);
  const [creating, setCreating] = useState(false);
  const [taskList, setTaskList] = useState<MaintenanceTaskItem[]>([
    {
      maintId: 101,
      title: 'AC B1 Compressor Pressure Inspection',
      description: 'Periodic vibration test and coolant pressure verification before departure.',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      coachId: 301,
      assignedStaffId: activeStaff.staffId,
      createdAt: '2026-10-25T14:30:00Z'
    },
    {
      maintId: 102,
      title: 'B2 Coach Automatic Door Sensor Alignment',
      description: 'Sensor obstruction alarm triggered during platform docking.',
      priority: 'MEDIUM',
      status: 'SCHEDULED',
      coachId: 302,
      assignedStaffId: activeStaff.staffId,
      createdAt: '2026-10-25T15:10:00Z'
    }
  ]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || creating) return;

    setCreating(true);
    try {
      const res = await createMaintenanceTask({
        coachId,
        stationId: activeStaff.assignedStationId || undefined,
        title: title.trim(),
        description: description.trim(),
        priority
      });

      const newTask: MaintenanceTaskItem = {
        maintId: res.maintId || Date.now(),
        title: title.trim(),
        description: description.trim(),
        priority,
        status: 'SCHEDULED',
        coachId,
        assignedStaffId: activeStaff.staffId,
        createdAt: new Date().toISOString()
      };

      setTaskList(prev => [newTask, ...prev]);
      setTitle('');
      setDescription('');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusUpdate = async (maintId: number, status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED') => {
    await updateMaintenanceStatus(maintId, status, `Updated by staff ${activeStaff.name}`);
    setTaskList(prev => prev.map(t => t.maintId === maintId ? { ...t, status } : t));
  };

  return (
    <div className="space-y-6">
      {/* Header & Create Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
            <Wrench className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Maintenance & Technical Tasks Terminal</h3>
            <p className="text-xs text-slate-500">
              Log, schedule, and complete coach and station mechanical/electrical maintenance assignments.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="space-y-4 mt-5 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">Create Technical Job Order</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Task Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Washroom flush valve replacement"
                className="w-full bg-white border border-slate-200 focus:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Priority Level</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-white border border-slate-200 focus:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-800 outline-none cursor-pointer"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Detailed Description & Symptoms *</label>
            <textarea
              required
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="State coach number, nature of defect, tools required..."
              className="w-full bg-white border border-slate-200 focus:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 outline-none resize-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              {creating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Dispatching Job...</span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Create Maintenance Order</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Task List Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 mb-4">Active Maintenance Duty Orders</h3>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Job ID</th>
                <th className="py-3 px-4">Task Details</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Target Unit</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Workflow Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {taskList.map(task => (
                <tr key={task.maintId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-slate-700">#{task.maintId}</td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{task.title}</div>
                    <div className="text-[11px] text-slate-500 line-clamp-1">{task.description}</div>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={task.priority} size="sm" />
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-700">Coach #{task.coachId}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      task.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      task.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {task.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {task.status !== 'IN_PROGRESS' && task.status !== 'COMPLETED' && (
                        <button
                          onClick={() => handleStatusUpdate(task.maintId, 'IN_PROGRESS')}
                          className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] font-semibold border border-blue-200 transition-colors"
                        >
                          Start Work
                        </button>
                      )}
                      {task.status !== 'COMPLETED' && (
                        <button
                          onClick={() => handleStatusUpdate(task.maintId, 'COMPLETED')}
                          className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-semibold border border-emerald-200 transition-colors"
                        >
                          Mark Complete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
