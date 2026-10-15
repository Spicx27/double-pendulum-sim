import React from 'react';
import { EXPERIMENT_PRESETS, type ExperimentPreset } from '../physics/presets';
import { PlayCircle, Sliders, Lock, Sparkles } from 'lucide-react';

interface Props {
  activeExperimentId: string | null;
  onLoadExperiment: (preset: ExperimentPreset, autoStart: boolean) => void;
}

export const ExperimentsView: React.FC<Props> = ({ activeExperimentId, onLoadExperiment }) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-panelBg p-6 rounded-xl border border-slate-700">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" /> Guided Physics Demonstration Experiments
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Eight curated experimental setups designed for live professor evaluation. Clicking any preset configures the actual 3D physics engine and switches to the Main Simulation viewport.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {EXPERIMENT_PRESETS.map((exp) => {
          const isCurrent = activeExperimentId === exp.id;
          return (
            <div
              key={exp.id}
              className={`bg-panelBg p-6 rounded-xl border transition-all flex flex-col justify-between ${
                isCurrent ? 'border-indigo-500 shadow-lg shadow-indigo-950/40' : 'border-slate-700'
              }`}
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-950 text-indigo-300 border border-indigo-700/60">
                    Experiment #{exp.number}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    θ₁={exp.initialAnglesDeg.t1}°, θ₂={exp.initialAnglesDeg.t2}°
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white">{exp.title}</h3>
                  <p className="text-xs text-sky-400 mt-0.5">{exp.subtitle}</p>
                </div>

                <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-start gap-2">
                    <Sliders className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-200">Changed:</strong>{' '}
                      <span className="text-slate-300">{exp.changedParams}</span>
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-200">Fixed:</strong>{' '}
                      <span className="text-slate-400">{exp.fixedParams}</span>
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong>Physical Principle:</strong> {exp.principle}
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  <strong>Expected Observation:</strong> {exp.expectedObservation}
                </p>
              </div>

              <div className="flex gap-2 pt-4 mt-4 border-t border-slate-800">
                <button
                  onClick={() => onLoadExperiment(exp, true)}
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex justify-center items-center gap-1.5 shadow"
                >
                  <PlayCircle className="w-4 h-4" /> Load &amp; Run in 3D Scene
                </button>
                <button
                  onClick={() => onLoadExperiment(exp, false)}
                  className="py-2 px-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-medium"
                >
                  Preview Initial State
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};