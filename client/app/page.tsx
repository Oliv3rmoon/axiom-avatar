'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import AudioCapture from '@/components/AudioCapture';
import PerceptionCapture from '@/components/PerceptionCapture';
import { AvatarWebSocket } from '@/lib/websocket';
import { BlendShapes, ServerMessage, PerceptionData } from '@/lib/types';
import { AudioChunkPlayer } from '@/components/AvatarScene';

// Dynamic import for Three.js (no SSR)
const AvatarScene = dynamic(() => import('@/components/AvatarScene'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0a0a0f]">
      <div className="text-zinc-500">Loading avatar...</div>
    </div>
  ),
});

const WS_URL = process.env.NEXT_PUBLIC_AVATAR_WS_URL || 'ws://localhost:8080/ws';

export default function Home() {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [blendShapes, setBlendShapes] = useState<BlendShapes>({});
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [emotion, setEmotion] = useState({ emotion: 'neutral', intensity: 0.5 });
  const [inputText, setInputText] = useState('');
  const [transcript, setTranscript] = useState<Array<{ role: string; text: string }>>([]);
  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);

  const wsRef = useRef<AvatarWebSocket | null>(null);
  const audioPlayerRef = useRef<AudioChunkPlayer | null>(null);

  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'connected':
        console.log('[App] Server connected at', msg.timestamp);
        break;
      case 'expression':
        setBlendShapes(msg.blendShapes);
        break;
      case 'gesture':
        // In production, this triggers a Mixamo animation
        console.log('[App] Gesture:', msg.animation, 'intensity:', msg.intensity);
        break;
      case 'emotion':
        setEmotion({ emotion: msg.emotion, intensity: msg.intensity });
        break;
      case 'speaking_start':
        setIsSpeaking(true);
        setCurrentText(msg.text);
        setTranscript((prev) => [...prev, { role: 'assistant', text: msg.text }]);
        audioPlayerRef.current?.resume();
        break;
      case 'audio_chunk':
        audioPlayerRef.current?.addChunk(msg.data);
        break;
      case 'word_timing':
        // Could drive lip-sync here
        break;
      case 'speaking_end':
        setIsSpeaking(false);
        break;
      case 'listening':
        break;
      case 'error':
        console.error('[App] Server error:', msg.message);
        break;
      case 'info':
        console.log('[App] Info:', msg.message);
        break;
    }
  }, []);

  // Connect WebSocket on mount
  useEffect(() => {
    const ws = new AvatarWebSocket(WS_URL, handleMessage, setStatus);
    wsRef.current = ws;
    ws.connect();
    return () => ws.disconnect();
  }, [handleMessage]);

  const sendText = useCallback(() => {
    if (!inputText.trim()) return;
    wsRef.current?.send({ type: 'user_text', text: inputText.trim() });
    setTranscript((prev) => [...prev, { role: 'user', text: inputText.trim() }]);
    setInputText('');
  }, [inputText]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendText();
      }
    },
    [sendText]
  );

  const onAudioPlayerReady = useCallback((player: AudioChunkPlayer) => {
    audioPlayerRef.current = player;
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden">
      {/* 3D Avatar — full screen */}
      <AvatarScene
        blendShapes={blendShapes}
        isSpeaking={isSpeaking}
        onAudioPlayerReady={onAudioPlayerReady}
      />

      {/* Status bar — top left */}
      <div className="absolute top-4 left-4 flex items-center gap-4 bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              status === 'connected'
                ? 'bg-green-500'
                : status === 'connecting'
                ? 'bg-yellow-500 animate-pulse'
                : 'bg-red-500'
            }`}
          />
          <span className="text-xs text-zinc-400 capitalize">{status}</span>
        </div>
        <div className="text-xs text-zinc-500">|</div>
        <div className="text-xs text-zinc-400">
          {emotion.emotion} ({(emotion.intensity * 100).toFixed(0)}%)
        </div>
      </div>

      {/* Controls — top right */}
      <div className="absolute top-4 right-4 flex items-center gap-3 bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2">
        <button
          onClick={() => setMicEnabled(!micEnabled)}
          className={`text-xs px-3 py-1 rounded ${
            micEnabled ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400'
          }`}
        >
          {micEnabled ? 'Mic On' : 'Mic Off'}
        </button>
        <button
          onClick={() => setCameraEnabled(!cameraEnabled)}
          className={`text-xs px-3 py-1 rounded ${
            cameraEnabled ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400'
          }`}
        >
          {cameraEnabled ? 'Cam On' : 'Cam Off'}
        </button>
        <AudioCapture
          enabled={micEnabled}
          onVADStart={() => wsRef.current?.send({ type: 'vad_start' })}
          onVADEnd={() => wsRef.current?.send({ type: 'vad_end' })}
          onAudioChunk={(data) => wsRef.current?.send({ type: 'user_audio', data })}
        />
        <PerceptionCapture
          enabled={cameraEnabled}
          onPerception={(data: PerceptionData) =>
            wsRef.current?.send({ type: 'perception', data })
          }
        />
      </div>

      {/* Transcript overlay — bottom left */}
      <div className="absolute bottom-20 left-4 right-4 max-w-lg">
        <div className="bg-black/60 backdrop-blur-sm rounded-lg p-3 max-h-48 overflow-y-auto">
          {transcript.length === 0 ? (
            <p className="text-zinc-500 text-sm">Send a message to start talking with AXIOM...</p>
          ) : (
            transcript.slice(-6).map((entry, i) => (
              <div key={i} className="mb-1">
                <span
                  className={`text-xs font-medium ${
                    entry.role === 'user' ? 'text-indigo-400' : 'text-emerald-400'
                  }`}
                >
                  {entry.role === 'user' ? 'You' : 'AXIOM'}:
                </span>{' '}
                <span className="text-sm text-zinc-300">{entry.text}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Text input — bottom */}
      <div className="absolute bottom-4 left-4 right-4 flex gap-2 max-w-2xl mx-auto">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 bg-zinc-900/90 backdrop-blur-sm border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          disabled={status !== 'connected'}
        />
        <button
          onClick={sendText}
          disabled={status !== 'connected' || !inputText.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
        >
          Send
        </button>
      </div>

      {/* Speaking indicator */}
      {isSpeaking && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-32 pointer-events-none">
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-indigo-500 rounded-full animate-pulse"
                style={{
                  height: `${8 + Math.random() * 16}px`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
