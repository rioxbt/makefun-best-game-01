// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one) and the renderer paints what is there. The game
// moves between five screens: title, play, paused, dawn (won) and dark (lost).
//
// ?seed=N fixes the water and the waves. ?shot=start|play|win|over stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, CORE, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_BURST,
  EVENT_CLEAR,
  EVENT_DAMAGE,
  EVENT_DEFLECT,
  EVENT_MOTE,
  EVENT_OVER,
  EVENT_SHATTER,
  EVENT_WIN,
} from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (a private window): the best then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world, seed);
  const extras = { muted: false, phase: 0.25 };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, extras);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  // A shot is photographed from outside the game, so the canvas is kept painted rather than left to
  // the loop: a resize clears a canvas, and a screenshot must never catch that moment.
  window.addEventListener('resize', () => renderer.draw(world.state, scene.screen, scene.best, extras));
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let phase = 0;
  let lastPhaseName = world.state.phase;

  // The sound may only start on a gesture the player made: wake it inside the handler itself.
  const wake = () => audio.resume();
  window.addEventListener('pointerdown', wake, { once: true });
  window.addEventListener('keydown', wake, { once: true });

  function announce(message) {
    status.textContent = message;
  }

  function startRun() {
    world.reset();
    accumulator = 0;
    phase = 0;
    screen = SCREEN_PLAY;
    lastPhaseName = world.state.phase;
    announce('Lanternkeeper. Twelve waves. Aim the shield with the mouse, or swing it with A and D.');
  }

  function endRun(screenName) {
    screen = screenName;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) startRun();
      else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  /** Where the player wants the shield: by key while one is held, else by the pointer. */
  function control() {
    const turn = input.turn();
    if (turn !== 0) return { type: 'turn', value: turn };
    const angle = input.pointerAim();
    return angle === null ? null : { type: 'angle', value: angle };
  }

  function answer(events) {
    const state = world.state;
    if ((events & EVENT_DEFLECT) !== 0) audio.deflect(state.combo);
    if ((events & EVENT_BURST) !== 0) audio.burst();
    if ((events & EVENT_SHATTER) !== 0) audio.shatter();
    if ((events & EVENT_MOTE) !== 0) audio.mote(state.combo);
    if ((events & EVENT_DAMAGE) !== 0) {
      audio.damage();
      announce(`Hit. Light ${Math.round((state.light / CORE.lightMax) * 100)} percent.`);
    }
    if ((events & EVENT_CLEAR) !== 0) {
      audio.wave();
      announce(`Wave ${Math.min(state.wave - 1, 12)} cleared.`);
    }
    if ((events & EVENT_WIN) !== 0) {
      audio.dawn();
      endRun(SCREEN_WIN);
      announce(`Dawn breaks. Score ${state.score}. Best ${best}.`);
      return;
    }
    if ((events & EVENT_OVER) !== 0) {
      audio.out();
      endRun(SCREEN_OVER);
      announce(`The lantern goes dark in wave ${state.wave}. Score ${state.score}. Best ${best}.`);
      return;
    }
    if (state.phase === 'assault' && lastPhaseName !== 'assault') announce(`Wave ${state.wave} of 12.`);
    lastPhaseName = state.phase;
  }

  function advance() {
    const events = world.step(STEP, control(), undefined);
    if (events !== 0) answer(events);
    if (screen === SCREEN_PLAY && (world.state.phase === 'lost' || world.state.phase === 'won')) {
      endRun(world.state.phase === 'won' ? SCREEN_WIN : SCREEN_OVER);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    phase += elapsed;
    handleActions(input.takeActions());
    if (screen === SCREEN_PLAY) {
      accumulator += elapsed;
      while (accumulator >= STEP) {
        accumulator -= STEP;
        advance();
        if (screen !== SCREEN_PLAY) break;
      }
    } else {
      accumulator = 0;
      // The title screen still moves: shades and motes drift through the lantern's water.
      if (screen === SCREEN_TITLE) world.step(MAX_FRAME, null, { harmless: true });
    }
    renderer.draw(world.state, screen, best, { muted: audio.muted, phase });
  }

  // Leaving the tab pauses a running run rather than letting the dark take it unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Lanternkeeper. Press Space or click to begin.');
  requestAnimationFrame(frame);

  // A handle for the game's own tests and for the screenshot staging: no rule lives here.
  window.__game = {
    world,
    screen: () => screen,
    start: startRun,
    press: (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true })),
    release: (code) => window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })),
  };
}

if (shot) runShot(shot);
else runGame();
