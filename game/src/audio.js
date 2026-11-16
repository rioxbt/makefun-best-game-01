// The game's sound: every noise is synthesised here from oscillators and a little noise, so the
// entry ships no audio files and loads nothing over the network. Nothing is created until the
// player's first gesture (browsers refuse to start audio before one), and every call is safe when
// the browser has no Web Audio at all: the game simply stays silent.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let failed = false;

  function ensure() {
    if (failed) return null;
    if (context !== null) return context;
    const Ctor = window.AudioContext ?? window.webkitAudioContext;
    if (typeof Ctor !== 'function') {
      failed = true;
      return null;
    }
    try {
      context = new Ctor();
      master = context.createGain();
      master.gain.value = 0.42;
      master.connect(context.destination);
    } catch {
      failed = true;
      context = null;
      return null;
    }
    return context;
  }

  /** One shaped tone: a frequency glide, an envelope and an optional detuned second voice. */
  function tone({ from, to = from, type = 'sine', attack = 0.005, hold = 0.06, decay = 0.14, gain = 0.5, delay = 0 }) {
    const ctx = ensure();
    if (ctx === null || muted) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const at = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, from), at);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + attack + hold + decay);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + attack);
    env.gain.setTargetAtTime(0.0001, at + attack + hold, decay * 0.35);
    osc.connect(env);
    env.connect(master);
    osc.start(at);
    osc.stop(at + attack + hold + decay + 0.08);
  }

  /** A short burst of filtered noise: the body of the impacts. */
  function noise({ duration = 0.16, gain = 0.35, cutoff = 900, delay = 0 }) {
    const ctx = ensure();
    if (ctx === null || muted) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const at = ctx.currentTime + delay;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) channel[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, at);
    env.gain.setTargetAtTime(0.0001, at, duration * 0.3);
    source.connect(filter);
    filter.connect(env);
    env.connect(master);
    source.start(at);
  }

  return {
    /** Wake the audio up on the player's first gesture; call it from every confirm. */
    resume() {
      const ctx = ensure();
      if (ctx !== null && ctx.state === 'suspended') void ctx.resume();
    },
    get muted() {
      return muted;
    },
    /** Mute or unmute; returns the new state. */
    toggleMute() {
      muted = !muted;
      if (!muted) tone({ from: 660, to: 880, type: 'triangle', gain: 0.28 });
      return muted;
    },
    /** A shade turned away: the pitch climbs with the combo, so a chain sings. */
    deflect(combo) {
      const step = Math.min(7, Math.max(0, combo - 1));
      const from = 430 * 2 ** (step * 0.14);
      tone({ from, to: from * 1.5, type: 'triangle', hold: 0.03, decay: 0.11, gain: 0.3 });
      noise({ duration: 0.09, gain: 0.2, cutoff: 2400 });
    },
    /** A husk bursting into shards. */
    burst() {
      tone({ from: 210, to: 90, type: 'square', hold: 0.05, decay: 0.2, gain: 0.24 });
      noise({ duration: 0.24, gain: 0.3, cutoff: 700 });
    },
    /** A mote broken on the shield: a small, flat knock. */
    shatter() {
      tone({ from: 520, to: 300, type: 'square', hold: 0.02, decay: 0.09, gain: 0.16 });
    },
    /** A mote reaching the lantern: a warm chime that rises with the combo. */
    mote(combo) {
      const step = Math.min(7, Math.max(0, combo - 1));
      const base = 740 * 2 ** (step * 0.1);
      tone({ from: base, to: base * 1.02, type: 'sine', attack: 0.008, hold: 0.05, decay: 0.5, gain: 0.26 });
      tone({ from: base * 1.5, to: base * 1.5, type: 'sine', hold: 0.03, decay: 0.3, gain: 0.12, delay: 0.04 });
    },
    /** A shade reaching the lantern: a low thud and a wash of noise. */
    damage() {
      tone({ from: 180, to: 60, type: 'sine', hold: 0.08, decay: 0.42, gain: 0.5 });
      noise({ duration: 0.4, gain: 0.4, cutoff: 420 });
    },
    /** A wave cleared: a two-note bell. */
    wave() {
      tone({ from: 523, to: 523, type: 'triangle', hold: 0.08, decay: 0.6, gain: 0.3 });
      tone({ from: 784, to: 784, type: 'triangle', hold: 0.08, decay: 0.7, gain: 0.24, delay: 0.09 });
    },
    /** The run lost: the lantern going out, sliding down. */
    out() {
      tone({ from: 320, to: 50, type: 'sine', attack: 0.02, hold: 0.2, decay: 1.5, gain: 0.42 });
      noise({ duration: 1.2, gain: 0.22, cutoff: 260 });
    },
    /** The run won: the reef waking, a small rising arpeggio. */
    dawn() {
      const notes = [523, 659, 784, 1046, 1318];
      notes.forEach((f, i) => tone({ from: f, to: f, type: 'triangle', hold: 0.06, decay: 0.7, gain: 0.24, delay: i * 0.12 }));
    },
  };
}
