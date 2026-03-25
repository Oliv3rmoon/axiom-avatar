export interface BlendShapes {
  [key: string]: number;
}

export interface GestureCommand {
  animation: string;
  intensity: number;
  transition: number;
}

export interface WordTiming {
  word: string;
  start: number;
  duration: number;
}

export interface EmotionState {
  emotion: string;
  intensity: number;
}

export interface PerceptionData {
  faceLandmarks?: unknown[];
  irisLandmarks?: { normalizedX: number; normalizedY: number };
  headPose?: { pitch: number; yaw: number; roll: number };
  bodyPose?: { shoulderDepth: number };
}

export type ServerMessage =
  | { type: 'connected'; timestamp: number }
  | { type: 'expression'; blendShapes: BlendShapes }
  | { type: 'gesture'; animation: string; intensity: number; transition: number }
  | { type: 'emotion'; emotion: string; intensity: number }
  | { type: 'speaking_start'; text: string }
  | { type: 'audio_chunk'; data: string; format: string }
  | { type: 'word_timing'; word: string; start: number; duration: number }
  | { type: 'speaking_end' }
  | { type: 'listening'; active: boolean }
  | { type: 'error'; message: string }
  | { type: 'info'; message: string }
  | { type: 'perception_processed'; data: unknown };

export type ClientMessage =
  | { type: 'user_text'; text: string }
  | { type: 'user_audio'; data: string }
  | { type: 'perception'; data: PerceptionData }
  | { type: 'vad_start' }
  | { type: 'vad_end' };
