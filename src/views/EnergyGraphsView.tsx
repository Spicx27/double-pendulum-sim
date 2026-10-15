import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Download, Trash2, BarChart3 } from 'lucide-react';

export interface TelemetryPoint {
  time: number;
  theta1Deg: number;
  theta2Deg: number;
  omega1: number;
  omega2: number;
  pendulumKE: number;
  pendulumPE: number;
  pendulumTotalE: number;
  structureKE: number;
  detachedCount: number;
}

interface Props {
  telemetry: TelemetryPoint[];
  onClearTelemetry: () => void;
}

export const EnergyGraphsView: React.FC<Props> = ({ telemetry, onClearTelemetry }) => {
  const handleExportCSV = () => {
    if (telemetry.length === 0) return;
    const headers = [
      'Time_s',
      'Theta1_deg',
      'Theta2_deg',
      'Omega1_rad_s',
      'Omega2_rad_s',
      'Pendulum_KE_J',
      'Pendulum_PE_J',
      'Pendulum_TotalE_J',
      'Structure_Fragment_KE_J',
      'Detached_Blocks',
    ];
    const rows = telemetry.map((pt) =>
      [
        pt.time,
        pt.theta1Deg,
        pt.theta2Deg,
        pt.omega1,
        pt.omega2,
        pt.pendulumKE,
        pt.pendulumPE,
        pt.pendulumTotalE,
        pt.structureKE,
        pt.detachedCount,
      ].join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'double_pendulum_impact_telemetry.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-panelBg p-6 rounded-xl border border-slate-700 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-sky-400" /> Quantitative Energy & Kinematic Time-Series
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Live scientific telemetry recorded directly from the RK4 pendulum solver and 3D rigid-body wall fragments ({telemetry.length} samples buffered).
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            disabled={telemetry.length === 0}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" /> Export Telemetry CSV
          </button>
          <button
            onClick={onClearTelemetry}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-600"
          >
            <Trash2 className="w-4 h-4" /> Clear Data
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plot 1: Mechanical Energy Partition */}
        <div className="bg-panelBg p-5 rounded-xl border border-slate-700">
          <h3 className="text-sm font-semibold text-white mb-1">
            1. System Mechanical Energy vs. Time (Joules)
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Shows exchange between Kinetic Energy (K), Gravitational Potential Energy (U), Total Pendulum Energy (E), and Structure Fragment Kinetic Energy.
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={telemetry}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="pendulumKE" name="Pendulum KE (J)" stroke="#38bdf8" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="pendulumPE" name="Pendulum PE (J)" stroke="#a855f7" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="pendulumTotalE" name="Total Pendulum E (J)" stroke="#22c55e" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="structureKE" name="Wall Fragment KE (J)" stroke="#f43f5e" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Plot 2: Angular Positions vs Time */}
        <div className="bg-panelBg p-5 rounded-xl border border-slate-700">
          <h3 className="text-sm font-semibold text-white mb-1">
            2. Generalized Coordinates θ₁(t) & θ₂(t) vs. Time (Degrees)
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Demonstrates nonlinear coupled oscillations and sudden trajectory redirection upon colliding with the 3D wall.
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={telemetry}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="theta1Deg" name="θ₁ (deg)" stroke="#38bdf8" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="theta2Deg" name="θ₂ (deg)" stroke="#f43f5e" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Plot 3: Angular Velocities vs Time */}
        <div className="bg-panelBg p-5 rounded-xl border border-slate-700">
          <h3 className="text-sm font-semibold text-white mb-1">
            3. Angular Velocities ω₁(t) & ω₂(t) vs. Time (rad/s)
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Step discontinuities in ω₁ and ω₂ correspond directly to generalized collision impulses Δω = M(θ)⁻¹ J_vᵀ J.
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={telemetry}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="omega1" name="ω₁ (rad/s)" stroke="#38bdf8" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="omega2" name="ω₂ (rad/s)" stroke="#f43f5e" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Plot 4: Cumulative Structural Fracture Progression */}
        <div className="bg-panelBg p-5 rounded-xl border border-slate-700">
          <h3 className="text-sm font-semibold text-white mb-1">
            4. Structural Fracture Progression & Fragment Kinetic Energy
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Tracks the number of detached wall blocks alongside the kinetic energy carried by falling debris.
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={telemetry}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="stepAfter" dataKey="detachedCount" name="Detached Blocks" stroke="#f59e0b" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="structureKE" name="Fragment KE (J)" stroke="#f43f5e" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};