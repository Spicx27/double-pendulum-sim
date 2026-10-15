import {
  type PendulumState,
  type PendulumParams,
  getBobKinematics,
  computeEffectiveInverseMass,
  applyGeneralizedImpulse,
  getBobRadius,
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
  area: number;   // m^2
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
      // Slight running-bond Z stagger on alternate rows for brick masonry realism
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

  // Create explicit mortar/structural bonds between neighboring blocks
  const horizArea = bw * bd;
  const vertArea = bh * bd;

  blocks.forEach((b) => {
    // Foundation bond for row 0
    if (b.row === 0) {
      bonds.push({
        id: `ground_${b.id}`,
        blockA: b.id,
        blockB: -1,
        area: horizArea,
        stressLoadKPa: 0,
        damage: 0,
        broken: false,
      });
    }

    // Vertical bond to the block directly above
    const above = blocks.find((other) => other.row === b.row + 1 && other.col === b.col);
    if (above) {
      bonds.push({
        id: `v_${b.id}_${above.id}`,
        blockA: b.id,
        blockB: above.id,
        area: horizArea,
        stressLoadKPa: 0,
        damage: 0,
        broken: false,
      });
    }

    // Horizontal bond to the block on the right
    const right = blocks.find((other) => other.row === b.row && other.col === b.col + 1);
    if (right) {
      bonds.push({
        id: `h_${b.id}_${right.id}`,
        blockA: b.id,
        blockB: right.id,
        area: vertArea,
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

  // Seed queue with blocks that still have an intact foundation bond
  for (const bond of bonds) {
    if (!bond.broken && bond.blockB === -1) {
      const b = blocks[bond.blockA];
      if (b && !b.isDetached) {
        visited.add(b.id);
        queue.push(b.id);
      }
    }
  }

  // Traverse intact inter-block bonds
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
      // Break any remaining bonds attached to this detached block
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
    // Half-sine skewed viscoelastic pulse profile
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

  const kin = getBobKinematics(currentPendulum, pendulumParams, PIVOT_HEIGHT);
  const bobs = [
    {
      index: 1 as const,
      x: kin.x1,
      y: kin.y1,
      z: kin.z1,
      vx: kin.vx1,
      vy: kin.vy1,
      speed: kin.speed1,
      mass: pendulumParams.m1,
      radius: getBobRadius(pendulumParams.m1),
    },
    {
      index: 2 as const,
      x: kin.x2,
      y: kin.y2,
      z: kin.z2,
      vx: kin.vx2,
      vy: kin.vy2,
      speed: kin.speed2,
      mass: pendulumParams.m2,
      radius: getBobRadius(pendulumParams.m2),
    },
  ];

  // 1. Check 3D Sphere-AABB collisions between both Pendulum Bobs and Wall Blocks
  for (const bob of bobs) {
    for (const block of blocks) {
      const halfW = block.width / 2;
      const halfH = block.height / 2;
      const halfD = block.depth / 2;

      const closestX = Math.max(block.x - halfW, Math.min(bob.x, block.x + halfW));
      const closestY = Math.max(block.y - halfH, Math.min(bob.y, block.y + halfH));
      const closestZ = Math.max(block.z - halfD, Math.min(bob.z, block.z + halfD));

      const dx = bob.x - closestX;
      const dy = bob.y - closestY;
      const dz = bob.z - closestZ;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < bob.radius * bob.radius) {
        const dist = Math.sqrt(distSq);
        // Contact normal pointing from Block -> Bob
        let nx = 0;
        let ny = 0;
        let nz = 0;
        if (dist > 1e-5) {
          nx = dx / dist;
          ny = dy / dist;
          nz = dz / dist;
        } else {
          nx = bob.x <= block.x ? -1 : 1;
          ny = 0;
          nz = 0;
        }

        const penetration = bob.radius - dist + 0.002;

        // Relative velocity along contact normal
        const rvx = bob.vx - block.vx;
        const rvy = bob.vy - block.vy;
        const rvz = 0 - block.vz;
        const velAlongNormal = rvx * nx + rvy * ny + rvz * nz;

        // Always project out small overlap so the bob cannot tunnel through the wall
        const posCorrX = nx * penetration;
        const posCorrY = ny * penetration;

        // Only apply impulse if the bob and block are approaching each other
        if (velAlongNormal < -0.02) {
          const preKE =
            0.5 * pendulumParams.m1 * kin.speed1 * kin.speed1 +
            0.5 * pendulumParams.m2 * kin.speed2 * kin.speed2;

          const invMassPendulum = computeEffectiveInverseMass(
            currentPendulum,
            pendulumParams,
            bob.index,
            nx,
            ny
          );

          // Effective block inverse mass: if still bonded, the wall provides structural resistance
          const intactBondsForBlock = bonds.filter(
            (bd) => !bd.broken && (bd.blockA === block.id || bd.blockB === block.id)
          );
          const invMassBlock = block.isDetached
            ? 1 / block.mass
            : 1 / (block.mass * (2.5 + intactBondsForBlock.length * 1.8));

          const e = material.restitution;
          const jMag = (-(1 + e) * velAlongNormal) / (invMassPendulum + invMassBlock);

          // Contact duration from Kelvin-Voigt compliant contact mechanics: dt_c = pi * sqrt(m_eff / k_c)
          const mEff = 1 / (invMassPendulum + invMassBlock);
          const contactDurationSec = Math.max(
            0.003,
            Math.min(0.045, Math.PI * Math.sqrt(mEff / material.contactStiffness))
          );
          const contactDurationMs = contactDurationSec * 1000;
          const avgForceN = jMag / contactDurationSec;
          const peakForceN = avgForceN * (Math.PI / 2);

          // Distribute contact force across connected mortar bonds & neighbors
          let damagedBlocksCount = 0;
          const bondFailureForceN = material.bondStrength * 1000 * (block.width * block.depth);

          for (const other of blocks) {
            if (other.isDetached && other.id !== block.id) continue;
            const dBlock = Math.hypot(
              other.x - block.x,
              other.y - block.y,
              other.z - block.z
            );
            const radiusOfInfluence = Math.max(block.width, block.height) * 2.35;
            if (dBlock <= radiusOfInfluence) {
              const attenuation = Math.exp(-dBlock / (Math.max(block.width, block.height) * 0.95));
              const localForceN = peakForceN * attenuation;
              const effectiveArea = other.width * other.depth;
              const localStressKPa = localForceN / effectiveArea / 1000;

              other.peakStressKPa = Math.max(other.peakStressKPa, localStressKPa);
              const damageIncrement = localStressKPa / material.bondStrength;

              if (damageIncrement > 0.08) {
                other.damage = Math.min(1.5, other.damage + damageIncrement * 0.85);
                other.lastImpactTime = simTime;
                damagedBlocksCount++;
              }
            }
          }

          // Check and break mortar bonds whose stress exceeds material.bondStrength
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
              -minD / (Math.max(block.width, block.height) * 1.05)
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

          // Update structural connectivity (blocks that lost all bonds or support detach)
          const newlyDetachedFromSupport = updateStructuralConnectivity(blocks, bonds);

          // Also detach any block whose direct damage >= 1.0
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

          // If target block (or neighboring blocks) detached, transfer impulse into 3D block velocity
          let transferredKE = 0;
          for (const other of blocks) {
            if (other.isDetached) {
              const dBlock = Math.hypot(other.x - block.x, other.y - block.y);
              if (dBlock <= Math.max(block.width, block.height) * 1.8) {
                const share = other.id === block.id ? 0.72 : 0.28 * Math.exp(-dBlock * 3);
                const blockImpulse = jMag * share;
                const pushDirX = -nx;
                const pushDirY = Math.max(-0.2, -ny + 0.15);
                const pushDirZ = (other.col - 0.5) * 0.28 + (other.row % 2 === 0 ? 0.12 : -0.12);

                other.vx += (blockImpulse * pushDirX) / other.mass;
                other.vy += (blockImpulse * pushDirY) / other.mass;
                other.vz += (blockImpulse * pushDirZ) / other.mass;

                // Torque induced angular velocity from off-center contact
                const leverY = closestY - other.y;
                other.wz += (-pushDirX * leverY * blockImpulse * 4.5) / other.mass;
                other.wx += (pushDirZ * leverY * blockImpulse * 3.0) / other.mass;

                const speedSq =
                  other.vx * other.vx + other.vy * other.vy + other.vz * other.vz;
                transferredKE += 0.5 * other.mass * speedSq;
              }
            }
          }

          // If the struck block fractured/detached, the pendulum ploughs through with reduced reaction impulse
          const reactionScale = block.isDetached ? 0.42 : 1.0;
          const Jx = jMag * nx * reactionScale;
          const Jy = jMag * ny * reactionScale;

          currentPendulum = applyGeneralizedImpulse(
            currentPendulum,
            pendulumParams,
            bob.index,
            Jx,
            Jy,
            posCorrX,
            posCorrY
          );

          const postKin = getBobKinematics(currentPendulum, pendulumParams, PIVOT_HEIGHT);
          const postVx = bob.index === 1 ? postKin.vx1 : postKin.vx2;
          const postVy = bob.index === 1 ? postKin.vy1 : postKin.vy2;
          const postSpeed = bob.index === 1 ? postKin.speed1 : postKin.speed2;
          const postKE =
            0.5 * pendulumParams.m1 * postKin.speed1 * postKin.speed1 +
            0.5 * pendulumParams.m2 * postKin.speed2 * postKin.speed2;

          const momentumChange =
            bob.mass * Math.hypot(postVx - bob.vx, postVy - bob.vy);
          const dissipatedEnergy = Math.max(0, preKE - postKE - transferredKE);

          // Record active 3D Force Vector Arrow at contact point
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

          // Record ImpactEvent if impulse is significant and not a micro-chatter duplicate
          if (jMag > 0.15 && simTime - block.lastImpactTime >= 0) {
            newImpacts.push({
              id: nextImpactId + newImpacts.length,
              simTime: Number(simTime.toFixed(3)),
              bobIndex: bob.index,
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
                vx: Number(bob.vx.toFixed(2)),
                vy: Number(bob.vy.toFixed(2)),
                speed: Number(bob.speed.toFixed(2)),
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
          // Pure positional separation if resting against block
          currentPendulum = applyGeneralizedImpulse(
            currentPendulum,
            pendulumParams,
            bob.index,
            0,
            0,
            posCorrX * 0.5,
            posCorrY * 0.5
          );
        }
      }
    }
  }

  // Fade out active force vector after 0.35s
  if (activeForceArrow.active && simTime - activeForceArrow.timestamp > 0.35) {
    activeForceArrow.active = false;
  }

  // 2. Step 3D Rigid-Body Physics for Detached Wall Fragments (Gravity, Floor & Fragment Collisions)
  const detachedBlocks = blocks.filter((b) => b.isDetached);
  for (const b of detachedBlocks) {
    // Gravity
    b.vy -= pendulumParams.g * dt;

    // Linear integration
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;

    // Angular integration
    b.rx += b.wx * dt;
    b.ry += b.wy * dt;
    b.rz += b.wz * dt;

    // Floor collision (y = 0)
    const minY = b.height / 2;
    if (b.y < minY) {
      b.y = minY;
      if (b.vy < 0) {
        b.vy = -b.vy * (material.restitution * 0.55);
        // Floor sliding friction
        b.vx *= 0.82;
        b.vz *= 0.82;
        b.wx *= 0.78;
        b.wy *= 0.78;
        b.wz *= 0.78;
      }
      if (Math.abs(b.vy) < 0.08) b.vy = 0;
    }
  }

  // 3. Block-to-Block Collisions (Detached fragments colliding with intact blocks or other fragments)
  for (let i = 0; i < detachedBlocks.length; i++) {
    const b1 = detachedBlocks[i];
    for (let j = 0; j < blocks.length; j++) {
      const b2 = blocks[j];
      if (b1.id === b2.id) continue;
      if (b2.isDetached && b1.id > b2.id) continue; // avoid double checking pair

      const dx = b1.x - b2.x;
      const dy = b1.y - b2.y;
      const dz = b1.z - b2.z;

      const overlapX = (b1.width + b2.width) / 2 - Math.abs(dx);
      const overlapY = (b1.height + b2.height) / 2 - Math.abs(dy);
      const overlapZ = (b1.depth + b2.depth) / 2 - Math.abs(dz);

      if (overlapX > 0 && overlapY > 0 && overlapZ > 0) {
        // Resolve along minimum penetration axis
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
            if (b1.vy * sign < 0) b1.vy = -b1.vy * 0.3;
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
            if (b1.vx * sign < 0) b1.vx = -b1.vx * 0.4;
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