import React, { useRef, useEffect, useState } from 'react';
import { type PendulumState, type PendulumParams } from '../physics/engine';

interface CanvasProps {
  state: PendulumState;
  params: PendulumParams;
  showTrail: boolean;
  trailLimit?: number;
}

export const SimulationCanvas: React.FC<CanvasProps> = ({ state, params, showTrail, trailLimit = 300 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [trail, setTrail] = useState<{x: number, y: number}[]>([]);

  // Scale pixels per meter
  const scale = 150; 

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const pivotX = width / 2;
    const pivotY = height / 3;

    // Calculate Cartesian coordinates
    const x1 = pivotX + params.l1 * scale * Math.sin(state.theta1);
    const y1 = pivotY + params.l1 * scale * Math.cos(state.theta1);
    
    const x2 = x1 + params.l2 * scale * Math.sin(state.theta2);
    const y2 = y1 + params.l2 * scale * Math.cos(state.theta2);

    // Update trail
    if (showTrail) {
      setTrail(prev => {
        const newTrail = [...prev, {x: x2, y: y2}];
        if (newTrail.length > trailLimit) newTrail.shift();
        return newTrail;
      });
    } else if (trail.length > 0) {
      setTrail([]); // Clear trail if disabled
    }

    // Clear Canvas
    ctx.clearRect(0, 0, width, height);

    // Draw Trail
    if (showTrail && trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      for (let i = 1; i < trail.length; i++) {
        ctx.lineTo(trail[i].x, trail[i].y);
      }
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)'; // accent2 faded
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw Rod 1
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw Rod 2
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Draw Pivot
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 5, 0, 2 * Math.PI);
    ctx.fillStyle = '#cbd5e1';
    ctx.fill();

    // Draw Bob 1
    ctx.beginPath();
    ctx.arc(x1, y1, Math.max(5, params.m1 * 3), 0, 2 * Math.PI);
    ctx.fillStyle = '#38bdf8'; // accent1
    ctx.fill();

    // Draw Bob 2
    ctx.beginPath();
    ctx.arc(x2, y2, Math.max(5, params.m2 * 3), 0, 2 * Math.PI);
    ctx.fillStyle = '#f43f5e'; // accent2
    ctx.fill();

  }, [state, params, showTrail]);

  return (
    <div className="bg-panelBg rounded-xl border border-slate-700 shadow-lg overflow-hidden flex justify-center items-center">
      <canvas 
        ref={canvasRef} 
        width={600} 
        height={600} 
        className="max-w-full h-auto"
      />
    </div>
  );
};