import React from 'react';
import { BookOpen, CheckCircle2, AlertTriangle } from 'lucide-react';

export const PhysicsTheoryView: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-panelBg p-6 rounded-xl border border-slate-700">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-indigo-400" /> Engineering Physics Theory & Mathematical Formulation
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Complete theoretical reference for first-year B.Tech Computer Engineering Physics presentation and viva at NMIMS. Every equation below is directly implemented in the TypeScript physics engine.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Double Pendulum Lagrangian Mechanics */}
        <div className="bg-panelBg p-6 rounded-xl border border-slate-700 space-y-3">
          <h3 className="text-lg font-bold text-sky-400">
            1. Coupled Double Pendulum & Euler-Lagrange Equations
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            <strong>Plain-Language Concept:</strong> Unlike a simple pendulum with one bob, a double pendulum has two point masses (m₁, m₂) connected by rigid massless rods (L₁, L₂). Because Bob 2 hangs from Bob 1, any acceleration of Bob 2 exerts a reaction tension on Bob 1, creating coupled nonlinear differential equations.
          </p>
          <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 font-mono text-xs text-slate-200 space-y-1.5">
            <div>L = T - V (Lagrangian)</div>
            <div>x₁ = L₁ sin(θ₁),  y₁ = Y_p - L₁ cos(θ₁)</div>
            <div>x₂ = x₁ + L₂ sin(θ₂),  y₂ = y₁ - L₂ cos(θ₂)</div>
            <div>M(θ) θ̈ + C(θ, θ̇) + G(θ) + c·θ̇ = 0</div>
          </div>
          <p className="text-xs text-slate-400">
            <strong>Symbols & SI Units:</strong> θ₁, θ₂ = angles from downward vertical (rad); ω₁, ω₂ = angular velocities (rad/s); m₁, m₂ = masses (kg); L₁, L₂ = rod lengths (m); g = 9.81 m/s²; c = viscous damping coefficient (s⁻¹).
          </p>
          <p className="text-xs text-emerald-400">
            <strong>Viva Demonstration Tip:</strong> Move the wall away (X = 1.65 m) and release from θ₁ = 120°, θ₂ = 140° to show chaotic, non-periodic trajectories prior to impact.
          </p>
        </div>

        {/* 2. Constraint-Consistent Collision Impulse */}
        <div className="bg-panelBg p-6 rounded-xl border border-slate-700 space-y-3">
          <h3 className="text-lg font-bold text-rose-400">
            2. Constraint-Consistent 3D Collision & Mass Matrix Projection
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            <strong>Plain-Language Concept:</strong> When a bob hits the 3D wall, it cannot be treated as a free-floating ball—it is still attached to the rigid rods! We project the Cartesian collision impulse <strong>J</strong> into generalized coordinates using the 2×2 configuration mass matrix <strong>M(θ)</strong> and kinematic Jacobian <strong>J_v</strong>.
          </p>
          <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 font-mono text-xs text-slate-200 space-y-1.5">
            <div>M₁₁ = (m₁ + m₂)L₁²,  M₁₂ = m₂ L₁ L₂ cos(θ₁ - θ₂),  M₂₂ = m₂ L₂²</div>
            <div>m_eff⁻¹ = nᵀ · J_v · M(θ)⁻¹ · J_vᵀ · n</div>
            <div>j_n = -(1 + e)(v_rel · n) / (m_eff⁻¹ + m_block⁻¹)</div>
            <div>Δω = M(θ)⁻¹ · J_vᵀ · (j_n · n)</div>
          </div>
          <p className="text-xs text-slate-400">
            <strong>Symbols & SI Units:</strong> M(θ) = generalized inertia matrix (kg·m²); J_v = ∂r/∂θ Jacobian (m); m_eff = operational-space effective mass along contact normal n (kg); e = coefficient of restitution (dimensionless).
          </p>
          <p className="text-xs text-emerald-400">
            <strong>Viva Demonstration Tip:</strong> Point out how when Bob 2 hits the wall, Bob 1 immediately jerks in response because M₁₂ ≠ 0 couples the two rods, while L₁ and L₂ remain strictly constant.
          </p>
        </div>

        {/* 3. Momentum, Impulse & Compliant Contact Force */}
        <div className="bg-panelBg p-6 rounded-xl border border-slate-700 space-y-3">
          <h3 className="text-lg font-bold text-amber-400">
            3. Linear Momentum, Impulse & Contact Duration (F_avg vs. F_peak)
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            <strong>Plain-Language Concept:</strong> A moving bob carries linear momentum <strong>p = mv</strong>. During a collision, the impulse <strong>J</strong> equals the change in momentum. The contact force is <em>not</em> equal to the bob&apos;s weight (mg); it depends on how rapidly the contact stiffness (k_c) decelerates the bob over the collision duration Δt_c.
          </p>
          <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 font-mono text-xs text-slate-200 space-y-1.5">
            <div>p = m · v   (kg·m/s)</div>
            <div>J = Δp = ∫ F(t) dt   (N·s)</div>
            <div>Δt_c = π · √(m_eff / k_c)   (s)</div>
            <div>F_avg = J / Δt_c,   F_peak = (π / 2) · F_avg   (N)</div>
          </div>
          <p className="text-xs text-slate-400">
            <strong>Symbols & SI Units:</strong> p = linear momentum (kg·m/s); J = impulse (N·s); k_c = contact stiffness (N/m); Δt_c = contact interval (s); F_avg, F_peak = average and peak contact force (N).
          </p>
          <p className="text-xs text-emerald-400">
            <strong>Viva Demonstration Tip:</strong> Compare Timber (low k_c, longer Δt_c) vs. Brittle Ceramic (high k_c, shorter Δt_c) in the Impact Analysis tab to show why stiffer contacts produce higher peak forces.
          </p>
        </div>

        {/* 4. Bond Stress, Damage & Fracture Mechanics */}
        <div className="bg-panelBg p-6 rounded-xl border border-slate-700 space-y-3">
          <h3 className="text-lg font-bold text-emerald-400">
            4. Mortar Bond Stress, Damage Accumulation & 3D Fragment Dynamics
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            <strong>Plain-Language Concept:</strong> Our 3D wall uses <strong>Approach B (Contact & Bond-Damage Model)</strong>. Each block is connected to its neighbors by mortar bonds of area A_bond. When impact force transmits through the wall, if local bond stress σ_bond exceeds the material&apos;s failure threshold σ_fail, the bond severs and unsupported blocks fall under 3D gravity.
          </p>
          <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 font-mono text-xs text-slate-200 space-y-1.5">
            <div>σ_bond = F_local / A_bond   (Pa or kPa)</div>
            <div>D = ∑ (σ_bond / σ_fail)   (Damage Index, Fracture at D ≥ 1.0)</div>
            <div>K_trans = ½ m_b v_b²,   K_rot = ½ I_b ω_b²   (Fragment Energy)</div>
          </div>
          <p className="text-xs text-slate-400">
            <strong>Symbols & SI Units:</strong> σ_bond = estimated bond stress (kPa); A_bond = inter-block contact area (m²); σ_fail = bond strength threshold (kPa); D = dimensionless damage state.
          </p>
          <p className="text-xs text-emerald-400">
            <strong>Viva Demonstration Tip:</strong> Toggle the Damage Overlay in the 3D scene to explain the difference between sub-critical micro-cracking (yellow/orange) and complete bond fracture (red detached fragments).
          </p>
        </div>
      </div>

      {/* Model Assumptions & Limitations Box */}
      <div className="bg-panelBg p-6 rounded-xl border border-slate-700 space-y-3">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" /> Explicit Scientific Assumptions & Model Limitations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300 leading-relaxed">
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span>
                <strong>Planar Pendulum with 3D Volume:</strong> The double pendulum has two generalized degrees of freedom (θ₁, θ₂) constrained to the Z = 0 plane, while its bobs, rods, and the destructible wall have full 3D collision geometry.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span>
                <strong>Rigid-Link Pendulum Constraint:</strong> Connecting rods L₁ and L₂ are modelled as massless and inextensible; collision impulses are projected onto generalized coordinates via M(θ)⁻¹.
              </span>
            </li>
          </ul>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Discrete Bond-Damage vs. Continuum FEA:</strong> Wall blocks are discrete rigid bodies joined by breakable mortar bonds rather than a continuum finite-element mesh; individual bricks do not bend or plastically deform internally.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Educational Scope:</strong> Material presets use representative textbook parameters to illustrate physical principles and are not intended for real-world structural safety certification.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};