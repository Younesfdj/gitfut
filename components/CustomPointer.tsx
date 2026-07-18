"use client";

import { useEffect, useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Environment } from "@react-three/drei";
import * as THREE from "three";

function FootballPointer() {
  const { scene } = useGLTF("/3D-Models/fifa_trionda_ball_world_cup_2026.glb");
  const meshRef = useRef<THREE.Group>(null);
  const scaleRef = useRef(6);
  const isHoveringRef = useRef(false);
  const isHiddenRef = useRef(false);

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const onMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      
      const isInput = target.tagName.toLowerCase() === "input" || 
                      target.tagName.toLowerCase() === "textarea" ||
                      target.isContentEditable;
                      
      isHiddenRef.current = isInput;
      isHoveringRef.current = 
        window.getComputedStyle(target).cursor === "pointer" || 
        target.tagName.toLowerCase() === "a" || 
        target.tagName.toLowerCase() === "button" ||
        target.closest('a') !== null ||
        target.closest('button') !== null;
    };

    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  useFrame((state, delta) => {
    if (meshRef.current) {
      // Continuous rotation
      meshRef.current.rotation.y += delta * 2;
      meshRef.current.rotation.x += delta * 1.5;

      // Smooth scale interpolation when hovering
      const targetScale = isHiddenRef.current ? 0 : (isHoveringRef.current ? 11 : 6);
      scaleRef.current += (targetScale - scaleRef.current) * 0.2;
      meshRef.current.scale.setScalar(scaleRef.current);
    }
  });

  return (
    <group ref={meshRef} dispose={null}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload("/3D-Models/fifa_trionda_ball_world_cup_2026.glb");

export function CustomPointer() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Disable on touch devices
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let mouseX = -100;
    let mouseY = -100;
    let currentX = -100;
    let currentY = -100;
    let hiddenState = false;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      
      const target = e.target as HTMLElement;
      if (!target) return;
      
      hiddenState = target.tagName.toLowerCase() === "input" || 
                    target.tagName.toLowerCase() === "textarea" ||
                    target.isContentEditable;
    };

    let hasMoved = false;
    const onFirstMouseMove = (e: MouseEvent) => {
      if (!hasMoved) {
        currentX = e.clientX;
        currentY = e.clientY;
        hasMoved = true;
      }
    };

    window.addEventListener("mousemove", onFirstMouseMove, { once: true });
    window.addEventListener("mousemove", onMouseMove);

    const animate = () => {
      // Ease the pointer towards the mouse for a smooth trailing effect
      currentX += (mouseX - currentX) * 0.4;
      currentY += (mouseY - currentY) * 0.4;

      if (containerRef.current) {
        containerRef.current.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
        containerRef.current.style.opacity = hiddenState ? "0" : "1";
      }

      requestAnimationFrame(animate);
    };

    const animId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(animId);
    };
  }, []);

  // Use a fixed w-28 h-28 container, offset by -56px so the mouse is exactly in the center
  return (
    <div 
      ref={containerRef}
      className="pointer-events-none fixed z-[999999] hidden sm:block will-change-transform transition-opacity duration-200 w-28 h-28"
      style={{ left: '-56px', top: '-56px', pointerEvents: 'none' }}
    >
      <Canvas 
        camera={{ position: [0, 0, 5], fov: 45 }} 
        dpr={[1, 2]}
        style={{ pointerEvents: 'none' }}
      >
        <ambientLight intensity={1} />
        {/* Brand green light to tie it into the theme */}
        <directionalLight position={[5, 5, 5]} intensity={2.5} color="#39d353" />
        <directionalLight position={[-5, -5, -5]} intensity={1.5} color="#ffffff" />
        <Environment preset="city" />
        <Suspense fallback={null}>
          <FootballPointer />
        </Suspense>
      </Canvas>
    </div>
  );
}
