import {
  type PendulumState,
  type PendulumParams,
  getBobKinematics,
  computeEffectiveInverseMass,
  applyGeneralizedImpulse,
  getBobRadius,
  calculateEnergy,
  PIVOT_HEIGHT,
} from './engine';

export type StructurePresetType = 'brick_wall' | 'concrete_barrier' | 'timber_panel' | 'pillar_tower';

export interface MaterialProperties {
  id: string;
  name: string;
  category: string;
  density: number;           // kg/m^3
  youngsModulus: number;     // GPa (illustrative reference stiffness)
  contactStiffness: number;  // N/m (compliant contact stiffness k_c)
  contactDamping: number;    // N*s/m (contact damping c_c)
  restitution: number;       // e (0 to 1)
  bondStrength: number;      // kPa (tensile/shear bond failure stress threshold)
  fractureEnergy: number;    // J (critical fracture energy per bond)
  colorHex: string;
  description: string;
}

export interface WallConfig {
  structureType: StructurePresetType;
  wallX: number;     // Horizontal distance from pendulum pivot (m)
  wallZ: number;     // Z offset from swing plane (m)
  rows: number;
  cols: number;
  blockWidth: number;
  blockHeight: number;
  blockDepth: number;
}

export interface WallBlock {
  id: number;
  row: number;
  col: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  wx: number;
  wy: number;
  wz: number;
  width: number;
  height: number;
  depth: number;
  mass: number;
  damage: number;       // 0 = intact, 0..1 = damaged, >=1 = fractured/detached
  peakStressKPa: number;
  isDetached: boolean;
  anchoredToGround: boolean;
  lastImpactTime: number;
}

export interface BlockBond {
  id: string;
  blockA: number;
  blockB: number; // -1 indicates bond to foundation floor
  area: number;   // m^2 (effective shear/flexural mortar bed area)
  stressLoadKPa: number;
  damage: number; // 0..1
  broken: boolean;
}

export interface ForceSample {
  timeMs: number;
  forceN: number;
}

export interface ImpactEvent {
  id: number;
  simTime: number;
  bobIndex: 1 | 2;
  blockId: number;
  contactPoint: { x: number; y: number; z: number };
  contactNormal: { x: number; y: number; z: number };
  preVelocity: { vx: number; vy: number; speed: number };
  postVelocity: { vx: number; vy: number; speed: number };
  momentumChange: number;     // kg*m/s
  impulse: number;            // N*s
  contactDurationMs: number;  // ms
  peakForceN: number;         // N
  avgForceN: number;          // N
  prePendulumKE: number;      // J
  postPendulumKE: number;     // J
  transferredKE: number;      // J
  dissipatedEnergy: number;   // J
  peakBondStressKPa: number;  // kPa
  blocksDamagedCount: number;
  blocksDetachedCount: number;
  materialName: string;
  forceProfile: ForceSample[];
}

export interface WallSystemState {
  blocks: WallBlock[];
  bonds: BlockBond[];
  activeForceArrow: {
    active: boolean;
    x: number;
    y: number;
    z: number;
    fx: number;
    fy: number;
    fz: number;
    magnitude: number;
    timestamp: number;
  };
  recentContacts: { x: number; y: number; z: number; time: number }[];
  cumulativeFractureEnergy: number;
}

// Builds the 3D destructible block structure and initializes all inter-block bonds
export const createWallSystem = (
  config: WallConfig,
  material: MaterialProperties
): WallSystemState => {
  const blocks: WallBlock[] = [];
  const bonds: BlockBond[] = [];

  let rows = config.rows;
  let cols = config.cols;
  let bw = config.blockWidth;
  let bh = config.blockHeight;
  let bd = config.blockDepth;

  if (config.structureType === 'concrete_barrier') {
    rows = 4;
    cols = 3;
    bw = 0.28;
    bh = 0.32;
    bd = 0.42;
  } else if (config.structureType === 'timber_panel') {
    rows = 7;
    cols = 2;
    bw = 0.14;
    bh = 0.22;
    bd = 0.48;
  } else if (config.structureType === 'pillar_tower') {
    rows = 8;
    cols = 2;
    bw = 0.22;
    bh = 0.24;
    bd = 0.30;
  }

  let idCounter = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const staggerZ =
        config.structureType === 'brick_wall' && r % 2 === 1 ? (c === 0 ? 0.04 : -0.04) : 0;

      const x = config.wallX + (c - (cols - 1) / 2) * (bw + 0.004);
      const y = bh / 2 + r * (bh + 0.002);
      const z = config.wallZ + staggerZ;
      const volume = bw * bh * bd;
      const mass = Math.max(0.2, material.density * volume);

      blocks.push({
        id: idCounter++,
        row: r,
        col: c,
        x,
        y,
        z,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: 0,
        rz: 0,
        wx: 0,
        wy: 0,
        wz: 0,
        width: bw,
        height: bh,
        depth: bd,
        mass,
        damage: 0,
        peakStressKPa: 0,
        isDetached: false,
        anchoredToGround: r === 0,
        lastImpactTime: -10,
      });
    }
  }

  // Effective mortar bed joint area (localized flexural/shear bond zone)
  const horizBondArea = bw * bd * 0.16;
  const vertBondArea = bh * bd * 0.16;

  blocks.forEach((b) => {
    if (b.row === 0) {
      bonds.push({
        id: `ground_${b.id}`,
        blockA: b.id,
        blockB: -1,
        area: horizBondArea,
        stressLoadKPa: 0,
        damage: 0,
        broken: false,
      });
    }

    const above = blocks.find((other) => other.row === b.row + 1 && other.col === b.col);
    if (above) {
      bonds.push({
        id: `v_${b.id}_${above.id}`,
        blockA: b.id,
        blockB: above.id,
        area: horizBondArea,
        stressLoadKPa: 0,
        damage: 0,
        broken: false,
      });
    }

    const right = blocks.find((other) => other.row === b.row && other.col === b.col + 1);
    if (right) {
      bonds.push({
        id: `h_${b.id}_${right.id}`,
        blockA: b.id,
        blockB: right.id,
        area: vertBondArea,
        stressLoadKPa: 0,
        damage: 0,
        broken: false,
      });
    }
  });

  return {
    blocks,
    bonds,
    activeForceArrow: {
      active: false,
      x: 0,
      y: 0,
      z: 0,
      fx: 0,
      fy: 0,
      fz: 0,
      magnitude: 0,
      timestamp: 0,
    },
    recentContacts: [],
    cumulativeFractureEnergy: 0,
  };
};

// Breadth-First Search (BFS) from ground bonds to find blocks that have lost structural support
const updateStructuralConnectivity = (blocks: WallBlock[], bonds: BlockBond[]): number => {
  const visited = new Set<number>();
  const queue: number[] = [];

  for (const bond of bonds) {
    if (!bond.broken && bond.blockB === -1) {
      const b = blocks[bond.blockA];
      if (b && !b.isDetached) {
        visited.add(b.id);
        queue.push(b.id);
      }
    }
  }

  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const bond of bonds) {
      if (bond.broken || bond.blockB === -1) continue;
      let neighbor = -1;
      if (bond.blockA === curr) neighbor = bond.blockB;
      else if (bond.blockB === curr) neighbor = bond.blockA;

      if (neighbor !== -1 && !visited.has(neighbor) && !blocks[neighbor].isDetached) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  let newlyDetached = 0;
  for (const b of blocks) {
    if (!b.isDetached && !visited.has(b.id)) {
      b.isDetached = true;
      b.anchoredToGround = false;
      b.damage = Math.max(b.damage, 1.0);
      for (const bond of bonds) {
        if (bond.blockA === b.id || bond.blockB === b.id) {
          bond.broken = true;
          bond.damage = 1.0;
        }
      }
      newlyDetached++;
    }
  }
  return newlyDetached;
};

// Synthesizes a realistic Kelvin-Voigt compliant contact force curve F(t) whose time-integral equals Impulse J
const generateContactForceCurve = (
  impulse: number,
  durationMs: number,
  peakForceN: number
): ForceSample[] => {
  const samples: ForceSample[] = [];
  const numPoints = 21;
  const durationSec = Math.max(0.001, durationMs / 1000);
  const impulseDerivedPeak = (impulse / durationSec) * (Math.PI / 2);
  const effectivePeak = Math.max(peakForceN, impulseDerivedPeak * 0.95);

  for (let i = 0; i < numPoints; i++) {
    const frac = i / (numPoints - 1);
    const t = frac * durationMs;
    const shape = Math.sin(Math.PI * frac) * Math.exp(-0.35 * (frac - 0.45));
    const normalizedShape = Math.max(0, Math.min(1, shape / 0.96));
    samples.push({
      timeMs: Number(t.toFixed(2)),
      forceN: Number((effectivePeak * normalizedShape).toFixed(1)),
    });
  }
  return samples;
};

export interface StepCollisionResult {
  pendulumState: PendulumState;
  wallState: WallSystemState;
  newImpacts: ImpactEvent[];
}

// Advances 3D collision detection, generalized pendulum impulse response, bond fracture, and 3D fragment dynamics
export const stepWallAndCollisions = (
  pendulumState: PendulumState,
  pendulumParams: PendulumParams,
  wallState: WallSystemState,
  material: MaterialProperties,
  simTime: number,
  dt: number,
  nextImpactId: number
): StepCollisionResult => {
  let currentPendulum = { ...pendulumState };
  const blocks = wallState.blocks.map((b) => ({ ...b }));
  const bonds = wallState.bonds.map((b) => ({ ...b }));
  let activeForceArrow = { ...wallState.activeForceArrow };
  const recentContacts = wallState.recentContacts.filter((c) => simTime - c.time < 1.2);
  let cumulativeFractureEnergy = wallState.cumulativeFractureEnergy;
  const newImpacts: ImpactEvent[] = [];

  // 1. Check 3D Sphere-AABB collisions for Bob 1 and Bob 2
  for (const bobIndex of [1, 2] as const) {
    const radius = getBobRadius(bobIndex === 1 ? pendulumParams.m1 : pendulumParams.m2);
    const bobMass = bobIndex === 1 ? pendulumParams.m1 : pendulumParams.m2;

    for (const block of blocks) {
      // Recompute live bob kinematics before EVERY block check so multi-brick seam contacts never stack impulses
      const liveKin = getBobKinematics(currentPendulum, pendulumParams, PIVOT_HEIGHT);
      const bobX = bobIndex === 1 ? liveKin.x1 : liveKin.x2;
      const bobY = bobIndex === 1 ? liveKin.y1 : liveKin.y2;
      const bobZ = bobIndex === 1 ? liveKin.z1 : liveKin.z2;
      const bobVx = bobIndex === 1 ? liveKin.vx1 : liveKin.vx2;
      const bobVy = bobIndex === 1 ? liveKin.vy1 : liveKin.vy2;
      const bobSpeed = bobIndex === 1 ? liveKin.speed1 : liveKin.speed2;

      const halfW = block.width / 2;
      const halfH = block.height / 2;
      const halfD = block.depth / 2;

      const closestX = Math.max(block.x - halfW, Math.min(bobX, block.x + halfW));
      const closestY = Math.max(block.y - halfH, Math.min(bobY, block.y + halfH));
      const closestZ = Math.max(block.z - halfD, Math.min(bobZ, block.z + halfD));

      const dx = bobX - closestX;
      const dy = bobY - closestY;
      const dz = bobZ - closestZ;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq);
        let nx = 0;
        let ny = 0;
        let nz = 0;
        if (dist > 1e-5) {
          nx = dx / dist;
          ny = dy / dist;
          nz = dz / dist;
        } else {
          nx = bobX <= block.x ? -1 : 1;
          ny = 0;
          nz = 0;
        }

        const penetration = radius - dist + 0.0015;

        const rvx = bobVx - block.vx;
        const rvy = bobVy - block.vy;
        const rvz = 0 - block.vz;
        const velAlongNormal = rvx * nx + rvy * ny + rvz * nz;

        const posCorrX = nx * penetration;
        const posCorrY = ny * penetration;

        // Only apply collision impulse if approaching and outside per-block micro-cooldown (15ms)
        if (velAlongNormal < -0.04 && simTime - block.lastImpactTime > 0.015) {
          const preKE = calculateEnergy(currentPendulum, pendulumParams, PIVOT_HEIGHT).ke;

          const invMassPendulum = computeEffectiveInverseMass(
            currentPendulum,
            pendulumParams,
            bobIndex,
            nx,
            ny
          );

          const intactBondsForBlock = bonds.filter(
            (bd) => !bd.broken && (bd.blockA === block.id || bd.blockB === block.id)
          );
          const invMassBlock = block.isDetached
            ? 1 / block.mass
            : 1 / (block.mass * (2.0 + intactBondsForBlock.length * 1.5));

          const e = material.restitution;
          const jMag = (-(1 + e) * velAlongNormal) / (invMassPendulum + invMassBlock);

          const mEff = 1 / (invMassPendulum + invMassBlock);
          const contactDurationSec = Math.max(
            0.003,
            Math.min(0.045, Math.PI * Math.sqrt(mEff / material.contactStiffness))
          );
          const contactDurationMs = contactDurationSec * 1000;
          const avgForceN = jMag / contactDurationSec;
          const peakForceN = avgForceN * (Math.PI / 2);

          let damagedBlocksCount = 0;
          const effectiveMortarArea = block.width * block.depth * 0.16;
          const bondFailureForceN = material.bondStrength * 1000 * effectiveMortarArea;

          for (const other of blocks) {
            if (other.isDetached && other.id !== block.id) continue;
            const dBlock = Math.hypot(
              other.x - block.x,
              other.y - block.y,
              other.z - block.z
            );
            const radiusOfInfluence = Math.max(block.width, block.height) * 2.25;
            if (dBlock <= radiusOfInfluence) {
              const attenuation = Math.exp(-dBlock / (Math.max(block.width, block.height) * 0.9));
              const localForceN = peakForceN * attenuation;
              const localArea = other.width * other.depth * 0.16;
              const localStressKPa = localForceN / localArea / 1000;

              other.peakStressKPa = Math.max(other.peakStressKPa, localStressKPa);
              const damageIncrement = localStressKPa / material.bondStrength;

              if (damageIncrement > 0.08) {
                other.damage = Math.min(1.5, other.damage + damageIncrement * 0.85);
                other.lastImpactTime = simTime;
                damagedBlocksCount++;
              }
            }
          }

          // Check and fracture mortar bonds exceeding material.bondStrength
          for (const bond of bonds) {
            if (bond.broken) continue;
            const bA = blocks[bond.blockA];
            const bB = bond.blockB >= 0 ? blocks[bond.blockB] : null;
            const dA = Math.hypot(bA.x - closestX, bA.y - closestY, bA.z - closestZ);
            const dB = bB
              ? Math.hypot(bB.x - closestX, bB.y - closestY, bB.z - closestZ)
              : dA;
            const minD = Math.min(dA, dB);
            const bondAttenuation = Math.exp(
              -minD / (Math.max(block.width, block.height) * 1.0)
            );

            const bondForce = peakForceN * bondAttenuation;
            const bondStressKPa = bondForce / bond.area / 1000;
            bond.stressLoadKPa = Math.max(bond.stressLoadKPa, bondStressKPa);

            const stressRatio = bondStressKPa / material.bondStrength;
            if (stressRatio > 0.12) {
              bond.damage = Math.min(1.2, bond.damage + stressRatio * 0.9);
            }

            if (bond.damage >= 1.0 || bondForce >= bondFailureForceN) {
              bond.broken = true;
              bond.damage = 1.0;
              cumulativeFractureEnergy += material.fractureEnergy;
            }
          }

          const newlyDetachedFromSupport = updateStructuralConnectivity(blocks, bonds);

          let directDetached = 0;
          for (const other of blocks) {
            if (!other.isDetached && other.damage >= 1.0) {
              other.isDetached = true;
              other.anchoredToGround = false;
              for (const bond of bonds) {
                if (bond.blockA === other.id || bond.blockB === other.id) {
                  bond.broken = true;
                  bond.damage = 1.0;
                }
              }
              directDetached++;
            }
          }
          const cascadeDetached = updateStructuralConnectivity(blocks, bonds);
          const totalDetachedThisImpact =
            newlyDetachedFromSupport + directDetached + cascadeDetached;

          // Transfer impulse to detached 3D fragments
          let transferredKE = 0;
          for (const other of blocks) {
            if (other.isDetached) {
              const dBlock = Math.hypot(other.x - block.x, other.y - block.y);
              if (dBlock <= Math.max(block.width, block.height) * 1.75) {
                const share = other.id === block.id ? 0.68 : 0.24 * Math.exp(-dBlock * 3);
                const blockImpulse = jMag * share;
                const pushDirX = -nx;
                const pushDirY = Math.max(-0.15, -ny + 0.12);
                const pushDirZ =
                  (other.col - 0.5) * 0.25 + (other.row % 2 === 0 ? 0.1 : -0.1);

                other.vx += (blockImpulse * pushDirX) / other.mass;
                other.vy += (blockImpulse * pushDirY) / other.mass;
                other.vz += (blockImpulse * pushDirZ) / other.mass;

                const leverY = closestY - other.y;
                other.wz += (-pushDirX * leverY * blockImpulse * 4.0) / other.mass;
                other.wx += (pushDirZ * leverY * blockImpulse * 2.5) / other.mass;

                const speedSq =
                  other.vx * other.vx + other.vy * other.vy + other.vz * other.vz;
                transferredKE += 0.5 * other.mass * speedSq;
              }
            }
          }

          block.lastImpactTime = simTime;

          // If the block fractured, the collision is highly inelastic and the bob loses energy ploughing through
          const reactionScale = block.isDetached ? 0.35 : 0.85;
          const maxEnergyRetention = block.isDetached
            ? 0.55
            : Math.min(0.85, 0.35 + material.restitution * 0.6);

          const Jx = jMag * nx * reactionScale;
          const Jy = jMag * ny * reactionScale;

          currentPendulum = applyGeneralizedImpulse(
            currentPendulum,
            pendulumParams,
            bobIndex,
            Jx,
            Jy,
            posCorrX,
            posCorrY,
            maxEnergyRetention
          );

          const postKin = getBobKinematics(currentPendulum, pendulumParams, PIVOT_HEIGHT);
          const postVx = bobIndex === 1 ? postKin.vx1 : postKin.vx2;
          const postVy = bobIndex === 1 ? postKin.vy1 : postKin.vy2;
          const postSpeed = bobIndex === 1 ? postKin.speed1 : postKin.speed2;
          const postKE = calculateEnergy(currentPendulum, pendulumParams, PIVOT_HEIGHT).ke;

          const momentumChange =
            bobMass * Math.hypot(postVx - bobVx, postVy - bobVy);
          const dissipatedEnergy = Math.max(0, preKE - postKE - transferredKE);

          activeForceArrow = {
            active: true,
            x: closestX,
            y: closestY,
            z: closestZ,
            fx: -nx,
            fy: -ny,
            fz: -nz,
            magnitude: peakForceN,
            timestamp: simTime,
          };

          recentContacts.push({
            x: closestX,
            y: closestY,
            z: closestZ,
            time: simTime,
          });

          if (jMag > 0.15) {
            newImpacts.push({
              id: nextImpactId + newImpacts.length,
              simTime: Number(simTime.toFixed(3)),
              bobIndex,
              blockId: block.id,
              contactPoint: {
                x: Number(closestX.toFixed(2)),
                y: Number(closestY.toFixed(2)),
                z: Number(closestZ.toFixed(2)),
              },
              contactNormal: {
                x: Number((-nx).toFixed(2)),
                y: Number((-ny).toFixed(2)),
                z: Number((-nz).toFixed(2)),
              },
              preVelocity: {
                vx: Number(bobVx.toFixed(2)),
                vy: Number(bobVy.toFixed(2)),
                speed: Number(bobSpeed.toFixed(2)),
              },
              postVelocity: {
                vx: Number(postVx.toFixed(2)),
                vy: Number(postVy.toFixed(2)),
                speed: Number(postSpeed.toFixed(2)),
              },
              momentumChange: Number(momentumChange.toFixed(3)),
              impulse: Number(jMag.toFixed(3)),
              contactDurationMs: Number(contactDurationMs.toFixed(2)),
              peakForceN: Number(peakForceN.toFixed(1)),
              avgForceN: Number(avgForceN.toFixed(1)),
              prePendulumKE: Number(preKE.toFixed(2)),
              postPendulumKE: Number(postKE.toFixed(2)),
              transferredKE: Number(transferredKE.toFixed(2)),
              dissipatedEnergy: Number(dissipatedEnergy.toFixed(2)),
              peakBondStressKPa: Number(block.peakStressKPa.toFixed(1)),
              blocksDamagedCount: damagedBlocksCount,
              blocksDetachedCount: totalDetachedThisImpact,
              materialName: material.name,
              forceProfile: generateContactForceCurve(
                jMag,
                contactDurationMs,
                peakForceN
              ),
            });
          }
        } else {
          // Gentle positional separation if resting against a block
          currentPendulum = applyGeneralizedImpulse(
            currentPendulum,
            pendulumParams,
            bobIndex,
            0,
            0,
            posCorrX * 0.35,
            posCorrY * 0.35
          );
        }
      }
    }
  }

  if (activeForceArrow.active && simTime - activeForceArrow.timestamp > 0.35) {
    activeForceArrow.active = false;
  }

  // 2. Step 3D Rigid-Body Physics for Detached Wall Fragments (Gravity & Floor Restitution)
  const detachedBlocks = blocks.filter((b) => b.isDetached);
  for (const b of detachedBlocks) {
    b.vy -= pendulumParams.g * dt;

    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;

    b.rx += b.wx * dt;
    b.ry += b.wy * dt;
    b.rz += b.wz * dt;

    const minY = b.height / 2;
    if (b.y < minY) {
      b.y = minY;
      if (b.vy < 0) {
        b.vy = -b.vy * (material.restitution * 0.45);
        b.vx *= 0.8;
        b.vz *= 0.8;
        b.wx *= 0.75;
        b.wy *= 0.75;
        b.wz *= 0.75;
      }
      if (Math.abs(b.vy) < 0.08) b.vy = 0;
    }
  }

  // 3. Block-to-Block Collisions
  for (let i = 0; i < detachedBlocks.length; i++) {
    const b1 = detachedBlocks[i];
    for (let j = 0; j < blocks.length; j++) {
      const b2 = blocks[j];
      if (b1.id === b2.id) continue;
      if (b2.isDetached && b1.id > b2.id) continue;

      const dx = b1.x - b2.x;
      const dy = b1.y - b2.y;
      const dz = b1.z - b2.z;

      const overlapX = (b1.width + b2.width) / 2 - Math.abs(dx);
      const overlapY = (b1.height + b2.height) / 2 - Math.abs(dy);
      const overlapZ = (b1.depth + b2.depth) / 2 - Math.abs(dz);

      if (overlapX > 0 && overlapY > 0 && overlapZ > 0) {
        if (overlapY <= overlapX && overlapY <= overlapZ) {
          const sign = dy >= 0 ? 1 : -1;
          if (b2.isDetached) {
            b1.y += sign * (overlapY * 0.5);
            b2.y -= sign * (overlapY * 0.5);
            const avgVy = 0.5 * (b1.vy + b2.vy);
            b1.vy = avgVy;
            b2.vy = avgVy;
          } else {
            b1.y += sign * overlapY;
            if (b1.vy * sign < 0) b1.vy = -b1.vy * 0.25;
          }
        } else if (overlapX <= overlapY && overlapX <= overlapZ) {
          const sign = dx >= 0 ? 1 : -1;
          if (b2.isDetached) {
            b1.x += sign * (overlapX * 0.5);
            b2.x -= sign * (overlapX * 0.5);
            const avgVx = 0.5 * (b1.vx + b2.vx);
            b1.vx = avgVx;
            b2.vx = avgVx;
          } else {
            b1.x += sign * overlapX;
            if (b1.vx * sign < 0) b1.vx = -b1.vx * 0.3;
          }
        } else {
          const sign = dz >= 0 ? 1 : -1;
          b1.z += sign * (overlapZ * 0.5);
          if (b2.isDetached) b2.z -= sign * (overlapZ * 0.5);
        }
      }
    }
  }

  return {
    pendulumState: currentPendulum,
    wallState: {
      blocks,
      bonds,
      activeForceArrow,
      recentContacts,
      cumulativeFractureEnergy,
    },
    newImpacts,
  };
};

// Computes the total translational + rotational kinetic energy of all moving structural blocks
export const calculateStructureKineticEnergy = (blocks: WallBlock[]): number => {
  let ke = 0;
  for (const b of blocks) {
    if (!b.isDetached) continue;
    const vSq = b.vx * b.vx + b.vy * b.vy + b.vz * b.vz;
    const iApprox = (1 / 6) * b.mass * (b.width * b.width + b.height * b.height);
    const wSq = b.wx * b.wx + b.wy * b.wy + b.wz * b.wz;
    ke += 0.5 * b.mass * vSq + 0.5 * iApprox * wSq;
  }
  return ke;
};