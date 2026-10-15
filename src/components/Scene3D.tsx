import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  type PendulumState,
  type PendulumParams,
  getBobKinematics,
  getBobRadius,
  PIVOT_HEIGHT,
} from '../physics/engine';
import {
  type WallSystemState,
  type MaterialProperties,
} from '../physics/wallEngine';
import { RotateCcw, Eye, Compass, Layers } from 'lucide-react';

interface Scene3DProps {
  pendulumState: PendulumState;
  pendulumParams: PendulumParams;
  wallState: WallSystemState;
  material: MaterialProperties;
  showDamageOverlay: boolean;
  showTrail: boolean;
  showForceVectors: boolean;
  showCollisionPoints: boolean;
  showCosmeticFX: boolean;
  trailResetKey: number;
}

// Interpolates block color based on normalized damage (0 = intact, 0.5 = amber, 1.0 = crimson/detached)
const getDamageColor = (
  damage: number,
  isDetached: boolean,
  baseHex: string,
  overlayOn: boolean
): THREE.Color => {
  if (!overlayOn) {
    const c = new THREE.Color(baseHex);
    if (isDetached) c.multiplyScalar(0.75);
    return c;
  }
  if (isDetached || damage >= 1.0) {
    return new THREE.Color('#ef4444'); // Crimson Red (Failed/Detached)
  }
  if (damage >= 0.6) {
    return new THREE.Color('#f97316'); // High Damage Orange
  }
  if (damage >= 0.25) {
    return new THREE.Color('#eab308'); // Moderate Damage Yellow
  }
  if (damage > 0.02) {
    return new THREE.Color('#22c55e'); // Low Stress Green
  }
  return new THREE.Color('#0ea5e9'); // Intact Low-Stress Cyan-Blue
};

export const Scene3D: React.FC<Scene3DProps> = ({
  pendulumState,
  pendulumParams,
  wallState,
  material,
  showDamageOverlay,
  showTrail,
  showForceVectors,
  showCollisionPoints,
  showCosmeticFX,
  trailResetKey,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Scene object references for 60fps updates
  const bob1MeshRef = useRef<THREE.Mesh | null>(null);
  const bob2MeshRef = useRef<THREE.Mesh | null>(null);
  const rod1MeshRef = useRef<THREE.Mesh | null>(null);
  const rod2MeshRef = useRef<THREE.Mesh | null>(null);
  const trailLineRef = useRef<THREE.Line | null>(null);
  const trailPointsRef = useRef<THREE.Vector3[]>([]);
  const blockMeshesRef = useRef<Map<number, THREE.Mesh>>(new Map());
  const blockGroupRef = useRef<THREE.Group | null>(null);
  const forceArrowRef = useRef<THREE.ArrowHelper | null>(null);
  const contactGroupRef = useRef<THREE.Group | null>(null);

  // Initialize Three.js WebGL Scene, Lighting, Floor, Gantry, and OrbitControls
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Clear any cached block meshes from previous StrictMode pass
    blockMeshesRef.current.clear();

    const width = container.clientWidth || 800;
    const height = 520;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#090d16');
    scene.fog = new THREE.FogExp2('#090d16', 0.045);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(1.6, 2.5, 4.8);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0.45, 1.5, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 1.5;
    controls.maxDistance = 14;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.update();
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight('#cbd5e1', 0.75);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight('#ffffff', 1.45);
    dirLight.position.set(4.5, 7.5, 5.0);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 20;
    const d = 4.5;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight('#38bdf8', 0.5);
    rimLight.position.set(-4, 3, -4);
    scene.add(rimLight);

    // Floor Plane & Reference Grid
    const floorGeo = new THREE.PlaneGeometry(18, 18);
    const floorMat = new THREE.MeshStandardMaterial({
      color: '#0f172a',
      roughness: 0.85,
      metalness: 0.1,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const gridHelper = new THREE.GridHelper(12, 24, '#334155', '#1e293b');
    gridHelper.position.y = 0.002;
    scene.add(gridHelper);

    // 3D Gantry Support Frame for Pendulum Pivot at (0, PIVOT_HEIGHT, 0)
    const gantryGroup = new THREE.Group();
    const steelMat = new THREE.MeshStandardMaterial({
      color: '#475569',
      metalness: 0.7,
      roughness: 0.3,
    });
    const pillarGeo = new THREE.BoxGeometry(0.1, PIVOT_HEIGHT + 0.1, 0.1);
    const backPillar = new THREE.Mesh(pillarGeo, steelMat);
    backPillar.position.set(0, PIVOT_HEIGHT / 2, -0.55);
    backPillar.castShadow = true;
    gantryGroup.add(backPillar);

    const armGeo = new THREE.BoxGeometry(0.1, 0.1, 0.65);
    const topArm = new THREE.Mesh(armGeo, steelMat);
    topArm.position.set(0, PIVOT_HEIGHT, -0.25);
    topArm.castShadow = true;
    gantryGroup.add(topArm);

    const pivotHubGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.18, 20);
    pivotHubGeo.rotateX(Math.PI / 2);
    const pivotHub = new THREE.Mesh(
      pivotHubGeo,
      new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.8, roughness: 0.2 })
    );
    pivotHub.position.set(0, PIVOT_HEIGHT, 0);
    gantryGroup.add(pivotHub);
    scene.add(gantryGroup);

    // Pendulum Rods & Bobs
    const rodMat = new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      metalness: 0.75,
      roughness: 0.25,
    });
    const rodGeo = new THREE.CylinderGeometry(0.022, 0.022, 1, 16);
    const rod1 = new THREE.Mesh(rodGeo, rodMat);
    const rod2 = new THREE.Mesh(rodGeo, rodMat);
    rod1.castShadow = true;
    rod2.castShadow = true;
    scene.add(rod1);
    scene.add(rod2);
    rod1MeshRef.current = rod1;
    rod2MeshRef.current = rod2;

    const bob1Mat = new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      metalness: 0.55,
      roughness: 0.2,
    });
    const bob2Mat = new THREE.MeshStandardMaterial({
      color: '#f43f5e',
      metalness: 0.55,
      roughness: 0.2,
    });
    const sphereGeo = new THREE.SphereGeometry(1, 32, 32);
    const bob1 = new THREE.Mesh(sphereGeo, bob1Mat);
    const bob2 = new THREE.Mesh(sphereGeo, bob2Mat);
    bob1.castShadow = true;
    bob2.castShadow = true;
    scene.add(bob1);
    scene.add(bob2);
    bob1MeshRef.current = bob1;
    bob2MeshRef.current = bob2;

    // 3D Motion Trail Line
    const trailGeo = new THREE.BufferGeometry();
    const trailMat = new THREE.LineBasicMaterial({
      color: '#f43f5e',
      transparent: true,
      opacity: 0.65,
    });
    const trailLine = new THREE.Line(trailGeo, trailMat);
    scene.add(trailLine);
    trailLineRef.current = trailLine;

    // Destructible Wall Blocks Container
    const blockGroup = new THREE.Group();
    scene.add(blockGroup);
    blockGroupRef.current = blockGroup;

    // Contact Points & Spark Group
    const contactGroup = new THREE.Group();
    scene.add(contactGroup);
    contactGroupRef.current = contactGroup;

    // 3D Impact Force Vector ArrowHelper
    const arrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0),
      0.8,
      0xa855f7,
      0.18,
      0.1
    );
    arrow.visible = false;
    scene.add(arrow);
    forceArrowRef.current = arrow;

    // Render loop for smooth OrbitControls camera damping
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Responsive Resize Handler
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth || 800;
      camera.aspect = newW / height;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      blockMeshesRef.current.forEach((mesh) => {
        mesh.geometry.dispose();
      });
      blockMeshesRef.current.clear();
      renderer.dispose();
    };
  }, []);

  // Clear trail when reset occurs
  useEffect(() => {
    trailPointsRef.current = [];
    if (trailLineRef.current) {
      trailLineRef.current.geometry.setFromPoints([]);
    }
  }, [trailResetKey]);

  // Synchronize 3D Pendulum, Wall Blocks, Damage Colors, Trail, and Force Vectors with Physics State
  useEffect(() => {
    const kin = getBobKinematics(pendulumState, pendulumParams, PIVOT_HEIGHT);
    const r1 = getBobRadius(pendulumParams.m1);
    const r2 = getBobRadius(pendulumParams.m2);

    // Update Bobs
    if (bob1MeshRef.current && bob2MeshRef.current) {
      bob1MeshRef.current.position.set(kin.x1, kin.y1, kin.z1);
      bob1MeshRef.current.scale.set(r1, r1, r1);

      bob2MeshRef.current.position.set(kin.x2, kin.y2, kin.z2);
      bob2MeshRef.current.scale.set(r2, r2, r2);
    }

    // Update Cylindrical Rods
    const updateRod = (
      rod: THREE.Mesh | null,
      ax: number,
      ay: number,
      az: number,
      bx: number,
      by: number,
      bz: number
    ) => {
      if (!rod) return;
      const start = new THREE.Vector3(ax, ay, az);
      const end = new THREE.Vector3(bx, by, bz);
      const dir = new THREE.Vector3().subVectors(end, start);
      const len = dir.length();
      rod.position.copy(start).add(end).multiplyScalar(0.5);
      rod.scale.set(1, len, 1);
      rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    };

    updateRod(rod1MeshRef.current, 0, PIVOT_HEIGHT, 0, kin.x1, kin.y1, kin.z1);
    updateRod(rod2MeshRef.current, kin.x1, kin.y1, kin.z1, kin.x2, kin.y2, kin.z2);

    // Update 3D Motion Trail
    if (trailLineRef.current) {
      if (showTrail) {
        const pts = trailPointsRef.current;
        const nextPt = new THREE.Vector3(kin.x2, kin.y2, kin.z2);
        if (pts.length === 0 || pts[pts.length - 1].distanceTo(nextPt) > 0.02) {
          pts.push(nextPt);
          if (pts.length > 320) pts.shift();
          trailLineRef.current.geometry.setFromPoints(pts);
        }
        trailLineRef.current.visible = true;
      } else {
        trailLineRef.current.visible = false;
      }
    }

    // Synchronize 3D Wall Block Meshes
    const blockGroup = blockGroupRef.current;
    if (blockGroup) {
      const currentIds = new Set(wallState.blocks.map((b) => b.id));

      // Remove stale block meshes if wall structure changed
      for (const [id, mesh] of blockMeshesRef.current.entries()) {
        if (!currentIds.has(id)) {
          blockGroup.remove(mesh);
          mesh.geometry.dispose();
          blockMeshesRef.current.delete(id);
        }
      }

      wallState.blocks.forEach((b) => {
        let mesh = blockMeshesRef.current.get(b.id);
        const dimsKey = `${b.width}_${b.height}_${b.depth}`;
        if (!mesh || mesh.userData.dimsKey !== dimsKey) {
          if (mesh) {
            blockGroup.remove(mesh);
            mesh.geometry.dispose();
          }
          const geo = new THREE.BoxGeometry(b.width, b.height, b.depth);
          const mat = new THREE.MeshStandardMaterial({
            color: material.colorHex,
            roughness: 0.65,
            metalness: 0.15,
          });
          mesh = new THREE.Mesh(geo, mat);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.userData.dimsKey = dimsKey;

          // Crisp dark mortar border wireframe so individual 3D bricks are clearly visible
          const edges = new THREE.EdgesGeometry(geo);
          const line = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: '#1e293b', transparent: true, opacity: 0.85 })
          );
          mesh.add(line);

          blockGroup.add(mesh);
          blockMeshesRef.current.set(b.id, mesh);
        } else if (mesh.parent !== blockGroup) {
          // Ensure mesh is attached to active scene's blockGroup
          blockGroup.add(mesh);
        }

        mesh.position.set(b.x, b.y, b.z);
        mesh.rotation.set(b.rx, b.ry, b.rz);

        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.color.copy(
          getDamageColor(b.damage, b.isDetached, material.colorHex, showDamageOverlay)
        );
      });
    }

    // Update 3D Contact Force Vector Arrow
    if (forceArrowRef.current) {
      const fa = wallState.activeForceArrow;
      if (showForceVectors && fa.active && fa.magnitude > 1) {
        const dir = new THREE.Vector3(fa.fx, fa.fy, fa.fz).normalize();
        const length = Math.min(1.8, Math.max(0.35, Math.log10(fa.magnitude + 10) * 0.42));
        forceArrowRef.current.position.set(fa.x, fa.y, fa.z);
        forceArrowRef.current.setDirection(dir);
        forceArrowRef.current.setLength(length, 0.22, 0.12);
        forceArrowRef.current.visible = true;
      } else {
        forceArrowRef.current.visible = false;
      }
    }

    // Update Collision Points & Cosmetic Impact Flashes
    if (contactGroupRef.current) {
      const grp = contactGroupRef.current;
      while (grp.children.length > 0) {
        grp.remove(grp.children[0]);
      }
      if (showCollisionPoints || showCosmeticFX) {
        wallState.recentContacts.slice(-6).forEach((c) => {
          const markerGeo = new THREE.SphereGeometry(showCosmeticFX ? 0.065 : 0.04, 12, 12);
          const markerMat = new THREE.MeshBasicMaterial({
            color: showCosmeticFX ? '#f59e0b' : '#a855f7',
          });
          const m = new THREE.Mesh(markerGeo, markerMat);
          m.position.set(c.x, c.y, c.z);
          grp.add(m);
        });
      }
    }
  }, [
    pendulumState,
    pendulumParams,
    wallState,
    material,
    showDamageOverlay,
    showTrail,
    showForceVectors,
    showCollisionPoints,
    showCosmeticFX,
  ]);

  // Camera Preset Handlers
  const setCameraView = (view: 'iso' | 'front' | 'side' | 'top') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    ctrl.target.set(0.45, 1.4, 0);

    if (view === 'iso') cam.position.set(1.8, 2.5, 4.6);
    else if (view === 'front') cam.position.set(0.45, 1.6, 5.2);
    else if (view === 'side') cam.position.set(5.2, 1.7, 0.0);
    else if (view === 'top') cam.position.set(0.45, 6.2, 0.8);

    ctrl.update();
  };

  return (
    <div className="relative bg-[#090d16] rounded-xl border border-slate-700 shadow-xl overflow-hidden">
      {/* Top Camera & View Toolbar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap justify-between items-center gap-2 pointer-events-none">
        <div className="bg-slate-900/85 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-700/80 text-xs text-slate-300 flex items-center gap-2 pointer-events-auto">
          <Compass className="w-4 h-4 text-sky-400" />
          <span>3D Orbit: Left-Drag • Zoom: Scroll • Pan: Right-Drag</span>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900/85 backdrop-blur p-1 rounded-lg border border-slate-700/80 pointer-events-auto">
          <button
            onClick={() => setCameraView('iso')}
            className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1"
            title="Isometric 3D View"
          >
            <Layers className="w-3.5 h-3.5 text-sky-400" /> Iso
          </button>
          <button
            onClick={() => setCameraView('front')}
            className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1"
            title="Front Swing-Plane View"
          >
            <Eye className="w-3.5 h-3.5 text-emerald-400" /> Front
          </button>
          <button
            onClick={() => setCameraView('side')}
            className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
            title="Side Profile View"
          >
            Side
          </button>
          <button
            onClick={() => setCameraView('top')}
            className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
            title="Top-Down View"
          >
            Top
          </button>
          <button
            onClick={() => setCameraView('iso')}
            className="px-2.5 py-1 text-xs rounded bg-indigo-600/80 hover:bg-indigo-600 text-white flex items-center gap-1"
            title="Reset 3D Camera"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Cam
          </button>
        </div>
      </div>

      {/* 3D WebGL Canvas Mount */}
      <div ref={mountRef} className="w-full h-[520px] cursor-grab active:cursor-grabbing" />

      {/* Bottom Bond-Damage & Stress Legend Bar */}
      <div className="bg-slate-900/95 border-t border-slate-800 px-4 py-2.5 flex flex-wrap justify-between items-center gap-4 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-semibold text-slate-300">
            {showDamageOverlay
              ? 'Bond-Damage & Fracture Overlay (D = σ / σ_fail):'
              : `Material View: ${material.name}`}
          </span>
          {showDamageOverlay && (
            <>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-3 h-3 rounded-sm bg-[#0ea5e9] inline-block" /> Intact (D &lt; 0.02)
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-3 h-3 rounded-sm bg-[#22c55e] inline-block" /> Low Stress (0.02–0.25)
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-3 h-3 rounded-sm bg-[#eab308] inline-block" /> Micro-Crack (0.25–0.60)
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-3 h-3 rounded-sm bg-[#f97316] inline-block" /> Critical Load (0.60–0.99)
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-3 h-3 rounded-sm bg-[#ef4444] inline-block" /> Bond Fractured / Detached (D ≥ 1.0)
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8] inline-block" /> Bob 1 (m₁)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f43f5e] inline-block" /> Bob 2 (m₂)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#a855f7] inline-block" /> Contact Force Vector
          </span>
        </div>
      </div>
    </div>
  );
};