function processPerception(data) {
  const result = {
    emotion: 'neutral',
    engagement: 0.5,
    gazeDirection: { x: 0, y: 0 },
    headPose: { pitch: 0, yaw: 0, roll: 0 },
    timestamp: Date.now(),
  };

  if (!data) return result;

  // Process facial landmarks for emotion detection
  if (data.faceLandmarks) {
    result.emotion = estimateEmotion(data.faceLandmarks);
  }

  // Process gaze direction from iris landmarks
  if (data.irisLandmarks) {
    result.gazeDirection = estimateGaze(data.irisLandmarks);
  }

  // Process head pose
  if (data.headPose) {
    result.headPose = {
      pitch: data.headPose.pitch || 0,
      yaw: data.headPose.yaw || 0,
      roll: data.headPose.roll || 0,
    };
  }

  // Engagement from body posture
  if (data.bodyPose) {
    result.engagement = estimateEngagement(data.bodyPose);
  }

  return result;
}

function estimateEmotion(landmarks) {
  if (!landmarks || landmarks.length < 468) return 'neutral';

  // Simplified emotion from landmark distances
  // Mouth openness (landmarks 13, 14 — upper/lower lip)
  const mouthOpen = landmarks[14] && landmarks[13]
    ? Math.abs(landmarks[14].y - landmarks[13].y)
    : 0;

  // Brow raise (landmarks 70, 300 — inner brow vs eye)
  const browRaise = landmarks[70] && landmarks[159]
    ? Math.abs(landmarks[70].y - landmarks[159].y)
    : 0;

  // Mouth corners (landmarks 61, 291)
  const mouthCornerDiff = landmarks[61] && landmarks[291] && landmarks[13]
    ? ((landmarks[61].y + landmarks[291].y) / 2) - landmarks[13].y
    : 0;

  if (mouthOpen > 0.05) return 'surprised';
  if (mouthCornerDiff < -0.02) return 'happy';
  if (mouthCornerDiff > 0.02) return 'sad';
  if (browRaise > 0.04) return 'curious';

  return 'neutral';
}

function estimateGaze(irisLandmarks) {
  if (!irisLandmarks) return { x: 0, y: 0 };

  // Simplified gaze from iris position relative to eye bounds
  return {
    x: irisLandmarks.normalizedX || 0,
    y: irisLandmarks.normalizedY || 0,
  };
}

function estimateEngagement(bodyPose) {
  if (!bodyPose) return 0.5;

  // Leaning forward = higher engagement
  // Shoulders (landmarks 11, 12) z-depth indicates lean
  const shoulderZ = bodyPose.shoulderDepth || 0;

  // Normalize to 0-1 range: leaning forward (negative z) = high engagement
  return Math.max(0, Math.min(1, 0.5 - shoulderZ * 2));
}

module.exports = { processPerception };
