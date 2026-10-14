import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, FastForward, Activity } from 'lucide-react';
import { SimulationCanvas } from './components/SimulationCanvas';
import { type PendulumState, type PendulumParams, stepRK4, calculateEnergy } from './physics/engine';

const INITIAL_PARAMS: PendulumParams = { m1: 1.0, m2: 1.0, l1: 1.0, l2: 1.0, g: 9.81 };
const INITIAL_STATE: PendulumState = { theta1: Math.PI / 2, theta2: Math.PI, omega1: 0, omega2: 0 };

function App() {
  const [params, setParams] = useState<PendulumParams>(INITIAL_PARAMS);
  const [initialConfig, setInitialConfig] = useState<{t1: number, t2: number}>({ t1: 90, t2: 180 });
  const [state, setState] = useState<PendulumState>(INITIAL_STATE);
  const [isRunning, setIsRunning] = useState(false);
  const [showTrail, setShowTrail] = useState(true);
  const [simSpeed, setSimSpeed] = useState(1.0);
  
  const [time, setTime] = useState(0);
  const [energyData, setEnergyData] = useState({ initial: 0, current: 0, error: 0 });

  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Initialize energy
  useEffect(() => {
    const e = calculateEnergy(INITIAL_STATE, INITIAL_PARAMS);
    setEnergyData({ initial: e.total, current: e.total, error: 0 });
  }, []);

  const resetSimulation = () => {
    setIsRunning(false);
    const newState = {
      theta1: (initialConfig.t1 * Math.PI) / 180,
      theta2: (initialConfig.t2 * Math.PI) / 180,
      omega1: 0,
      omega2: 0
    };
    setState(newState);
    setTime(0);
    const e = calculateEnergy(newState, params);
    setEnergyData({ initial: e.total, current: e.total, error: 0 });
  };

  const updatePhysics = (deltaTime: number) => {
    // Fixed internal timestep for RK4 stability (e.g., 5ms)
    const fixedDt = 0.005; 
    const steps = Math.floor((deltaTime * simSpeed) / fixedDt);
    
    setState(prevState => {
      let nextState = { ...prevState };
      for (let i = 0; i < steps; i++) {
        nextState = stepRK4(nextState, params, fixedDt);
      }
      return nextState;
    });

    setTime(prev => prev + steps * fixedDt);
  };

  const loop = (timestamp: number) => {
    if (lastTimeRef.current !== undefined && isRunning) {
      // Delta time in seconds
      const deltaTime = (timestamp - lastTimeRef.current) / 1000;
      // Cap deltaTime to avoid explosive instability if tab is inactive
      updatePhysics(Math.min(deltaTime, 0.05));
    }
    lastTimeRef.current = timestamp;
    requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
  if (isRunning) {
    requestRef.current = requestAnimationFrame(loop);
  }
  return () => {
    if (requestRef.current !== 0) {
      cancelAnimationFrame(requestRef.current);
    }
  };
}, [isRunning, params, simSpeed]);

  useEffect(() => {
    if (!isRunning) return;
    const e = calculateEnergy(state, params);
    const error = Math.abs((e.total - energyData.initial) / energyData.initial) * 100;
    setEnergyData(prev => ({ ...prev, current: e.total, error }));
  }, [state]);

  const handleParamChange = (key: keyof PendulumParams, value: number) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-darkBg text-slate-200 p-6 font-sans">
      <header className="max-w-6xl mx-auto mb-8 border-b border-slate-800 pb-4">
        <h1 className="text-3xl font-bold text-white mb-2">Double Pendulum Dynamics</h1>
        <p className="text-slate-400">First-Semester B.Tech CE Physics Project • Computational Physics</p>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Canvas and Live Data */}
        <div className="lg:col-span-2 space-y-6">
          <SimulationCanvas state={state} params={params} showTrail={showTrail} />
          
          <div className="bg-panelBg p-6 rounded-xl border border-slate-700 shadow-md flex justify-between">
            <div>
              <p className="text-sm text-slate-400">Sim Time</p>
              <p className="text-xl font-mono">{time.toFixed(2)} s</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">θ₁ / ω₁</p>
              <p className="text-xl font-mono text-accent1">
                {((state.theta1 * 180)/Math.PI).toFixed(0)}° / {state.omega1.toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-400">θ₂ / ω₂</p>
              <p className="text-xl font-mono text-accent2">
                {((state.theta2 * 180)/Math.PI).toFixed(0)}° / {state.omega2.toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Energy Deviation</p>
              <p className="text-xl font-mono">{energyData.error.toFixed(4)}%</p>
            </div>
          </div>
        </div>

        {/* Right Column: Controls */}
        <div className="space-y-6">
          <div className="bg-panelBg p-6 rounded-xl border border-slate-700 shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
              <Activity className="w-5 h-5" /> Controls
            </h2>
            <div className="flex flex-wrap gap-2 mb-6">
              <button 
                onClick={() => setIsRunning(!isRunning)} 
                className={`flex-1 py-2 px-4 rounded font-medium flex justify-center items-center gap-2 ${isRunning ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
              >
                {isRunning ? <><Pause className="w-4 h-4"/> Pause</> : <><Play className="w-4 h-4"/> Start</>}
              </button>
              <button 
                onClick={resetSimulation}
                className="py-2 px-4 bg-slate-700 hover:bg-slate-600 rounded font-medium flex justify-center items-center gap-2"
              >
                <RotateCcw className="w-4 h-4"/> Reset
              </button>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm uppercase tracking-wider text-slate-400 font-semibold">Initial Angles (Degrees)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">θ₁: {initialConfig.t1}°</label>
                  <input type="range" min="-180" max="180" value={initialConfig.t1} disabled={isRunning}
                    onChange={(e) => setInitialConfig(p => ({...p, t1: parseFloat(e.target.value)}))}
                    className="w-full accent-accent1" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">θ₂: {initialConfig.t2}°</label>
                  <input type="range" min="-180" max="180" value={initialConfig.t2} disabled={isRunning}
                    onChange={(e) => setInitialConfig(p => ({...p, t2: parseFloat(e.target.value)}))}
                    className="w-full accent-accent2" />
                </div>
              </div>

              <h3 className="text-sm uppercase tracking-wider text-slate-400 font-semibold pt-2">Physical Parameters</h3>
              
              <div>
                <label className="text-xs text-slate-400 flex justify-between">
                  <span>Mass 1 (m₁)</span> <span>{params.m1} kg</span>
                </label>
                <input type="range" min="0.1" max="5" step="0.1" value={params.m1}
                  onChange={(e) => handleParamChange('m1', parseFloat(e.target.value))}
                  className="w-full accent-accent1" />
              </div>
              <div>
                <label className="text-xs text-slate-400 flex justify-between">
                  <span>Mass 2 (m₂)</span> <span>{params.m2} kg</span>
                </label>
                <input type="range" min="0.1" max="5" step="0.1" value={params.m2}
                  onChange={(e) => handleParamChange('m2', parseFloat(e.target.value))}
                  className="w-full accent-accent2" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">L₁: {params.l1} m</label>
                  <input type="range" min="0.5" max="2" step="0.1" value={params.l1}
                    onChange={(e) => handleParamChange('l1', parseFloat(e.target.value))}
                    className="w-full accent-slate-400" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">L₂: {params.l2} m</label>
                  <input type="range" min="0.5" max="2" step="0.1" value={params.l2}
                    onChange={(e) => handleParamChange('l2', parseFloat(e.target.value))}
                    className="w-full accent-slate-400" />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4">
                <input type="checkbox" id="trail" checked={showTrail} onChange={(e) => setShowTrail(e.target.checked)} className="accent-accent2 w-4 h-4"/>
                <label htmlFor="trail" className="text-sm">Show Motion Trail</label>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* Educational Section */}
      <section className="max-w-6xl mx-auto mt-12 bg-panelBg p-8 rounded-xl border border-slate-700 shadow-md">
        <h2 className="text-2xl font-bold mb-4 border-b border-slate-700 pb-2">Physics Behind the Double Pendulum</h2>
        <div className="grid md:grid-cols-2 gap-8 text-slate-300 leading-relaxed text-sm">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Theoretical Model</h3>
            <p className="mb-3">
              A double pendulum consists of a pendulum attached to the end of another. Unlike a simple pendulum which exhibits regular harmonic motion for small angles, the double pendulum is a classic demonstration of <strong>nonlinear dynamics</strong> and deterministic chaos.
            </p>
            <p className="mb-3">
              The system's state is completely described by two generalized coordinates: <strong>θ₁</strong> and <strong>θ₂</strong>, representing the angles the first and second rigid, massless rods make with the downward vertical axis. 
            </p>
            <p>
              By applying Lagrangian Mechanics (L = T - V), we derive two coupled, second-order nonlinear ordinary differential equations. The nonlinearity arises from the trigonometric interaction between the two bobs.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Numerical Integration (RK4)</h3>
            <p className="mb-3">
              Because the equations of motion cannot be solved analytically (there is no closed-form solution), we must integrate them numerically.
            </p>
            <p className="mb-3">
              RK4 evaluates the derivatives at four points within each time step to achieve an error on the order of O(h<sup>4</sup>). This ensures that mechanical energy is properly conserved over time without artificial dampening.
            </p>
            <p>
              Sensitivity to initial conditions means that even a microscopic change in the starting angle will rapidly compound, leading to entirely divergent trajectories—the hallmark of chaotic systems.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;