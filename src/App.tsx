import { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  StepForward,
  Shuffle,
  BrickWall,
  Sliders,
  Zap,
  FlaskConical,
  BarChart3,
  BookOpen,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  type PendulumState,
  type PendulumParams,
  stepRK4,
  calculateEnergy,
  getBobKinematics,
  PIVOT_HEIGHT,
} from './physics/engine';
import {
  type WallConfig,
  type WallSystemState,
  type MaterialProperties,
  type ImpactEvent,
  type StructurePresetType,
  createWallSystem,
  stepWallAndCollisions,
  calculateStructureKineticEnergy,
} from './physics/wallEngine';
import { MATERIAL_PRESETS, type ExperimentPreset } from './physics/presets';
import { Scene3D } from './components/Scene3D';
import { ImpactAnalysisView } from './views/ImpactAnalysisView';
import { MaterialLabView, type MaterialComparisonRecord } from './views/MaterialLabView';
import { EnergyGraphsView, type TelemetryPoint } from './views/EnergyGraphsView';
import { PhysicsTheoryView } from './views/PhysicsTheoryView';
import { ExperimentsView } from './views/ExperimentsView';
import { ProjectInfoView } from './views/ProjectInfoView';

type TabId =
  | 'simulation'
  | 'impacts'
  | 'materials'
  | 'graphs'
  | 'theory'
  | 'experiments'
  | 'info';

const INITIAL_PENDULUM_PARAMS: PendulumParams = {
  m1: 2.0,
  m2: 2.8,
  l1: 1.2,
  l2: 1.1,
  g: 9.81,
  damping: 0.02,
};

const INITIAL_ANGLES_DEG = { t1: -115, t2: -130 };

const INITIAL_WALL_CONFIG: WallConfig = {
  structureType: 'brick_wall',
  wallX: 0.95,
  wallZ: 0,
  rows: 6,
  cols: 3,
  blockWidth: 0.22,
  blockHeight: 0.24,
  blockDepth: 0.34,
};

const degToRad = (deg: number) => (deg * Math.PI) / 180;
const radToDeg = (rad: number) => (rad * 180) / Math.PI;

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('simulation');

  // Pendulum Configuration & State
  const [params, setParams] = useState<PendulumParams>(INITIAL_PENDULUM_PARAMS);
  const [initialAngles, setInitialAngles] = useState<{ t1: number; t2: number }>(INITIAL_ANGLES_DEG);
  const [pendulumState, setPendulumState] = useState<PendulumState>({
    theta1: degToRad(INITIAL_ANGLES_DEG.t1),
    theta2: degToRad(INITIAL_ANGLES_DEG.t2),
    omega1: 0,
    omega2: 0,
  });

  // Destructible Wall & Material State
  const [wallConfig, setWallConfig] = useState<WallConfig>(INITIAL_WALL_CONFIG);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('brick');
  const [material, setMaterial] = useState<MaterialProperties>(MATERIAL_PRESETS.brick);
  const [wallState, setWallState] = useState<WallSystemState>(() =>
    createWallSystem(INITIAL_WALL_CONFIG, MATERIAL_PRESETS.brick)
  );

  // Playback & Visualization Toggles
  const [isRunning, setIsRunning] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1.0);
  const [simTime, setSimTime] = useState(0);
  const [showDamageOverlay, setShowDamageOverlay] = useState(true);
  const [showTrail, setShowTrail] = useState(true);
  const [showForceVectors, setShowForceVectors] = useState(true);
  const [showCollisionPoints, setShowCollisionPoints] = useState(true);
  const [showCosmeticFX, setShowCosmeticFX] = useState(true);
  const [trailResetKey, setTrailResetKey] = useState(0);

  // Recorded Data for Analysis Tabs
  const [impacts, setImpacts] = useState<ImpactEvent[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [comparisonLog, setComparisonLog] = useState<MaterialComparisonRecord[]>([]);
  const [activeExperimentId, setActiveExperimentId] = useState<string | null>(null);

  // Mutable simulation refs for deterministic 60fps sub-stepped physics loop
  const simRef = useRef({
    pendulum: {
      theta1: degToRad(INITIAL_ANGLES_DEG.t1),
      theta2: degToRad(INITIAL_ANGLES_DEG.t2),
      omega1: 0,
      omega2: 0,
    },
    wall: createWallSystem(INITIAL_WALL_CONFIG, MATERIAL_PRESETS.brick),
    time: 0,
    nextImpactId: 1,
    lastTelemetryTime: -1,
  });

  const requestRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);

  // Advance simulation by deltaTime using 8 sub-steps per frame to prevent tunneling
  const advancePhysics = (deltaSec: number) => {
    const subSteps = 8;
    const subDt = (deltaSec * simSpeed) / subSteps;
    if (subDt <= 0) return;

    let pState = simRef.current.pendulum;
    let wState = simRef.current.wall;
    let t = simRef.current.time;
    const gatheredImpacts: ImpactEvent[] = [];

    for (let i = 0; i < subSteps; i++) {
      pState = stepRK4(pState, params, subDt);
      t += subDt;
      const colResult = stepWallAndCollisions(
        pState,
        params,
        wState,
        material,
        t,
        subDt,
        simRef.current.nextImpactId
      );
      pState = colResult.pendulumState;
      wState = colResult.wallState;
      if (colResult.newImpacts.length > 0) {
        gatheredImpacts.push(...colResult.newImpacts);
        simRef.current.nextImpactId += colResult.newImpacts.length;
      }
    }

    simRef.current.pendulum = pState;
    simRef.current.wall = wState;
    simRef.current.time = t;

    setPendulumState(pState);
    setWallState(wState);
    setSimTime(t);

    if (gatheredImpacts.length > 0) {
      setImpacts((prev) => [...prev.slice(-40), ...gatheredImpacts]);
    }

    // Record telemetry point every ~0.04s
    if (t - simRef.current.lastTelemetryTime >= 0.04) {
      simRef.current.lastTelemetryTime = t;
      const e = calculateEnergy(pState, params, PIVOT_HEIGHT);
      const structKE = calculateStructureKineticEnergy(wState.blocks);
      const detached = wState.blocks.filter((b) => b.isDetached).length;

      setTelemetry((prev) => [
        ...prev.slice(-240),
        {
          time: Number(t.toFixed(2)),
          theta1Deg: Number(radToDeg(pState.theta1).toFixed(1)),
          theta2Deg: Number(radToDeg(pState.theta2).toFixed(1)),
          omega1: Number(pState.omega1.toFixed(2)),
          omega2: Number(pState.omega2.toFixed(2)),
          pendulumKE: Number(e.ke.toFixed(2)),
          pendulumPE: Number(e.pe.toFixed(2)),
          pendulumTotalE: Number(e.total.toFixed(2)),
          structureKE: Number(structKE.toFixed(2)),
          detachedCount: detached,
        },
      ]);
    }
  };

  // Main Animation Loop
  useEffect(() => {
    const loop = (timestamp: number) => {
      if (lastFrameTimeRef.current !== 0 && isRunning) {
        const dt = Math.min((timestamp - lastFrameTimeRef.current) / 1000, 0.035);
        advancePhysics(dt);
      }
      lastFrameTimeRef.current = timestamp;
      if (isRunning) {
        requestRef.current = requestAnimationFrame(loop);
      }
    };

    if (isRunning) {
      lastFrameTimeRef.current = 0;
      requestRef.current = requestAnimationFrame(loop);
    }
    return () => {
      if (requestRef.current !== 0) cancelAnimationFrame(requestRef.current);
    };
  }, [isRunning, params, material, simSpeed]);

  // Reset Handlers
  const handleResetAll = (
    customAngles = initialAngles,
    customWallCfg = wallConfig,
    customMat = material
  ) => {
    setIsRunning(false);
    const freshPend: PendulumState = {
      theta1: degToRad(customAngles.t1),
      theta2: degToRad(customAngles.t2),
      omega1: 0,
      omega2: 0,
    };
    const freshWall = createWallSystem(customWallCfg, customMat);

    simRef.current = {
      pendulum: freshPend,
      wall: freshWall,
      time: 0,
      nextImpactId: simRef.current.nextImpactId,
      lastTelemetryTime: -1,
    };

    setPendulumState(freshPend);
    setWallState(freshWall);
    setSimTime(0);
    setTelemetry([]);
    setTrailResetKey((k) => k + 1);
  };

  const handleResetPendulumOnly = () => {
    setIsRunning(false);
    const freshPend: PendulumState = {
      theta1: degToRad(initialAngles.t1),
      theta2: degToRad(initialAngles.t2),
      omega1: 0,
      omega2: 0,
    };
    simRef.current.pendulum = freshPend;
    setPendulumState(freshPend);
    setTrailResetKey((k) => k + 1);
  };

  const handleRebuildWallOnly = (customCfg = wallConfig, customMat = material) => {
    const freshWall = createWallSystem(customCfg, customMat);
    simRef.current.wall = freshWall;
    setWallState(freshWall);
  };

  const handleSingleStep = () => {
    setIsRunning(false);
    advancePhysics(0.016);
  };

  const handleRandomizeAngles = () => {
    setIsRunning(false);
    const r1 = -Math.floor(65 + Math.random() * 85);
    const r2 = -Math.floor(50 + Math.random() * 110);
    const nextAngles = { t1: r1, t2: r2 };
    setInitialAngles(nextAngles);
    handleResetAll(nextAngles, wallConfig, material);
  };

  // Update initial angle sliders before simulation runs
  const handleAngleChange = (key: 't1' | 't2', degValue: number) => {
    const clamped = Math.max(-180, Math.min(180, Number.isNaN(degValue) ? 0 : degValue));
    const updated = { ...initialAngles, [key]: clamped };
    setInitialAngles(updated);
    if (!isRunning) {
      const nextPend: PendulumState = {
        theta1: degToRad(updated.t1),
        theta2: degToRad(updated.t2),
        omega1: 0,
        omega2: 0,
      };
      simRef.current.pendulum = nextPend;
      setPendulumState(nextPend);
      setTrailResetKey((k) => k + 1);
    }
  };

  const handleWallConfigChange = <K extends keyof WallConfig>(key: K, val: WallConfig[K]) => {
    const updated = { ...wallConfig, [key]: val };
    setWallConfig(updated);
    handleRebuildWallOnly(updated, material);
  };

  const handleSelectMaterialPreset = (presetId: string) => {
    const preset = MATERIAL_PRESETS[presetId];
    if (!preset) return;
    setSelectedMaterialId(presetId);
    setMaterial(preset);
    handleRebuildWallOnly(wallConfig, preset);
  };

  const handleChangeMaterialProp = (key: keyof MaterialProperties, value: number) => {
    const updated = { ...material, [key]: value, name: `${material.name.replace(' (Custom)', '')} (Custom)` };
    setMaterial(updated);
  };

  const handleRecordComparisonRun = () => {
    const peakForce = impacts.reduce((max, imp) => Math.max(max, imp.peakForceN), 0);
    const peakStress = wallState.blocks.reduce((max, b) => Math.max(max, b.peakStressKPa), 0);
    const detached = wallState.blocks.filter((b) => b.isDetached).length;

    setComparisonLog((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        materialName: material.name,
        bondStrengthKPa: material.bondStrength,
        contactStiffnessKNm: Number((material.contactStiffness / 1000).toFixed(0)),
        restitution: material.restitution,
        peakImpactForceN: Number(peakForce.toFixed(1)),
        peakBondStressKPa: Number(peakStress.toFixed(1)),
        detachedBlocks: detached,
        totalBlocks: wallState.blocks.length,
      },
    ]);
  };

  const handleLoadExperiment = (preset: ExperimentPreset, autoStart: boolean) => {
    setIsRunning(false);
    setActiveExperimentId(preset.id);
    setParams(preset.pendulumParams);
    setInitialAngles(preset.initialAnglesDeg);
    setWallConfig(preset.wallConfig);
    const mat = MATERIAL_PRESETS[preset.materialId];
    setSelectedMaterialId(preset.materialId);
    setMaterial(mat);

    const freshPend: PendulumState = {
      theta1: degToRad(preset.initialAnglesDeg.t1),
      theta2: degToRad(preset.initialAnglesDeg.t2),
      omega1: 0,
      omega2: 0,
    };
    const freshWall = createWallSystem(preset.wallConfig, mat);

    simRef.current = {
      pendulum: freshPend,
      wall: freshWall,
      time: 0,
      nextImpactId: simRef.current.nextImpactId,
      lastTelemetryTime: -1,
    };

    setPendulumState(freshPend);
    setWallState(freshWall);
    setSimTime(0);
    setTelemetry([]);
    setTrailResetKey((k) => k + 1);
    setActiveTab('simulation');

    if (autoStart) {
      setTimeout(() => setIsRunning(true), 80);
    }
  };

  // Live Calculated Metrics for HUD
  const kin = getBobKinematics(pendulumState, params, PIVOT_HEIGHT);
  const energy = calculateEnergy(pendulumState, params, PIVOT_HEIGHT);
  const structureKE = calculateStructureKineticEnergy(wallState.blocks);
  const detachedCount = wallState.blocks.filter((b) => b.isDetached).length;
  const damagedCount = wallState.blocks.filter((b) => b.damage > 0.08).length;
  const maxBlockStress = wallState.blocks.reduce((m, b) => Math.max(m, b.peakStressKPa), 0);
  const latestImpact = impacts[impacts.length - 1] || null;

  return (
    <div className="min-h-screen bg-darkBg text-slate-200 font-sans flex flex-col">
      {/* Top Academic Header & Navigation Tabs */}
      <header className="bg-panelBg border-b border-slate-700/90 sticky top-0 z-50 shadow-lg">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-3 flex flex-col xl:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-3 h-8 rounded bg-gradient-to-b from-sky-400 to-rose-500" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                3D Double Pendulum &amp; Destructible Structure Lab
              </h1>
              <p className="text-xs text-slate-400">
                NMIMS B.Tech CE • Engineering Physics — Nonlinear Dynamics, Collision Impulse &amp; Fracture Mechanics
              </p>
            </div>
          </div>

          {/* 7-Tab Navigation Bar */}
          <nav className="flex flex-wrap justify-center gap-1 bg-slate-900/90 p-1.5 rounded-xl border border-slate-700/80">
            {[
              { id: 'simulation', label: '1. Main Simulation', icon: BrickWall },
              { id: 'impacts', label: `2. Impact Analysis (${impacts.length})`, icon: Zap },
              { id: 'materials', label: '3. Material Lab', icon: FlaskConical },
              { id: 'graphs', label: '4. Energy & Graphs', icon: BarChart3 },
              { id: 'theory', label: '5. Physics Theory', icon: BookOpen },
              { id: 'experiments', label: '6. Experiments', icon: Sparkles },
              { id: 'info', label: '7. Project Info', icon: Info },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabId)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${active
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Global Playback Controls Toolbar */}
        <div className="bg-slate-900/95 border-t border-slate-800 px-4 sm:px-6 py-2">
          <div className="max-w-[1440px] mx-auto flex flex-wrap justify-between items-center gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsRunning(!isRunning)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow transition-all ${isRunning
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
              >
                {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {isRunning ? 'Pause Simulation' : simTime > 0 ? 'Resume Simulation' : 'Start Simulation'}
              </button>

              <button
                onClick={handleSingleStep}
                disabled={isRunning}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 border border-slate-700"
                title="Advance physics by 16ms step"
              >
                <StepForward className="w-3.5 h-3.5 text-sky-400" /> Step
              </button>

              <button
                onClick={() => handleResetAll()}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 border border-slate-700"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-400" /> Reset All
              </button>

              <button
                onClick={() => handleRebuildWallOnly()}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 border border-slate-700"
              >
                <BrickWall className="w-3.5 h-3.5 text-amber-400" /> Rebuild Wall
              </button>

              <button
                onClick={handleRandomizeAngles}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 border border-slate-700"
              >
                <Shuffle className="w-3.5 h-3.5 text-purple-400" /> Random Swing
              </button>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Sim Speed:</span>
                {[0.25, 0.5, 1.0, 1.5].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setSimSpeed(spd)}
                    className={`px-2 py-0.5 rounded font-mono ${simSpeed === spd
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>

              <span
                className={`px-2.5 py-0.5 rounded-full font-mono text-[11px] border ${isRunning
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                    : simTime > 0
                      ? 'bg-amber-950/80 text-amber-300 border-amber-700'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
              >
                {isRunning ? 'STATUS: RUNNING' : simTime > 0 ? 'STATUS: PAUSED' : 'STATUS: READY'} • t ={' '}
                {simTime.toFixed(2)}s
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 flex-grow w-full">
        {activeTab === 'simulation' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 animate-in fade-in duration-300">
            {/* Left 8 Columns: 3D Scene & Real-Time Physics Dashboard */}
            <div className="xl:col-span-8 space-y-5">
              <Scene3D
                pendulumState={pendulumState}
                pendulumParams={params}
                wallState={wallState}
                material={material}
                showDamageOverlay={showDamageOverlay}
                showTrail={showTrail}
                showForceVectors={showForceVectors}
                showCollisionPoints={showCollisionPoints}
                showCosmeticFX={showCosmeticFX}
                trailResetKey={trailResetKey}
              />

              {/* Live Physical Measurements Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-panelBg p-3.5 rounded-xl border border-slate-700">
                  <p className="text-[11px] text-slate-400">Bob 1 State (θ₁ / v₁)</p>
                  <p className="text-base font-mono font-bold text-sky-400 mt-0.5">
                    {radToDeg(pendulumState.theta1).toFixed(1)}° • {kin.speed1.toFixed(2)} m/s
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    ω₁ = {pendulumState.omega1.toFixed(2)} rad/s
                  </p>
                </div>

                <div className="bg-panelBg p-3.5 rounded-xl border border-slate-700">
                  <p className="text-[11px] text-slate-400">Bob 2 State (θ₂ / v₂)</p>
                  <p className="text-base font-mono font-bold text-rose-400 mt-0.5">
                    {radToDeg(pendulumState.theta2).toFixed(1)}° • {kin.speed2.toFixed(2)} m/s
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    ω₂ = {pendulumState.omega2.toFixed(2)} rad/s
                  </p>
                </div>

                <div className="bg-panelBg p-3.5 rounded-xl border border-slate-700">
                  <p className="text-[11px] text-slate-400">Mechanical Energy (Pendulum / Wall)</p>
                  <p className="text-base font-mono font-bold text-emerald-400 mt-0.5">
                    {energy.total.toFixed(1)} J • {structureKE.toFixed(1)} J
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    KE = {energy.ke.toFixed(1)} J | PE = {energy.pe.toFixed(1)} J
                  </p>
                </div>

                <div className="bg-panelBg p-3.5 rounded-xl border border-slate-700">
                  <p className="text-[11px] text-slate-400">Wall Fracture &amp; Latest Peak Force</p>
                  <p className="text-base font-mono font-bold text-amber-400 mt-0.5">
                    {detachedCount}/{wallState.blocks.length} Detached
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono">
                    F_peak = {latestImpact ? `${latestImpact.peakForceN} N` : '0 N'} • σ_max ={' '}
                    {maxBlockStress.toFixed(0)} kPa
                  </p>
                </div>
              </div>
            </div>

            {/* Right 4 Columns: Interactive Parameter Control Panel */}
            <div className="xl:col-span-4 space-y-5">
              {/* Pendulum Parameters Card */}
              <div className="bg-panelBg p-5 rounded-xl border border-slate-700 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-700 pb-2.5">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-sky-400" /> Double Pendulum Controls
                  </h2>
                  <button
                    onClick={handleResetPendulumOnly}
                    className="text-xs text-sky-400 hover:underline"
                  >
                    Reset Swing
                  </button>
                </div>

                {/* Initial Angles (Synced Sliders + Numeric Inputs) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="text-slate-300">Init Angle θ₁ (°)</span>
                      <input
                        type="number"
                        min="-180"
                        max="180"
                        value={initialAngles.t1}
                        onChange={(e) => handleAngleChange('t1', parseFloat(e.target.value))}
                        className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-right font-mono text-sky-400"
                      />
                    </div>
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      value={initialAngles.t1}
                      onChange={(e) => handleAngleChange('t1', parseFloat(e.target.value))}
                      className="w-full accent-sky-400"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="text-slate-300">Init Angle θ₂ (°)</span>
                      <input
                        type="number"
                        min="-180"
                        max="180"
                        value={initialAngles.t2}
                        onChange={(e) => handleAngleChange('t2', parseFloat(e.target.value))}
                        className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-right font-mono text-rose-400"
                      />
                    </div>
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      value={initialAngles.t2}
                      onChange={(e) => handleAngleChange('t2', parseFloat(e.target.value))}
                      className="w-full accent-rose-500"
                    />
                  </div>
                </div>

                {/* Masses m1, m2 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-300 flex justify-between mb-1">
                      <span>Mass m₁</span>
                      <span className="font-mono text-sky-400">{params.m1.toFixed(1)} kg</span>
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="8.0"
                      step="0.1"
                      value={params.m1}
                      onChange={(e) => setParams((p) => ({ ...p, m1: parseFloat(e.target.value) }))}
                      className="w-full accent-sky-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 flex justify-between mb-1">
                      <span>Mass m₂</span>
                      <span className="font-mono text-rose-400">{params.m2.toFixed(1)} kg</span>
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="8.0"
                      step="0.1"
                      value={params.m2}
                      onChange={(e) => setParams((p) => ({ ...p, m2: parseFloat(e.target.value) }))}
                      className="w-full accent-rose-500"
                    />
                  </div>
                </div>

                {/* Rod Lengths L1, L2 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-300 flex justify-between mb-1">
                      <span>Length L₁</span>
                      <span className="font-mono text-slate-200">{params.l1.toFixed(2)} m</span>
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="1.6"
                      step="0.05"
                      value={params.l1}
                      onChange={(e) => setParams((p) => ({ ...p, l1: parseFloat(e.target.value) }))}
                      className="w-full accent-slate-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 flex justify-between mb-1">
                      <span>Length L₂</span>
                      <span className="font-mono text-slate-200">{params.l2.toFixed(2)} m</span>
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="1.6"
                      step="0.05"
                      value={params.l2}
                      onChange={(e) => setParams((p) => ({ ...p, l2: parseFloat(e.target.value) }))}
                      className="w-full accent-slate-400"
                    />
                  </div>
                </div>

                {/* Gravity & Joint Damping */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-300 flex justify-between mb-1">
                      <span>Gravity (g)</span>
                      <span className="font-mono text-slate-200">{params.g.toFixed(2)} m/s²</span>
                    </label>
                    <input
                      type="range"
                      min="1.6"
                      max="20.0"
                      step="0.1"
                      value={params.g}
                      onChange={(e) => setParams((p) => ({ ...p, g: parseFloat(e.target.value) }))}
                      className="w-full accent-indigo-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 flex justify-between mb-1">
                      <span>Joint Friction (c)</span>
                      <span className="font-mono text-amber-400">{params.damping.toFixed(2)}</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="0.3"
                      step="0.01"
                      value={params.damping}
                      onChange={(e) =>
                        setParams((p) => ({ ...p, damping: parseFloat(e.target.value) }))
                      }
                      className="w-full accent-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Destructible Structure & Material Controls Card */}
              <div className="bg-panelBg p-5 rounded-xl border border-slate-700 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-700 pb-2.5">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <BrickWall className="w-4 h-4 text-amber-400" /> 3D Structure &amp; Material
                  </h2>
                  <span className="text-[11px] font-mono text-slate-400">
                    {damagedCount} Damaged • {detachedCount} Broken
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Structure Preset</label>
                    <select
                      value={wallConfig.structureType}
                      onChange={(e) =>
                        handleWallConfigChange(
                          'structureType',
                          e.target.value as StructurePresetType
                        )
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="brick_wall">3D Brick Wall (Default)</option>
                      <option value="concrete_barrier">Concrete Barrier</option>
                      <option value="timber_panel">Timber Panel Wall</option>
                      <option value="pillar_tower">Stacked Pillar Tower</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Material Preset</label>
                    <select
                      value={selectedMaterialId}
                      onChange={(e) => handleSelectMaterialPreset(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    >
                      {Object.values(MATERIAL_PRESETS).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-300 flex justify-between mb-1">
                      <span>Wall Distance (X)</span>
                      <span className="font-mono text-amber-400">{wallConfig.wallX.toFixed(2)} m</span>
                    </label>
                    <input
                      type="range"
                      min="0.55"
                      max="1.75"
                      step="0.05"
                      value={wallConfig.wallX}
                      onChange={(e) =>
                        handleWallConfigChange('wallX', parseFloat(e.target.value))
                      }
                      className="w-full accent-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-300 flex justify-between mb-1">
                      <span>Bond Strength (σ_fail)</span>
                      <span className="font-mono text-rose-400">{material.bondStrength} kPa</span>
                    </label>
                    <input
                      type="range"
                      min="40"
                      max="1200"
                      step="10"
                      value={material.bondStrength}
                      onChange={(e) =>
                        handleChangeMaterialProp('bondStrength', parseFloat(e.target.value))
                      }
                      className="w-full accent-rose-500"
                    />
                  </div>
                </div>

                {/* Visual Overlay Toggles */}
                <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showDamageOverlay}
                      onChange={(e) => setShowDamageOverlay(e.target.checked)}
                      className="accent-indigo-500"
                    />
                    <span>Bond-Damage Overlay</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showTrail}
                      onChange={(e) => setShowTrail(e.target.checked)}
                      className="accent-rose-500"
                    />
                    <span>3D Motion Trail</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showForceVectors}
                      onChange={(e) => setShowForceVectors(e.target.checked)}
                      className="accent-purple-500"
                    />
                    <span>Impact Force Vector</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showCollisionPoints && showCosmeticFX}
                      onChange={(e) => {
                        setShowCollisionPoints(e.target.checked);
                        setShowCosmeticFX(e.target.checked);
                      }}
                      className="accent-amber-500"
                    />
                    <span>Collision &amp; FX Markers</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'impacts' && (
          <ImpactAnalysisView impacts={impacts} onClearImpacts={() => setImpacts([])} />
        )}

        {activeTab === 'materials' && (
          <MaterialLabView
            material={material}
            selectedPresetId={selectedMaterialId}
            onSelectPreset={handleSelectMaterialPreset}
            onChangeMaterialProp={handleChangeMaterialProp}
            onRebuildWall={() => handleRebuildWallOnly()}
            comparisonLog={comparisonLog}
            onRecordComparisonRun={handleRecordComparisonRun}
            onClearComparisonLog={() => setComparisonLog([])}
          />
        )}

        {activeTab === 'graphs' && (
          <EnergyGraphsView telemetry={telemetry} onClearTelemetry={() => setTelemetry([])} />
        )}

        {activeTab === 'theory' && <PhysicsTheoryView />}

        {activeTab === 'experiments' && (
          <ExperimentsView
            activeExperimentId={activeExperimentId}
            onLoadExperiment={handleLoadExperiment}
          />
        )}

        {activeTab === 'info' && <ProjectInfoView />}
      </main>
    </div>
  );
}

export default App;