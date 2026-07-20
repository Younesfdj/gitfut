"use client";

import { useRef, Suspense, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Environment, Float, Html, Center } from "@react-three/drei";
import * as THREE from "three";

export interface Trophy3DProps {
  modelPath: string;
  scale?: number;
  position?: [number, number, number];
  rotationSpeed?: number;
  size?: number;
}

function LoadingPlaceholder() {
  return (
    <Html center>
      <div className="flex flex-col items-center justify-center pointer-events-none select-none">
        <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        <span className="text-[8px] font-mono text-ink-mute mt-1 tracking-wider">LOADING</span>
      </div>
    </Html>
  );
}

function TrophyModel({ modelPath, scale = 1, position = [0, 0, 0], rotationSpeed = 0.5 }: Trophy3DProps) {
  const { scene } = useGLTF(modelPath);
  const clonedScene = useMemo(() => scene.clone(), [scene]);
  const meshRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * rotationSpeed;
    }
  });

  return (
    <Float
      speed={2} 
      rotationIntensity={0.2}
      floatIntensity={0.8}
      floatingRange={[-0.1, 0.1]} 
    >
      <group ref={meshRef} dispose={null} scale={scale} position={position}>
        <Center>
          <primitive object={clonedScene} />
        </Center>
      </group>
    </Float>
  );
}

export default function Trophy3D(props: Trophy3DProps) {
  const size = props.size ?? 120;
  return (
    <div 
      className="relative pointer-events-none"
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <Canvas 
        camera={{ position: [0, 0, 5], fov: 45 }} 
        dpr={[1, 2]}
        style={{ pointerEvents: 'none' }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={2.5} color="#fff" />
        <directionalLight position={[-10, 10, 5]} intensity={1.5} color="#d4af37" />
        <Environment preset="city" />
        <Suspense fallback={<LoadingPlaceholder />}>
          <TrophyModel {...props} />
        </Suspense>
      </Canvas>
    </div>
  );
}

// Preload the models so they appear instantly when awarded
useGLTF.preload("/3D-Models/golden_boot.glb");
useGLTF.preload("/3D-Models/golden_glove.glb");
useGLTF.preload("/3D-Models/world_cup_trophy.glb");

