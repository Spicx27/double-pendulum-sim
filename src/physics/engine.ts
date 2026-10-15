export interface PendulumState {
  theta1: number; // radians from downward vertical
  theta2: number; // radians from downward vertical
  omega1: number; // rad/s
  omega2: number; // rad/s
}

export interface PendulumParams {
  m1: number;      // kg
  m2: number;      // kg
  l1: number;      // meters
  l2: number;      // meters
  g: number;       // m/s^2
  damping: number; // viscous joint damping (1/s)
}

export interface Derivatives {
  dTheta1: number;
  dTheta2: number;
  dOmega1: number;
  dOmega2: number;
}

export interface BobKinematics {
  pivotY: number;
  x1: number;
  y1: number;
  z1: number;
  vx1: number;
  vy1: number;
  speed1: number;
  x2: number;
  y2: number;
  z2: number;
  vx2: number;
  vy2: number;
  speed2: number;
  alpha1: number;
  alpha2: number;
}

export const PIVOT_HEIGHT = 3.2; // meters above the 3D floor (y = 0)

// Calculates angular velocities and angular accelerations (alpha1, alpha2)
export const getDerivatives = (state: PendulumState, params: PendulumParams): Derivatives => {
  const { theta1, theta2, omega1, omega2 } = state;
  const { m1, m2, l1, l2, g, damping } = params;

  const totalMass = m1 + m2;
  const delta = theta1 - theta2;

  const denom1 = l1 * (2 * m1 + m2 - m2 * Math.cos(2 * theta1 - 2 * theta2));
  const num1_1 = -g * (2 * m1 + m2) * Math.sin(theta1);
  const num1_2 = -m2 * g * Math.sin(theta1 - 2 * theta2);
  const num1_3 = -2 * Math.sin(delta) * m2;
  const num1_4 = omega2 * omega2 * l2 + omega1 * omega1 * l1 * Math.cos(delta);
  const alpha1 = (num1_1 + num1_2 + num1_3 * num1_4) / denom1 - damping * omega1;

  const denom2 = l2 * (2 * m1 + m2 - m2 * Math.cos(2 * theta1 - 2 * theta2));
  const num2_1 = 2 * Math.sin(delta);
  const num2_2 = omega1 * omega1 * l1 * totalMass;
  const num2_3 = g * totalMass * Math.cos(theta1);
  const num2_4 = omega2 * omega2 * l2 * m2 * Math.cos(delta);
  const alpha2 = (num2_1 * (num2_2 + num2_3 + num2_4)) / denom2 - damping * omega2;

  return {
    dTheta1: omega1,
    dTheta2: omega2,
    dOmega1: alpha1,
    dOmega2: alpha2,
  };
};

// 4th-Order Runge-Kutta (RK4) integration step
export const stepRK4 = (state: PendulumState, params: PendulumParams, dt: number): PendulumState => {
  const k1 = getDerivatives(state, params);

  const stateK2: PendulumState = {
    theta1: state.theta1 + 0.5 * dt * k1.dTheta1,
    theta2: state.theta2 + 0.5 * dt * k1.dTheta2,
    omega1: state.omega1 + 0.5 * dt * k1.dOmega1,
    omega2: state.omega2 + 0.5 * dt * k1.dOmega2,
  };
  const k2 = getDerivatives(stateK2, params);

  const stateK3: PendulumState = {
    theta1: state.theta1 + 0.5 * dt * k2.dTheta1,
    theta2: state.theta2 + 0.5 * dt * k2.dTheta2,
    omega1: state.omega1 + 0.5 * dt * k2.dOmega1,
    omega2: state.omega2 + 0.5 * dt * k2.dOmega2,
  };
  const k3 = getDerivatives(stateK3, params);

  const stateK4: PendulumState = {
    theta1: state.theta1 + dt * k3.dTheta1,
    theta2: state.theta2 + dt * k3.dTheta2,
    omega1: state.omega1 + dt * k3.dOmega1,
    omega2: state.omega2 + dt * k3.dOmega2,
  };
  const k4 = getDerivatives(stateK4, params);

  return {
    theta1: state.theta1 + (dt / 6) * (k1.dTheta1 + 2 * k2.dTheta1 + 2 * k3.dTheta1 + k4.dTheta1),
    theta2: state.theta2 + (dt / 6) * (k1.dTheta2 + 2 * k2.dTheta2 + 2 * k3.dTheta2 + k4.dTheta2),
    omega1: state.omega1 + (dt / 6) * (k1.dOmega1 + 2 * k2.dOmega1 + 2 * k3.dOmega1 + k4.dOmega1),
    omega2: state.omega2 + (dt / 6) * (k1.dOmega2 + 2 * k2.dOmega2 + 2 * k3.dOmega2 + k4.dOmega2),
  };
};

// Computes 3D world-space positions (y-up, floor at y=0) and velocities of both bobs
export const getBobKinematics = (
  state: PendulumState,
  params: PendulumParams,
  pivotY: number = PIVOT_HEIGHT
): BobKinematics => {
  const { theta1, theta2, omega1, omega2 } = state;
  const { l1, l2 } = params;
  const derivs = getDerivatives(state, params);

  const x1 = l1 * Math.sin(theta1);
  const y1 = pivotY - l1 * Math.cos(theta1);
  const vx1 = l1 * omega1 * Math.cos(theta1);
  const vy1 = l1 * omega1 * Math.sin(theta1);
  const speed1 = Math.hypot(vx1, vy1);

  const x2 = x1 + l2 * Math.sin(theta2);
  const y2 = y1 - l2 * Math.cos(theta2);
  const vx2 = vx1 + l2 * omega2 * Math.cos(theta2);
  const vy2 = vy1 + l2 * omega2 * Math.sin(theta2);
  const speed2 = Math.hypot(vx2, vy2);

  return {
    pivotY,
    x1,
    y1,
    z1: 0,
    vx1,
    vy1,
    speed1,
    x2,
    y2,
    z2: 0,
    vx2,
    vy2,
    speed2,
    alpha1: derivs.dOmega1,
    alpha2: derivs.dOmega2,
  };
};

// Calculates Pendulum Mechanical Energy (with Potential Energy referenced to floor y = 0)
export const calculateEnergy = (
  state: PendulumState,
  params: PendulumParams,
  pivotY: number = PIVOT_HEIGHT
) => {
  const { theta1, theta2, omega1, omega2 } = state;
  const { m1, m2, l1, l2, g } = params;

  const ke1 = 0.5 * m1 * l1 * l1 * omega1 * omega1;
  const ke2 =
    0.5 *
    m2 *
    (l1 * l1 * omega1 * omega1 +
      l2 * l2 * omega2 * omega2 +
      2 * l1 * l2 * omega1 * omega2 * Math.cos(theta1 - theta2));
  const ke = ke1 + ke2;

  const y1 = pivotY - l1 * Math.cos(theta1);
  const y2 = y1 - l2 * Math.cos(theta2);
  const pe = m1 * g * y1 + m2 * g * y2;

  return { ke, pe, total: ke + pe };
};

/**
 * Computes operational-space inverse effective mass along collision normal (nx, ny).
 * Includes physical mass bounds so near-collinear rod alignments never cause division-by-zero impulse spikes.
 */
export const computeEffectiveInverseMass = (
  state: PendulumState,
  params: PendulumParams,
  bobIndex: 1 | 2,
  nx: number,
  ny: number
): number => {
  const { theta1, theta2 } = state;
  const { m1, m2, l1, l2 } = params;

  const M11 = (m1 + m2) * l1 * l1;
  const M12 = m2 * l1 * l2 * Math.cos(theta1 - theta2);
  const M22 = m2 * l2 * l2;
  const det = Math.max(1e-4, M11 * M22 - M12 * M12);

  const invM11 = M22 / det;
  const invM12 = -M12 / det;
  const invM22 = M11 / det;

  const jtn1 = l1 * Math.cos(theta1) * nx + l1 * Math.sin(theta1) * ny;
  const jtn2 = bobIndex === 2 ? l2 * Math.cos(theta2) * nx + l2 * Math.sin(theta2) * ny : 0;

  const rawInvMassEff =
    jtn1 * (invM11 * jtn1 + invM12 * jtn2) + jtn2 * (invM12 * jtn1 + invM22 * jtn2);

  // Physical bounds: effective mass cannot exceed total pendulum mass or be less than 0.35 * bob mass
  const minInvMass = 1 / (m1 + m2);
  const maxInvMass = 1 / (0.35 * (bobIndex === 1 ? m1 : m2));

  return Math.max(minInvMass, Math.min(maxInvMass, rawInvMassEff));
};

/**
 * Projects a Cartesian collision impulse (Jx, Jy) into generalized angular velocities (omega1, omega2)
 * while enforcing passive thermodynamic energy conservation (collision with a passive wall can never add KE).
 */
export const applyGeneralizedImpulse = (
  state: PendulumState,
  params: PendulumParams,
  bobIndex: 1 | 2,
  Jx: number,
  Jy: number,
  posCorrectionX: number = 0,
  posCorrectionY: number = 0,
  maxEnergyRetention: number = 0.92
): PendulumState => {
  const { theta1, theta2, omega1, omega2 } = state;
  const { m1, m2, l1, l2 } = params;

  const preKE = calculateEnergy(state, params).ke;

  // Small angular position projection to resolve overlap without altering rod lengths
  let dTheta1 = 0;
  let dTheta2 = 0;
  if (bobIndex === 1) {
    dTheta1 = (Math.cos(theta1) * posCorrectionX + Math.sin(theta1) * posCorrectionY) / l1;
  } else {
    dTheta2 = (Math.cos(theta2) * posCorrectionX + Math.sin(theta2) * posCorrectionY) / l2;
  }
  // Clamp single-substep angular position correction to prevent teleportation
  dTheta1 = Math.max(-0.025, Math.min(0.025, dTheta1));
  dTheta2 = Math.max(-0.025, Math.min(0.025, dTheta2));

  const nextTheta1 = theta1 + dTheta1;
  const nextTheta2 = theta2 + dTheta2;

  if (Jx === 0 && Jy === 0) {
    return {
      theta1: nextTheta1,
      theta2: nextTheta2,
      omega1,
      omega2,
    };
  }

  const M11 = (m1 + m2) * l1 * l1;
  const M12 = m2 * l1 * l2 * Math.cos(theta1 - theta2);
  const M22 = m2 * l2 * l2;
  const det = Math.max(1e-4, M11 * M22 - M12 * M12);

  const invM11 = M22 / det;
  const invM12 = -M12 / det;
  const invM22 = M11 / det;

  const pi1 = l1 * Math.cos(theta1) * Jx + l1 * Math.sin(theta1) * Jy;
  const pi2 = bobIndex === 2 ? l2 * Math.cos(theta2) * Jx + l2 * Math.sin(theta2) * Jy : 0;

  // Damp off-diagonal coupling slightly during sharp impacts to prevent numerical whip spikes
  const couplingDamp = 0.65;
  const dOmega1 = invM11 * pi1 + couplingDamp * invM12 * pi2;
  const dOmega2 = couplingDamp * invM12 * pi1 + invM22 * pi2;

  let nextOmega1 = omega1 + dOmega1;
  let nextOmega2 = omega2 + dOmega2;

  // Thermodynamic passivity check: passive wall collision cannot increase total pendulum kinetic energy
  const candidateState: PendulumState = {
    theta1: nextTheta1,
    theta2: nextTheta2,
    omega1: nextOmega1,
    omega2: nextOmega2,
  };
  const postKE = calculateEnergy(candidateState, params).ke;
  const maxAllowedKE = Math.max(0.05, preKE * maxEnergyRetention);

  if (preKE > 0.01 && postKE > maxAllowedKE) {
    const scale = Math.sqrt(maxAllowedKE / postKE);
    nextOmega1 *= scale;
    nextOmega2 *= scale;
  }

  return {
    theta1: nextTheta1,
    theta2: nextTheta2,
    omega1: Math.max(-25, Math.min(25, nextOmega1)),
    omega2: Math.max(-30, Math.min(30, nextOmega2)),
  };
};

export const getBobRadius = (mass: number): number => {
  return Math.max(0.09, Math.min(0.24, 0.085 * Math.cbrt(mass)));
};