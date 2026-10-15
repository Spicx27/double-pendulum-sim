import {
  type PendulumParams,
  type PendulumState,
  stepRK4,
  calculateEnergy,
  getBobKinematics,
  applyGeneralizedImpulse,
  PIVOT_HEIGHT,
} from './engine';
import { createWallSystem, stepWallAndCollisions } from './wallEngine';
import { MATERIAL_PRESETS } from './presets';

export interface ValidationTestResult {
  id: number;
  name: string;
  category: string;
  passed: boolean;
  measuredValue: string;
  expectedCriterion: string;
}

export const runPhysicsValidationSuite = (): ValidationTestResult[] => {
  const results: ValidationTestResult[] = [];
  const defaultParams: PendulumParams = {
    m1: 2.0,
    m2: 2.5,
    l1: 1.2,
    l2: 1.1,
    g: 9.81,
    damping: 0.0,
  };

  // Test 1: RK4 Mechanical Energy Conservation (Undamped Free Swing)
  {
    let state: PendulumState = { theta1: 0.6, theta2: -0.4, omega1: 0, omega2: 0 };
    const e0 = calculateEnergy(state, defaultParams).total;
    for (let i = 0; i < 500; i++) {
      state = stepRK4(state, defaultParams, 0.002);
    }
    const e1 = calculateEnergy(state, defaultParams).total;
    const driftPct = Math.abs((e1 - e0) / e0) * 100;
    results.push({
      id: 1,
      name: 'RK4 Energy Conservation (1.0s Undamped Swing)',
      category: 'Pendulum Solver',
      passed: driftPct < 0.05,
      measuredValue: `${driftPct.toFixed(5)}% drift`,
      expectedCriterion: '< 0.05% energy error',
    });
  }

  // Test 2: Rod-Length Geometric Invariant Before & After Collision Impulse
  {
    const state: PendulumState = { theta1: -0.8, theta2: 0.5, omega1: 3.2, omega2: -2.1 };
    const afterImpulse = applyGeneralizedImpulse(state, defaultParams, 2, -18.5, 6.2, -0.015, 0.008);
    const kin = getBobKinematics(afterImpulse, defaultParams, PIVOT_HEIGHT);
    const actualL1 = Math.hypot(kin.x1, kin.y1 - PIVOT_HEIGHT);
    const actualL2 = Math.hypot(kin.x2 - kin.x1, kin.y2 - kin.y1);
    const errL1 = Math.abs(actualL1 - defaultParams.l1);
    const errL2 = Math.abs(actualL2 - defaultParams.l2);
    results.push({
      id: 2,
      name: 'Post-Collision Rod-Length Constraint Invariance',
      category: 'Generalized Impulse',
      passed: errL1 < 1e-9 && errL2 < 1e-9,
      measuredValue: `|ΔL₁| = ${errL1.toExponential(2)} m, |ΔL₂| = ${errL2.toExponential(2)} m`,
      expectedCriterion: '|ΔL| < 1e-9 m',
    });
  }

  // Test 3: Coupled Generalized Impulse Reverses Bob Velocity Without Energy Explosion
  {
    const state: PendulumState = { theta1: 0.4, theta2: 0.4, omega1: 4.0, omega2: 4.0 };
    const kinBefore = getBobKinematics(state, defaultParams);
    const after = applyGeneralizedImpulse(state, defaultParams, 2, -25.0, 0);
    const kinAfter = getBobKinematics(after, defaultParams);
    const velocityChanged = kinAfter.vx2 < kinBefore.vx2;
    results.push({
      id: 3,
      name: 'Lagrangian Mass-Matrix Velocity Rebound Response',
      category: 'Collision Mechanics',
      passed: velocityChanged && Number.isFinite(kinAfter.speed2),
      measuredValue: `v_x2: ${kinBefore.vx2.toFixed(2)} → ${kinAfter.vx2.toFixed(2)} m/s`,
      expectedCriterion: 'Post-impulse v_x2 < Pre-impulse v_x2',
    });
  }

  // Test 4: Weak Impact vs. Strong Impact Damage Differentiation
  {
    const wallCfg = {
      structureType: 'brick_wall' as const,
      wallX: 0.95,
      wallZ: 0,
      rows: 6,
      cols: 3,
      blockWidth: 0.22,
      blockHeight: 0.24,
      blockDepth: 0.34,
    };

    // Weak run
    let weakPend: PendulumState = { theta1: (-35 * Math.PI) / 180, theta2: (-20 * Math.PI) / 180, omega1: 0, omega2: 0 };
    let weakWall = createWallSystem(wallCfg, MATERIAL_PRESETS.brick);
    for (let i = 0; i < 450; i++) {
      weakPend = stepRK4(weakPend, defaultParams, 0.002);
      const res = stepWallAndCollisions(weakPend, defaultParams, weakWall, MATERIAL_PRESETS.brick, i * 0.002, 0.002, 1);
      weakPend = res.pendulumState;
      weakWall = res.wallState;
    }
    const weakDetached = weakWall.blocks.filter((b) => b.isDetached).length;

    // Strong run
    let strongPend: PendulumState = { theta1: (-130 * Math.PI) / 180, theta2: (-145 * Math.PI) / 180, omega1: 0, omega2: 0 };
    let strongWall = createWallSystem(wallCfg, MATERIAL_PRESETS.brick);
    for (let i = 0; i < 450; i++) {
      strongPend = stepRK4(strongPend, defaultParams, 0.002);
      const res = stepWallAndCollisions(strongPend, defaultParams, strongWall, MATERIAL_PRESETS.brick, i * 0.002, 0.002, 1);
      strongPend = res.pendulumState;
      strongWall = res.wallState;
    }
    const strongDetached = strongWall.blocks.filter((b) => b.isDetached).length;

    results.push({
      id: 4,
      name: 'Weak vs. Strong Impact Fracture Differentiation',
      category: 'Fracture Model',
      passed: strongDetached > weakDetached && strongDetached > 0,
      measuredValue: `Weak: ${weakDetached} detached | Strong: ${strongDetached} detached`,
      expectedCriterion: 'Strong Detached > Weak Detached',
    });
  }

  // Test 5: Detached 3D Fragment Gravity & Floor Restitution Boundary
  {
    const wallCfg = {
      structureType: 'brick_wall' as const,
      wallX: 0.95,
      wallZ: 0,
      rows: 3,
      cols: 2,
      blockWidth: 0.22,
      blockHeight: 0.24,
      blockDepth: 0.34,
    };
    let wall = createWallSystem(wallCfg, MATERIAL_PRESETS.brick);
    // Detach top block manually and let it fall under gravity
    wall.blocks[wall.blocks.length - 1].isDetached = true;
    const initialY = wall.blocks[wall.blocks.length - 1].y;
    const idlePend: PendulumState = { theta1: 0, theta2: 0, omega1: 0, omega2: 0 };

    for (let i = 0; i < 400; i++) {
      const res = stepWallAndCollisions(idlePend, defaultParams, wall, MATERIAL_PRESETS.brick, i * 0.0025, 0.0025, 1);
      wall = res.wallState;
    }
    const finalY = wall.blocks[wall.blocks.length - 1].y;
    const halfH = wall.blocks[wall.blocks.length - 1].height / 2;

    results.push({
      id: 5,
      name: 'Detached Fragment Gravity Fall & Floor Collision',
      category: '3D Fragment Dynamics',
      passed: finalY < initialY && finalY >= halfH - 1e-4,
      measuredValue: `y_initial = ${initialY.toFixed(2)} m → y_final = ${finalY.toFixed(2)} m (floor min = ${halfH.toFixed(2)} m)`,
      expectedCriterion: 'Fragment falls and rests on floor (y >= h/2)',
    });
  }

  // Test 6: Equilibrium Static Rest Check (Zero Initial Angle)
  {
    let state: PendulumState = { theta1: 0, theta2: 0, omega1: 0, omega2: 0 };
    for (let i = 0; i < 100; i++) {
      state = stepRK4(state, defaultParams, 0.005);
    }
    const maxAngle = Math.max(Math.abs(state.theta1), Math.abs(state.theta2));
    results.push({
      id: 6,
      name: 'Downward Vertical Equilibrium Stability (θ₁ = θ₂ = 0)',
      category: 'Pendulum Solver',
      passed: maxAngle < 1e-12,
      measuredValue: `max(|θ|) = ${maxAngle.toExponential(2)} rad`,
      expectedCriterion: 'Remains at rest (|θ| = 0)',
    });
  }

  return results;
};