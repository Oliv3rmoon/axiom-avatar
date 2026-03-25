'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { PerceptionData } from '@/lib/types';

interface PerceptionCaptureProps {
  onPerception: (data: PerceptionData) => void;
  enabled: boolean;
  interval?: number; // ms between sends, default 500
}

export default function PerceptionCapture({
  onPerception,
  enabled,
  interval = 500,
}: PerceptionCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isActive, setIsActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // For Phase 1: send basic frame data at interval
      // MediaPipe integration would go here in production
      timerRef.current = setInterval(() => {
        // Placeholder perception — in production, MediaPipe face_mesh
        // would process the video frame and extract landmarks
        const mockPerception: PerceptionData = {
          headPose: { pitch: 0, yaw: 0, roll: 0 },
          bodyPose: { shoulderDepth: 0 },
        };
        onPerception(mockPerception);
      }, interval);

      setIsActive(true);
    } catch (e) {
      console.error('[Perception] Camera access error:', e);
    }
  }, [onPerception, interval]);

  const stopCapture = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsActive(false);
  }, []);

  useEffect(() => {
    if (enabled && !isActive) {
      startCapture();
    } else if (!enabled && isActive) {
      stopCapture();
    }
    return () => {
      if (isActive) stopCapture();
    };
  }, [enabled]);

  return (
    <>
      {/* Hidden video element for camera capture */}
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
        width={640}
        height={480}
      />
      <canvas ref={canvasRef} className="hidden" width={640} height={480} />
      <div className="flex items-center gap-2 text-sm">
        <div
          className={`w-2 h-2 rounded-full ${
            isActive ? 'bg-blue-500' : 'bg-zinc-600'
          }`}
        />
        <span className="text-zinc-400">
          {isActive ? 'Camera active' : 'Camera off'}
        </span>
      </div>
    </>
  );
}
