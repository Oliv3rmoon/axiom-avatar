const WebSocket = require('ws');

function streamTTS(text, voiceId, apiKey, onAudioChunk, onWordTiming) {
  return new Promise((resolve, reject) => {
    if (!apiKey || !voiceId) {
      console.warn('[TTS] No ElevenLabs credentials — sending mock audio');
      onWordTiming({ word: text, start: 0, duration: 1 });
      resolve();
      return;
    }

    const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=eleven_v3&output_format=pcm_16000`;

    const ws = new WebSocket(wsUrl, {
      headers: { 'xi-api-key': apiKey },
    });

    let resolved = false;

    ws.on('open', () => {
      ws.send(JSON.stringify({
        text: ' ',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        generation_config: { chunk_length_schedule: [120, 160, 250, 290] },
      }));

      ws.send(JSON.stringify({ text, try_trigger_generation: true }));
      ws.send(JSON.stringify({ text: '' }));
    });

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw);

        if (data.audio) {
          onAudioChunk(data.audio);
        }

        if (data.alignment) {
          const words = charsToWords(data.alignment);
          words.forEach((w) => onWordTiming(w));
        }

        if (data.isFinal) {
          if (!resolved) {
            resolved = true;
            ws.close();
            resolve();
          }
        }
      } catch (e) {
        console.error('[TTS] Parse error:', e.message);
      }
    });

    ws.on('error', (err) => {
      console.error('[TTS] WebSocket error:', err.message);
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });

    ws.on('close', () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    });

    // Timeout after 30s
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws.close();
        resolve();
      }
    }, 30000);
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
          duration:
            ((charStartTimesMs[i] || 0) - wordStart + (charDurationsMs[i] || 0)) / 1000,
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
