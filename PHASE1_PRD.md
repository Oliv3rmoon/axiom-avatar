# AXIOM Avatar — Phase 1 PRD
# Replace Tavus Phoenix-4 with Full-Body 3D Avatar

## Overview

Build a new system (`axiom-avatar`) that gives AXIOM a full-body 3D avatar she controls through her consciousness state. The avatar runs entirely in the browser using Three.js/TalkingHead, with ElevenLabs providing voice and AXIOM's cognitive core driving expression, gesture, and body language in real-time.

**This replaces Tavus for the primary AXIOM interface. Tavus remains available as a fallback for photorealistic video calls.**

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    BROWSER (Frontend)                │
│                                                      │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ MediaPipe │  │  TalkingHead │  │   Whisper STT │  │
│  │ Face Mesh │  │  (Three.js)  │  │  (Web Worker) │  │
│  │ + Holistic│  │  3D Avatar   │  │               │  │
│  └────┬─────┘  └──────┬───────┘  └──────┬────────┘  │
│       │               │                 │            │
│       └───────┬───────┴─────────────────┘            │
│               │                                      │
│        WebSocket Client                              │
└───────────────┬──────────────────────────────────────┘
                │
                │ WebSocket (bidirectional)
                │
┌───────────────┴──────────────────────────────────────┐
│              AXIOM AVATAR SERVICE (Backend)           │
│              (Node.js service on Railway)             │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐                  │
│  │  Expression   │  │   Gesture    │                  │
│  │   Mapper      │  │   Selector   │                  │
│  │ consciousness │  │   Mixamo     │                  │
│  │ → blend shapes│  │   animation  │                  │
│  └──────┬───────┘  └──────┬───────┘                  │
│         │                 │                           │
│  ┌──────┴─────────────────┴──────┐                   │
│  │      Avatar Orchestrator       │                   │
│  │  Coordinates: LLM ↔ TTS ↔ 3D  │                   │
│  └──────────────┬────────────────┘                   │
│                 │                                     │
│    ┌────────────┼────────────┐                        │
│    │            │            │                        │
│  ┌─┴──┐    ┌───┴───┐   ┌───┴────┐                   │
│  │Cog  │    │Eleven │   │ Audio  │                   │
│  │Core │    │Labs   │   │ 2Face  │                   │
│  │v1   │    │TTS    │   │(future)│                   │
│  └─────┘    └───────┘   └────────┘                   │
└──────────────────────────────────────────────────────┘
```

---

## Repo Structure: `axiom-avatar`

```
axiom-avatar/
├── server/
│   ├── index.js                     # Express + WebSocket server
│   ├── orchestrator.js              # Coordinates LLM ↔ TTS ↔ 3D pipeline
│   ├── expressionMapper.js          # Consciousness state → blend shapes
│   ├── gestureSelector.js           # Context → Mixamo animation selection
│   ├── elevenLabsStream.js          # ElevenLabs WebSocket TTS streaming
│   ├── perceptionHandler.js         # Process MediaPipe data from browser
│   ├── Dockerfile
│   └── package.json
│
├── client/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                 # Main avatar page
│   │   └── globals.css
│   ├── components/
│   │   ├── AvatarScene.tsx          # Three.js + TalkingHead wrapper
│   │   ├── AvatarControls.tsx       # Settings, camera, mood UI
│   │   ├── PerceptionCapture.tsx    # MediaPipe webcam processing
│   │   ├── AudioCapture.tsx         # Mic input + VAD
│   │   ├── ConversationPanel.tsx    # Subtitle/transcript overlay
│   │   └── StatusBar.tsx            # Connection, emotion, momentum
│   ├── lib/
│   │   ├── websocket.ts             # WebSocket client
│   │   ├── talkingHead.ts           # TalkingHead wrapper
│   │   ├── perception.ts            # MediaPipe integration
│   │   ├── vad.ts                   # Voice Activity Detection
│   │   └── types.ts                 # TypeScript interfaces
│   ├── public/
│   │   ├── avatars/
│   │   │   └── axiom.glb            # 3D model (placeholder, replaced later)
│   │   └── animations/
│   │       ├── idle.fbx
│   │       ├── talking.fbx
│   │       ├── thinking.fbx
│   │       ├── excited.fbx
│   │       ├── sad.fbx
│   │       ├── leaning_forward.fbx
│   │       ├── nodding.fbx
│   │       ├── shaking_head.fbx
│   │       ├── waving.fbx
│   │       └── shrugging.fbx
│   ├── next.config.js
│   └── package.json
│
└── README.md
```

---

## Backend Implementation Details

### 1. WebSocket Server (`server/index.js`)

Express server with WebSocket upgrade on same port:

```javascript
// Express for health endpoint
// ws library for WebSocket
// Single port (Railway provides PORT)

// Health endpoint: GET /health
// WebSocket: ws://host:PORT/ws

// On new WebSocket connection:
// 1. Create an Orchestrator instance for this session
// 2. Handle incoming messages (user_text, user_audio, perception, vad_start, vad_end)
// 3. Stream responses back (audio_chunk, word_timing, expression, gesture, emotion)
```

### 2. Avatar Orchestrator (`server/orchestrator.js`)

Full conversation pipeline per session:

```javascript
class AvatarOrchestrator {
  constructor(ws, config) {
    this.ws = ws;                    // WebSocket to browser
    this.cogCoreUrl = config.cogCoreUrl;
    this.messages = [];               // Conversation history
    this.consciousness = null;        // Last known consciousness state
  }

  async handleUserText(text) {
    // 1. Add user message to history
    this.messages.push({ role: 'user', content: text });

    // 2. Call AXIOM cognitive core
    const response = await fetch(`${this.cogCoreUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: this.messages,
        model: 'anthropic',
        stream: false,
      }),
    });
    const data = await response.json();
    const assistantText = data.choices[0].message.content;

    // 3. Get consciousness state
    const brainRes = await fetch(`${this.cogCoreUrl}/brain`);
    this.consciousness = await brainRes.json();

    // 4. Get momentum state
    const momRes = await fetch(`${this.cogCoreUrl}/momentum`);
    const momentum = await momRes.json();

    // 5. Map consciousness → expression
    const expression = mapConsciousnessToExpression(this.consciousness);
    this.ws.send(JSON.stringify({ type: 'expression', blendShapes: expression }));

    // 6. Select gesture
    const gesture = selectGesture(this.consciousness, assistantText);
    this.ws.send(JSON.stringify({ type: 'gesture', animation: gesture, intensity: 0.8, transition: 0.3 }));

    // 7. Send emotion
    this.ws.send(JSON.stringify({
      type: 'emotion',
      emotion: this.consciousness.emotion?.primary || 'neutral',
      intensity: this.consciousness.emotion?.intensity || 0.5,
    }));

    // 8. Stream TTS
    this.ws.send(JSON.stringify({ type: 'speaking_start', text: assistantText }));

    await streamTTS(
      assistantText,
      process.env.ELEVENLABS_VOICE_ID,
      process.env.ELEVENLABS_API_KEY,
      (audioChunk) => {
        this.ws.send(JSON.stringify({ type: 'audio_chunk', data: audioChunk, format: 'pcm_16000' }));
      },
      (wordTiming) => {
        this.ws.send(JSON.stringify({ type: 'word_timing', ...wordTiming }));
      }
    );

    this.ws.send(JSON.stringify({ type: 'speaking_end' }));

    // 9. Add to history
    this.messages.push({ role: 'assistant', content: assistantText });
  }
}
```

### 3. Expression Mapper (`server/expressionMapper.js`)

Maps AXIOM's consciousness state to 52 ARKit blend shapes:

```javascript
function mapConsciousnessToExpression(consciousness) {
  const shapes = {};
  const emotion = consciousness?.emotion?.primary || 'neutral';
  const intensity = consciousness?.emotion?.intensity || 0.5;

  // Emotion presets (each maps emotion → blend shape values)
  const presets = {
    happy:     { mouthSmileLeft: 0.7, mouthSmileRight: 0.7, cheekSquintLeft: 0.3, cheekSquintRight: 0.3 },
    sad:       { mouthFrownLeft: 0.5, mouthFrownRight: 0.5, browInnerUp: 0.4 },
    surprised: { eyeWideLeft: 0.6, eyeWideRight: 0.6, browOuterUpLeft: 0.5, browOuterUpRight: 0.5, jawOpen: 0.3 },
    concerned: { browInnerUp: 0.5, browDownLeft: 0.2, mouthFrownLeft: 0.2, mouthFrownRight: 0.2 },
    curious:   { browOuterUpLeft: 0.3, browInnerUp: 0.2, eyeWideLeft: 0.15, eyeWideRight: 0.15 },
    excited:   { mouthSmileLeft: 0.8, mouthSmileRight: 0.8, eyeWideLeft: 0.3, eyeWideRight: 0.3 },
    thinking:  { eyeLookUpLeft: 0.3, eyeLookUpRight: 0.3, browDownLeft: 0.15, mouthPucker: 0.1 },
    tender:    { mouthSmileLeft: 0.3, mouthSmileRight: 0.3, eyeSquintLeft: 0.15, eyeSquintRight: 0.15, browInnerUp: 0.1 },
    frustrated:{ browDownLeft: 0.4, browDownRight: 0.4, jawForward: 0.15, mouthPressLeft: 0.2 },
    neutral:   {},
  };

  // Apply preset scaled by intensity
  const preset = presets[emotion] || presets.neutral;
  for (const [shape, value] of Object.entries(preset)) {
    shapes[shape] = value * intensity;
  }

  // Mirror neuron blending — subtle empathy expression
  const mirror = consciousness?.mirror?.currentEmotion;
  if (mirror && mirror !== emotion && presets[mirror]) {
    for (const [shape, value] of Object.entries(presets[mirror])) {
      shapes[shape] = (shapes[shape] || 0) * 0.7 + value * 0.3 * intensity;
    }
  }

  // Psyche micro-expressions
  if (consciousness?.psyche?.fears?.activeFear) {
    shapes.browInnerUp = (shapes.browInnerUp || 0) + 0.12;
    shapes.eyeWideLeft = (shapes.eyeWideLeft || 0) + 0.08;
    shapes.eyeWideRight = (shapes.eyeWideRight || 0) + 0.08;
  }
  if (consciousness?.psyche?.desires?.activeDesire) {
    shapes.mouthSmileLeft = (shapes.mouthSmileLeft || 0) + 0.05;
    shapes.eyeSquintLeft = (shapes.eyeSquintLeft || 0) + 0.05;
    shapes.eyeSquintRight = (shapes.eyeSquintRight || 0) + 0.05;
  }

  // Eye contact — based on RAS attention mode
  const ras = consciousness?.ras?.attentionMode;
  if (ras === 'emotional') {
    // Direct eye contact during emotional moments
    shapes.eyeLookInLeft = 0;
    shapes.eyeLookInRight = 0;
  } else if (ras === 'intellectual') {
    // Slight upward gaze when thinking
    shapes.eyeLookUpLeft = (shapes.eyeLookUpLeft || 0) + 0.15;
    shapes.eyeLookUpRight = (shapes.eyeLookUpRight || 0) + 0.15;
  }

  // Clamp all values to [0, 1]
  for (const key of Object.keys(shapes)) {
    shapes[key] = Math.max(0, Math.min(1, shapes[key]));
  }

  return shapes;
}

module.exports = { mapConsciousnessToExpression };
```

### 4. Gesture Selector (`server/gestureSelector.js`)

```javascript
const GESTURES = {
  // Emotion-driven
  happy: ['excited.fbx', 'nodding.fbx'],
  sad: ['sad.fbx'],
  thinking: ['thinking.fbx'],
  surprised: ['excited.fbx'],
  curious: ['leaning_forward.fbx', 'thinking.fbx'],

  // Content-driven patterns
  question: ['thinking.fbx'],
  agreement: ['nodding.fbx'],
  disagreement: ['shaking_head.fbx'],
  uncertainty: ['shrugging.fbx'],
  greeting: ['waving.fbx'],

  // Defaults
  idle: ['idle.fbx'],
  speaking: ['talking.fbx'],
};

function selectGesture(consciousness, text) {
  const emotion = consciousness?.emotion?.primary || 'neutral';

  // Content patterns
  if (/\?$/.test(text?.trim())) return { animation: 'thinking.fbx', intensity: 0.7, transition: 0.3 };
  if (/^(hey|hi|hello)/i.test(text?.trim())) return { animation: 'waving.fbx', intensity: 0.8, transition: 0.2 };
  if (/yes|agree|exactly|right|definitely/i.test(text)) return { animation: 'nodding.fbx', intensity: 0.7, transition: 0.3 };
  if (/no|disagree|don't think|not really/i.test(text)) return { animation: 'shaking_head.fbx', intensity: 0.6, transition: 0.3 };
  if (/i think|maybe|not sure|hmm|could be/i.test(text)) return { animation: 'shrugging.fbx', intensity: 0.5, transition: 0.4 };

  // Emotion-driven
  if (GESTURES[emotion]) {
    const options = GESTURES[emotion];
    return { animation: options[Math.floor(Math.random() * options.length)], intensity: 0.6, transition: 0.3 };
  }

  // Default speaking
  return { animation: 'talking.fbx', intensity: 0.5, transition: 0.3 };
}

module.exports = { selectGesture };
```

### 5. ElevenLabs Streaming (`server/elevenLabsStream.js`)

```javascript
const WebSocket = require('ws');

function streamTTS(text, voiceId, apiKey, onAudioChunk, onWordTiming) {
  return new Promise((resolve, reject) => {
    const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=eleven_v3&output_format=pcm_16000`;

    const ws = new WebSocket(wsUrl, {
      headers: { 'xi-api-key': apiKey },
    });

    ws.on('open', () => {
      // Initial config
      ws.send(JSON.stringify({
        text: ' ',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        generation_config: { chunk_length_schedule: [120, 160, 250, 290] },
      }));

      // Send text
      ws.send(JSON.stringify({ text, try_trigger_generation: true }));

      // Signal end of text
      ws.send(JSON.stringify({ text: '' }));
    });

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw);

        if (data.audio) {
          onAudioChunk(data.audio);
        }

        if (data.alignment) {
          // Convert character-level timing to word-level
          const words = charsToWords(data.alignment);
          words.forEach(w => onWordTiming(w));
        }

        if (data.isFinal) {
          ws.close();
          resolve();
        }
      } catch (e) {
        console.error('[TTS] Parse error:', e.message);
      }
    });

    ws.on('error', reject);
    ws.on('close', resolve);
  });
}

function charsToWords(alignment) {
  const { chars, charStartTimesMs, charDurationsMs } = alignment;
  if (!chars || !charStartTimesMs) return [];

  const words = [];
  let currentWord = '';
  let wordStart = 0;

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (char === ' ' || i === chars.length - 1) {
      if (i === chars.length - 1 && char !== ' ') currentWord += char;
      if (currentWord.trim()) {
        words.push({
          word: currentWord.trim(),
          start: wordStart / 1000,
          duration: ((charStartTimesMs[i] || 0) - wordStart + (charDurationsMs[i] || 0)) / 1000,
        });
      }
      currentWord = '';
      wordStart = charStartTimesMs[i + 1] || 0;
    } else {
      if (!currentWord) wordStart = charStartTimesMs[i] || 0;
      currentWord += char;
    }
  }

  return words;
}

module.exports = { streamTTS };
```

---

## Frontend Implementation Details

### AvatarScene.tsx — Core TalkingHead Integration

```tsx
// Load TalkingHead from CDN via importmap
// Initialize Three.js scene
// Load GLB avatar model
// Handle incoming WebSocket messages:
//   audio_chunk → buffer and play via speakAudio
//   word_timing → queue for lip-sync
//   expression → apply blend shapes to avatar mesh
//   gesture → trigger Mixamo animation
//   emotion → set avatar mood

// Key API:
// head.showAvatar({ url, body, avatarMood, lipsyncLang })
// head.speakAudio({ audio, words, wtimes, wdurations })
// head.setMood(mood)
// head.playAnimation(animationUrl, options)

// Audio buffering strategy:
// Collect audio chunks and word timings
// When speaking_end received, assemble full audio buffer + timing
// Call head.speakAudio() with complete data
// This gives perfect lip-sync

// Expression updates:
// Apply blend shapes directly to avatar mesh
// Smooth interpolation between states (lerp over 200ms)
// Don't conflict with lip-sync blend shapes (jaw, mouth)
```

### AudioCapture.tsx — Microphone + VAD

```tsx
// Web Audio API AudioWorklet for real-time audio processing
// Energy-based Voice Activity Detection:
//   Calculate RMS energy per frame (128 samples)
//   Speech threshold: energy > 0.01 for 3+ consecutive frames
//   Silence threshold: energy < 0.005 for 15+ frames (300ms)
// When speech starts: send vad_start to server
// During speech: stream audio chunks (PCM 16kHz) every 200ms
// When speech ends: send vad_end to server
// Whisper STT: either browser-side (transformers.js) or server-side
// For Phase 1: send audio to server, use OpenAI Whisper API
```

### PerceptionCapture.tsx — MediaPipe

```tsx
// @mediapipe/face_mesh — 468 facial landmarks
// @mediapipe/holistic — body pose (33 keypoints)
// Process at 10 FPS to save CPU
// Extract:
//   emotion — map landmark distances to basic emotions
//   gaze direction — from iris landmarks
//   head pose — from face mesh rotation
//   engagement — from body posture (leaning forward/back)
// Send to server every 500ms via WebSocket
```

---

## Environment Variables

### Avatar Service (Railway)
```
ELEVENLABS_API_KEY=<key>
ELEVENLABS_VOICE_ID=4tRn1lSkEn13EVTuqb0g
COGNITIVE_CORE_URL=https://axiom-cognitive-core-production.up.railway.app
PORT=8080
```

### Frontend (Vercel)
```
NEXT_PUBLIC_AVATAR_WS_URL=wss://axiom-avatar-production.up.railway.app/ws
```

---

## What Claude Code Should Do

1. Read this PRD
2. Build backend first (server/), test with curl/wscat
3. Build frontend (client/), test with local dev server
4. Use a placeholder cube or simple mesh if no GLB model available
5. Get the full pipeline working: speak → cognitive core → TTS → lip-sync → expression → gesture
6. Deploy backend to Railway, frontend to Vercel

**Build order:**
1. `server/package.json` + `server/index.js` (Express + WS)
2. `server/elevenLabsStream.js` (TTS streaming)
3. `server/expressionMapper.js` (blend shapes)
4. `server/gestureSelector.js` (animations)
5. `server/orchestrator.js` (full pipeline)
6. `server/Dockerfile`
7. `client/` Next.js app with TalkingHead
8. Integration test

**CRITICAL:**
- TalkingHead loaded from CDN, not npm (it's a browser-only ES module)
- ElevenLabs uses WebSocket streaming API, NOT REST API
- Audio format: PCM 16kHz mono
- Avatar model needs ARKit + Oculus OVR blend shapes
- All WebSocket messages are JSON
- Frontend must handle reconnection
