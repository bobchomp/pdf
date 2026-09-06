"use client";

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  if (!audioContext) audioContext = new Ctor();
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

/**
 * Synthesizes a short paper "whoosh" instead of shipping an audio file — avoids bundling (and
 * needing a license for) someone else's sound effect. A burst of filtered noise with a quick
 * attack and short decay reads as a page flip; called from a real user gesture (a flip), so it
 * isn't blocked by autoplay restrictions.
 */
export function playPageFlipSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const duration = 0.28;
  const sampleCount = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.Q.value = 0.7;
  bandpass.frequency.setValueAtTime(2400, ctx.currentTime);
  bandpass.frequency.exponentialRampToValueAtTime(700, ctx.currentTime + duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.45, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  noise.connect(bandpass);
  bandpass.connect(gain);
  gain.connect(ctx.destination);

  noise.start();
  noise.stop(ctx.currentTime + duration);
}
