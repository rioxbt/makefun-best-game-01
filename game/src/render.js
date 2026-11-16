// The scene: the abyss, the lantern, the shades coming for it, the shield, and the panels and HUD
// the player reads. State in, pixels out: this file never changes a rule, it only shows one, so the
// field can be staged for a screenshot without the renderer knowing.
//
// The whole scene is painted in a fixed 1280x720 field and the context is scaled to fit the window,
// so nothing here depends on the size of the window it lands in. Text sits at the top and the bottom
// of the field and the water keeps the middle, so the lantern and the shield are never hidden by the
// thing that describes them.
import { COMBO, CORE, ENTITY, FIELD, KIND_DARTER, KIND_DRIFTER, KIND_HUSK, KIND_MOTE, KIND_SPINNER, PALETTE, SHIELD, WAVES } from './config.js';
import { createPainter, withAlpha } from './draw.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const TAU = Math.PI * 2;

/** The shades' outlines, at radius 1: scaled to each shade's own size and turned to face inward. */
const SHAPES = {
  [KIND_DRIFTER]: [[1.05, 0], [-0.55, 0.85], [-0.15, 0], [-0.55, -0.85]],
  [KIND_DARTER]: [[1.35, 0], [-0.8, 0.55], [-0.25, 0], [-0.8, -0.55]],
  [KIND_SPINNER]: [[1, 0], [0, 1], [-1, 0], [0, -1]],
  [KIND_HUSK]: [[1, 0], [0.5, 0.86], [-0.5, 0.86], [-1, 0], [-0.5, -0.86], [0.5, -0.86]],
};

/** The rings drawn in the water, so the arena reads as a place with depth. */
const RINGS = [286, 424, 562];

/** One lit arc of the shield's band: the bright rim of the bloom, and the soft skirt behind it. */
const SHIELD_SKIRT = 26;
const SHIELD_WIDTH = 9;
/** How high the bottom band of a panel banner stands, and the margin it keeps from the edge. */
const BANNER_MARGIN = 26;
const CONTROL_LINE = 'mouse aims · a d or \u2190 \u2192 swing the shield · space start · p pause · m mute';

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const paint = createPainter(context, FIELD.width, FIELD.height);
  const view = { scale: 1, x: 0, y: 0 };
  const shapeCache = new Map();

  /** The shape scaled to a radius, built once per (kind, radius) pair: nothing here allocates a frame. */
  function shapeFor(kind, radius) {
    const key = `${kind}:${radius}`;
    let points = shapeCache.get(key);
    if (points === undefined) {
      points = SHAPES[kind].map(([x, y]) => [x * radius, y * radius]);
      shapeCache.set(key, points);
    }
    return points;
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const percent = (value) => `${Math.round(value * 100)}%`;
  const thousands = (value) => value.toLocaleString('en-US');

  function drawAbyss(state, lightFraction) {
    paint.gradient(0, 0, FIELD.width, FIELD.height, PALETTE.deepTop, PALETTE.deepBottom);
    // The lantern's own wash: the arena is as bright as the light left in it.
    paint.glow(FIELD.cx, FIELD.cy, 640, PALETTE.core, 0.06 + lightFraction * 0.1);
    for (let i = 0; i < RINGS.length; i += 1) {
      paint.ring(FIELD.cx, FIELD.cy, RINGS[i], 1, withAlpha(PALETTE.ring, 0.75 - i * 0.14));
    }
    paint.ring(FIELD.cx, FIELD.cy, ENTITY.spawnRadius - 24, 1, withAlpha(PALETTE.ring, 0.34));
    const specks = state.specks;
    for (let i = 0; i < specks.length; i += 1) {
      const speck = specks[i];
      const twinkle = 0.5 + 0.5 * Math.sin(speck.phase);
      paint.circle(speck.x, speck.y, speck.size, withAlpha(PALETTE.speck, 0.16 + 0.4 * speck.depth * twinkle));
    }
  }

  /** A volley on its way: a rift glowing at its bearing, brighter as the shade steps through. */
  function drawRifts(state) {
    for (let i = 0; i < state.rifts.length; i += 1) {
      const rift = state.rifts[i];
      if (!rift.active) continue;
      const charge = 1 - rift.timer / WAVES.telegraph;
      const radius = 16 + charge * 20;
      const x = FIELD.cx + Math.cos(rift.angle) * ENTITY.spawnRadius;
      const y = FIELD.cy + Math.sin(rift.angle) * ENTITY.spawnRadius;
      paint.glow(x, y, radius * 2.6, PALETTE.rift, 0.22 + charge * 0.4);
      paint.line(
        x,
        y,
        FIELD.cx + Math.cos(rift.angle) * (SHIELD.radius + 40),
        FIELD.cy + Math.sin(rift.angle) * (SHIELD.radius + 40),
        1.5,
        withAlpha(PALETTE.rift, 0.12 + charge * 0.22),
      );
      if (rift.count > 1) paint.text(`${rift.count}`, x, y - 30, 20, withAlpha(PALETTE.rift, 0.5 + charge * 0.5), 'center', 'middle', '700');
    }
  }

  function drawParticles(state) {
    for (let i = 0; i < state.particles.length; i += 1) {
      const particle = state.particles[i];
      if (!particle.active) continue;
      const life = particle.life / particle.maxLife;
      paint.circle(particle.x, particle.y, particle.size * (0.4 + life * 0.6), withAlpha(particle.color, Math.min(1, life * 1.2)));
    }
  }

  function drawEntities(state) {
    for (let i = 0; i < state.entities.length; i += 1) {
      const entity = state.entities[i];
      if (!entity.active) continue;
      const inward = Math.atan2(FIELD.cy - entity.y, FIELD.cx - entity.x);
      if (entity.kind === KIND_MOTE) {
        paint.glow(entity.x, entity.y, entity.radius * 3.6, PALETTE.mote, 0.42);
        paint.circle(entity.x, entity.y, entity.radius * 0.62, PALETTE.coreHot);
        continue;
      }
      if (entity.kind === KIND_DARTER) {
        // A darter trails its own speed: two ghosts behind it, so it reads as fast.
        const back = Math.atan2(entity.vy, entity.vx);
        for (let ghost = 2; ghost >= 1; ghost -= 1) {
          const off = ghost * 16;
          paint.polygon(
            entity.x - Math.cos(back) * off,
            entity.y - Math.sin(back) * off,
            shapeFor(KIND_DARTER, entity.radius),
            inward,
            withAlpha(PALETTE.darter, 0.12 * (3 - ghost)),
          );
        }
      }
      const color = entity.kind === KIND_DARTER
        ? PALETTE.darter
        : entity.kind === KIND_SPINNER
          ? PALETTE.spinner
          : entity.kind === KIND_HUSK
            ? PALETTE.husk
            : PALETTE.drifter;
      const spin = entity.kind === KIND_SPINNER || entity.kind === KIND_HUSK ? entity.spin : inward;
      const alpha = entity.shard ? 0.72 : 1;
      paint.glow(entity.x, entity.y, entity.radius * 2.6, color, entity.kind === KIND_HUSK ? 0.3 : 0.2);
      paint.polygon(entity.x, entity.y, shapeFor(entity.kind, entity.radius), spin, withAlpha(color, alpha));
      if (entity.kind === KIND_HUSK) {
        paint.polygonOutline(entity.x, entity.y, shapeFor(entity.kind, entity.radius * 1.35), spin, 1.5, withAlpha(PALETTE.husk, 0.45));
      }
      if (entity.kind === KIND_DARTER) paint.circle(entity.x, entity.y, entity.radius * 0.3, PALETTE.coreHot);
    }
  }

  function drawShield(state) {
    const { angle } = state.shield;
    const from = angle - SHIELD.halfWidth;
    const to = angle + SHIELD.halfWidth;
    // The bloom's own thickness first: the part of it that catches a shade which slipped past the rim.
    paint.arcBand(FIELD.cx, FIELD.cy, SHIELD.radius - SHIELD.grip / 2, from, to, SHIELD.grip, withAlpha(PALETTE.shield, 0.08));
    paint.arcBand(FIELD.cx, FIELD.cy, SHIELD.radius, from, to, SHIELD_SKIRT, withAlpha(PALETTE.shield, 0.14));
    paint.arcBand(FIELD.cx, FIELD.cy, SHIELD.radius, from, to, SHIELD_WIDTH, withAlpha(PALETTE.shieldDim, 0.95));
    paint.arcBand(FIELD.cx, FIELD.cy, SHIELD.radius, from + 0.04, to - 0.04, SHIELD_WIDTH * 0.45, PALETTE.shield);
    const noseX = FIELD.cx + Math.cos(angle) * SHIELD.radius;
    const noseY = FIELD.cy + Math.sin(angle) * SHIELD.radius;
    const flash = state.lastDeflect.timer > 0 ? state.lastDeflect.timer / 0.18 : 0;
    paint.glow(noseX, noseY, 26 + flash * 40, PALETTE.shield, 0.3 + flash * 0.5);
    paint.line(
      FIELD.cx + Math.cos(angle) * (CORE.radius + 6),
      FIELD.cy + Math.sin(angle) * (CORE.radius + 6),
      noseX,
      noseY,
      1.5,
      withAlpha(PALETTE.shield, 0.1),
    );
  }

  function drawLantern(state, lightFraction) {
    const pulse = state.corePulse;
    const guttering = lightFraction < CORE.dimBelow ? 0.65 + 0.35 * Math.sin(state.elapsed * 22) : 1;
    paint.glow(FIELD.cx, FIELD.cy, 130 + pulse * 90, PALETTE.core, (0.3 + lightFraction * 0.35 + pulse * 0.3) * guttering);
    paint.circle(FIELD.cx, FIELD.cy, CORE.radius * (1 + pulse * 0.12), withAlpha(PALETTE.core, 0.9));
    paint.circle(FIELD.cx, FIELD.cy, CORE.radius * 0.52, PALETTE.coreHot);
    // The light meter: a ring around the lantern, the way a wick burns down.
    const meter = CORE.radius + 16;
    paint.ring(FIELD.cx, FIELD.cy, meter, 5, withAlpha(PALETTE.ring, 0.85));
    const color = lightFraction > CORE.dimAt ? PALETTE.core : lightFraction > CORE.dimBelow ? PALETTE.rift : PALETTE.bad;
    paint.arcBand(FIELD.cx, FIELD.cy, meter, -Math.PI / 2, -Math.PI / 2 + lightFraction * TAU, 5, color);
  }

  function drawPopups(state) {
    for (let i = 0; i < state.popups.length; i += 1) {
      const popup = state.popups[i];
      if (!popup.active) continue;
      const life = popup.life / 0.9;
      paint.text(popup.text, popup.x, popup.y, 22, withAlpha(popup.color, Math.min(1, life * 1.6)), 'center', 'middle', '700');
    }
  }

  function drawHud(state, best, extras) {
    const lightFraction = state.light / CORE.lightMax;
    paint.text('SCORE', 28, 20, 15, PALETTE.muted, 'left', 'top', '700');
    paint.text(thousands(state.score), 28, 38, 42, PALETTE.text, 'left', 'top', '800');
    paint.text('BEST', FIELD.width - 28, 20, 15, PALETTE.muted, 'right', 'top', '700');
    paint.text(thousands(best), FIELD.width - 28, 38, 42, withAlpha(PALETTE.muted, 0.95), 'right', 'top', '800');
    if (extras.muted === true) paint.text('MUTED', FIELD.width - 28, 92, 15, PALETTE.bad, 'right', 'top', '700');

    // The light bar: how much the lantern has left, and the thing the run turns on.
    const barX = 28;
    const barY = 96;
    const barWidth = 292;
    const barHeight = 18;
    paint.box(barX, barY, barWidth, barHeight, 9, withAlpha(PALETTE.ring, 0.9));
    const barColor = lightFraction > CORE.dimAt ? PALETTE.core : lightFraction > CORE.dimBelow ? PALETTE.rift : PALETTE.bad;
    paint.box(barX, barY, Math.max(2, barWidth * lightFraction), barHeight, 9, withAlpha(barColor, 0.9));
    paint.glow(barX + barWidth * lightFraction, barY + barHeight / 2, 26, barColor, 0.3);
    paint.text(`LIGHT ${percent(lightFraction)}`, barX + barWidth + 12, barY + 1, 17, withAlpha(barColor, 0.95), 'left', 'top', '700');

    if (state.combo > 1) {
      paint.textGlow(`COMBO ×${state.combo}`, barX, barY + 32, 26, PALETTE.good, 'left', 'top', '800');
      const left = Math.max(0, state.comboTimer / COMBO.window);
      paint.box(barX, barY + 64, 132 * left, 5, 2.5, withAlpha(PALETTE.good, 0.7));
    }

    paint.text(`WAVE ${Math.min(state.wave, WAVES.count)} / ${WAVES.count}`, FIELD.width / 2, 22, 32, PALETTE.text, 'center', 'top', '800');
    const dotGap = 16;
    const dotStart = FIELD.width / 2 - ((WAVES.count - 1) * dotGap) / 2;
    for (let i = 0; i < WAVES.count; i += 1) {
      const done = i + 1 < state.wave;
      const now = i + 1 === state.wave;
      paint.circle(dotStart + i * dotGap, 74, now ? 5 : 3.4, done ? PALETTE.good : now ? PALETTE.core : withAlpha(PALETTE.ring, 0.95));
    }

    paint.text(CONTROL_LINE, FIELD.width / 2, FIELD.height - 26, 16, withAlpha(PALETTE.muted, 0.9), 'center', 'top', '600');
  }

  function drawBanner(state) {
    if (state.banner.timer <= 0 || state.banner.title === '') return;
    const alpha = Math.min(1, state.banner.timer * 1.6);
    paint.textGlow(state.banner.title, FIELD.width / 2, 132, 62, withAlpha(PALETTE.text, alpha), 'center', 'top', '800');
    if (state.banner.sub !== '') paint.text(state.banner.sub, FIELD.width / 2, 206, 22, withAlpha(PALETTE.muted, alpha), 'center', 'top', '600');
  }

  /** The dark closing in: the hurt flash, and the arena losing its light as the wick burns down. */
  function drawMood(state, lightFraction) {
    const dim = Math.max(0, (CORE.dimBelow - lightFraction) / CORE.dimBelow);
    paint.vignette(FIELD.cx, FIELD.cy, 260, 780, PALETTE.deepTop, dim * 0.75);
    if (state.damageFlash > 0) paint.vignette(FIELD.cx, FIELD.cy, 240, 760, PALETTE.bad, state.damageFlash * 0.55);
  }

  /**
   * A banner across the foot of the field: a heading, a line under it, then the lines a run's end
   * has to report. It stands at the bottom rather than the middle, so the lantern it is talking
   * about stays in view above it.
   */
  function bannerOf({ heading, sub, lines, prompt, accent, promptAlpha }) {
    const width = 940;
    const x = (FIELD.width - width) / 2;
    const height = 96 + lines.length * 32 + 78;
    const y = FIELD.height - BANNER_MARGIN - height;
    paint.box(x, y, width, height, 18, PALETTE.panel);
    paint.boxOutline(x, y, width, height, 18, 2, withAlpha(PALETTE.panelEdge, 0.95));
    paint.textGlow(heading, FIELD.width / 2, y + 22, 44, accent, 'center', 'top', '800');
    paint.text(sub, FIELD.width / 2, y + 74, 21, withAlpha(PALETTE.muted, 0.98), 'center', 'top', '600');
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      paint.text(line.text, FIELD.width / 2, y + 116 + i * 32, line.size ?? 22, line.color ?? PALETTE.text, 'center', 'top', line.weight ?? '600');
    }
    paint.text(prompt, FIELD.width / 2, y + height - 44, 25, withAlpha(accent, promptAlpha), 'center', 'top', '700');
  }

  /** The title screen: the name and the water across the top, the how-to-play band at the foot. */
  function drawTitle(state, best, promptAlpha) {
    paint.textGlow('LANTERNKEEPER', FIELD.width / 2, 76, 78, PALETTE.core, 'center', 'top', '800');
    paint.text('the last light on the abyss shelf', FIELD.width / 2, 172, 26, withAlpha(PALETTE.muted, 0.98), 'center', 'top', '600');
    paint.text('BEST', FIELD.width - 28, 20, 15, PALETTE.muted, 'right', 'top', '700');
    paint.text(thousands(best), FIELD.width - 28, 38, 40, withAlpha(PALETTE.muted, 0.95), 'right', 'top', '800');

    const width = 1020;
    const x = (FIELD.width - width) / 2;
    const y = 508;
    const height = 186;
    paint.box(x, y, width, height, 18, PALETTE.panel);
    paint.boxOutline(x, y, width, height, 18, 2, withAlpha(PALETTE.panelEdge, 0.9));
    paint.text('Shades come out of the dark for your light \u2014 swing the shield to turn them away.', FIELD.width / 2, y + 22, 23, PALETTE.text, 'center', 'top', '600');
    paint.text('Plankton motes feed the lantern: let them through, and never let one break on the shield.', FIELD.width / 2, y + 56, 21, PALETTE.muted, 'center', 'top', '600');
    paint.text('Hold the lantern through twelve waves. A wave taken without a scratch pays double.', FIELD.width / 2, y + 88, 21, PALETTE.muted, 'center', 'top', '600');
    paint.text(CONTROL_LINE, FIELD.width / 2, y + 122, 17, withAlpha(PALETTE.shield, 0.9), 'center', 'top', '600');
    if (best > 0) paint.text(`your best is ${thousands(best)} \u2014 beat it`, FIELD.width / 2, y + 148, 17, withAlpha(PALETTE.muted, 0.8), 'center', 'top', '600');
    paint.text('press space or click to begin', FIELD.width / 2, y - 46, 30, withAlpha(PALETTE.core, promptAlpha), 'center', 'top', '700');
  }

  const stats = (state, best) => [
    { text: `score ${thousands(state.score)}`, size: 25, weight: '800' },
    { text: `best ${thousands(best)} \u00b7 shades turned away ${state.deflected} \u00b7 best combo ×${Math.max(1, state.bestCombo)}`, color: PALETTE.muted },
  ];

  /**
   * Paint one frame. `screen` is which screen the game is on and `extras` carries what the renderer
   * cannot see in the world: the best score, whether the sound is muted, and where the prompt's
   * pulse is in its cycle.
   */
  function draw(state, screen, best, extras) {
    const lightFraction = state.light / CORE.lightMax;
    const shake = screen === SCREEN_PLAY || screen === SCREEN_PAUSED ? 1 : 0;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.deepTop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(
      view.scale,
      0,
      0,
      view.scale,
      view.x + state.shakeX * view.scale * shake,
      view.y + state.shakeY * view.scale * shake,
    );
    drawAbyss(state, lightFraction);
    drawRifts(state);
    drawParticles(state);
    drawEntities(state);
    drawShield(state);
    drawLantern(state, lightFraction);
    drawPopups(state);
    drawMood(state, lightFraction);

    const promptAlpha = 0.62 + 0.38 * Math.abs(Math.sin(extras.phase * 2.2));

    if (screen === SCREEN_TITLE) {
      drawTitle(state, best, promptAlpha);
      return;
    }

    drawHud(state, best, extras);
    drawBanner(state);
    if (screen === SCREEN_PAUSED) {
      bannerOf({
        heading: 'PAUSED',
        sub: 'the dark waits, and it is patient',
        lines: [
          ...stats(state, best),
          { text: `wave ${Math.min(state.wave, WAVES.count)} of ${WAVES.count} \u00b7 light ${percent(lightFraction)}`, color: PALETTE.muted },
        ],
        prompt: 'press p or space to go on',
        accent: PALETTE.shield,
        promptAlpha,
      });
      return;
    }
    if (screen === SCREEN_OVER) {
      bannerOf({
        heading: 'THE LANTERN GOES DARK',
        sub: `the light went out in wave ${Math.min(state.wave, WAVES.count)}`,
        lines: [
          ...stats(state, best),
          { text: 'Hold the lantern through twelve waves to wake the reef.', color: PALETTE.muted },
        ],
        prompt: 'press space or click to light it again',
        accent: PALETTE.bad,
        promptAlpha,
      });
      return;
    }
    if (screen === SCREEN_WIN) {
      bannerOf({
        heading: 'DAWN BREAKS',
        sub: 'the reef wakes \u2014 you held the last light through the night',
        lines: [
          ...stats(state, best),
          { text: `twelve waves held \u00b7 light left ${percent(lightFraction)}`, color: PALETTE.good },
        ],
        prompt: 'press space or click to keep the light again',
        accent: PALETTE.core,
        promptAlpha,
      });
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
