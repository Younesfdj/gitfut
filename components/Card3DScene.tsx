"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Card } from "@/lib/scoring/types";
import PlayerCard from "./PlayerCard";

interface Props {
  cards: Card[];
  onPick: (login: string) => void;
}

export default function Card3DScene({ cards, onPick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardsParentRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const hoveredIndexRef = useRef<number | null>(null);
  const [ballLoaded, setBallLoaded] = useState(false);

  // Mouse Parallax & Scene Rotation Refs
  const mousePosRef = useRef({ x: 0, y: 0 });
  const sceneRotXRef = useRef<number>(0);
  const sceneRotYRef = useRef<number>(0);

  const ballRef = useRef<THREE.Group | null>(null);
  const containerWidthRef = useRef<number>(600);

  // Sync state and ref for hover
  useEffect(() => {
    hoveredIndexRef.current = hoveredIndex;
  }, [hoveredIndex]);

  // Set up Three.js WebGL Scene for the Ball
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;

    // Update width ref
    containerWidthRef.current = container.clientWidth;
    const isMobile = container.clientWidth < 860;
    const ballSize = isMobile ? 220 : 280; // Scaled down to fit perfectly with the text on the left

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(ballSize, ballSize);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4; // Slightly brighter

    // Scene
    const scene = new THREE.Scene();

    // Camera positioned for better view of larger ball
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10);
    camera.position.set(0, 0, 4.8); // Slightly further back for larger ball

    // Enhanced lighting setup for dramatic stadium atmosphere
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    // Key directional light (stadium lights) - stronger and more dramatic
    const dirLight = new THREE.DirectionalLight(0xffffff, 3.2);
    dirLight.position.set(5, 5, 4);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Enhanced colored lights for more dramatic effect
    const greenLight = new THREE.PointLight(0x39d353, 6.0, 12);
    greenLight.position.set(-4, 1.5, 3);
    scene.add(greenLight);

    // Additional rim light for ball prominence
    const rimLight = new THREE.DirectionalLight(0x39d353, 2.0);
    rimLight.position.set(-2, -2, 3);
    scene.add(rimLight);

    const goldLight = new THREE.PointLight(0xe9cc74, 4.5, 10);
    goldLight.position.set(4, -2, 3);
    scene.add(goldLight);

    // Add spotlight effect
    const spotLight = new THREE.SpotLight(0xffffff, 2.0);
    spotLight.position.set(0, 5, 3);
    spotLight.angle = Math.PI / 6;
    scene.add(spotLight);

    // Load GLB Ball with better error handling and fallback
    const loader = new GLTFLoader();
    let isDestroyed = false;
    let modelLoaded = false;

    // Fallback: Create a simple sphere if model fails to load
    const createFallbackBall = () => {
      if (modelLoaded || isDestroyed) return;

      const geometry = new THREE.SphereGeometry(1.6, 64, 64);
      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.3,
        roughness: 0.4,
        envMapIntensity: 1.0,
      });
      const sphere = new THREE.Mesh(geometry, material);

      // Add texture-like pattern with multiple materials
      const patternGeometry = new THREE.SphereGeometry(1.62, 32, 32);
      const patternMaterial = new THREE.MeshStandardMaterial({
        color: 0x39d353,
        metalness: 0.5,
        roughness: 0.3,
        transparent: true,
        opacity: 0.3,
      });
      const pattern = new THREE.Mesh(patternGeometry, patternMaterial);

      const group = new THREE.Group();
      group.add(sphere);
      group.add(pattern);

      ballRef.current = group;
      scene.add(group);
      modelLoaded = true;
      setBallLoaded(true);
    };

    // Try loading the GLB model first
    loader.load(
      "/models/fifa_ball.glb",
      (gltf) => {
        if (isDestroyed || modelLoaded) return;
        const model = gltf.scene;

        // Auto-center and normalize size
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        model.position.x += model.position.x - center.x;
        model.position.y += model.position.y - center.y;
        model.position.z += model.position.z - center.z;

        // Scale ball to be MASSIVE and prominent - the star of the show
        const maxDim = Math.max(size.x, size.y, size.z);
        const scaleFactor = 3.2 / maxDim; // Much larger scale for dramatic centerpiece
        model.scale.setScalar(scaleFactor);

        ballRef.current = model;
        scene.add(model);
        modelLoaded = true;
        setBallLoaded(true);
      },
      (progress) => {
        // Optional: show loading progress
        const percentComplete = (progress.loaded / progress.total) * 100;
        if (percentComplete < 100 && !modelLoaded) {
          // Model is loading
        }
      },
      (err) => {
        console.warn("Error loading FIFA ball model, using fallback:", err);
        createFallbackBall();
      }
    );

    // Fallback timeout - if model doesn't load within 3 seconds, show fallback
    const fallbackTimeout = setTimeout(() => {
      if (!modelLoaded) {
        createFallbackBall();
      }
    }, 3000);

    // Animation Loop
    let animationFrameId: number;
    let baseBallYRot = 0;
    let currentOrbitAngle = 0;
    let currentSpeed = 0.002; // Slightly slower, smoother rotation

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const containerWidth = containerWidthRef.current;
      const isMobileView = containerWidth < 860;

      const isHovered = hoveredIndexRef.current !== null;
      const targetSpeed = isHovered ? 0 : 0.002; // Slower for smoother feel
      currentSpeed += (targetSpeed - currentSpeed) * 0.05; // Slower easing
      currentOrbitAngle += currentSpeed;

      // 1. Update 3D Parallax Rotation
      const targetRotX = mousePosRef.current.y * -0.16;
      const targetRotY = mousePosRef.current.x * 0.16;
      sceneRotXRef.current += (targetRotX - sceneRotXRef.current) * 0.08;
      sceneRotYRef.current += (targetRotY - sceneRotYRef.current) * 0.08;

      // Rotate the 3D WebGL Ball with smoother motion
      if (ballRef.current) {
        if (!isHovered) {
          // Normal state - smooth continuous rotation
          baseBallYRot += 0.005; // Slightly slower for smoother feel
          ballRef.current.rotation.y = baseBallYRot + sceneRotYRef.current * 0.5;
          ballRef.current.rotation.x = (Math.sin(Date.now() * 0.0003) * 0.12) + sceneRotXRef.current * 0.3;
          ballRef.current.rotation.z = Math.sin(Date.now() * 0.0002) * 0.05; // Add subtle z rotation
        } else {
          // Hover state: Face the hovered card based on its orbit angle
          const hoveredIdx = hoveredIndexRef.current ?? 0;
          const hoveredTheta = currentOrbitAngle + (hoveredIdx * Math.PI * 0.5);
          const targetBallFaceY = -hoveredTheta + Math.PI / 2; // Approximate face direction

          ballRef.current.rotation.y += (targetBallFaceY - ballRef.current.rotation.y) * 0.08;
          ballRef.current.rotation.x += (sceneRotXRef.current - ballRef.current.rotation.x) * 0.08;
        }
      }

      // 2. Position the cards in 3D (Desktop layout)
      if (isMobileView) {
        for (let i = 0; i < cards.length; i++) {
          const cardEl = cardRefs.current[i];
          if (cardEl) {
            cardEl.style.transform = "";
            cardEl.style.zIndex = "";
            cardEl.style.opacity = "";
          }
        }
      } else {
        if (cardsParentRef.current) {
          cardsParentRef.current.style.transform = `rotateX(${sceneRotXRef.current * 12}deg) rotateY(${sceneRotYRef.current * 15}deg)`;
        }

        // Scaled down orbit radii so they fit inside the 50% flex-1 container perfectly
        const radiusX = 240;
        const radiusY = 120;
        const radiusZ = 60;

        for (let i = 0; i < cards.length; i++) {
          const cardEl = cardRefs.current[i];
          const lineEl = lineRefs.current[i];
          if (!cardEl) continue;

          // Calculate orbital position
          const theta = currentOrbitAngle + (i * Math.PI * 0.5);
          let tx = Math.cos(theta) * radiusX;
          let ty = Math.sin(theta) * radiusY;
          let tz = Math.sin(theta) * radiusZ;
          let rotY = 0; // Always face forward toward the screen

          let scale = 0.95;
          let opacity = 0.95;
          let zIndex = 20;
          let lineColor = "rgba(57,211,83,0.25)"; // More visible lines
          let lineWidth = "2.5";

          const floatOffset = Math.sin(Date.now() * 0.0012 + i * 1.8) * 8; // More dramatic float
          ty += floatOffset;

          if (hoveredIndexRef.current === i) {
            scale = 1.35; // Even larger scale on hover
            opacity = 1.0;
            zIndex = 50;
            tz += 100; // More dramatic forward movement
            ty -= 20;
            rotY = 0; // Face forward
            lineColor = "#39d353"; // Bright GitHub Green
            lineWidth = "5";
          } else if (isHovered) {
            opacity = 0.35;
            scale = 0.82;
            zIndex = 10;
          }

          cardEl.style.transform = `translate3d(calc(-50% + ${tx}px), calc(-50% + ${ty}px), ${tz}px) rotateY(${rotY}deg) scale(${scale})`;
          cardEl.style.zIndex = `${zIndex}`;
          cardEl.style.opacity = `${opacity}`;

          // Update SVG line
          if (lineEl && !isMobileView) {
            lineEl.setAttribute("x2", tx.toFixed(2));
            lineEl.setAttribute("y2", ty.toFixed(2));
            lineEl.setAttribute("stroke", lineColor);
            lineEl.setAttribute("stroke-width", lineWidth);
            lineEl.style.opacity = "1";
          } else if (lineEl && isMobileView) {
            lineEl.style.opacity = "0";
          }
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize observer to keep dimensions responsive
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        containerWidthRef.current = newWidth;
        const isMobileSize = newWidth < 860;
        const size = isMobileSize ? 180 : Math.min(180, newWidth * 0.4);
        renderer.setSize(size, size);
      }
    });
    resizeObserver.observe(container);

    // Clean up
    return () => {
      isDestroyed = true;
      clearTimeout(fallbackTimeout);
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.dispose();
      scene.clear();
    };
  }, [cards.length]);

  // Mouse parallax motion listeners
  const handleMouseMove = (e: React.MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    // Normalize mouse coords (-1 to 1)
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    mousePosRef.current = { x, y };
  };

  const handleMouseLeave = () => {
    mousePosRef.current = { x: 0, y: 0 };
    setHoveredIndex(null);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative flex-1 flex h-[600px] w-full select-none items-center justify-center overflow-visible max-[860px]:h-auto max-[860px]:flex-col max-[860px]:gap-[26px] max-[860px]:py-6"
      style={{
        background: 'radial-gradient(circle at center, rgba(57,211,83,0.12) 0%, rgba(57,211,83,0.04) 40%, transparent 70%)',
        filter: 'drop-shadow(0 0 40px rgba(57,211,83,0.1))',
      }}
    >
      {/* 1. Enhanced WebGL central rotating ball - PROMINENT CENTERPIECE */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center max-[860px]:relative max-[860px]:left-auto max-[860px]:top-auto max-[860px]:translate-none"
        style={{ width: "280px", height: "280px" }}
      >
        <canvas ref={canvasRef} className="block drop-shadow-2xl" style={{ opacity: ballLoaded ? 1 : 0, transition: 'opacity 0.5s ease-in' }} />

        {/* Loading indicator */}
        {!ballLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-16 h-16 border-4 border-brand/30 border-t-brand rounded-full animate-spin"
            />
          </div>
        )}

        {/* Dramatic glow effects around ball */}
        <div className="absolute inset-0 rounded-full bg-gradient-radial from-brand/30 via-brand/10 to-transparent blur-2xl opacity-70 animate-pulse" />
        <div className="absolute inset-0 rounded-full bg-gradient-radial from-gold/20 via-transparent to-transparent blur-xl opacity-40" />
      </div>

      {/* 2. SVG Hub & Spoke Lines - enhanced visibility */}
      <svg className="absolute inset-0 z-0 h-full w-full pointer-events-none max-[860px]:hidden">
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style={{ stopColor: 'rgba(57,211,83,0.6)', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: 'rgba(57,211,83,0.1)', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        <g style={{ transform: "translate(50%, 50%)" }}>
          {cards.map((card, i) => (
            <line
              key={`line-${card.login}`}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              x1="0"
              y1="0"
              x2="0"
              y2="0"
              stroke="url(#lineGradient)"
              strokeWidth="2.5"
              className="transition-all duration-300 ease-out"
              style={{ filter: 'drop-shadow(0 0 4px rgba(57,211,83,0.4))' }}
            />
          ))}
        </g>
      </svg>

      {/* 3. 3D CSS Orbiting Cards Container (z-20 so it renders on top of the ball) */}
      <div
        ref={cardsParentRef}
        className="absolute inset-0 z-20 overflow-visible max-[860px]:relative max-[860px]:flex max-[860px]:flex-col max-[860px]:items-center max-[860px]:gap-[18px] max-[860px]:h-auto max-[860px]:w-full"
        style={{ perspective: "1000px", transformStyle: "preserve-3d" }}
      >
        {cards.map((card, i) => (
          <div
            key={card.login}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            onClick={() => onPick(card.login)}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            className="absolute left-1/2 top-1/2 w-[190px] cursor-pointer origin-center transition-all duration-[350ms] ease-out select-none hover:drop-shadow-2xl max-[860px]:relative max-[860px]:left-auto max-[860px]:top-auto max-[860px]:w-[min(230px,66vw)] max-[860px]:!transform-none max-[860px]:!z-auto max-[860px]:!opacity-100"
            style={{
              transform: `translate3d(-50%, -50%, 0) scale(0.85)`,
              opacity: 0,
            }}
          >
            {/* Enhanced glow effect on hover - MORE DRAMATIC */}
            {hoveredIndex === i && (
              <>
                {/* Outer glow with pulsing animation */}
                <div
                  className="absolute -inset-8 rounded-xl"
                  style={{
                    background: 'radial-gradient(circle, rgba(57,211,83,0.4) 0%, rgba(57,211,83,0.15) 40%, transparent 70%)',
                    filter: 'blur(25px)',
                    animation: 'pulse 2s ease-in-out infinite'
                  }}
                />
                {/* Middle glow layer */}
                <div
                  className="absolute -inset-4 rounded-xl"
                  style={{
                    background: 'radial-gradient(circle, rgba(57,211,83,0.5) 0%, rgba(57,211,83,0.2) 50%, transparent 80%)',
                    filter: 'blur(15px)'
                  }}
                />
                {/* Shimmer sweep effect */}
                <div
                  className="absolute inset-0 rounded-xl opacity-80 animate-enhanced-shimmer pointer-events-none overflow-hidden"
                  style={{
                    background: 'linear-gradient(90deg, transparent 20%, rgba(255,255,255,0.8) 50%, transparent 80%)'
                  }}
                />
                {/* Inner bright glow */}
                <div
                  className="absolute -inset-1 rounded-xl pointer-events-none"
                  style={{
                    background: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(57,211,83,0.1) 50%, transparent 70%)',
                    filter: 'blur(10px)'
                  }}
                />
                {/* Sharp highlight edge */}
                <div
                  className="absolute inset-0 rounded-xl pointer-events-none"
                  style={{
                    boxShadow: 'inset 0 0 20px rgba(57,211,83,0.3), 0 0 30px rgba(57,211,83,0.4)',
                  }}
                />
              </>
            )}
            <PlayerCard card={card} />
          </div>
        ))}
      </div>
    </div>
  );
}
