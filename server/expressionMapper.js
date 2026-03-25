function mapConsciousnessToExpression(consciousness) {
  const shapes = {};
  const emotion = consciousness?.emotion?.primary || 'neutral';
  const intensity = consciousness?.emotion?.intensity || 0.5;

  const presets = {
    happy: {
      mouthSmileLeft: 0.7, mouthSmileRight: 0.7,
      cheekSquintLeft: 0.3, cheekSquintRight: 0.3,
    },
    sad: {
      mouthFrownLeft: 0.5, mouthFrownRight: 0.5,
      browInnerUp: 0.4,
    },
    surprised: {
      eyeWideLeft: 0.6, eyeWideRight: 0.6,
      browOuterUpLeft: 0.5, browOuterUpRight: 0.5,
      jawOpen: 0.3,
    },
    concerned: {
      browInnerUp: 0.5, browDownLeft: 0.2,
      mouthFrownLeft: 0.2, mouthFrownRight: 0.2,
    },
    curious: {
      browOuterUpLeft: 0.3, browInnerUp: 0.2,
      eyeWideLeft: 0.15, eyeWideRight: 0.15,
    },
    excited: {
      mouthSmileLeft: 0.8, mouthSmileRight: 0.8,
      eyeWideLeft: 0.3, eyeWideRight: 0.3,
    },
    thinking: {
      eyeLookUpLeft: 0.3, eyeLookUpRight: 0.3,
      browDownLeft: 0.15, mouthPucker: 0.1,
    },
    tender: {
      mouthSmileLeft: 0.3, mouthSmileRight: 0.3,
      eyeSquintLeft: 0.15, eyeSquintRight: 0.15,
      browInnerUp: 0.1,
    },
    frustrated: {
      browDownLeft: 0.4, browDownRight: 0.4,
      jawForward: 0.15, mouthPressLeft: 0.2,
    },
    neutral: {},
  };

  // Apply preset scaled by intensity
  const preset = presets[emotion] || presets.neutral;
  for (const [shape, value] of Object.entries(preset)) {
    shapes[shape] = value * intensity;
  }

  // Mirror neuron blending
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

  // Eye contact based on RAS attention mode
  const ras = consciousness?.ras?.attentionMode;
  if (ras === 'emotional') {
    shapes.eyeLookInLeft = 0;
    shapes.eyeLookInRight = 0;
  } else if (ras === 'intellectual') {
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
