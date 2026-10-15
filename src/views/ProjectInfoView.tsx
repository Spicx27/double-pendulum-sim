import React, { useState } from 'react';
import { runPhysicsValidationSuite, type ValidationTestResult } from '../physics/validator';
import { Award, CheckCircle, XCircle, Play, Cpu, Layers } from 'lucide-react';

export const ProjectInfoView: React.FC = () => {
  const [testResults, setTestResults] = useState<ValidationTestResult[]>(() =>
    runPhysicsValidationSuite()
  );

  const handleReRunTests = () => {
    setTestResults(runPhysicsValidationSuite());
  };

  const allPassed = testResults.every((t) => t.passed);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Project Header Banner */}
      <div className="bg-panelBg p-6 rounded-xl border border-slate-700 flex flex-wrap justify-between items-center gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold text-sky-400">
            NMIMS Mukesh Patel School of Technology Management &amp; Engineering (MPSTME)
          </span>
          <h2 className="text-2xl font-bold text-white mt-1">
            3D Coupled Double Pendulum &amp; Destructible Structure Simulator
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            First-Semester B.Tech Computer Engineering — Engineering Physics Computational Project
          </p>
        </div>
        <div className="bg-slate-900 px-4 py-3 rounded-lg border border-slate-700 text-xs font-mono text-slate-300">
          <div>Solver: Sub-stepped RK4 + Generalized Impulse</div>
          <div>3D Engine: Three.js WebGL + Shadow Mapping</div>
        </div>
      </div>

      {/* Live Automated Physics Verification Suite */}
      <div className="bg-panelBg p-6 rounded-xl border border-slate-700 space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-4 border-b border-slate-700 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-400" /> Automated Scientific Verification Suite
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Executes real-time unit tests directly against the TypeScript physics engine (`src/physics/validator.ts`) to verify conservation laws, rod-length invariants, and collision fracture differentiation.
            </p>
          </div>
          <button
            onClick={handleReRunTests}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
          >
            <Play className="w-4 h-4" /> Re-Run All Verification Tests ({testResults.filter((t) => t.passed).length}/{testResults.length} Passed)
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {testResults.map((test) => (
            <div
              key={test.id}
              className={`p-3.5 rounded-lg border flex items-start justify-between gap-3 ${
                test.passed
                  ? 'bg-emerald-950/20 border-emerald-700/50'
                  : 'bg-rose-950/30 border-rose-700'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {test.passed ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span className="text-xs font-semibold text-white">{test.name}</span>
                </div>
                <p className="text-[11px] font-mono text-slate-300 pl-6">
                  Measured: {test.measuredValue}
                </p>
                <p className="text-[11px] text-slate-400 pl-6">
                  Criterion: {test.expectedCriterion}
                </p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                {test.category}
              </span>
            </div>
          ))}
        </div>
        {allPassed && (
          <p className="text-xs text-emerald-400 font-medium">
            All 6 core mathematical and collision invariants verified successfully in the current runtime environment.
          </p>
        )}
      </div>

      {/* Problem Statement, Architecture & Viva Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-panelBg p-6 rounded-xl border border-slate-700 space-y-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-sky-400" /> Problem Statement &amp; Objectives
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Standard classroom treatments study nonlinear oscillators (like the double pendulum) and impulse-momentum collision mechanics as isolated topics. This project unifies them in a shared 3D virtual laboratory where students can observe how chaotic kinetic energy and angular momentum transfer into a destructible masonry structure during physical collisions.
          </p>
          <ul className="list-disc pl-5 text-xs text-slate-300 space-y-1.5">
            <li>Solve the coupled nonlinear Euler-Lagrange equations using sub-stepped 4th-Order Runge-Kutta (RK4).</li>
            <li>Resolve 3D sphere-box collisions using operational-space mass matrix projection so rod lengths never stretch or break.</li>
            <li>Model inter-block mortar bond stress, progressive fracture, and 3D falling fragment dynamics.</li>
            <li>Quantify impact impulse, contact duration, peak vs. average force, and energy dissipation.</li>
          </ul>
        </div>

        <div className="bg-panelBg p-6 rounded-xl border border-slate-700 space-y-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" /> Software Architecture &amp; Future Scope
          </h3>
          <ul className="list-disc pl-5 text-xs text-slate-300 space-y-1.5">
            <li>
              <strong>Frontend &amp; State:</strong> React 19 + TypeScript + Tailwind CSS with modular separation between numerical solvers (`src/physics/`) and rendering (`src/components/Scene3D.tsx`).
            </li>
            <li>
              <strong>3D Graphics:</strong> Three.js WebGL with `PerspectiveCamera`, `OrbitControls`, `PCFSoftShadowMap`, and real-time bond-stress color mapping.
            </li>
            <li>
              <strong>Data Visualization:</strong> Recharts time-series plots with one-click CSV telemetry export.
            </li>
            <li>
              <strong>Future Improvements:</strong> Extension to spherical 4-DOF 3D pendulums, Voronoi polyhedral brick shattering, and WebAssembly/GPU collision broadphases for 1,000+ block structures.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};