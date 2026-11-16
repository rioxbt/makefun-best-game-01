// The scenes behind ?shot=start|play|win|over: the photo shoots of the game, each one produced by
// running the real rules (never by drawing an invented picture) and then handed to the renderer to
// paint. Every scene is deterministic: the same seed always gives the same frame, so a screenshot
// can be retaken and a change in the game seen.
//
// The screenshots themselves are taken by the game's maker from these scenes at a 1280x720 window,
// the same field the game draws; take them again with shots.json's queries.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createPilot, FLINCH, HELM } from './pilot.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { EVENT_DEFLECT, EVENT_OVER, EVENT_WIN } from './world.js';

/** The longest a staged run may take, in seconds of game time. */
const WIN_LIMIT = 400;
const OVER_LIMIT = 300;
/** The play scene's length, and the reference run whose score the staged panels show as the best. */
const PLAY_SECONDS = 42;
const REFERENCE_SECONDS = 55;

/**
 * Runs the world forward with a pilot for up to `seconds` of game time, or until `stop` fires. A
 * plan with a topUp keeps the lantern alive: the staged run is played for its end screen, so the
 * photographer's hand steadies the light whenever it drops below that, and only for these scenes.
 */
function play(world, steer, plan, seconds, stop) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const events = world.step(STEP, steer(world.state), undefined);
    if (plan.topUp > 0 && world.state.light < plan.topUp) world.state.light = plan.topUpTo;
    if (stop !== undefined && (events & stop) !== 0) return true;
  }
  return false;
}

/** Steps on until a shade is turned away, then a few frames more, so the burst is still on screen. */
function playToDeflect(world, steer, plan, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const events = world.step(STEP, steer(world.state), undefined);
    if (plan.topUp > 0 && world.state.light < plan.topUp) world.state.light = plan.topUpTo;
    if ((events & EVENT_DEFLECT) !== 0) break;
  }
  for (let i = 0; i < 5; i += 1) world.step(STEP, steer(world.state), undefined);
}

/** The score the staged panels show as the best: a real run of the helm's, played to its end. */
function referenceScore(world, random) {
  world.reset();
  play(world, createPilot(HELM, random), HELM, REFERENCE_SECONDS);
  const score = world.state.score;
  world.reset();
  return score;
}

/**
 * Set `world` to the named scene (start, play, win or over; any other name is start) and return the
 * screen to draw over it and the best score to show.
 */
export function stageShot(name, world, seed) {
  const random = createRandom(seed ^ 0x51ed270b);
  const best = referenceScore(world, random);

  if (name === 'play') {
    world.reset();
    const steer = createPilot(HELM, random);
    play(world, steer, HELM, PLAY_SECONDS);
    playToDeflect(world, steer, HELM, 12);
    return { screen: SCREEN_PLAY, best: Math.max(best, world.state.score) };
  }

  if (name === 'win') {
    world.reset();
    const plan = { ...HELM, topUp: 20, topUpTo: 55 };
    const steer = createPilot(plan, random);
    play(world, steer, plan, WIN_LIMIT, EVENT_WIN);
    return { screen: SCREEN_WIN, best: Math.max(best, world.state.score) };
  }

  if (name === 'over') {
    world.reset();
    const steer = createPilot(FLINCH, random);
    const lost = play(world, steer, FLINCH, OVER_LIMIT, EVENT_OVER);
    // The flinch is meant to lose, and does; if it somehow outlasted the limit, the lantern is
    // brought down to a breath so the run still ends the way this scene is photographing.
    if (!lost) {
      world.state.light = 6;
      play(world, steer, FLINCH, 60, EVENT_OVER);
    }
    return { screen: SCREEN_OVER, best: Math.max(best, world.state.score) };
  }

  world.reset();
  for (let i = 0; i < Math.round(7 / STEP); i += 1) world.step(STEP, null, { harmless: true });
  return { screen: SCREEN_TITLE, best };
}
