// Every tuning number, colour and name in one place, so the rules, the drawing and the
// screenshot staging all agree: the playfield is a fixed 1280x720 logical area centred on the
// lantern, and the renderer scales it to whatever window it is given, so nothing below depends
// on the screen size.
//
// Lanternkeeper: you hold a rotating bloom of light (the shield) around the last lantern on the
// abyssal shelf. Everything that comes out of the dark wants the light: shades that drink it are
// turned away with the shield, plankton motes that feed it are let through. Keep the lantern lit
// through twelve waves and the reef wakes.

export const FIELD = { width: 1280, height: 720, cx: 640, cy: 360 };

/** The simulation's fixed step: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The lantern at the centre: its radius, its light, and what a shade takes from it. */
export const CORE = {
  radius: 34,
  lightMax: 100,
  lightStart: 100,
  /** Light below this fraction of the maximum changes the arena: the reef dims and the lantern guttering. */
  dimBelow: 0.3,
  dimAt: 0.55,
};

/** The shield: a bloom of light that turns around the lantern. */
export const SHIELD = {
  /** Where it sits: a band of light this far from the lantern's centre. */
  radius: 196,
  /** Half its width, in radians: a 38-degree arc, wide enough to catch a volley, narrow enough to miss one. */
  halfWidth: 0.33,
  /** How thick the bloom is, in pixels: a shade that slipped past the rim is still caught inside this
   *  band, so a volley swung at a moment late is answered rather than lost. */
  grip: 46,
  /** How fast it swings, in radians a second, when the player steers with the keyboard. */
  turnSpeed: 6.4,
  /** How fast it follows the pointer, in radians a second: a snappy but visible slew, never a teleport. */
  pointerSpeed: 11.5,
};

/** Where things come from: the dark, this far from the lantern. */
export const ENTITY = {
  spawnRadius: 610,
  poolSize: 224,
};

/** Plankton motes: they drift slowly in and the lantern feeds on them. Let them through. */
export const MOTE = {
  radius: 8,
  speed: 62,
  speedJitter: 18,
  interval: 2.7,
  intervalJitter: 1.5,
  /** What reaching the lantern gives back. */
  light: 12,
  score: 25,
  /** What breaking one on the shield gives: a little score, no light. */
  shatterScore: 2,
};

/** The combo: turns away chains of shades before it lapses. */
export const COMBO = { window: 2.6, max: 8 };

/** The shades: four kinds, each with its own temperament. An array indexed by the KIND_* below. */
export const KIND_DRIFTER = 0;
export const KIND_DARTER = 1;
export const KIND_SPINNER = 2;
export const KIND_HUSK = 3;
export const KIND_MOTE = 4;

export const ENEMY = [
  {
    name: 'drifter',
    radius: 15,
    speed: 88,
    speedPerWave: 4.2,
    /** Light the lantern loses when one reaches it. */
    drain: 20,
    score: 10,
    /** Angular jitter of its bearing inside a volley, in radians. */
    spread: 0.13,
  },
  {
    name: 'darter',
    radius: 12,
    speed: 186,
    speedPerWave: 6,
    drain: 26,
    score: 20,
    spread: 0.1,
  },
  {
    name: 'spinner',
    radius: 16,
    speed: 112,
    speedPerWave: 5,
    drain: 22,
    score: 15,
    spread: 0.16,
    /** It weaves: a lateral sway, radians of bearing and radians a second. */
    sway: 0.5,
    swayRate: 3.1,
  },
  {
    name: 'husk',
    radius: 20,
    speed: 96,
    speedPerWave: 4,
    drain: 24,
    score: 25,
    spread: 0.15,
    /** Turned away, it bursts into this many smaller shades that keep coming. */
    shards: 2,
    shardSpread: 0.4,
    shardSpeedScale: 1.25,
    /** Each shard is thrown a touch further out than the last, so the two do not land together. */
    shardGap: 34,
    shardRadius: 11,
    shardDrain: 12,
    shardScore: 8,
  },
];

/** The waves: twelve of them, and the calm between. */
export const WAVES = {
  count: 12,
  /** Seconds of quiet before the first volley and between waves. */
  calmSeconds: 3.4,
  firstCalm: 2.8,
  /** Score for clearing a wave: base per wave, plus more for a wave taken without a scratch. */
  clearBonus: 120,
  flawlessBonus: 170,
  /** Light handed back when a wave is cleared. */
  lightRestore: 22,
  /** How many volleys a wave sends, and how far apart: both grow with the wave. Volleys are spaced
   *  by when they reach the shield, not when they leave the dark, so a wave cannot hand the player
   *  two volleys from opposite sides in the same instant: the fastest whole turn is ~0.5 s and a
   *  volley is always at least this far behind the one before it. */
  burstsBase: 2,
  burstsPerWave: 0.7,
  burstsMax: 9,
  windowBase: 11,
  windowPerWave: 1.35,
  windowMax: 26,
  /** How many shades in a volley, and how the volley is shaped. A volley is a fan narrower than the
   *  shield's own arc, so one well-aimed turn answers the whole thing, and each shade in it is set a
   *  little further out than the last so the volley lands as a short stream rather than all at once. */
  volleyBase: 1,
  volleyPerWave: 0.22,
  volleyMax: 4,
  fanStep: 0.095,
  fanJitter: 0.025,
  fanGap: 24,
  /** Seconds of warning before a volley leaves the dark: a rift glows at its bearing. */
  telegraph: 0.85,
  /** A late wave sometimes sends a companion volley this long after the first arrives, a little off
   *  its bearing: one more turn of the shield, never a second volley nobody could answer. */
  companionFromWave: 9,
  companionChance: 0.25,
  companionDelay: 1.15,
  companionOffset: 0.5,
};

export const PALETTE = {
  /** The abyss: a vertical gradient, drawn as two stops. */
  deepTop: '#02040a',
  deepBottom: '#0a1522',
  /** The light the lantern throws: a soft radial wash over the arena. */
  lanternWash: 'rgba(255, 214, 132, 0.10)',
  ring: '#12213a',
  ringLit: '#1d3252',
  speck: '#2b4a6e',
  core: '#ffd66b',
  coreHot: '#fff6da',
  shield: '#5ef0e0',
  shieldDim: '#2b7d78',
  mote: '#ffce6a',
  drifter: '#93a9c4',
  darter: '#ff5470',
  spinner: '#b98cff',
  husk: '#8fd25a',
  rift: '#ff8f6b',
  text: '#e9f1f8',
  muted: '#7f90a8',
  panel: 'rgba(6, 12, 22, 0.88)',
  panelEdge: '#213650',
  good: '#5ef0e0',
  bad: '#ff5470',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'lanternkeeper.best';
