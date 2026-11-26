// Shield window: a transparent, non-activating window that covers every
// monitor whenever the palette is open or a color-gesture key is held.
//
// Two jobs:
//  * Dismiss mode — a press anywhere outside the palette dismisses it instead
//    of reaching CSP's canvas.
//  * Gesture mode — while the user holds 1 / 2 / 3, a press-and-drag adjusts
//    hue / saturation / brightness of CSP's current color. The HUD appears on
//    key-down and follows the pointer; pen-down pins it. It is a tape: a
//    gradient of that dimension scrolls under a marker fixed at the pen-down
//    point. Escape or a right-click / barrel-button press cancels and
//    restores the starting color.
import { rgb2oklch, gamutClamp, rgbToHex, hexToRgb, MAX_CHROMA } from "./oklch.js";
import { hsv2rgb, rgb2hsv, hsl2rgb, rgb2hsl } from "./color-models.js";
import { lab2rgb, rgb2lab } from "./lab.js";

const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

let dragPxPerRange = 100; // pen travel for one full range / one hue turn (settings)
const TAPE_PX_PER_RANGE = 300; // how much of the tape one full range spans
const SEND_INTERVAL_MS = 100;
const TAPE_W = 320;
const TAPE_H = 20;
const REF_H = 4; // hue only: full-saturation band along the top of the tape

const surface = document.getElementById("surface");
const hud = document.getElementById("hud");
const tape = document.getElementById("tape");
const tapeCtx = tape.getContext("2d");
const readout = document.getElementById("readout");
const swatchStart = document.getElementById("swatch-start");
const swatchNow = document.getElementById("swatch-now");

let debugTrace = false;
invoke("debug_enabled").then((v) => { debugTrace = !!v; }).catch(() => {});
const dlog = (msg) => { if (debugTrace) invoke("debug_log", { msg: `shield ${msg}` }).catch(() => {}); };

// ---- color dimension model ---------------------------------------------------
// A "dim" is 1 = hue, 2 = saturation (chroma for OKLCH/Lab), 3 = brightness.
// Each wheel type maps a color to [hue01, sat01, bright01] components in its
// own space and back; `label` is for the readout.

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const wrap01 = (v) => ((v % 1) + 1) % 1;

const MODELS = {
  oklch: {
    decompose(rgb) {
      const [L, C, h] = rgb2oklch(...rgb);
      return [h / 360, Math.min(C / MAX_CHROMA, 1), L];
    },
    compose([h, c, l]) {
      return gamutClamp(clamp01(l), clamp01(c) * MAX_CHROMA, wrap01(h) * 360);
    },
    label(dim, [h, c, l]) {
      if (dim === 1) return `H ${Math.round(wrap01(h) * 360)}°`;
      if (dim === 2) return `C ${(clamp01(c) * MAX_CHROMA).toFixed(3)}`;
      return `L ${Math.round(clamp01(l) * 100)}%`;
    },
    vivid(h) { return [h, 1, 0.7]; },
  },
  hsv: {
    decompose(rgb) { return rgb2hsv(...rgb); },
    compose([h, s, v]) { return hsv2rgb(wrap01(h), clamp01(s), clamp01(v)); },
    label(dim, [h, s, v]) {
      if (dim === 1) return `H ${Math.round(wrap01(h) * 360)}°`;
      if (dim === 2) return `S ${Math.round(clamp01(s) * 100)}%`;
      return `V ${Math.round(clamp01(v) * 100)}%`;
    },
    vivid(h) { return [h, 1, 1]; },
  },
  hsl: {
    decompose(rgb) { return rgb2hsl(...rgb); },
    compose([h, s, l]) { return hsl2rgb(wrap01(h), clamp01(s), clamp01(l)); },
    label(dim, [h, s, l]) {
      if (dim === 1) return `H ${Math.round(wrap01(h) * 360)}°`;
      if (dim === 2) return `S ${Math.round(clamp01(s) * 100)}%`;
      return `L ${Math.round(clamp01(l) * 100)}%`;
    },
    vivid(h) { return [h, 1, 0.5]; },
  },
  lab: {
    // Lab treated as LCh: chroma up to 128 covers the whole a/b square.
    decompose(rgb) {
      const [L, a, b] = rgb2lab(...rgb);
      let h = Math.atan2(b, a) / (2 * Math.PI);
      if (h < 0) h += 1;
      return [h, Math.min(Math.hypot(a, b) / 128, 1), L / 100];
    },
    compose([h, c, l]) {
      const ang = wrap01(h) * 2 * Math.PI;
      const C = clamp01(c) * 128;
      return lab2rgb(clamp01(l) * 100, C * Math.cos(ang), C * Math.sin(ang));
    },
    label(dim, [h, c, l]) {
      if (dim === 1) return `H ${Math.round(wrap01(h) * 360)}°`;
      if (dim === 2) return `C ${Math.round(clamp01(c) * 128)}`;
      return `L ${Math.round(clamp01(l) * 100)}`;
    },
    vivid(h) { return [h, 1, 0.65]; },
  },
};

// ---- state --------------------------------------------------------------------

let mode = "dismiss"; // "dismiss" | "armed" | "dragging"
let keyHeld = false;
let dim = 0;
let model = MODELS.oklch;
let startComps = null; // components at pen-down (restored on cancel)
let comps = null; // live components
let startHex = "#808080";
let pointerId = null;
let lastX = 0;
// Components behind the color we last sent. Re-arming re-reads the color from
// CSP as RGB, which has no hue once chroma is 0 (grey, black, white); if that
// color is the one we produced, restore these instead of re-deriving them.
let remembered = null; // { hex, comps, model }
let lastSend = 0;
let sendTimer = null;
let pendingHex = null;

// ---- events from Rust -----------------------------------------------------------

listen("gesture-arm", (evt) => {
  const { dim: d, hex, wheel_type: wheelType, cursor_x: cx, cursor_y: cy, drag_px_per_range: dragPx } = evt.payload;
  if (dragPx > 0) dragPxPerRange = dragPx;
  keyHeld = true;
  const nextModel = MODELS[wheelType] || MODELS.oklch;
  if (mode === "dragging") {
    // Switched keys mid-drag: keep the live color, just change which
    // dimension the drag edits from here on.
    dim = d;
    renderHud();
    dlog(`switched to dim=${dim} mid-drag`);
    return;
  }
  const wasArmed = mode === "armed";
  model = nextModel;
  dim = d;
  startHex = hex || "#808080";
  if (remembered && remembered.model === model && sameColor(remembered.hex, startHex)) {
    comps = [...remembered.comps];
  } else {
    comps = model.decompose(hexToRgb(startHex));
  }
  startComps = [...comps];
  mode = "armed";
  surface.classList.add("armed");
  swatchStart.style.background = startHex;
  if (!wasArmed) {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    placeHud(cx / dpr, cy / dpr);
  }
  showHud();
  dlog(`armed dim=${dim} hex=${startHex} model=${wheelType}`);
});

function sameColor(a, b) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const tol = 2.5 / 255;
  return Math.abs(r1 - r2) <= tol && Math.abs(g1 - g2) <= tol && Math.abs(b1 - b2) <= tol;
}

listen("gesture-disarm", () => {
  keyHeld = false;
  if (mode === "armed") endGesture();
  // While dragging, the drag finishes on pen-up.
});

listen("gesture-cancel", () => {
  if (mode === "dragging") cancelDrag();
  else if (mode === "armed") endGesture();
});

// ---- pointer handling ----------------------------------------------------------

surface.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (mode === "armed") {
    if (e.button !== 0) return; // barrel / right button: ignore before a drag
    startDrag(e);
    return;
  }
  if (mode === "dragging") {
    if (e.button !== 0) cancelDrag();
    return;
  }
  dlog(`pointerdown ${e.pointerType} -> dismiss`);
  invoke("dismiss_palette").catch(() => {});
}, { capture: true });

surface.addEventListener("pointermove", (e) => {
  if (mode !== "dragging" || e.pointerId !== pointerId) return;
  const dx = e.clientX - lastX;
  lastX = e.clientX;
  const step = dx / dragPxPerRange;
  const i = dim - 1;
  comps[i] = dim === 1 ? wrap01(comps[i] + step) : clamp01(comps[i] + step);
  renderHud();
  queueSend(currentHex());
});

surface.addEventListener("pointerup", (e) => {
  if (mode !== "dragging" || e.pointerId !== pointerId) return;
  finishDrag();
});
surface.addEventListener("pointercancel", (e) => {
  if (mode !== "dragging" || e.pointerId !== pointerId) return;
  cancelDrag();
});
surface.addEventListener("contextmenu", (e) => e.preventDefault());

function startDrag(e) {
  startComps = [...comps];
  startHex = currentHex();
  swatchStart.style.background = startHex;
  pointerId = e.pointerId;
  lastX = e.clientX;
  try { surface.setPointerCapture(e.pointerId); } catch {}
  mode = "dragging";
  surface.classList.add("dragging");
  renderHud();
  dlog(`drag start dim=${dim} at ${e.clientX},${e.clientY}`);
}

function finishDrag() {
  flushSend(currentHex());
  releaseDrag();
  dlog("drag end");
  if (keyHeld) {
    mode = "armed";
  } else {
    endGesture();
  }
}

function cancelDrag() {
  comps = [...startComps];
  flushSend(startHex);
  releaseDrag();
  renderHud();
  dlog("drag cancel");
  if (keyHeld) mode = "armed";
  else endGesture();
}

function releaseDrag() {
  try { surface.releasePointerCapture(pointerId); } catch {}
  pointerId = null;
  surface.classList.remove("dragging");
}

function endGesture() {
  mode = "dismiss";
  surface.classList.remove("armed", "dragging");
  hideHud();
  invoke("gesture_end").catch(() => {});
}

// ---- color send -----------------------------------------------------------------

function currentHex() {
  return rgbToHex(...model.compose(comps));
}

function queueSend(hex) {
  pendingHex = hex;
  const due = SEND_INTERVAL_MS - (performance.now() - lastSend);
  if (due <= 0) {
    flushSend(hex);
  } else if (!sendTimer) {
    sendTimer = setTimeout(() => { sendTimer = null; if (pendingHex) flushSend(pendingHex); }, due);
  }
}

function flushSend(hex) {
  if (sendTimer) { clearTimeout(sendTimer); sendTimer = null; }
  pendingHex = null;
  lastSend = performance.now();
  remembered = { hex, comps: [...comps], model };
  invoke("gesture_color", { hex }).catch((e) => console.warn("gesture_color:", e));
}

// ---- HUD --------------------------------------------------------------------------

function showHud() {
  renderHud();
  if (hud.hidden) {
    hud.hidden = false;
    hud.classList.remove("show");
    void hud.offsetWidth; // restart the entrance animation
    hud.classList.add("show");
  }
}

function hideHud() {
  hud.hidden = true;
  hud.classList.remove("show");
}

function placeHud(x, y) {
  // Tape centered on the cursor x at key-down, a little above it; kept inside
  // the window. It stays put for the whole gesture.
  const w = hud.offsetWidth || TAPE_W + 24;
  const h = hud.offsetHeight || 60;
  const left = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2));
  const top = Math.max(8, Math.min(window.innerHeight - h - 8, y - h - 24));
  hud.style.left = `${left}px`;
  hud.style.top = `${top}px`;
}

function renderHud() {
  if (!comps) return;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const W = Math.round(TAPE_W * dpr);
  const H = Math.round(TAPE_H * dpr);
  if (tape.width !== W || tape.height !== H) {
    tape.width = W;
    tape.height = H;
    tape.style.width = `${TAPE_W}px`;
    tape.style.height = `${TAPE_H}px`;
  }
  const i = dim - 1;
  tapeCtx.clearRect(0, 0, W, H);
  const mainColor = (v) => {
    if (dim !== 1 && (v < 0 || v > 1)) return null; // past the end
    const probe = [...comps];
    probe[i] = dim === 1 ? wrap01(v) : v;
    return model.compose(probe);
  };
  if (dim === 1) {
    // Hue: a thin fully-saturated band along the top so the hue reads even
    // when the current color is nearly grey, then the real colors below.
    const RH = Math.round(REF_H * dpr);
    paintBand(tapeCtx, W, 0, RH, dpr, (v) => model.compose(model.vivid(wrap01(v))), comps[i]);
    paintBand(tapeCtx, W, RH, H - RH, dpr, mainColor, comps[i]);
  } else {
    paintBand(tapeCtx, W, 0, H, dpr, mainColor, comps[i]);
  }
  drawMarker(tapeCtx, W, H, dpr);

  readout.textContent = model.label(dim, comps);
  swatchNow.style.background = currentHex();
}

// Paint rows [y0, y0 + h) of the tape: `colorAt(v)` gives RGB for the
// dimension value at each column (null = past the end), with `center` under
// the fixed marker.
function paintBand(ctx, W, y0, h, dpr, colorAt, center) {
  const row = ctx.createImageData(W, 1);
  const d = row.data;
  for (let px = 0; px < W; px++) {
    const offset = px / dpr - TAPE_W / 2; // CSS px from the fixed marker
    const rgb = colorAt(center + offset / TAPE_PX_PER_RANGE);
    const o = px * 4;
    if (!rgb) {
      d[o] = 30; d[o + 1] = 30; d[o + 2] = 32; d[o + 3] = 110;
      continue;
    }
    d[o] = Math.round(rgb[0] * 255);
    d[o + 1] = Math.round(rgb[1] * 255);
    d[o + 2] = Math.round(rgb[2] * 255);
    d[o + 3] = 255;
  }
  ctx.putImageData(row, 0, y0);
  ctx.drawImage(ctx.canvas, 0, y0, W, 1, 0, y0, W, h);
}

function drawMarker(ctx, W, H, dpr) {
  const cx = Math.round(W / 2) + 0.5;
  ctx.lineWidth = Math.max(1, dpr * 3);
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
  ctx.lineWidth = Math.max(1, dpr);
  ctx.strokeStyle = "#fff";
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
}
