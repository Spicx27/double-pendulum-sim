import React from 'react';
import { type MaterialProperties } from '../physics/wallEngine';
import { MATERIAL_PRESETS } from '../physics/presets';
import { FlaskConical, PlusCircle, RotateCcw } from 'lucide-react';

export interface MaterialComparisonRecord {
  id: number;
  materialName: string;
  bondStrengthKPa: number;
  contactStiffnessKNm: number;
  restitution: number;
  peakImpactForceN: number;
  peakBondStressKPa: number;
  detachedBlocks: number;
  totalBlocks: number;
}

interface Props {
  material: MaterialProperties;
  selectedPresetId: string;
  onSelectPreset: (id: string) => void;
  onChangeMaterialProp: (key: keyof MaterialProperties, value: number) => void;
  onRebuildWall: () => void;
  comparisonLog: MaterialComparisonRecord[];
  onRecordComparisonRun: () => void;
  onClearComparisonLog: () => void;
}

export const MaterialLabView: React.FC<Props> = ({
  material,
  selectedPresetId,
  onSelectPreset,
  onChangeMaterialProp,
  onRebuildWall,
  comparisonLog,
  onRecordComparisonRun,
  onClearComparisonLog,
}) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-panelBg p-6 rounded-xl border border-slate-700 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-emerald-400" /> Material Constitutive & Fracture Lab
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Configure density, compliant contact stiffness, restitution, and inter-block mortar bond failure thresholds to compare brittle vs. ductile structural response.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRecordComparisonRun}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" /> Log Current Experiment to Comparison Table
          </button>
          <button
            onClick={onRebuildWall}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium flex items-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" /> Rebuild Wall with New Material
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Preset Selector */}
        <div className="bg-panelBg p-6 rounded-xl border border-slate-700 space-y-4">
          <h3 className="text-base font-semibold text-white">Illustrative Material Presets</h3>
          <div className="space-y-2.5">
            {Object.values(MATERIAL_PRESETS).map((preset) => (
              <button
                key={preset.id}
                onClick={() => onSelectPreset(preset.id)}
                className={`w-full text-left p-3.5 rounded-lg border transition-all ${
                  selectedPresetId === preset.id
                    ? 'bg-indigo-950/90 border-indigo-500 text-white'
                    : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-sm flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full inline-block"
                      style={{ backgroundColor: preset.colorHex }}
                    />
                    {preset.name}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">{preset.category}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{preset.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Constitutive Sliders */}
        <div className="lg:col-span-2 bg-panelBg p-6 rounded-xl border border-slate-700 space-y-5">
          <div className="flex justify-between items-center border-b border-slate-700 pb-3">
            <h3 className="text-base font-semibold text-white">
              Active Material Parameters: <span className="text-sky-400">{material.name}</span>
            </h3>
            <span className="text-xs text-amber-400 font-mono">
              Educational Representative Values
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="text-xs text-slate-300 flex justify-between mb-1">
                <span>Bulk Density (ρ)</span>
                <span className="font-mono text-sky-400">{material.density} kg/m³</span>
              </label>
              <input
                type="range"
                min="400"
                max="8000"
                step="50"
                value={material.density}
                onChange={(e) => onChangeMaterialProp('density', parseFloat(e.target.value))}
                className="w-full accent-sky-400"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Determines individual block mass (m = ρ·V) and inertial resistance during impact.
              </p>
            </div>

            <div>
              <label className="text-xs text-slate-300 flex justify-between mb-1">
                <span>Bond Failure Strength (σ_fail)</span>
                <span className="font-mono text-rose-400">{material.bondStrength} kPa</span>
              </label>
              <input
                type="range"
                min="30"
                max="1500"
                step="10"
                value={material.bondStrength}
                onChange={(e) => onChangeMaterialProp('bondStrength', parseFloat(e.target.value))}
                className="w-full accent-rose-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Critical bond stress threshold (σ = F / A_bond) at which inter-block mortar joints fracture.
              </p>
            </div>

            <div>
              <label className="text-xs text-slate-300 flex justify-between mb-1">
                <span>Contact Stiffness (k_c)</span>
                <span className="font-mono text-amber-400">
                  {(material.contactStiffness / 1000).toFixed(0)} kN/m
                </span>
              </label>
              <input
                type="range"
                min="40000"
                max="700000"
                step="10000"
                value={material.contactStiffness}
                onChange={(e) => onChangeMaterialProp('contactStiffness', parseFloat(e.target.value))}
                className="w-full accent-amber-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Higher contact stiffness shortens collision duration (Δt = π√(m_eff/k_c)), increasing peak force.
              </p>
            </div>

            <div>
              <label className="text-xs text-slate-300 flex justify-between mb-1">
                <span>Coefficient of Restitution (e)</span>
                <span className="font-mono text-emerald-400">{material.restitution.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0.05"
                max="0.90"
                step="0.05"
                value={material.restitution}
                onChange={(e) => onChangeMaterialProp('restitution', parseFloat(e.target.value))}
                className="w-full accent-emerald-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Ratio of post-impact to pre-impact relative normal speed (0 = perfectly inelastic, 1 = elastic).
              </p>
            </div>

            <div>
              <label className="text-xs text-slate-300 flex justify-between mb-1">
                <span>Illustrative Young&apos;s Modulus (E)</span>
                <span className="font-mono text-indigo-400">{material.youngsModulus} GPa</span>
              </label>
              <input
                type="range"
                min="5"
                max="210"
                step="5"
                value={material.youngsModulus}
                onChange={(e) => onChangeMaterialProp('youngsModulus', parseFloat(e.target.value))}
                className="w-full accent-indigo-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Elastic modulus reference value for comparing elastic stiffness across structural materials.
              </p>
            </div>

            <div>
              <label className="text-xs text-slate-300 flex justify-between mb-1">
                <span>Bond Fracture Energy (G_f)</span>
                <span className="font-mono text-purple-400">{material.fractureEnergy.toFixed(1)} J</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="30"
                step="0.5"
                value={material.fractureEnergy}
                onChange={(e) => onChangeMaterialProp('fractureEnergy', parseFloat(e.target.value))}
                className="w-full accent-purple-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Mechanical energy absorbed per severed inter-block connection during fracture.
              </p>
            </div>
          </div>

          {/* Recorded Material Comparison Table */}
          <div className="pt-4 border-t border-slate-700 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-semibold text-white">
                Experimental Material Comparison Log ({comparisonLog.length} runs)
              </h4>
              {comparisonLog.length > 0 && (
                <button
                  onClick={onClearComparisonLog}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Clear Table
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="py-2 px-2">Run</th>
                    <th className="py-2 px-2">Material</th>
                    <th className="py-2 px-2">σ_fail (kPa)</th>
                    <th className="py-2 px-2">k_c (kN/m)</th>
                    <th className="py-2 px-2">Peak Force (N)</th>
                    <th className="py-2 px-2">Max Stress (kPa)</th>
                    <th className="py-2 px-2">Detached Blocks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {comparisonLog.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-slate-400 font-sans">
                        Run an impact in the Main Simulation, then click &quot;Log Current Experiment&quot; above to compare materials side-by-side.
                      </td>
                    </tr>
                  ) : (
                    comparisonLog.map((rec) => (
                      <tr key={rec.id} className="text-slate-200">
                        <td className="py-2 px-2">#{rec.id}</td>
                        <td className="py-2 px-2 font-sans font-medium text-sky-400">{rec.materialName}</td>
                        <td className="py-2 px-2">{rec.bondStrengthKPa}</td>
                        <td className="py-2 px-2">{rec.contactStiffnessKNm}</td>
                        <td className="py-2 px-2 text-rose-400">{rec.peakImpactForceN}</td>
                        <td className="py-2 px-2 text-amber-400">{rec.peakBondStressKPa}</td>
                        <td className="py-2 px-2 text-emerald-400">
                          {rec.detachedBlocks} / {rec.totalBlocks}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};