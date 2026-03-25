'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { BlendShapes, WordTiming } from '@/lib/types';

// ---- Placeholder avatar head with morph targets ----
function PlaceholderHead({
  blendShapes,
  isSpeaking,
}: {
  blendShapes: BlendShapes;
  isSpeaking: boolean;
}) {
  const headRef = useRef<THREE.Mesh>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const mouthRef = useRef<THREE.Mesh>(null);
  const bodyRef = useRef<THREE.Group>(null);

  // Idle animation + blend shape response
  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // Subtle idle breathing/sway
    if (bodyRef.current) {
      bodyRef.current.rotation.y = Math.sin(t * 0.5) * 0.03;
      bodyRef.current.position.y = Math.sin(t * 0.8) * 0.01;
    }

    // Head tilt from blend shapes
    if (headRef.current) {
      const lookUp = (blendShapes.eyeLookUpLeft || 0) + (blendShapes.eyeLookUpRight || 0);
      headRef.current.rotation.x = -lookUp * 0.15;

      const lookIn = (blendShapes.eyeLookInLeft || 0) - (blendShapes.eyeLookInRight || 0);
      headRef.current.rotation.y = lookIn * 0.1 + Math.sin(t * 0.3) * 0.02;
    }

    // Eye scale from blend shapes (wide = bigger)
    const eyeWide = Math.max(blendShapes.eyeWideLeft || 0, blendShapes.eyeWideRight || 0);
    const eyeSquint = Math.max(blendShapes.eyeSquintLeft || 0, blendShapes.eyeSquintRight || 0);
    const eyeScale = 1 + eyeWide * 0.3 - eyeSquint * 0.2;
    if (leftEyeRef.current) leftEyeRef.current.scale.setScalar(eyeScale);
    if (rightEyeRef.current) rightEyeRef.current.scale.setScalar(eyeScale);

    // Mouth from blend shapes + speaking
    if (mouthRef.current) {
      const jawOpen = blendShapes.jawOpen || 0;
      const smile = ((blendShapes.mouthSmileLeft || 0) + (blendShapes.mouthSmileRight || 0)) / 2;
      const frown = ((blendShapes.mouthFrownLeft || 0) + (blendShapes.mouthFrownRight || 0)) / 2;

      // Speaking animation
      const speakOpen = isSpeaking ? Math.abs(Math.sin(t * 8)) * 0.15 : 0;
      const openAmount = Math.max(jawOpen, speakOpen);

      mouthRef.current.scale.x = 1 + smile * 0.5 - frown * 0.2;
      mouthRef.current.scale.y = 0.3 + openAmount * 2;
      mouthRef.current.position.y = -0.35 - openAmount * 0.05;
    }

    // Brow animation via head mesh slight adjustments
    // (In a real avatar these would be morph targets)
  });

  return (
    <group ref={bodyRef}>
      {/* Body */}
      <mesh position={[0, -1.2, 0]}>
        <capsuleGeometry args={[0.35, 0.8, 8, 16]} />
        <meshStandardMaterial color="#4338ca" />
      </mesh>

      {/* Neck */}
      <mesh position={[0, -0.55, 0]}>
        <cylinderGeometry args={[0.12, 0.15, 0.3, 12]} />
        <meshStandardMaterial color="#e0c8a8" />
      </mesh>

      {/* Head */}
      <mesh ref={headRef} position={[0, 0, 0]}>
        <sphereGeometry args={[0.4, 32, 32]} />
        <meshStandardMaterial color="#e8d5b7" />

        {/* Left eye */}
        <mesh ref={leftEyeRef} position={[-0.13, 0.06, 0.35]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color="#1a1a2e" />
        </mesh>

        {/* Right eye */}
        <mesh ref={rightEyeRef} position={[0.13, 0.06, 0.35]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshStandardMaterial color="#1a1a2e" />
        </mesh>

        {/* Mouth */}
        <mesh ref={mouthRef} position={[0, -0.35, 0.34]}>
          <boxGeometry args={[0.18, 0.03, 0.04]} />
          <meshStandardMaterial color="#c9746b" />
        </mesh>

        {/* Nose */}
        <mesh position={[0, -0.05, 0.38]}>
          <coneGeometry args={[0.04, 0.08, 8]} />
          <meshStandardMaterial color="#d4be9e" />
        </mesh>
      </mesh>

      {/* Left arm */}
      <mesh position={[-0.55, -1.1, 0]} rotation={[0, 0, 0.2]}>
        <capsuleGeometry args={[0.08, 0.5, 8, 12]} />
        <meshStandardMaterial color="#4338ca" />
      </mesh>

      {/* Right arm */}
      <mesh position={[0.55, -1.1, 0]} rotation={[0, 0, -0.2]}>
        <capsuleGeometry args={[0.08, 0.5, 8, 12]} />
        <meshStandardMaterial color="#4338ca" />
      </mesh>
    </group>
  );
}

function Scene({
  blendShapes,
  isSpeaking,
}: {
  blendShapes: BlendShapes;
  isSpeaking: boolean;
}) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <directionalLight position={[-3, 3, 2]} intensity={0.3} color="#6366f1" />
      <PlaceholderHead blendShapes={blendShapes} isSpeaking={isSpeaking} />
      <OrbitControls
        enablePan={false}
        minDistance={1.5}
        maxDistance={5}
        target={[0, -0.3, 0]}
      />
    </>
  );
}

// ---- Audio player for PCM chunks ----
class AudioChunkPlayer {
  private audioCtx: AudioContext;
  private queue: Float32Array[] = [];
  private isPlaying = false;
  private nextStartTime = 0;

  constructor() {
    this.audioCtx = new AudioContext({ sampleRate: 16000 });
  }

  addChunk(base64: string) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    // PCM 16-bit signed LE to Float32
    const samples = new Float32Array(bytes.length / 2);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = view.getInt16(i * 2, true) / 32768;
    }
    this.queue.push(samples);
    this.scheduleNext();
  }

  private scheduleNext() {
    if (this.isPlaying || this.queue.length === 0) return;
    this.isPlaying = true;

    const samples = this.queue.shift()!;
    const buffer = this.audioCtx.createBuffer(1, samples.length, 16000);
    buffer.getChannelData(0).set(samples);

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioCtx.destination);

    const now = this.audioCtx.currentTime;
    const startTime = Math.max(now, this.nextStartTime);
    source.start(startTime);
    this.nextStartTime = startTime + buffer.duration;

    source.onended = () => {
      this.isPlaying = false;
      this.scheduleNext();
    };
  }

  stop() {
    this.queue = [];
    this.nextStartTime = 0;
  }

  async resume() {
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
  }
}

// ---- Main exported component ----
export default function AvatarScene({
  blendShapes,
  isSpeaking,
  audioChunks,
  onAudioPlayerReady,
}: {
  blendShapes: BlendShapes;
  isSpeaking: boolean;
  audioChunks?: string[];
  onAudioPlayerReady?: (player: AudioChunkPlayer) => void;
}) {
  const playerRef = useRef<AudioChunkPlayer | null>(null);

  useEffect(() => {
    const player = new AudioChunkPlayer();
    playerRef.current = player;
    onAudioPlayerReady?.(player);
    return () => player.stop();
  }, [onAudioPlayerReady]);

  return (
    <div className="w-full h-full" id="avatar-canvas">
      <Canvas
        camera={{ position: [0, 0, 2.5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={['#0a0a0f']} />
        <Scene blendShapes={blendShapes} isSpeaking={isSpeaking} />
      </Canvas>
    </div>
  );
}

export { AudioChunkPlayer };
