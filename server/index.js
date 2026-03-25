require('dotenv').config();
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { AvatarOrchestrator } = require('./orchestrator');

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'axiom-avatar', timestamp: Date.now() });
});

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  console.log('[WS] Client connected');

  const orchestrator = new AvatarOrchestrator(ws, {
    cogCoreUrl: process.env.COGNITIVE_CORE_URL || 'http://localhost:3001',
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      switch (msg.type) {
        case 'user_text':
          orchestrator.handleUserText(msg.text);
          break;
        case 'user_audio':
          orchestrator.handleUserAudio(msg.data);
          break;
        case 'perception':
          orchestrator.handlePerception(msg.data);
          break;
        case 'vad_start':
          orchestrator.handleVADStart();
          break;
        case 'vad_end':
          orchestrator.handleVADEnd();
          break;
        default:
          console.log('[WS] Unknown message type:', msg.type);
      }
    } catch (e) {
      console.error('[WS] Parse error:', e.message);
    }
  });

  ws.on('close', () => {
    console.log('[WS] Client disconnected');
    orchestrator.cleanup();
  });

  ws.on('error', (err) => {
    console.error('[WS] Error:', err.message);
  });

  // Send initial state
  ws.send(JSON.stringify({ type: 'connected', timestamp: Date.now() }));
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`[AXIOM Avatar] Server running on port ${PORT}`);
  console.log(`[AXIOM Avatar] WebSocket available at ws://localhost:${PORT}/ws`);
  console.log(`[AXIOM Avatar] Health check at http://localhost:${PORT}/health`);
});
