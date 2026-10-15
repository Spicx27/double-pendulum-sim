import { type MaterialProperties, type WallConfig } from './wallEngine';
import { type PendulumParams } from './engine';

export const MATERIAL_PRESETS: Record<string, MaterialProperties> = {
  brick: {
    id: 'brick',
    name: 'Unreinforced Brick Masonry',
    category: 'Brittle Masonry',
    density: 1900,
    youngsModulus: 18,
    contactStiffness: 180000,
    contactDamping: 420,
    restitution: 0.25,
    bondStrength: 160, // kPa mortar bond strength
    fractureEnergy: 2.5,
    colorHex: '#b45309',
    description:
      'Fired clay bricks joined by lime-cement mortar joints. Moderate compressive strength but low tensile/shear bond threshold, fracturing into detached blocks under moderate pendulum impacts.',
  },
  concrete: {
    id: 'concrete',
    name: 'Reinforced Concrete Barrier',
    category: 'High-Strength Composite',
    density: 2400,
    youngsModulus: 32,
    contactStiffness: 380000,
    contactDamping: 650,
    restitution: 0.35,
    bondStrength: 540, // kPa high bond strength
    fractureEnergy: 9.0,
    colorHex: '#64748b',
    description:
      'High-density concrete blocks with reinforced inter-block joints. Requires high-mass, high-velocity impacts to exceed the 540 kPa bond failure threshold.',
  },
  timber: {
    id: 'timber',
    name: 'Structural Timber (Pine)',
    category: 'Light Orthotropic Wood',
    density: 650,
    youngsModulus: 11,
    contactStiffness: 95000,
    contactDamping: 290,
    restitution: 0.48,
    bondStrength: 110, // kPa dowel/fastener bond
    fractureEnergy: 1.8,
    colorHex: '#ca8a04',
    description:
      'Low-density timber segments with compliant contact stiffness (longer contact duration Δt) and lower inertia, launching further once detached.',
  },
  glass: {
    id: 'glass',
    name: 'Brittle Tempered Ceramic',
    category: 'Ultra-Brittle',
    density: 2500,
    youngsModulus: 70,
    contactStiffness: 520000,
    contactDamping: 150,
    restitution: 0.65,
    bondStrength: 65, // Fractures easily under sharp peak forces
    fractureEnergy: 0.8,
    colorHex: '#0284c7',
    description:
      'Very high contact stiffness produces short impact duration (Δt) and high peak contact forces (F_peak), causing rapid brittle bond failure.',
  },
  steel_frame: {
    id: 'steel_frame',
    name: 'Heavy Ductile Steel Block',
    category: 'Ductile Metal',
    density: 7850,
    youngsModulus: 200,
    contactStiffness: 650000,
    contactDamping: 900,
    restitution: 0.55,
    bondStrength: 1200, // Resists most impacts without breaking
    fractureEnergy: 25.0,
    colorHex: '#475569',
    description:
      'High density and 1200 kPa weld strength. Absorbs and reflects the pendulum bob with minimal structural detachment, ideal for studying elastic rebound.',
  },
};

export interface ExperimentPreset {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  changedParams: string;
  fixedParams: string;
  principle: string;
  expectedObservation: string;
  pendulumParams: PendulumParams;
  initialAnglesDeg: { t1: number; t2: number };
  wallConfig: WallConfig;
  materialId: keyof typeof MATERIAL_PRESETS;
}

export const EXPERIMENT_PRESETS: ExperimentPreset[] = [
  {
    id: 'exp_weak_impact',
    number: 1,
    title: 'Low-Energy Grazing Impact (Sub-Critical Stress)',
    subtitle: 'Demonstrates localized bond damage without catastrophic fracture',
    changedParams: 'Initial Angles θ₁ = -38°, θ₂ = -25° (Low Potential Energy)',
    fixedParams: 'm₁ = 2.0 kg, m₂ = 2.5 kg, L₁ = 1.2 m, L₂ = 1.1 m, Brick Masonry (σ_fail = 160 kPa)',
    principle:
      'When initial gravitational potential energy is low, the bob reaches the wall with low pre-impact momentum (p = mv). Peak contact stress remains below the mortar bond strength threshold.',
    expectedObservation:
      'The bob rebounds off the brick wall. The damage overlay turns yellow/orange near the contact zone, but zero or at most 1 surface block detaches.',
    pendulumParams: { m1: 2.0, m2: 2.5, l1: 1.2, l2: 1.1, g: 9.81, damping: 0.02 },
    initialAnglesDeg: { t1: -38, t2: -25 },
    wallConfig: {
      structureType: 'brick_wall',
      wallX: 0.95,
      wallZ: 0,
      rows: 6,
      cols: 3,
      blockWidth: 0.22,
      blockHeight: 0.24,
      blockDepth: 0.34,
    },
    materialId: 'brick',
  },
  {
    id: 'exp_strong_impact',
    number: 2,
    title: 'High-Energy Catastrophic Breach (Super-Critical Stress)',
    subtitle: 'Identical setup to Experiment 1, but dropped from θ₁ = -125°, θ₂ = -140°',
    changedParams: 'Initial Angles θ₁ = -125°, θ₂ = -140° (High Potential Energy)',
    fixedParams: 'm₁ = 2.0 kg, m₂ = 2.5 kg, L₁ = 1.2 m, L₂ = 1.1 m, Brick Masonry (σ_fail = 160 kPa)',
    principle:
      'Kinetic energy scales with velocity squared (K = ½mv²). Raising initial height drastically increases impact velocity, impulse (J = Δp), and peak bond stress beyond 160 kPa.',
    expectedObservation:
      'The bob smashes through the lower-middle courses of the brick wall, severing mortar bonds and causing upper unsupported courses to collapse under gravity.',
    pendulumParams: { m1: 2.0, m2: 2.5, l1: 1.2, l2: 1.1, g: 9.81, damping: 0.02 },
    initialAnglesDeg: { t1: -125, t2: -140 },
    wallConfig: {
      structureType: 'brick_wall',
      wallX: 0.95,
      wallZ: 0,
      rows: 6,
      cols: 3,
      blockWidth: 0.22,
      blockHeight: 0.24,
      blockDepth: 0.34,
    },
    materialId: 'brick',
  },
  {
    id: 'exp_heavy_wrecking_ball',
    number: 3,
    title: 'Heavy Wrecking Ball Effect (Mass Ratio m₂ >> m₁)',
    subtitle: 'Demonstrates momentum dominance with a 6.5 kg secondary bob',
    changedParams: 'Second Bob Mass m₂ = 6.5 kg (vs. 2.5 kg baseline)',
    fixedParams: 'θ₁ = -105°, θ₂ = -115°, L₁ = 1.2 m, L₂ = 1.1 m, Brick Masonry',
    principle:
      'Linear momentum p = m₂v₂ and operational-space effective mass m_eff increase directly with m₂, reducing bob deceleration upon impact and transferring massive impulse into the wall.',
    expectedObservation:
      'Bob 2 acts like a demolition wrecking ball, ploughing through multiple columns of bricks with minimal velocity loss and sending fragments flying across the floor.',
    pendulumParams: { m1: 1.5, m2: 6.5, l1: 1.2, l2: 1.1, g: 9.81, damping: 0.02 },
    initialAnglesDeg: { t1: -105, t2: -115 },
    wallConfig: {
      structureType: 'brick_wall',
      wallX: 0.95,
      wallZ: 0,
      rows: 6,
      cols: 3,
      blockWidth: 0.22,
      blockHeight: 0.24,
      blockDepth: 0.34,
    },
    materialId: 'brick',
  },
  {
    id: 'exp_whip_effect',
    number: 4,
    title: 'Coupled Whip Dynamics (m₁ > m₂ & Long L₂)',
    subtitle: 'Transfers angular momentum from heavy upper bob to fast outer bob',
    changedParams: 'm₁ = 5.0 kg, m₂ = 1.4 kg, L₁ = 1.0 m, L₂ = 1.4 m',
    fixedParams: 'θ₁ = -110°, θ₂ = -45°, Brick Masonry Wall at X = 1.05 m',
    principle:
      'In a coupled double pendulum, when m₁ > m₂, conservation of energy and off-diagonal mass-matrix coupling accelerate the lighter second bob to extreme angular velocity ω₂.',
    expectedObservation:
      'Bob 2 whips forward at high speed, striking the wall with a sharp, short-duration impulse that snaps local bonds while violently kicking Bob 1 backward.',
    pendulumParams: { m1: 5.0, m2: 1.4, l1: 1.0, l2: 1.4, g: 9.81, damping: 0.01 },
    initialAnglesDeg: { t1: -110, t2: -45 },
    wallConfig: {
      structureType: 'brick_wall',
      wallX: 1.05,
      wallZ: 0,
      rows: 6,
      cols: 3,
      blockWidth: 0.22,
      blockHeight: 0.24,
      blockDepth: 0.34,
    },
    materialId: 'brick',
  },
  {
    id: 'exp_concrete_vs_brick',
    number: 5,
    title: 'Reinforced Concrete Barrier Resilience',
    subtitle: 'High bond strength (540 kPa) and contact stiffness under heavy impact',
    changedParams: 'Material = Reinforced Concrete Barrier (σ_fail = 540 kPa, ρ = 2400 kg/m³)',
    fixedParams: 'θ₁ = -125°, θ₂ = -140°, m₁ = 2.0 kg, m₂ = 2.5 kg',
    principle:
      'Higher contact stiffness k_c increases peak contact force, but the 3.4× higher bond failure threshold prevents structural collapse under loads that demolished the brick wall.',
    expectedObservation:
      'The pendulum slams into the concrete barrier and violently rebounds upward; the barrier absorbs the stress with moderate damage coloring but stays standing.',
    pendulumParams: { m1: 2.0, m2: 2.5, l1: 1.2, l2: 1.1, g: 9.81, damping: 0.02 },
    initialAnglesDeg: { t1: -125, t2: -140 },
    wallConfig: {
      structureType: 'concrete_barrier',
      wallX: 0.95,
      wallZ: 0,
      rows: 4,
      cols: 3,
      blockWidth: 0.28,
      blockHeight: 0.32,
      blockDepth: 0.42,
    },
    materialId: 'concrete',
  },
  {
    id: 'exp_brittle_glass',
    number: 6,
    title: 'Brittle Ceramic Shatter (High Stiffness, Low Bond Threshold)',
    subtitle: 'Short contact duration Δt produces high peak force and instant fracture',
    changedParams: 'Material = Brittle Tempered Ceramic (k_c = 520 kN/m, σ_fail = 65 kPa)',
    fixedParams: 'θ₁ = -85°, θ₂ = -90°, m₁ = 2.0 kg, m₂ = 2.2 kg',
    principle:
      'From F_avg = Δp / Δt, a very stiff contact interface (large k_c) compresses collision duration Δt, spiking peak force F_peak well past the low 65 kPa brittle threshold.',
    expectedObservation:
      'Even a medium-angle swing shatters the ceramic wall bonds on contact, showering blue-tinted fragments across the floor.',
    pendulumParams: { m1: 2.0, m2: 2.2, l1: 1.2, l2: 1.1, g: 9.81, damping: 0.01 },
    initialAnglesDeg: { t1: -85, t2: -90 },
    wallConfig: {
      structureType: 'brick_wall',
      wallX: 0.92,
      wallZ: 0,
      rows: 6,
      cols: 3,
      blockWidth: 0.22,
      blockHeight: 0.24,
      blockDepth: 0.34,
    },
    materialId: 'glass',
  },
  {
    id: 'exp_wall_standoff',
    number: 7,
    title: 'Wall Position Standoff Study (Close vs. Far Impact Geometry)',
    subtitle: 'Placing the structure further away at X = 1.45 m so only the outer tip strikes',
    changedParams: 'Wall Horizontal Distance X = 1.45 m, Tall Pillar Tower Geometry',
    fixedParams: 'θ₁ = -115°, θ₂ = -120°, m₁ = 2.2 kg, m₂ = 3.0 kg, Timber Material',
    principle:
      'Moving the structure toward the outer reach of L₁ + L₂ changes the impact angle and normal vector, striking with upward tangential velocity rather than horizontal bottom-of-arc velocity.',
    expectedObservation:
      'Bob 2 clips the upper-middle section of the timber tower on its upswing, toppling the upper blocks while leaving the base intact.',
    pendulumParams: { m1: 2.2, m2: 3.0, l1: 1.2, l2: 1.1, g: 9.81, damping: 0.02 },
    initialAnglesDeg: { t1: -115, t2: -120 },
    wallConfig: {
      structureType: 'pillar_tower',
      wallX: 1.45,
      wallZ: 0,
      rows: 8,
      cols: 2,
      blockWidth: 0.22,
      blockHeight: 0.24,
      blockDepth: 0.30,
    },
    materialId: 'timber',
  },
  {
    id: 'exp_elastic_steel_rebound',
    number: 8,
    title: 'High-Restitution Elastic Rebound on Ductile Steel',
    subtitle: 'Demonstrates constraint-consistent momentum reversal on an unbreakable target',
    changedParams: 'Material = Heavy Ductile Steel (σ_fail = 1200 kPa, e = 0.55)',
    fixedParams: 'θ₁ = -100°, θ₂ = -100°, m₁ = 2.5 kg, m₂ = 2.5 kg',
    principle:
      'When target bond strength far exceeds impact stress, zero fracture energy is consumed. The impulse J = -(1+e)Δv / m_eff⁻¹ reverses the generalized angular velocities via M(θ)⁻¹.',
    expectedObservation:
      'The bobs bounce cleanly off the steel wall, reversing trajectory while maintaining exact rod lengths L₁ and L₂.',
    pendulumParams: { m1: 2.5, m2: 2.5, l1: 1.15, l2: 1.15, g: 9.81, damping: 0.01 },
    initialAnglesDeg: { t1: -100, t2: -100 },
    wallConfig: {
      structureType: 'concrete_barrier',
      wallX: 0.85,
      wallZ: 0,
      rows: 4,
      cols: 3,
      blockWidth: 0.28,
      blockHeight: 0.32,
      blockDepth: 0.42,
    },
    materialId: 'steel_frame',
  },
];