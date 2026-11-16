// The two hands that play the game for the screenshot scenes: the helm, which plays it the way a
// player who knows the reef plays it, and the flinch, which plays it the way a run ends. Both read
// the world's state and answer with where the shield should point; neither needs the DOM, so the
// staged scenes and the tuning harness can both run headless through the same pilot.
//
// A pilot is deliberately imperfect: it decides only every `reaction` seconds and adds an aim
// error, so a staged frame is what a competent game looks like and not what a perfect machine's.
import { FIELD, KIND_MOTE, SHIELD, STEP } from './config.js';
import { angleDelta, between } from './random.js';

/** A player who knows the reef: quick, accurate, and it takes the shade that lands first. */
export const HELM = { reaction: 0.16, error: 0.05, panicked: false, topUp: 0 };

/** A player who has lost the thread: slow, wide, and it chases whatever just appeared. */
export const FLINCH = { reaction: 0.62, error: 0.95, panicked: true, topUp: 0 };

/** Every shade in the water with the time it will take to reach the shield's band, soonest first. */
function threatsOf(state) {
  const list = [];
  for (let i = 0; i < state.entities.length; i += 1) {
    const entity = state.entities[i];
    if (!entity.active || entity.kind === KIND_MOTE) continue;
    const radius = Math.hypot(entity.x - FIELD.cx, entity.y - FIELD.cy);
    if (radius <= SHIELD.radius) continue;
    list.push({
      bearing: Math.atan2(entity.y - FIELD.cy, entity.x - FIELD.cx),
      time: (radius - SHIELD.radius) / Math.max(1, entity.speed),
    });
  }
  list.sort((a, b) => a.time - b.time);
  return list;
}

/**
 * The bearing the pilot wants under the shield. The helm takes the first shade it can still reach in
 * time — the shield only slews so fast, so a shade it cannot cover is left rather than losing the
 * one after it too — and the flinch takes the newest, which is the mistake that ends a run.
 */
function chooseBearing(state, plan) {
  const list = threatsOf(state);
  if (list.length === 0) return null;
  if (plan.panicked) return list[list.length - 1].bearing;
  for (let i = 0; i < list.length; i += 1) {
    const swing = Math.abs(angleDelta(state.shield.angle, list[i].bearing)) / SHIELD.pointerSpeed;
    if (swing <= list[i].time - 0.05) return list[i].bearing;
  }
  return list[0].bearing;
}

/** A steer function: give it the world's state, get back where the shield should point. */
export function createPilot(plan, random) {
  const memory = { timer: 0, aim: -Math.PI / 2 };
  return function steer(state) {
    memory.timer -= STEP;
    if (memory.timer <= 0) {
      memory.timer = plan.reaction;
      const bearing = chooseBearing(state, plan);
      if (bearing !== null) memory.aim = bearing + between(random, -plan.error, plan.error);
    }
    return { type: 'angle', value: memory.aim };
  };
}
