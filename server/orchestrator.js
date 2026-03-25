const { streamTTS } = require('./elevenLabsStream');
const { mapConsciousnessToExpression } = require('./expressionMapper');
const { selectGesture } = require('./gestureSelector');
const { processPerception } = require('./perceptionHandler');

class AvatarOrchestrator {
  constructor(ws, config) {
    this.ws = ws;
    this.cogCoreUrl = config.cogCoreUrl;
    this.messages = [];
    this.consciousness = null;
    this.perception = null;
    this.isProcessing = false;
  }

  send(msg) {
    if (this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  async handleUserText(text) {
    if (this.isProcessing) {
      this.send({ type: 'error', message: 'Still processing previous message' });
      return;
    }

    this.isProcessing = true;
    console.log('[Orchestrator] Processing:', text.substring(0, 80));

    try {
      // 1. Add user message
      this.messages.push({ role: 'user', content: text });

      // 2. Call cognitive core
      let assistantText;
      try {
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
        assistantText = data.choices?.[0]?.message?.content || 'I hear you, but I need a moment to gather my thoughts.';
      } catch (e) {
        console.error('[Orchestrator] Cognitive core error:', e.message);
        assistantText = "I'm having trouble connecting to my cognitive core right now. Let me try to respond simply — " + this.generateFallbackResponse(text);
      }

      // 3. Get consciousness state
      try {
        const brainRes = await fetch(`${this.cogCoreUrl}/brain`);
        this.consciousness = await brainRes.json();
      } catch (e) {
        console.log('[Orchestrator] Could not fetch consciousness, using defaults');
        this.consciousness = { emotion: { primary: 'neutral', intensity: 0.5 } };
      }

      // 4. Map consciousness to expression
      const expression = mapConsciousnessToExpression(this.consciousness);
      this.send({ type: 'expression', blendShapes: expression });

      // 5. Select gesture
      const gesture = selectGesture(this.consciousness, assistantText);
      this.send({ type: 'gesture', ...gesture });

      // 6. Send emotion
      this.send({
        type: 'emotion',
        emotion: this.consciousness.emotion?.primary || 'neutral',
        intensity: this.consciousness.emotion?.intensity || 0.5,
      });

      // 7. Stream TTS
      this.send({ type: 'speaking_start', text: assistantText });

      await streamTTS(
        assistantText,
        process.env.ELEVENLABS_VOICE_ID,
        process.env.ELEVENLABS_API_KEY,
        (audioChunk) => {
          this.send({ type: 'audio_chunk', data: audioChunk, format: 'pcm_16000' });
        },
        (wordTiming) => {
          this.send({ type: 'word_timing', ...wordTiming });
        }
      );

      this.send({ type: 'speaking_end' });

      // 8. Add to history
      this.messages.push({ role: 'assistant', content: assistantText });
    } catch (e) {
      console.error('[Orchestrator] Pipeline error:', e.message);
      this.send({ type: 'error', message: 'Pipeline error: ' + e.message });
    } finally {
      this.isProcessing = false;
    }
  }

  async handleUserAudio(audioData) {
    // For Phase 1: forward to Whisper API for transcription
    // Then process as text
    console.log('[Orchestrator] Audio received, length:', audioData?.length || 0);
    // TODO: Integrate Whisper STT
    this.send({ type: 'info', message: 'Audio input not yet supported — use text input' });
  }

  handlePerception(data) {
    this.perception = processPerception(data);
    // Send processed perception back so frontend can display engagement metrics
    this.send({ type: 'perception_processed', data: this.perception });
  }

  handleVADStart() {
    console.log('[Orchestrator] VAD: speech started');
    this.send({ type: 'listening', active: true });
  }

  handleVADEnd() {
    console.log('[Orchestrator] VAD: speech ended');
    this.send({ type: 'listening', active: false });
  }

  generateFallbackResponse(text) {
    if (/\?/.test(text)) return "That's a great question. Let me think about that.";
    if (/hello|hi|hey/i.test(text)) return 'Hello! Nice to meet you.';
    return "I understand. Tell me more about that.";
  }

  cleanup() {
    console.log('[Orchestrator] Session cleanup');
    this.messages = [];
    this.consciousness = null;
  }
}

module.exports = { AvatarOrchestrator };
