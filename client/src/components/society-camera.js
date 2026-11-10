export const INITIAL_CAMERA = Object.freeze({ yaw: -22, pitch: -28 });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// No timers, easing, momentum, wheel handling or autonomous camera updates.
export function createSocietyCamera(write) {
  let state = { ...INITIAL_CAMERA };
  let drag = null;
  return {
    get: () => ({ ...state }),
    down: e => {
      if (drag || e.button !== 0 || e.isPrimary === false) return false;
      drag = { id:e.pointerId, x:e.clientX, y:e.clientY };
      return true;
    },
    up: e => { if (drag?.id === e.pointerId) drag = null; },
    cancel: () => { drag = null; },
    move: e => {
      if (!drag || drag.id !== e.pointerId) return;
      // Also stop if a mouse-up happened outside the window/capture was interrupted.
      if (e.pointerType === "mouse" && !(e.buttons & 1)) { drag=null; return; }
      const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
      drag.x=e.clientX; drag.y=e.clientY;
      if (!dx && !dy) return;
      state = { yaw:state.yaw+dx*.3, pitch:clamp(state.pitch-dy*.22,-42,-14) };
      write({ ...state }); // Synchronous: nothing remains queued after pointer release.
    }
  };
}
