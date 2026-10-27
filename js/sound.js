// Sound effects, synthesized with Web Audio: no files to download or cache. One set per theme.

/** @typedef {'tap'|'flag'|'wrong'|'boom'|'won'|'flawless'} Moment */

const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
let ac = null;

/** Call from a user gesture: browsers (iOS above all) only start or resume audio inside one. */
export function unlockAudio() {
  if (!AC) return;
  ac ??= new AC();
  if (ac.state !== 'running') ac.resume().catch(() => {});
}

function tone({ f, f2 = f, type = 'sine', t = 0, d = .1, v = .2 }) {
  const s = ac.currentTime + t, o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, s);
  if (f2 !== f) o.frequency.exponentialRampToValueAtTime(f2, s + d);
  g.gain.setValueAtTime(v, s);
  g.gain.exponentialRampToValueAtTime(.0001, s + d);
  o.connect(g).connect(ac.destination);
  o.start(s); o.stop(s + d + .05);
}

function noise({ d = .4, v = .5, f = 1000, f2, filter = 'lowpass', q = 1 }) {
  const s = ac.currentTime, len = Math.ceil(ac.sampleRate * d);
  const buf = ac.createBuffer(1, len, ac.sampleRate), data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource(), bq = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = buf; bq.type = filter; bq.Q.value = q;
  bq.frequency.setValueAtTime(f, s);
  if (f2) bq.frequency.exponentialRampToValueAtTime(f2, s + d);
  g.gain.setValueAtTime(v, s);
  g.gain.exponentialRampToValueAtTime(.0001, s + d);
  src.connect(bq).connect(g).connect(ac.destination);
  src.start(s);
}

const arp = (fs, dt, type, v, d = dt * 3) => fs.forEach((f, k) => tone({ f, type, t: k * dt, d, v }));
// Pitch jumps with no glide, like an old console.
const steps = (fs, dt, v = .07) => fs.forEach((f, k) => tone({ f, type: 'square', t: k * dt, d: dt * 1.1, v }));

/** @type {Record<string, Record<Moment, () => void>>} */
export const SOUNDS = {
  flat: { // soft and clean
    tap: () => tone({ f: 520, f2: 400, d: .07, v: .12 }),
    flag: () => { tone({ f: 660, d: .09, v: .15 }); tone({ f: 990, t: .07, d: .16, v: .15 }); },
    wrong: () => tone({ f: 330, f2: 150, type: 'triangle', d: .35, v: .3 }),
    boom: () => { noise({ d: .7, f: 1400, f2: 120, v: .6 }); tone({ f: 110, f2: 35, d: .6, v: .5 }); },
    won: () => arp([523, 659, 784, 1047], .09, 'sine', .18),
    flawless: () => { arp([523, 659, 784, 1047, 1319, 1568], .08, 'triangle', .18); arp([2093, 2637, 3136, 4186], .06, 'sine', .06, .25); },
  },
  pixel: { // chiptune square waves
    tap: () => tone({ f: 1200, type: 'square', d: .03, v: .05 }),
    flag: () => steps([523, 1047], .06),
    wrong: () => steps([440, 330, 220, 165], .07),
    boom: () => { noise({ d: .6, f: 2500, f2: 200, v: .5 }); steps([98, 82, 65, 55, 49], .08, .1); },
    won: () => steps([523, 659, 784, 1047, 784, 1047], .07),
    flawless: () => steps([523, 523, 523, 698, 880, 1047, 880, 1047, 1397], .085),
  },
  candy: { // bubbly bloops and boings
    tap: () => tone({ f: 380, f2: 950, d: .08, v: .2 }),
    flag: () => { tone({ f: 260, f2: 1300, d: .12, v: .2 }); tone({ f: 1300, f2: 900, t: .11, d: .14, v: .14 }); },
    wrong: () => { tone({ f: 520, f2: 330, type: 'triangle', d: .2, v: .25 }); tone({ f: 440, f2: 200, type: 'triangle', t: .2, d: .32, v: .25 }); },
    boom: () => { noise({ d: .35, f: 700, filter: 'bandpass', q: .8, v: .9 }); tone({ f: 220, f2: 55, d: .4, v: .35 }); tone({ f: 1800, f2: 3000, t: .05, d: .12, v: .05 }); },
    won: () => { arp([784, 988, 1175, 1568], .1, 'sine', .16, .5); arp([1568, 1976, 2349, 3136], .1, 'sine', .04, .5); },
    flawless: () => { arp([1047, 1319, 1568, 2093, 1568, 2093, 2637], .08, 'sine', .16, .45); arp([2093, 2637, 3136, 4186, 3136, 4186, 5274], .08, 'sine', .04, .45); },
  },
};
SOUNDS.contrast = SOUNDS.flat; // high contrast is about looks; it keeps Flat's voice

/** Plays `moment` in `theme`'s voice. Silent until unlockAudio has run in a user gesture. */
export function playSound(theme, moment) {
  if (ac?.state === 'running') SOUNDS[theme]?.[moment]?.();
}
