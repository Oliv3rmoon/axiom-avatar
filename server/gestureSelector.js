const GESTURES = {
  happy: ['excited.fbx', 'nodding.fbx'],
  sad: ['sad.fbx'],
  thinking: ['thinking.fbx'],
  surprised: ['excited.fbx'],
  curious: ['leaning_forward.fbx', 'thinking.fbx'],
  excited: ['excited.fbx'],
  tender: ['nodding.fbx'],
  frustrated: ['shaking_head.fbx'],
  concerned: ['thinking.fbx', 'leaning_forward.fbx'],
  idle: ['idle.fbx'],
  speaking: ['talking.fbx'],
};

function selectGesture(consciousness, text) {
  const emotion = consciousness?.emotion?.primary || 'neutral';

  // Content patterns
  if (/\?$/.test(text?.trim()))
    return { animation: 'thinking.fbx', intensity: 0.7, transition: 0.3 };
  if (/^(hey|hi|hello)/i.test(text?.trim()))
    return { animation: 'waving.fbx', intensity: 0.8, transition: 0.2 };
  if (/yes|agree|exactly|right|definitely/i.test(text))
    return { animation: 'nodding.fbx', intensity: 0.7, transition: 0.3 };
  if (/no|disagree|don't think|not really/i.test(text))
    return { animation: 'shaking_head.fbx', intensity: 0.6, transition: 0.3 };
  if (/i think|maybe|not sure|hmm|could be/i.test(text))
    return { animation: 'shrugging.fbx', intensity: 0.5, transition: 0.4 };

  // Emotion-driven
  if (GESTURES[emotion]) {
    const options = GESTURES[emotion];
    return {
      animation: options[Math.floor(Math.random() * options.length)],
      intensity: 0.6,
      transition: 0.3,
    };
  }

  // Default speaking
  return { animation: 'talking.fbx', intensity: 0.5, transition: 0.3 };
}

module.exports = { selectGesture };
