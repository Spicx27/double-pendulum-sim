export interface PendulumState {
  theta1: number; // radians from downward vertical
  theta2: number;
  omega1: number; // angular velocity
  omega2: number;
}

export interface PendulumParams {
  m1: number; // kg
  m2: number;
  l1: number; // meters
  l2: number;
  g: number;  // m/s^2
  damping: number; // NEW: Friction coefficient
}

export interface Derivatives {
  dTheta1: number;
  dTheta2: number;
  dOmega1: number;
  dOmega2: number;
}

// Calculates the angular accelerations (alpha1, alpha2) and velocities
export const getDerivatives = (state: PendulumState, params: PendulumParams): Derivatives => {
  const { theta1, theta2, omega1, omega2 } = state;
  const { m1, m2, l1, l2, g } = params;

  const deltaTheta = theta1 - theta2;
  const totalMass = m1 + m2;

  const denom1 = l1 * (2 * m1 + m2 - m2 * Math.cos(2 * theta1 - 2 * theta2));
  const num1_1 = -g * (2 * m1 + m2) * Math.sin(theta1);
  const num1_2 = -m2 * g * Math.sin(theta1 - 2 * theta2);
  const num1_3 = -2 * Math.sin(theta1 - theta2) * m2;
  const num1_4 = omega2 * omega2 * l2 + omega1 * omega1 * l1 * Math.cos(theta1 - theta2);
  const alpha1 = ((num1_1 + num1_2 + num1_3 * num1_4) / denom1) - (params.damping * omega1);

  const denom2 = l2 * (2 * m1 + m2 - m2 * Math.cos(2 * theta1 - 2 * theta2));
  const num2_1 = 2 * Math.sin(theta1 - theta2);
  const num2_2 = omega1 * omega1 * l1 * totalMass;
  const num2_3 = g * totalMass * Math.cos(theta1);
  const num2_4 = omega2 * omega2 * l2 * m2 * Math.cos(theta1 - theta2);
  const alpha2 = ((num2_1 * (num2_2 + num2_3 + num2_4)) / denom2) - (params.damping * omega2);

  return {
    dTheta1: omega1,
    dTheta2: omega2,
    dOmega1: alpha1,
    dOmega2: alpha2
  };
};

// 4th-Order Runge-Kutta numerical integration step
export const stepRK4 = (state: PendulumState, params: PendulumParams, dt: number): PendulumState => {
  const k1 = getDerivatives(state, params);
  
  const stateK2 = {
    theta1: state.theta1 + 0.5 * dt * k1.dTheta1,
    theta2: state.theta2 + 0.5 * dt * k1.dTheta2,
    omega1: state.omega1 + 0.5 * dt * k1.dOmega1,
    omega2: state.omega2 + 0.5 * dt * k1.dOmega2,
  };
  const k2 = getDerivatives(stateK2, params);

  const stateK3 = {
    theta1: state.theta1 + 0.5 * dt * k2.dTheta1,
    theta2: state.theta2 + 0.5 * dt * k2.dTheta2,
    omega1: state.omega1 + 0.5 * dt * k2.dOmega1,
    omega2: state.omega2 + 0.5 * dt * k2.dOmega2,
  };
  const k3 = getDerivatives(stateK3, params);

  const stateK4 = {
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

export const calculateEnergy = (state: PendulumState, params: PendulumParams) => {
  const { theta1, theta2, omega1, omega2 } = state;
  const { m1, m2, l1, l2, g } = params;

  // Kinetic Energy
  const ke1 = 0.5 * m1 * l1 * l1 * omega1 * omega1;
  const ke2 = 0.5 * m2 * (l1 * l1 * omega1 * omega1 + l2 * l2 * omega2 * omega2 + 2 * l1 * l2 * omega1 * omega2 * Math.cos(theta1 - theta2));
  const ke = ke1 + ke2;

  // Potential Energy
  const pe1 = -m1 * g * l1 * Math.cos(theta1);
  const pe2 = -m2 * g * (l1 * Math.cos(theta1) + l2 * Math.cos(theta2));
  const pe = pe1 + pe2;

  return { ke, pe, total: ke + pe };
};