let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(value: boolean) {
  muted = value;
}

export function unlockAudio() {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
}

function tone(freq: number, when: number, dur: number, type: OscillatorType, gain: number) {
  if (!ctx || muted) return;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.setValueAtTime(gain, when);
  amp.gain.exponentialRampToValueAtTime(0.001, when + dur);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(when);
  osc.stop(when + dur + 0.02);
}

export const sfx = {
  catch() {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    tone(520, t, 0.08, "triangle", 0.07);
    tone(780, t + 0.05, 0.1, "sine", 0.05);
  },
  miss() {
    if (!ctx || muted) return;
    tone(170, ctx.currentTime, 0.18, "sawtooth", 0.04);
  },
  clear() {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    [523, 659, 784].forEach((freq, i) => tone(freq, t + i * 0.08, 0.16, "triangle", 0.06));
  },
  fail() {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    [392, 330, 247].forEach((freq, i) => tone(freq, t + i * 0.1, 0.18, "sine", 0.05));
  },
};
