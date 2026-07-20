import type { Finish } from "@/lib/scoring/types";

// Synthesized reveal chimes — dependency-free, same philosophy as lib/confetti.ts
// (no bundled audio assets, no audio library). A single shared AudioContext is
// reused across calls; oscillator nodes are scheduled and torn down per chime.

const MUTE_KEY = "gitfut:muted";

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    if (!ctx) ctx = new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {}
}

// Plays one note: a short envelope on a single oscillator, starting `delay`
// seconds from now.
function playNote(audio: AudioContext, freq: number, delay: number, duration: number, type: OscillatorType, peak: number): void {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = audio.currentTime + delay;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// Rare tiers (totw/toty/icon/founder) get a brighter ascending arpeggio; every
// other tier gets a single short "pop" — see lib/reveal.ts for which finishes
// reach the "burst" phase.
export function playRevealChime(finish: Finish, burst: boolean): void {
  if (isMuted()) return;
  const audio = getContext();
  if (!audio) return;

  try {
    if (burst) {
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, i) => playNote(audio, freq, i * 0.09, 0.35, "triangle", 0.09));
    } else {
      playNote(audio, 440, 0, 0.15, "triangle", 0.06);
    }
  } catch {
    // Autoplay/policy restrictions or a torn-down context — never break the reveal.
  }
}
