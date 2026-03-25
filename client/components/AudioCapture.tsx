'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface AudioCaptureProps {
  onVADStart: () => void;
  onVADEnd: () => void;
  onAudioChunk: (base64: string) => void;
  enabled: boolean;
}

const SPEECH_THRESHOLD = 0.01;
const SILENCE_THRESHOLD = 0.005;
const SPEECH_FRAMES_REQUIRED = 3;
const SILENCE_FRAMES_REQUIRED = 15;
const CHUNK_INTERVAL_MS = 200;

export default function AudioCapture({
  onVADStart,
  onVADEnd,
  onAudioChunk,
  enabled,
}: AudioCaptureProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeechActive, setIsSpeechActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const speechFramesRef = useRef(0);
  const silenceFramesRef = useRef(0);
  const isSpeakingRef = useRef(false);
  const audioBufferRef = useRef<Float32Array[]>([]);
  const chunkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true },
      });
      streamRef.current = stream;

      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      // Use ScriptProcessor for VAD (AudioWorklet would be better in production)
      const processor = audioCtx.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;

      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(audioCtx.destination);

      processor.onaudioprocess = (e) => {
        const data = e.inputBuffer.getChannelData(0);
        const copy = new Float32Array(data.length);
        copy.set(data);

        // RMS energy
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length);

        if (rms > SPEECH_THRESHOLD) {
          speechFramesRef.current++;
          silenceFramesRef.current = 0;

          if (speechFramesRef.current >= SPEECH_FRAMES_REQUIRED && !isSpeakingRef.current) {
            isSpeakingRef.current = true;
            setIsSpeechActive(true);
            onVADStart();
          }
        } else if (rms < SILENCE_THRESHOLD) {
          silenceFramesRef.current++;
          speechFramesRef.current = 0;

          if (silenceFramesRef.current >= SILENCE_FRAMES_REQUIRED && isSpeakingRef.current) {
            isSpeakingRef.current = false;
            setIsSpeechActive(false);
            onVADEnd();
            audioBufferRef.current = [];
          }
        }

        if (isSpeakingRef.current) {
          audioBufferRef.current.push(copy);
        }
      };

      // Send audio chunks periodically
      chunkTimerRef.current = setInterval(() => {
        if (audioBufferRef.current.length > 0 && isSpeakingRef.current) {
          const totalLength = audioBufferRef.current.reduce((a, b) => a + b.length, 0);
          const combined = new Float32Array(totalLength);
          let offset = 0;
          for (const buf of audioBufferRef.current) {
            combined.set(buf, offset);
            offset += buf.length;
          }
          audioBufferRef.current = [];

          // Float32 to PCM16 base64
          const pcm = new Int16Array(combined.length);
          for (let i = 0; i < combined.length; i++) {
            pcm[i] = Math.max(-32768, Math.min(32767, combined[i] * 32768));
          }
          const bytes = new Uint8Array(pcm.buffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          onAudioChunk(btoa(binary));
        }
      }, CHUNK_INTERVAL_MS);

      setIsListening(true);
    } catch (e) {
      console.error('[AudioCapture] Mic access error:', e);
    }
  }, [onVADStart, onVADEnd, onAudioChunk]);

  const stopListening = useCallback(() => {
    if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);
    processorRef.current?.disconnect();
    audioCtxRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setIsListening(false);
    setIsSpeechActive(false);
    isSpeakingRef.current = false;
  }, []);

  useEffect(() => {
    if (enabled && !isListening) {
      startListening();
    } else if (!enabled && isListening) {
      stopListening();
    }
    return () => {
      if (isListening) stopListening();
    };
  }, [enabled]);

  return (
    <div className="flex items-center gap-2 text-sm">
      <div
        className={`w-2 h-2 rounded-full ${
          isSpeechActive ? 'bg-red-500 animate-pulse' : isListening ? 'bg-green-500' : 'bg-zinc-600'
        }`}
      />
      <span className="text-zinc-400">
        {isSpeechActive ? 'Listening...' : isListening ? 'Mic ready' : 'Mic off'}
      </span>
    </div>
  );
}
