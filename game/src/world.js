// The rules and nothing else: no drawing, no browser, no sound. The lantern at the centre, the
// shield that turns around it, the plankton motes that feed it, the shades that come for it, the
// waves that send them, the combo, the score and the screen shake. step() advances the world one
// fixed step, taking where the player wants the shield, and returns what happened as bit flags, so
// the caller can answer with sound and announcements without the world knowing about either.
//
// Nothing here allocates once createWorld has returned: the shades, motes, rifts, particles and
// score popups all live in pools sized at boot, so a long run never makes the collector work in
// the middle of a volley.
import {
  COMBO,
  CORE,
  ENEMY,
  ENTITY,
  FIELD,
  KIND_DRIFTER,
  KIND_DARTER,
  KIND_HUSK,
  KIND_MOTE,
  KIND_SPINNER,
  MOTE,
  SHIELD,
  WAVES,
} from './config.js';
import { angleDelta, between } from './random.js';

export const EVENT_DEFLECT = 1;
export const EVENT_BURST = 2;
export const EVENT_SHATTER = 4;
export const EVENT_MOTE = 8;
export const EVENT_DAMAGE = 16;
export const EVENT_CLEAR = 32;
export const EVENT_WIN = 64;
export const EVENT_OVER = 128;

const TAU = Math.PI * 2;
/** How long the field holds still when a shade reaches the lantern, in seconds. */
const HIT_STOP = 0.09;
const PARTICLE_POOL = 320;
const POPUP_POOL = 32;
const RIFT_POOL = 16;

/** How long a shade of this kind takes to reach the shield's band from the dark. */
function travelOf(kind, wave) {
  const def = ENEMY[kind];
  return (ENTITY.spawnRadius - SHIELD.radius) / (def.speed + def.speedPerWave * (wave - 1));
}

/**
 * A wave's volleys: when each reaches the shield, where from, what kind and how many. Volleys are
 * spaced by their arrival, and each is put into the water just early enough to land on its slot, so
 * a slow drifter and a fast darter sent a beat apart still arrive a beat apart.
 */
function planWave(wave, random) {
  const bursts = Math.min(WAVES.burstsMax, WAVES.burstsBase + Math.round(WAVES.burstsPerWave * wave));
  const window = Math.min(WAVES.windowMax, WAVES.windowBase + WAVES.windowPerWave * wave);
  const spacing = window / bursts;
  const kinds = [KIND_DRIFTER];
  if (wave >= 2) kinds.push(KIND_DARTER);
  if (wave >= 5) kinds.push(KIND_SPINNER);
  if (wave >= 7) kinds.push(KIND_HUSK);
  const maxCount = Math.min(WAVES.volleyMax, WAVES.volleyBase + Math.round(WAVES.volleyPerWave * wave));
  const pick = () => kinds[Math.min(kinds.length - 1, Math.floor(random() * kinds.length))];
  const plan = [];
  const add = (kind, arrival, angle, count) => {
    plan.push({
      arrival,
      spawnAt: Math.max(0, arrival - travelOf(kind, wave)),
      angle,
      kind,
      count: Math.max(1, Math.min(WAVES.volleyMax, count)),
      wave,
    });
  };
  for (let index = 0; index < bursts; index += 1) {
    const kind = pick();
    // Early waves stay gentle: one shade, one bearing, one at a time.
    const size = wave < 3 ? 1 : 1 + Math.floor(random() * maxCount);
    const arrival = 1.4 + spacing * index + between(random, -0.18, 0.18) * spacing;
    const angle = random() * TAU;
    add(kind, arrival, angle, size);
    if (wave >= WAVES.companionFromWave && random() < WAVES.companionChance) {
      const companionKind = pick();
      add(companionKind, arrival + WAVES.companionDelay, angle + WAVES.companionOffset, 1 + Math.floor(random() * 2));
    }
  }
  plan.sort((a, b) => a.spawnAt - b.spawnAt);
  return plan;
}

export function createWorld(random) {
  const shield = { angle: -Math.PI / 2, target: -Math.PI / 2 };
  const entities = [];
  const rifts = [];
  const particles = [];
  const popups = [];
  const specks = [];

  for (let i = 0; i < ENTITY.poolSize; i += 1) {
    entities.push({ active: false, kind: KIND_DRIFTER, shard: false, x: 0, y: 0, vx: 0, vy: 0, radius: 0, speed: 0, angle: 0, drain: 0, score: 0, swayAmp: 0, swayRate: 0, swayPhase: 0, spin: 0, spinRate: 0 });
  }
  for (let i = 0; i < RIFT_POOL; i += 1) rifts.push({ active: false, angle: 0, timer: 0, kind: KIND_DRIFTER, count: 1 });
  for (let i = 0; i < PARTICLE_POOL; i += 1) particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff' });
  for (let i = 0; i < POPUP_POOL; i += 1) popups.push({ active: false, x: 0, y: 0, life: 0, text: '', color: '#fff' });

  const state = {
    phase: 'calm',       // calm | assault | won | lost
    phaseTimer: 0,
    assaultTime: 0,
    wave: 1,
    plan: [],
    planIndex: 0,
    score: 0,
    light: CORE.lightMax,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    flawless: true,
    deflected: 0,
    elapsed: 0,
    moteTimer: MOTE.interval,
    harmlessSpacers: 0,
    shield,
    entities,
    rifts,
    particles,
    popups,
    specks,
    banner: { title: '', sub: '', timer: 0 },
    shake: 0,
    shakeX: 0,
    shakeY: 0,
    damageFlash: 0,
    hitStop: 0,
    corePulse: 0,
    lastDeflect: { x: FIELD.cx, y: FIELD.cy, timer: 0 },
  };

  function reset() {
    state.phase = 'calm';
    state.phaseTimer = WAVES.firstCalm;
    state.assaultTime = 0;
    state.wave = 1;
    state.plan = planWave(1, random);
    state.planIndex = 0;
    state.score = 0;
    state.light = CORE.lightStart;
    state.combo = 0;
    state.comboTimer = 0;
    state.bestCombo = 0;
    state.flawless = true;
    state.deflected = 0;
    state.elapsed = 0;
    state.moteTimer = MOTE.interval * 0.7;
    state.harmlessSpacers = 0;
    state.banner = { title: '', sub: '', timer: 0 };
    state.shake = 0;
    state.shakeX = 0;
    state.shakeY = 0;
    state.damageFlash = 0;
    state.hitStop = 0;
    state.corePulse = 0;
    state.lastDeflect = { x: FIELD.cx, y: FIELD.cy, timer: 0 };
    shield.angle = -Math.PI / 2;
    shield.target = shield.angle;
    for (const e of entities) e.active = false;
    for (const r of rifts) r.active = false;
    for (const p of particles) p.active = false;
    for (const p of popups) p.active = false;
    specks.length = 0;
    // The plankton in the water, for depth: fixed at boot so a run looks the same twice.
    for (let i = 0; i < 120; i += 1) {
      specks.push({
        x: random() * FIELD.width,
        y: random() * FIELD.height,
        size: 0.7 + random() * 1.9,
        depth: 0.25 + random() * 0.75,
        phase: random() * TAU,
      });
    }
  }

  const takeEntity = () => {
    for (let i = 0; i < entities.length; i += 1) if (!entities[i].active) return entities[i];
    return null;
  };

  function spawnShade(kind, angle, wave, jitterRange) {
    const def = ENEMY[kind];
    const entity = takeEntity();
    if (entity === null) return null;
    const bearing = angle + between(random, -jitterRange, jitterRange);
    const speed = (def.speed + def.speedPerWave * (wave - 1)) * between(random, 0.93, 1.09);
    entity.active = true;
    entity.kind = kind;
    entity.shard = false;
    entity.radius = def.radius;
    entity.drain = def.drain;
    entity.score = def.score;
    entity.angle = bearing;
    entity.speed = speed;
    entity.x = FIELD.cx + Math.cos(bearing) * ENTITY.spawnRadius;
    entity.y = FIELD.cy + Math.sin(bearing) * ENTITY.spawnRadius;
    entity.vx = -Math.cos(bearing) * speed;
    entity.vy = -Math.sin(bearing) * speed;
    entity.swayAmp = (def.sway ?? 0) * speed;
    entity.swayRate = def.swayRate ?? 0;
    entity.swayPhase = random() * TAU;
    entity.spin = random() * TAU;
    entity.spinRate = between(random, -2.4, 2.4);
    return entity;
  }

  /**
   * A husk's shards: two smaller shades thrown clear of the burst and already diving back in, so a
   * husk is a double turn of the shield rather than one. They start just outside the shield's band,
   * where the player can still catch them.
   */
  function spawnShards(husk) {
    const def = ENEMY[KIND_HUSK];
    const heading = Math.atan2(husk.y - FIELD.cy, husk.x - FIELD.cx);
    for (let i = 0; i < def.shards; i += 1) {
      const entity = takeEntity();
      if (entity === null) return;
      const side = i === 0 ? -1 : 1;
      const bearing = heading + side * def.shardSpread;
      const radius = SHIELD.radius + 70 + i * def.shardGap;
      entity.active = true;
      entity.kind = KIND_DRIFTER;
      entity.shard = true;
      entity.radius = def.shardRadius;
      entity.drain = def.shardDrain;
      entity.score = def.shardScore;
      entity.angle = bearing;
      entity.speed = husk.speed * def.shardSpeedScale;
      entity.x = FIELD.cx + Math.cos(bearing) * radius;
      entity.y = FIELD.cy + Math.sin(bearing) * radius;
      entity.vx = -Math.cos(bearing) * entity.speed;
      entity.vy = -Math.sin(bearing) * entity.speed;
      entity.swayAmp = 0;
      entity.swayRate = 0;
      entity.swayPhase = 0;
      entity.spin = random() * TAU;
      entity.spinRate = between(random, -3, 3);
    }
  }

  function spawnMote(angle) {
    const entity = takeEntity();
    if (entity === null) return;
    const bearing = angle ?? random() * TAU;
    const speed = MOTE.speed + between(random, -MOTE.speedJitter, MOTE.speedJitter);
    entity.active = true;
    entity.kind = KIND_MOTE;
    entity.shard = false;
    entity.radius = MOTE.radius;
    entity.drain = 0;
    entity.score = 0;
    entity.angle = bearing;
    entity.speed = speed;
    entity.x = FIELD.cx + Math.cos(bearing) * ENTITY.spawnRadius;
    entity.y = FIELD.cy + Math.sin(bearing) * ENTITY.spawnRadius;
    entity.vx = -Math.cos(bearing) * speed;
    entity.vy = -Math.sin(bearing) * speed;
    entity.swayAmp = 0;
    entity.swayRate = 0;
    entity.swayPhase = random() * TAU;
    entity.spin = random() * TAU;
    entity.spinRate = between(random, -1.6, 1.6);
  }

  function spray(x, y, color, count, spread, speed, size, life) {
    for (let i = 0; i < count; i += 1) {
      let particle = null;
      for (let j = 0; j < particles.length; j += 1) if (!particles[j].active) { particle = particles[j]; break; }
      if (particle === null) return;
      const angle = random() * TAU;
      particle.active = true;
      particle.x = x;
      particle.y = y;
      particle.vx = Math.cos(angle) * speed * between(random, 0.35, 1);
      particle.vy = Math.sin(angle) * speed * between(random, 0.35, 1);
      particle.maxLife = life * between(random, 0.6, 1.25);
      particle.life = particle.maxLife;
      particle.size = size * between(random, 0.55, 1.35);
      particle.color = color;
    }
  }

  function popup(x, y, text, color) {
    for (let i = 0; i < popups.length; i += 1) {
      if (popups[i].active) continue;
      popups[i].active = true;
      popups[i].x = x;
      popups[i].y = y;
      popups[i].life = 0.9;
      popups[i].text = text;
      popups[i].color = color;
      return;
    }
  }

  /** A volley: a tight fan of shades, each set a little further out than the last, so the player can
   *  answer the whole thing with one turn and the fan lands as a short stream rather than together. */
  function spawnVolley(kind, angle, count, wave) {
    for (let n = 0; n < count; n += 1) {
      const offset = (n - (count - 1) / 2) * WAVES.fanStep;
      const entity = spawnShade(kind, angle + offset, wave, WAVES.fanJitter);
      if (entity === null) return;
      const extra = n * WAVES.fanGap;
      entity.x += Math.cos(entity.angle) * extra;
      entity.y += Math.sin(entity.angle) * extra;
      spray(entity.x, entity.y, '#ff8f6b', 6, TAU, 90, 1.7, 0.4);
    }
  }

  function rift(angle, kind, count) {
    for (let i = 0; i < rifts.length; i += 1) {
      if (rifts[i].active) continue;
      rifts[i].active = true;
      rifts[i].angle = angle;
      rifts[i].timer = WAVES.telegraph;
      rifts[i].kind = kind;
      rifts[i].count = count;
      return;
    }
  }

  function scoreHit(base, x, y) {
    state.combo = Math.min(COMBO.max, state.combo + 1);
    state.comboTimer = COMBO.window;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;
    const gained = base * state.combo;
    state.score += gained;
    popup(x, y, `+${gained}`, state.combo > 1 ? '#5ef0e0' : '#e9f1f8');
    return gained;
  }

  function restoresLight(amount) {
    state.light = Math.min(CORE.lightMax, state.light + amount);
    if (state.light > CORE.lightMax - 0.001) state.corePulse = Math.max(state.corePulse, 0.6);
  }

  function hitLantern(entity) {
    state.light = Math.max(0, state.light - entity.drain);
    state.combo = 0;
    state.comboTimer = 0;
    state.flawless = false;
    state.damageFlash = 1;
    state.shake = Math.max(state.shake, 0.85);
    // A beat of stillness: the hit lands, and the field holds its breath for a moment.
    state.hitStop = HIT_STOP;
    spray(entity.x, entity.y, '#ff5470', 22, TAU, 190, 2.6, 0.7);
    spray(FIELD.cx, FIELD.cy, '#ffb07a', 14, TAU, 120, 2.2, 0.6);
    if (state.light <= 0) {
      state.light = 0;
      state.phase = 'lost';
      return EVENT_DAMAGE | EVENT_OVER;
    }
    return EVENT_DAMAGE;
  }

  function deflect(entity, shieldHitX, shieldHitY) {
    let events = EVENT_DEFLECT;
    const def = ENEMY[entity.kind];
    if (entity.kind === KIND_HUSK && !entity.shard) {
      spawnShards(entity);
      events |= EVENT_BURST;
      spray(shieldHitX, shieldHitY, '#8fd25a', 26, TAU, 210, 2.8, 0.75);
      state.shake = Math.max(state.shake, 0.35);
    } else {
      spray(shieldHitX, shieldHitY, entity.kind === KIND_DARTER ? '#ff5470' : entity.kind === KIND_SPINNER ? '#b98cff' : '#93a9c4', 16, TAU, 170, 2.2, 0.55);
      state.shake = Math.max(state.shake, 0.2);
    }
    state.deflected += 1;
    const gained = scoreHit(entity.score, entity.x, entity.y);
    state.lastDeflect = { x: shieldHitX, y: shieldHitY, timer: 0.18 };
    entity.active = false;
    // A shade turned away feeds a spark back into the lantern, so a good turn is never a waste; the
    // plankton is still what the light really lives on.
    restoresLight(entity.shard ? 0.15 : 0.25);
    if (gained > 0) state.corePulse = Math.max(state.corePulse, 0.3);
    return events;
  }

  /**
   * Whether a shade is in the shield's grip this step: inside the arc, and within the band of light
   * the bloom throws — its outer rim where it sits, and its thickness behind that rim, so a shade
   * that slipped past still meets the light if the player swings back to it in time.
   */
  function withinShield(entity, previousRadius, radius) {
    if (previousRadius <= SHIELD.radius - SHIELD.grip) return false;
    if (radius > SHIELD.radius) return false;
    return Math.abs(angleDelta(shield.angle, entity.angle)) <= SHIELD.halfWidth;
  }

  function advanceShield(dt, control) {
    if (control !== null && control.type === 'turn') {
      shield.angle += control.value * SHIELD.turnSpeed * dt;
      return;
    }
    const target = control !== null && control.type === 'angle' ? control.value : shield.target;
    shield.target = target;
    const delta = angleDelta(shield.angle, target);
    const step = SHIELD.pointerSpeed * dt;
    shield.angle += Math.abs(delta) <= step ? delta : Math.sign(delta) * step;
  }

  function stepEntities(dt, harmless) {
    let events = 0;
    const lightHigh = state.light / CORE.lightMax;
    for (let i = 0; i < entities.length; i += 1) {
      const entity = entities[i];
      if (!entity.active) continue;
      const previousRadius = Math.hypot(entity.x - FIELD.cx, entity.y - FIELD.cy);
      let stepX = entity.vx;
      let stepY = entity.vy;
      if (entity.swayAmp !== 0 && previousRadius > 0.001) {
        // The weave is a tangent to the line the shade is already on, so a spinner curves without
        // ever gaining radius: near the lantern a fixed sideways push would throw it back out.
        entity.swayPhase += entity.swayRate * dt;
        const lateral = entity.swayAmp * Math.cos(entity.swayPhase);
        stepX += (-(entity.y - FIELD.cy) / previousRadius) * lateral;
        stepY += ((entity.x - FIELD.cx) / previousRadius) * lateral;
      }
      entity.x += stepX * dt;
      entity.y += stepY * dt;
      entity.angle = Math.atan2(entity.y - FIELD.cy, entity.x - FIELD.cx);
      entity.spin += entity.spinRate * dt;
      const radius = Math.hypot(entity.x - FIELD.cx, entity.y - FIELD.cy);

      // Nothing the game sends may leave the arena: a wave could then never be cleared.
      if (radius > ENTITY.spawnRadius + 140) {
        entity.active = false;
        continue;
      }

      if (!harmless && withinShield(entity, previousRadius, radius)) {
        const hitX = entity.x;
        const hitY = entity.y;
        if (entity.kind === KIND_MOTE) {
          entity.active = false;
          state.score += MOTE.shatterScore;
          spray(hitX, hitY, '#ffce6a', 10, TAU, 120, 1.8, 0.4);
          popup(entity.x, entity.y, `+${MOTE.shatterScore}`, '#7f90a8');
          events |= EVENT_SHATTER;
          continue;
        }
        events |= deflect(entity, hitX, hitY);
        continue;
      }

      if (radius > CORE.radius + entity.radius * 0.4) continue;
      entity.active = false;
      if (harmless) continue;
      if (entity.kind === KIND_MOTE) {
        restoresLight(MOTE.light);
        scoreHit(MOTE.score, entity.x, entity.y);
        popup(entity.x, entity.y + 20, `+${MOTE.light} light`, '#ffce6a');
        spray(entity.x, entity.y, '#ffce6a', 16, TAU, 130, 2, 0.5);
        events |= EVENT_MOTE;
        continue;
      }
      const drainScale = 1 + (1 - lightHigh) * 0.12;
      const drained = entity.drain * drainScale;
      entity.drain = drained;
      events |= hitLantern(entity);
      if (state.phase === 'lost') break;
    }
    return events;
  }

  function stepEffects(dt) {
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 1.9 * dt;
      p.vy *= 1 - 1.9 * dt;
    }
    for (let i = 0; i < popups.length; i += 1) {
      const p = popups[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.y -= 26 * dt;
    }
    for (let i = 0; i < specks.length; i += 1) {
      const s = specks[i];
      s.phase += dt * 0.6 * s.depth;
      s.y -= dt * 8 * s.depth;
      if (s.y < -4) s.y = FIELD.height + 4;
    }
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.comboTimer = 0;
        state.combo = 0;
      }
    }
    if (state.banner.timer > 0) state.banner.timer -= dt;
    state.damageFlash = Math.max(0, state.damageFlash - dt * 1.6);
    state.corePulse = Math.max(0, state.corePulse - dt * 2);
    state.shake = Math.max(0, state.shake - dt * 2.4);
    state.lastDeflect.timer = Math.max(0, state.lastDeflect.timer - dt);
    if (state.shake > 0) {
      const amount = state.shake * 11;
      state.shakeX = between(random, -amount, amount);
      state.shakeY = between(random, -amount, amount);
    } else {
      state.shakeX = 0;
      state.shakeY = 0;
    }
  }

  function advanceWaves(dt) {
    let events = 0;
    if (state.phase === 'calm') {
      state.phaseTimer -= dt;
      if (state.phaseTimer <= 0) {
        state.phase = 'assault';
        state.assaultTime = 0;
        state.flawless = true;
        state.banner = { title: `WAVE ${state.wave}`, sub: state.wave === 1 ? 'turn the shade away, let the motes in' : '', timer: 1.6 };
      }
      return 0;
    }
    if (state.phase !== 'assault') return 0;

    state.assaultTime += dt;
    const elapsed = state.assaultTime;
    while (state.planIndex < state.plan.length && state.plan[state.planIndex].spawnAt <= elapsed) {
      const burst = state.plan[state.planIndex];
      rift(burst.angle, burst.kind, burst.count);
      state.planIndex += 1;
    }

    for (let i = 0; i < rifts.length; i += 1) {
      const r = rifts[i];
      if (!r.active) continue;
      r.timer -= dt;
      if (r.timer > 0) continue;
      r.active = false;
      spawnVolley(r.kind, r.angle, r.count, state.wave);
    }

    const planDone = state.planIndex >= state.plan.length;
    let anyActive = false;
    for (let i = 0; i < entities.length; i += 1) {
      const e = entities[i];
      if (e.active && e.kind !== KIND_MOTE) { anyActive = true; break; }
    }
    if (planDone && !anyActive) {
      const wave = state.wave;
      const clear = WAVES.clearBonus * wave + (state.flawless ? WAVES.flawlessBonus * wave : 0);
      state.score += clear;
      restoresLight(WAVES.lightRestore);
      state.banner = {
        title: state.flawless ? `WAVE ${wave} — FLAWLESS` : `WAVE ${wave} CLEARED`,
        sub: `+${clear} points · light +${WAVES.lightRestore}`,
        timer: 2,
      };
      spray(FIELD.cx, FIELD.cy, '#ffd66b', 30, TAU, 260, 2.4, 0.8);
      events |= EVENT_CLEAR;
      state.wave += 1;
      if (state.wave > WAVES.count) {
        state.phase = 'won';
        state.score += 1000;
        return events | EVENT_WIN;
      }
      state.plan = planWave(state.wave, random);
      state.planIndex = 0;
      state.phase = 'calm';
      state.phaseTimer = WAVES.calmSeconds;
      return events;
    }
    return events;
  }

  /** The title screen's water: shades and motes drifting in that can touch nothing. */
  function stepHarmless(dt) {
    state.harmlessSpacers -= dt;
    state.moteTimer -= dt;
    if (state.moteTimer <= 0) {
      state.moteTimer = 2.4;
      spawnMote(random() * TAU);
    }
    if (state.harmlessSpacers <= 0) {
      state.harmlessSpacers = 1.5 + random();
      const kind = random() < 0.25 ? KIND_DARTER : KIND_DRIFTER;
      spawnShade(kind, random() * TAU, 2, ENEMY[kind].spread);
    }
  }

  /**
   * One fixed step. `control` is where the player wants the shield: {type:'turn', value:-1|0|1}
   * when they steer by key, {type:'angle', value} when they point with the mouse, or null to hold
   * the last target. `options.harmless` runs the title screen's water instead of the game.
   */
  function step(dt, control, options) {
    const harmless = options !== undefined && options.harmless === true;
    state.elapsed += dt;
    advanceShield(dt, control);
    if (harmless) {
      stepHarmless(dt);
      const events = stepEntities(dt, true);
      stepEffects(dt);
      return events;
    }
    if (state.phase === 'won' || state.phase === 'lost') {
      stepEffects(dt);
      return 0;
    }
    // The beat after a hit: the field stops, the effects and the shield do not.
    if (state.hitStop > 0) {
      state.hitStop = Math.max(0, state.hitStop - dt);
      stepEffects(dt);
      return 0;
    }
    state.moteTimer -= dt;
    if (state.moteTimer <= 0) {
      state.moteTimer = MOTE.interval + between(random, -MOTE.intervalJitter, MOTE.intervalJitter);
      spawnMote(random() * TAU);
    }
    const events = advanceWaves(dt) | stepEntities(dt, false);
    stepEffects(dt);
    return events;
  }

  reset();
  return { state, reset, step };
}
