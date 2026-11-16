// Player input: the mouse aims the shield and the keyboard can steer it, start the run, pause it
// and mute the sound. One-shot presses are queued as bit flags and taken once by the loop, so a
// press between two frames is never lost and never counted twice; the pointer's angle and the
// held keys are read as state.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter', 'NumpadEnter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

/**
 * Input for the whole page. `target` is the canvas: a click or tap on it confirms. The pointer's
 * angle is measured from the arena's centre, which is the window's own centre: the field is scaled
 * to fit and centred in the window, so its middle always lands on the middle of the window whatever
 * the window's size, and the aim follows the mouse without the caller passing any geometry.
 */
export function createInput(target) {
  let left = false;
  let right = false;
  let actions = 0;
  let pointerAngle = null;
  let pointerSeen = false;
  /** What the player touched last: the pointer or a key. The newer one aims the shield. */
  let pointerNewer = false;

  const angleFromCentre = (clientX, clientY) =>
    Math.atan2(clientY - window.innerHeight / 2, clientX - window.innerWidth / 2);

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    if (LEFT.has(event.code) || RIGHT.has(event.code)) pointerNewer = false;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    left = false;
    right = false;
  });

  window.addEventListener('pointermove', (event) => {
    pointerAngle = angleFromCentre(event.clientX, event.clientY);
    pointerSeen = true;
    pointerNewer = true;
  });
  target.addEventListener('pointerdown', (event) => {
    pointerAngle = angleFromCentre(event.clientX, event.clientY);
    pointerSeen = true;
    pointerNewer = true;
    actions |= ACTION_CONFIRM;
  });

  return {
    /** -1 for left, 1 for right, 0 for neither or both: how the player is steering by key. */
    turn() {
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    /** The angle from the arena's centre to the pointer the last time it moved, or null if it never has. */
    pointerAim() {
      return pointerSeen && pointerNewer ? pointerAngle : null;
    },
    /** Whether a key is held: the keyboard's steer outranks the pointer while it lasts. */
    steeringByKey() {
      return left || right;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
