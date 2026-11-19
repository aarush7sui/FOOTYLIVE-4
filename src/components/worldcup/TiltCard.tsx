'use client';

import React, { useRef } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useMotionTemplate,
  useReducedMotion,
} from 'framer-motion';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  maxTilt?: number;
}

/**
 * 60fps pointer-reactive 3D tilt + inner-depth + specular glare card driven by MotionValues (zero re-renders on hover).
 */
export const TiltCard: React.FC<TiltCardProps> = ({
  children,
  className = '',
  onClick,
  maxTilt = 7,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();

  const rawRotateX = useMotionValue(0);
  const rawRotateY = useMotionValue(0);
  const rawScale = useMotionValue(1);
  const rawGlareX = useMotionValue(50);
  const rawGlareY = useMotionValue(50);
  const rawGlareOpacity = useMotionValue(0);

  const rotateX = useSpring(rawRotateX, { stiffness: 320, damping: 24 });
  const rotateY = useSpring(rawRotateY, { stiffness: 320, damping: 24 });
  const scale = useSpring(rawScale, { stiffness: 320, damping: 24 });
  const glareOpacity = useSpring(rawGlareOpacity, { stiffness: 260, damping: 26 });

  const glareBackground = useMotionTemplate`radial-gradient(circle at ${rawGlareX}% ${rawGlareY}%, rgba(255, 255, 255, 0.16) 0%, transparent 65%)`;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReduced || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    rawRotateX.set(((y - centerY) / centerY) * -maxTilt);
    rawRotateY.set(((x - centerX) / centerX) * maxTilt);
    rawGlareX.set((x / rect.width) * 100);
    rawGlareY.set((y / rect.height) * 100);
  };

  const handleMouseEnter = () => {
    if (prefersReduced) return;
    rawScale.set(1.02);
    rawGlareOpacity.set(1);
  };

  const handleMouseLeave = () => {
    rawRotateX.set(0);
    rawRotateY.set(0);
    rawScale.set(1);
    rawGlareOpacity.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={
        prefersReduced
          ? undefined
          : {
              transformStyle: 'preserve-3d',
              transformPerspective: 1000,
              rotateX,
              rotateY,
              scale,
            }
      }
      className={`relative cursor-pointer overflow-hidden rounded-2xl transition-colors ${className}`}
    >
      {/* Specular Glare Reflection on Hover */}
      {!prefersReduced && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20"
          style={{
            opacity: glareOpacity,
            background: glareBackground,
          }}
        />
      )}

      <div
        style={prefersReduced ? undefined : { transform: 'translateZ(18px)' }}
        className="relative z-10 h-full"
      >
        {children}
      </div>
    </motion.div>
  );
};
