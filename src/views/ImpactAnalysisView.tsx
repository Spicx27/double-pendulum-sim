import React, { useState } from 'react';
import { type ImpactEvent } from '../physics/wallEngine';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Zap, Activity, ShieldAlert, Trash2 } from 'lucide-react';

interface Props {
  impacts: ImpactEvent[];
  onClearImpacts: () => void;
}

export const ImpactAnalysisView: React.FC<Props> = ({ impacts, onClearImpacts }) => {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const selectedImpact =
    impacts.find((imp) => imp.id === selectedId) || impacts[impacts.length - 1] || null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-panelBg p-6 rounded-xl border border-slate-700 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" /> 3D Collision & Impact Analysis Lab
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Inspects real-time collision events recorded during the 3D simulation, including momentum transfer, impulse, and Kelvin-Voigt contact force profiles.
          </p>
        </div>
        <button
          onClick={onClearImpacts}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-600"
        >
          <Trash2 className="w-4 h-4" /> Clear Recorded Impacts ({impacts.length})
        </button>
      </div>

      {impacts.length === 0 || !selectedImpact ? (
        <div className="bg-panelBg p-12 rounded-xl border border-slate-700 text-center space-y-3">
          <ShieldAlert className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-lg font-semibold text-white">No Collisions Recorded Yet</h3>
          <p className="text-sm text-slate-400 max-w-lg mx-auto">
            Start the 3D simulation on the <strong>Main Simulation</strong> tab and allow Bob 1 or Bob 2 to strike the destructible structure. Every physical collision is automatically logged here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Impact Event Timeline List */}
          <div className="bg-panelBg p-5 rounded-xl border border-slate-700 space-y-3 max-h-[640px] overflow-y-auto">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Recorded Collision Events ({impacts.length})
            </h3>
            <div className="space-y-2">
              {impacts
                .slice()
                .reverse()
                .map((imp) => {
                  const isSelected = imp.id === selectedImpact.id;
                  return (
                    <button
                      key={imp.id}
                      onClick={() => setSelectedId(imp.id)}
                      className={`w-full text-left p-3.5 rounded-lg border transition-all ${
                        isSelected
                          ? 'bg-indigo-950/80 border-indigo-500 text-white shadow'
                          : 'bg-slate-800/70 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs font-semibold mb-1">
                        <span className={imp.bobIndex === 1 ? 'text-sky-400' : 'text-rose-400'}>
                          Event #{imp.id} • Bob {imp.bobIndex} → Block #{imp.blockId}
                        </span>
                        <span className="font-mono text-slate-400">t = {imp.simTime}s</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-slate-300 font-mono mt-2">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Impulse J</span>
                          {imp.impulse} N·s
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Peak Force</span>
                          {imp.peakForceN} N
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Detached</span>
                          {imp.blocksDetachedCount} blk
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Right 2 Columns: Detailed Metrics & Contact Force Graph */}
          <div className="lg:col-span-2 space-y-6">
            {/* Primary Quantitative Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-panelBg p-4 rounded-xl border border-slate-700">
                <p className="text-xs text-slate-400">Impact Impulse (J = Δp)</p>
                <p className="text-xl font-mono font-bold text-amber-400 mt-1">
                  {selectedImpact.impulse} N·s
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  |Δp| = {selectedImpact.momentumChange} kg·m/s
                </p>
              </div>

              <div className="bg-panelBg p-4 rounded-xl border border-slate-700">
                <p className="text-xs text-slate-400">Peak vs. Avg Contact Force</p>
                <p className="text-xl font-mono font-bold text-rose-400 mt-1">
                  {selectedImpact.peakForceN} N
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  F_avg = {selectedImpact.avgForceN} N (Δt = {selectedImpact.contactDurationMs} ms)
                </p>
              </div>

              <div className="bg-panelBg p-4 rounded-xl border border-slate-700">
                <p className="text-xs text-slate-400">Bob Velocity (Pre → Post)</p>
                <p className="text-xl font-mono font-bold text-sky-400 mt-1">
                  {selectedImpact.preVelocity.speed} → {selectedImpact.postVelocity.speed} m/s
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Contact @ ({selectedImpact.contactPoint.x}, {selectedImpact.contactPoint.y}) m
                </p>
              </div>

              <div className="bg-panelBg p-4 rounded-xl border border-slate-700">
                <p className="text-xs text-slate-400">Structural Damage Result</p>
                <p className="text-xl font-mono font-bold text-emerald-400 mt-1">
                  {selectedImpact.blocksDetachedCount} Detached
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {selectedImpact.blocksDamagedCount} blocks stressed ({selectedImpact.peakBondStressKPa} kPa)
                </p>
              </div>
            </div>

            {/* Contact Force vs Time Chart */}
            <div className="bg-panelBg p-6 rounded-xl border border-slate-700">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-rose-400" /> Contact Force vs. Contact Time F(t) — Event #{selectedImpact.id}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Area under the curve ∫F(t)dt equals the collision impulse J = {selectedImpact.impulse} N·s over Δt = {selectedImpact.contactDurationMs} ms.
                  </p>
                </div>
                <span className="text-xs font-mono bg-slate-800 px-2.5 py-1 rounded text-slate-300">
                  Target: {selectedImpact.materialName}
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={selectedImpact.forceProfile}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis
                      dataKey="timeMs"
                      stroke="#94a3b8"
                      fontSize={12}
                      label={{ value: 'Contact Time (ms)', position: 'insideBottom', offset: -4, fill: '#94a3b8', fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={12}
                      label={{ value: 'Contact Force (N)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="forceN"
                      name="Contact Force (N)"
                      stroke="#f43f5e"
                      fill="#f43f5e"
                      fillOpacity={0.25}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Energy Accounting Breakdown for Selected Event */}
            <div className="bg-panelBg p-6 rounded-xl border border-slate-700 space-y-3">
              <h3 className="text-base font-semibold text-white">
                Collision Energy Accounting & Scientific Interpretation
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="bg-slate-800/80 p-3 rounded-lg">
                  <span className="text-slate-400 block">Pre-Impact Pendulum KE</span>
                  <span className="text-base text-white">{selectedImpact.prePendulumKE} J</span>
                </div>
                <div className="bg-slate-800/80 p-3 rounded-lg">
                  <span className="text-slate-400 block">Post-Impact Pendulum KE</span>
                  <span className="text-base text-sky-400">{selectedImpact.postPendulumKE} J</span>
                </div>
                <div className="bg-slate-800/80 p-3 rounded-lg">
                  <span className="text-slate-400 block">Fragment Kinetic Energy</span>
                  <span className="text-base text-emerald-400">{selectedImpact.transferredKE} J</span>
                </div>
                <div className="bg-slate-800/80 p-3 rounded-lg">
                  <span className="text-slate-400 block">Inelastic / Fracture Loss</span>
                  <span className="text-base text-amber-400">{selectedImpact.dissipatedEnergy} J</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed pt-1">
                <strong>Why Peak Force ≠ Average Force:</strong> During a compliant collision of duration Δt = {selectedImpact.contactDurationMs} ms, contact force rises from zero at initial touch to a peak of <strong>{selectedImpact.peakForceN} N</strong> at maximum compression before decaying. Note that impact force is governed by the rate of momentum change (Δp/Δt) and contact stiffness (k_c), <em>not</em> by the static gravitational weight (mg) of the bob.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};