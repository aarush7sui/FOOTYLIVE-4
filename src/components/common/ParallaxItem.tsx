'use client';

import React, { useRef, useEffect } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  useReducedMotion,
} from 'framer-motion';

interface ParallaxItemProps {
  children: React.ReactNode;
  speed?: number; // Vertical scroll parallax travel in px (e.g. -30 to 40)
  xSpeed?: number; // Optional horizontal scroll parallax travel in px
  scaleOnScroll?: boolean; // Optional subtle zoom depth curve
  className?: string;
}

export const ParallaxItem: React.FC<ParallaxItemProps> = ({
  children,
  speed = 24,
  xSpeed = 0,
  scaleOnScroll = false,
  className = '',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const rawY = useTransform(scrollYProgress, [0, 1], [-speed, speed]);
  const rawX = useTransform(scrollYProgress, [0, 1], [-xSpeed, xSpeed]);
  const rawScale = useTransform(scrollYProgress, [0, 0.5, 1], [0.985, 1, 0.99]);

  const y = useSpring(rawY, { stiffness: 320, damping: 34, mass: 0.4 });
  const x = useSpring(rawX, { stiffness: 320, damping: 34, mass: 0.4 });
  const scale = useSpring(rawScale, { stiffness: 280, damping: 30 });

  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      style={{
        y,
        x: xSpeed !== 0 ? x : undefined,
        scale: scaleOnScroll ? scale : undefined,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

interface ParallaxMouseLayerProps {
  children: React.ReactNode;
  depth?: number; // Max pixel shift on pointer move across viewport/container
  className?: string;
}

/**
 * Pointer-driven depth layer powered purely by MotionValues + Springs (0 React re-renders).
 */
export const ParallaxMouseLayer: React.FC<ParallaxMouseLayerProps> = ({
  children,
  depth = 18,
  className = '',
}) => {
  const prefersReduced = useReducedMotion();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springX = useSpring(mouseX, { stiffness: 140, damping: 22, mass: 0.5 });
  const springY = useSpring(mouseY, { stiffness: 140, damping: 22, mass: 0.5 });

  useEffect(() => {
    if (prefersReduced) return;
    const handlePointerMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2; // -1 to 1
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      mouseX.set(nx * depth);
      mouseY.set(ny * depth);
    };
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [depth, mouseX, mouseY, prefersReduced]);

  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div style={{ x: springX, y: springY }} className={className}>
      {children}
    </motion.div>
  );
};

/**
 * Top neon pitch-progress bar tracking vertical scroll position across the site.
 */
export const ParallaxScrollProgress: React.FC<{ color?: string }> = ({
  color = '#00ff88',
}) => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 260,
    damping: 32,
    restDelta: 0.001,
  });

  return (
    <motion.div
      aria-hidden="true"
      style={{
        scaleX,
        transformOrigin: '0% 50%',
        backgroundImage: color === '#00ff88' ? 'linear-gradient(90deg, #ff3355 0%, #00ff88 65%, #00ff88 100%)' : undefined,
        backgroundColor: color === '#00ff88' ? undefined : color,
      }}
      className="fixed top-0 left-0 right-0 h-[2.5px] z-50 pointer-events-none shadow-[0_0_12px_rgba(255,51,85,0.5)]"
    />
  );
};

/**
 * Multi-depth fixed stadium ambient glows + subtle grid reacting to both scrollY and pointer movement.
 */
export const FloatingBackgroundGlows: React.FC = () => {
  const prefersReduced = useReducedMotion();
  const { scrollY } = useScroll();

  const y1 = useTransform(scrollY, [0, 2600], [0, 340]);
  const y2 = useTransform(scrollY, [0, 2600], [0, -280]);
  const y3 = useTransform(scrollY, [0, 2600], [0, 210]);
  const gridY = useTransform(scrollY, [0, 2600], [0, -140]);

  const ptrX = useMotionValue(0);
  const ptrY = useMotionValue(0);
  const smoothX1 = useSpring(ptrX, { stiffness: 90, damping: 24 });
  const smoothY1 = useSpring(ptrY, { stiffness: 90, damping: 24 });
  const smoothX2 = useTransform(smoothX1, (v) => -v * 1.4);
  const smoothY2 = useTransform(smoothY1, (v) => -v * 1.2);

  useEffect(() => {
    if (prefersReduced) return;
    const onMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 36;
      const ny = (e.clientY / window.innerHeight - 0.5) * 36;
      ptrX.set(nx);
      ptrY.set(ny);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [prefersReduced, ptrX, ptrY]);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
      {/* Subtle Tactical Parallax Grid */}
      <motion.div
        style={{
          y: prefersReduced ? 0 : gridY,
          backgroundImage:
            'linear-gradient(to right, rgba(0, 255, 136, 0.025) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 255, 136, 0.025) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
        className="absolute -inset-32 opacity-70"
      />

      <motion.div
        style={{
          y: prefersReduced ? 0 : y1,
          x: prefersReduced ? 0 : smoothX1,
        }}
        className="absolute -top-32 left-1/4 h-[520px] w-[520px] rounded-full bg-[#00ff88]/7 blur-[140px]"
      />
      <motion.div
        style={{
          y: prefersReduced ? 0 : y2,
          x: prefersReduced ? 0 : smoothX2,
        }}
        className="absolute top-1/2 -right-32 h-[620px] w-[620px] rounded-full bg-[#ff3355]/7 blur-[160px]"
      />
      <motion.div
        style={{
          y: prefersReduced ? 0 : y3,
          x: prefersReduced ? 0 : smoothY1,
          translateY: prefersReduced ? 0 : smoothY2,
        }}
        className="absolute bottom-1/4 left-10 h-[460px] w-[460px] rounded-full bg-[#ff3355]/8 blur-[130px]"
      />
    </div>
  );
};
