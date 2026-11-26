const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

const statusLabel = document.getElementById("status-label");
const connectionPill = document.getElementById("connection-pill");
const portableWarning = document.getElementById("portable-warning");
const settingsPath = document.getElementById("settings-path");
const sessionPath = document.getElementById("session-path");
const scanBtn = document.getElementById("scan-btn");
const showPaletteBtn = document.getElementById("show-palette-btn");
const languageSelect = document.getElementById("language-select");
const altPickToggle = document.getElementById("alt-pick-toggle");
const restrictToggle = document.getElementById("restrict-toggle");
const wheelType = document.getElementById("wheel-type");
const paletteOffset = document.getElementById("palette-offset");
const shortcutEnabled = document.getElementById("shortcut-enabled");
const shortcutFields = document.getElementById("shortcut-fields");
const shortcutModifier = document.getElementById("shortcut-modifier");
const shortcutKeyBtn = document.getElementById("shortcut-key");
const clearShortcutBtn = document.getElementById("clear-shortcut-btn");
const shortcutSummary = document.getElementById("shortcut-summary");
const shortcutMessage = document.getElementById("shortcut-message");
const gesturesToggle = document.getElementById("gestures-toggle");
const gesturesHelp = document.getElementById("gestures-help");
const gestureFields = document.getElementById("gesture-fields");
const gestureKeyBtns = [1, 2, 3].map((d) => document.getElementById(`gesture-key-${d}`));
const gestureLabels = [1, 2, 3].map((d) => document.getElementById(`gesture-label-${d}`));
const gestureSensitivity = document.getElementById("gesture-sensitivity");
const gestureSensitivityValue = document.getElementById("gesture-sensitivity-value");
const gestureHint = document.getElementById("gesture-hint");
const gestureMessage = document.getElementById("gesture-message");
const tabButtons = [...document.querySelectorAll(".tabs .tab")];
const tabPages = [...document.querySelectorAll(".tab-page")];
const closeBtn = document.getElementById("close-btn");

let currentShortcut = "";
let gestureKeys = ["1", "2", "3"];
let connected = false;
let language = "en";
let currentTab = "connection";

const I18N = {
  en: {
    documentTitle: "Luma Palette Settings",
    starting: "Starting...",
    checking: "Checking",
    portableTitle: "Portable storage needs attention",
    portableBody: "Luma Palette saves settings.json and session.json beside the app. Move the app to a writable folder if settings or pairing do not persist.",
    tabConnection: "Connection",
    tabPalette: "Palette",
    tabGestures: "Gestures",
    connection: "Connection",
    language: "Language",
    step1: "Open Clip Studio Paint.",
    step2: "Choose File > Connect to Smartphone.",
    step3: "Keep the QR code visible while Luma Palette scans.",
    disconnectScan: "Disconnect and scan QR",
    forgetScan: "Forget session and scan QR",
    showPalette: "Show palette now",
    palette: "Palette",
    triggers: "Triggers",
    altPickTitle: "Show palette after ALT color pick",
    altPickHelp: "After CSP samples the canvas color, Luma Palette opens at the cursor.",
    restrictTitle: "Only respond when CSP is focused",
    restrictHelp: "Ignore the shortcut, ALT color pick and color gestures while another app is active.",
    colorWheel: "Color wheel",
    palettePosition: "Palette position",
    keyboardShortcut: "Keyboard shortcut",
    shortcutTitle: "Enable keyboard shortcut",
    shortcutHelp: "Show the palette at the cursor with a key of your choice.",
    modifier: "Modifier",
    modNone: "None",
    key: "Key",
    clickToSet: "Click to set",
    pressKey: "Press a key… (Esc cancels)",
    clear: "Clear",
    shortcutSummary: "Shortcut: {shortcut}",
    setKeyHint: "Click the key box and press a key to finish setting up the shortcut.",
    noModifierHint: "No modifier: the key still types into other apps. Turn on \"Only respond when CSP is focused\" above to keep it from triggering elsewhere.",
    gestures: "Color gestures",
    gesturesTitle: "Hold a key and drag to adjust one color dimension",
    gesturesHelp: "Hold {k1} ({d1}), {k2} ({d2}) or {k3} ({d3}) and drag left or right on the canvas. Esc or right-click cancels.",
    sensitivity: "Sensitivity",
    sensitivityValue: "{px} px",
    gestureHint: "Sensitivity is how far the pen travels for one full range (or one full turn of hue): smaller is faster. Keys are single keys without modifiers; the first press still reaches CSP, so pick keys CSP doesn't use.",
    dimHue: "Hue",
    dimSaturation: "Saturation",
    dimChroma: "Chroma",
    dimBrightness: "Brightness",
    dimValue: "Value",
    dimLightness: "Lightness",
    gestureKeySet: "{dim} key set to {key}.",
    gestureKeyCanceled: "Key recording canceled.",
    gesturesDisabled: "Color gestures disabled.",
    storage: "Storage",
    settings: "Settings",
    pairing: "Pairing",
    close: "Close to tray",
    connected: "Connected",
    scanning: "Scanning",
    reconnecting: "Reconnecting",
    disconnected: "Disconnected",
    waiting: "Waiting",
    waitingCsp: "Waiting for Clip Studio Paint",
    tryingSession: "Trying saved Companion Mode session",
    connectedTo: "Connected to CSP at {detail}",
    disconnectedReason: "Disconnected: {detail}",
    clearingConnected: "Disconnecting and clearing saved pairing...",
    clearing: "Clearing saved pairing...",
    shortcutCanceled: "Key recording canceled.",
    registering: "Registering shortcut...",
    shortcutSet: "Shortcut set to {shortcut}.",
    pressAnother: "Press another key…",
    shortcutDisabled: "Keyboard shortcut disabled.",
    shortcutCleared: "Key cleared.",
    unavailable: "Unavailable",
    wheelOklch: "OKLCH (perceptual)",
    wheelHsv: "HSV (CSP native)",
    wheelHsl: "HSL (classic)",
    wheelLab: "Photoshop Lab",
    posBr: "Bottom-right of cursor",
    posBl: "Bottom-left of cursor (left-handed)",
    posTr: "Top-right of cursor",
    posTl: "Top-left of cursor",
    posCenter: "Centered on cursor",
  },
  "zh-TW": {
    documentTitle: "Luma Palette 設定",
    starting: "啟動中...",
    checking: "檢查中",
    portableTitle: "可攜式儲存需要注意",
    portableBody: "Luma Palette 會把 settings.json 和 session.json 儲存在程式旁邊。如果設定或配對無法保存，請把程式移到可寫入的資料夾。",
    tabConnection: "連線",
    tabPalette: "調色盤",
    tabGestures: "手勢",
    connection: "連線",
    language: "語言",
    step1: "開啟 Clip Studio Paint。",
    step2: "選擇「檔案 > 連接至智慧型手機」。",
    step3: "掃描時請讓 QR code 保持顯示。",
    disconnectScan: "中斷並掃描 QR",
    forgetScan: "清除配對並掃描 QR",
    showPalette: "立即顯示調色盤",
    palette: "調色盤",
    triggers: "觸發方式",
    altPickTitle: "ALT 取色後顯示調色盤",
    altPickHelp: "CSP 完成畫布取色後，Luma Palette 會在游標旁開啟。",
    restrictTitle: "只在 CSP 作用中時回應",
    restrictHelp: "其他程式作用中時，忽略快捷鍵、ALT 取色與色彩手勢。",
    colorWheel: "色盤模式",
    palettePosition: "調色盤位置",
    keyboardShortcut: "鍵盤快捷鍵",
    shortcutTitle: "啟用鍵盤快捷鍵",
    shortcutHelp: "按下自訂按鍵，在游標旁顯示調色盤。",
    modifier: "修飾鍵",
    modNone: "無",
    key: "按鍵",
    clickToSet: "點擊以設定",
    pressKey: "請按一個按鍵…（Esc 取消）",
    clear: "清除",
    shortcutSummary: "快捷鍵：{shortcut}",
    setKeyHint: "點擊按鍵欄位並按下一個按鍵，即可完成快捷鍵設定。",
    noModifierHint: "未使用修飾鍵：該按鍵仍會輸入到其他程式。建議開啟上方的「只在 CSP 作用中時回應」，避免在其他程式中觸發。",
    gestures: "色彩手勢",
    gesturesTitle: "按住按鍵並拖曳，調整單一色彩維度",
    gesturesHelp: "按住 {k1}（{d1}）、{k2}（{d2}）或 {k3}（{d3}）並在畫布上左右拖曳。Esc 或右鍵取消。",
    sensitivity: "靈敏度",
    sensitivityValue: "{px} px",
    gestureHint: "靈敏度是筆尖移動多遠等於完整範圍（色相則為一整圈）：數值越小越快。按鍵為不含修飾鍵的單一按鍵；第一次按下仍會傳給 CSP，請選擇 CSP 未使用的按鍵。",
    dimHue: "色相",
    dimSaturation: "飽和度",
    dimChroma: "彩度",
    dimBrightness: "亮度",
    dimValue: "明度",
    dimLightness: "亮度",
    gestureKeySet: "{dim}按鍵已設定為 {key}。",
    gestureKeyCanceled: "已取消錄製按鍵。",
    gesturesDisabled: "色彩手勢已停用。",
    storage: "儲存位置",
    settings: "設定",
    pairing: "配對",
    close: "關閉到系統匣",
    connected: "已連線",
    scanning: "掃描中",
    reconnecting: "重新連線",
    disconnected: "已中斷",
    waiting: "等待中",
    waitingCsp: "等待 Clip Studio Paint",
    tryingSession: "嘗試使用已儲存的 Companion Mode 配對",
    connectedTo: "已連線到 CSP：{detail}",
    disconnectedReason: "已中斷：{detail}",
    clearingConnected: "正在中斷並清除已儲存配對...",
    clearing: "正在清除已儲存配對...",
    shortcutCanceled: "已取消錄製按鍵。",
    registering: "正在設定快捷鍵...",
    shortcutSet: "快捷鍵已設定為 {shortcut}。",
    pressAnother: "請按另一個按鍵…",
    shortcutDisabled: "鍵盤快捷鍵已停用。",
    shortcutCleared: "按鍵已清除。",
    unavailable: "無法取得",
    wheelOklch: "OKLCH（感知均勻）",
    wheelHsv: "HSV（CSP 原生）",
    wheelHsl: "HSL（傳統）",
    wheelLab: "Photoshop Lab",
    posBr: "游標右下",
    posBl: "游標左下（左手模式）",
    posTr: "游標右上",
    posTl: "游標左上",
    posCenter: "以游標置中",
  },
};

function t(key, vars = {}) {
  const dict = I18N[language] || I18N.en;
  let value = dict[key] || I18N.en[key] || key;
  for (const [name, replacement] of Object.entries(vars)) {
    value = value.replaceAll(`{${name}}`, replacement);
  }
  return value;
}

function setText(selector, key) {
  const el = document.querySelector(selector);
  if (el) el.textContent = t(key);
}

function setOptionText(selector, key) {
  const option = document.querySelector(selector);
  if (option) option.textContent = t(key);
}

// Names of the three gesture dimensions for the selected wheel type.
function dimensionNames(type) {
  switch (type) {
    case "hsv": return [t("dimHue"), t("dimSaturation"), t("dimValue")];
    case "hsl": return [t("dimHue"), t("dimSaturation"), t("dimLightness")];
    case "lab": return [t("dimHue"), t("dimChroma"), t("dimLightness")];
    case "oklch":
    default: return [t("dimHue"), t("dimChroma"), t("dimLightness")];
  }
}

function applyLanguage() {
  document.documentElement.lang = language === "zh-TW" ? "zh-Hant" : "en";
  document.title = t("documentTitle");
  setText("#portable-warning h2", "portableTitle");
  setText("#portable-warning p", "portableBody");
  for (const btn of tabButtons) {
    const name = btn.dataset.tab;
    btn.textContent = t(`tab${name.charAt(0).toUpperCase()}${name.slice(1)}`);
  }
  setText("#h-connection", "connection");
  setText("label[for='language-select']", "language");
  setText("#setup-steps li:nth-child(1)", "step1");
  setText("#setup-steps li:nth-child(2)", "step2");
  setText("#setup-steps li:nth-child(3)", "step3");
  showPaletteBtn.textContent = t("showPalette");
  setText("#h-storage", "storage");
  setText("#dt-settings", "settings");
  setText("#dt-pairing", "pairing");
  setText("#h-palette", "palette");
  setText("label[for='wheel-type']", "colorWheel");
  setText("label[for='palette-offset']", "palettePosition");
  setText("#h-triggers", "triggers");
  setText("#alt-pick-toggle + span strong", "altPickTitle");
  setText("#alt-pick-toggle + span small", "altPickHelp");
  setText("#restrict-toggle + span strong", "restrictTitle");
  setText("#restrict-toggle + span small", "restrictHelp");
  setText("#h-shortcut", "keyboardShortcut");
  setText("#shortcut-enabled + span strong", "shortcutTitle");
  setText("#shortcut-enabled + span small", "shortcutHelp");
  setText("label[for='shortcut-modifier']", "modifier");
  setOptionText("#shortcut-modifier option[value='']", "modNone");
  setText("label[for='shortcut-key']", "key");
  clearShortcutBtn.textContent = t("clear");
  setText("#h-gestures", "gestures");
  setText("#gestures-toggle + span strong", "gesturesTitle");
  setText("#gesture-sensitivity-label", "sensitivity");
  gestureHint.textContent = t("gestureHint");
  closeBtn.textContent = t("close");

  setOptionText("#wheel-type option[value='oklch']", "wheelOklch");
  setOptionText("#wheel-type option[value='hsv']", "wheelHsv");
  setOptionText("#wheel-type option[value='hsl']", "wheelHsl");
  setOptionText("#wheel-type option[value='lab']", "wheelLab");
  setOptionText("#palette-offset option[value='bottom-right']", "posBr");
  setOptionText("#palette-offset option[value='bottom-left']", "posBl");
  setOptionText("#palette-offset option[value='top-right']", "posTr");
  setOptionText("#palette-offset option[value='top-left']", "posTl");
  setOptionText("#palette-offset option[value='center']", "posCenter");
}

// ---- tabs -----------------------------------------------------------------------

function showTab(name, persist) {
  if (!tabButtons.some((b) => b.dataset.tab === name)) name = "connection";
  currentTab = name;
  for (const btn of tabButtons) btn.classList.toggle("active", btn.dataset.tab === name);
  for (const page of tabPages) page.hidden = page.dataset.page !== name;
  if (persist) invoke("set_settings_tab", { tab: name }).catch(() => {});
}

for (const btn of tabButtons) {
  btn.addEventListener("click", () => {
    cancelCapture();
    showTab(btn.dataset.tab, true);
  });
}

// ---- rendering --------------------------------------------------------------------

function renderPhase(phase) {
  statusLabel.textContent = phaseText(phase);
  const key = phase?.phase || "waiting_for_csp";
  connectionPill.className = key;
  connectionPill.textContent = pillText(key);
}

function phaseText(phase) {
  const key = phase?.phase || "waiting_for_csp";
  const detail = phase?.detail || "";
  switch (key) {
    case "connected": return t("connectedTo", { detail });
    case "scanning": return t("scanning");
    case "reconnecting": return t("tryingSession");
    case "disconnected": return t("disconnectedReason", { detail });
    case "waiting_for_csp":
    default: return t("waitingCsp");
  }
}

function pillText(key) {
  switch (key) {
    case "connected": return t("connected");
    case "scanning": return t("scanning");
    case "reconnecting": return t("reconnecting");
    case "disconnected": return t("disconnected");
    case "waiting_for_csp":
    default: return t("waiting");
  }
}

function renderSettings(settings) {
  language = settings.language || "en";
  languageSelect.value = language;
  currentShortcut = settings.global_hotkey || "";
  gestureKeys = Array.isArray(settings.gesture_keys) && settings.gesture_keys.length === 3
    ? settings.gesture_keys.map(String)
    : ["1", "2", "3"];
  altPickToggle.checked = !!settings.show_after_alt_pick;
  restrictToggle.checked = !!settings.restrict_to_csp;
  wheelType.value = settings.wheel_type || "oklch";
  paletteOffset.value = settings.palette_offset || "bottom-right";
  applyLanguage();
  renderShortcut(!!settings.hotkey_enabled);
  renderGestures(settings);
  renderScanAction(connected);
  if (settings.settings_tab && settings.settings_tab !== currentTab) showTab(settings.settings_tab, false);
}

function keyButtonContent(button, key) {
  button.classList.remove("recording");
  if (key) {
    button.textContent = key;
  } else {
    button.innerHTML = "";
    const placeholder = document.createElement("span");
    placeholder.className = "placeholder";
    placeholder.textContent = t("clickToSet");
    button.appendChild(placeholder);
  }
}

function renderShortcut(enabled) {
  shortcutEnabled.checked = enabled;
  shortcutFields.disabled = !enabled;
  clearShortcutBtn.disabled = !currentShortcut;

  const { mod, key } = splitShortcut(currentShortcut);
  // Only mirror the dropdown from a saved shortcut; with none saved, keep the
  // user's pending choice (default Ctrl) instead of resetting it on refresh.
  if (currentShortcut) syncModifierDropdown(mod);

  if (capture?.button !== shortcutKeyBtn) keyButtonContent(shortcutKeyBtn, key);

  shortcutSummary.innerHTML = "";
  if (!key) {
    shortcutSummary.textContent = t("setKeyHint");
  } else {
    const line = document.createElement("div");
    line.textContent = t("shortcutSummary", { shortcut: "" });
    const strong = document.createElement("strong");
    strong.textContent = currentShortcut;
    line.appendChild(strong);
    shortcutSummary.appendChild(line);
    if (!mod) {
      const warn = document.createElement("div");
      warn.textContent = t("noModifierHint");
      shortcutSummary.appendChild(warn);
    }
  }
}

function renderGestures(settings) {
  const enabled = !!settings.color_gestures;
  gesturesToggle.checked = enabled;
  gestureFields.disabled = !enabled;
  const names = dimensionNames(settings.wheel_type || "oklch");
  gestureLabels.forEach((label, i) => { label.textContent = names[i]; });
  gestureKeyBtns.forEach((btn, i) => {
    if (capture?.button !== btn) keyButtonContent(btn, gestureKeys[i]);
  });
  gesturesHelp.textContent = t("gesturesHelp", {
    k1: gestureKeys[0], k2: gestureKeys[1], k3: gestureKeys[2],
    d1: names[0], d2: names[1], d3: names[2],
  });
  const px = Number(settings.gesture_px_per_range) || 100;
  gestureSensitivity.value = String(px);
  gestureSensitivityValue.textContent = t("sensitivityValue", { px });
}

function renderPortable(portable) {
  portableWarning.hidden = !!portable.exe_dir_writable;
  settingsPath.textContent = portable.settings_path || t("unavailable");
  sessionPath.textContent = portable.session_path || t("unavailable");
}

function renderScanAction(isConnected) {
  connected = !!isConnected;
  scanBtn.textContent = connected ? t("disconnectScan") : t("forgetScan");
}

async function refresh() {
  const snapshot = await invoke("get_app_snapshot");
  renderSettings(snapshot.settings);
  renderPhase(snapshot.phase);
  renderPortable(snapshot.portable);
  renderScanAction(snapshot.connected);
}

// ---- key recording ---------------------------------------------------------------

// US-layout shifted symbols → the unshifted key they live on, so holding Shift
// while recording still stores the base key.
const SHIFTED_SYMBOLS = {
  "~": "`", "_": "-", "+": "=", "{": "[", "}": "]", "|": "\\",
  ":": ";", '"': "'", "<": ",", ">": ".", "?": "/",
  "!": "1", "@": "2", "#": "3", "$": "4", "%": "5", "^": "6",
  "&": "7", "*": "8", "(": "9", ")": "0",
};

function keyFromEvent(e) {
  let key = e.key;
  if (["Control", "Shift", "Alt", "Meta", "Dead", "Unidentified"].includes(key)) return null;
  if (key === " ") key = "Space";
  else if (/^F\d+$/.test(key)) { /* keep F1..F24 */ }
  else if (key.length === 1) key = (SHIFTED_SYMBOLS[key] || key).toUpperCase();
  else key = key.charAt(0).toUpperCase() + key.slice(1);
  return key;
}

function composeAccel(mod, key) {
  if (!key) return "";
  return mod ? `${mod}+${key}` : key;
}

// Split an accelerator string into a canonical modifier combo and its key.
function splitShortcut(accel) {
  if (!accel) return { mod: "", key: "" };
  const parts = accel.split("+").map((p) => p.trim()).filter(Boolean);
  const key = parts.pop() || "";
  const names = parts.map((p) => {
    const l = p.toLowerCase();
    if (l === "ctrl" || l === "control") return "Ctrl";
    if (l === "meta" || l === "win" || l === "windows" || l === "super") return "Super";
    return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  });
  const mod = ["Ctrl", "Shift", "Alt", "Super"].filter((m) => names.includes(m)).join("+");
  return { mod, key };
}

// Select the modifier combo in the dropdown, adding an option for combos the
// static list doesn't cover (e.g. Super, or shortcuts from older saves).
function syncModifierDropdown(mod) {
  if (![...shortcutModifier.options].some((o) => o.value === mod)) {
    const opt = document.createElement("option");
    opt.value = mod;
    opt.textContent = mod;
    shortcutModifier.insertBefore(opt, shortcutModifier.lastElementChild);
  }
  shortcutModifier.value = mod;
}

// One recorder shared by every key field. Clicking a field arms it; anything
// that takes focus away (clicking elsewhere, unchecking, switching tabs or
// windows) cancels, and so does Esc. `apply(key)` persists the key and
// resolves to the success message, or throws with the error to show.
let capture = null; // { button, fieldset, message, canceled, apply }
let captureEndedAt = 0;

function startCapture(spec) {
  if (capture || spec.fieldset.disabled) return;
  capture = spec;
  spec.button.classList.add("recording");
  spec.button.textContent = t("pressKey");
  spec.message.textContent = "";
  spec.button.focus();
  document.addEventListener("keydown", onCaptureKey, true);
  spec.button.addEventListener("blur", cancelCapture);
  window.addEventListener("blur", cancelCapture);
}

function stopCapture() {
  if (!capture) return null;
  const spec = capture;
  capture = null;
  captureEndedAt = performance.now();
  document.removeEventListener("keydown", onCaptureKey, true);
  spec.button.removeEventListener("blur", cancelCapture);
  window.removeEventListener("blur", cancelCapture);
  return spec;
}

function cancelCapture() {
  const spec = stopCapture();
  if (!spec) return;
  spec.message.textContent = spec.canceled;
  refresh().catch(() => {});
}

async function onCaptureKey(e) {
  if (!capture) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.key === "Escape") {
    cancelCapture();
    return;
  }
  const key = keyFromEvent(e);
  if (!key) return;
  const spec = capture;
  spec.button.textContent = key;
  try {
    const message = await spec.apply(key);
    stopCapture();
    spec.message.textContent = message;
    await refresh();
  } catch (err) {
    spec.message.textContent = String(err);
    spec.button.textContent = t("pressAnother");
    spec.button.focus();
  }
}

// A key button clicked via keyboard right after recording ended (Space's
// keyup "clicks" the focused button) must not restart recording.
function onKeyFieldClick(e, spec) {
  if (e.detail === 0 && performance.now() - captureEndedAt < 300) return;
  startCapture(spec);
}

const shortcutCaptureSpec = {
  button: shortcutKeyBtn,
  fieldset: shortcutFields,
  message: shortcutMessage,
  get canceled() { return t("shortcutCanceled"); },
  async apply(key) {
    const accel = composeAccel(shortcutModifier.value, key);
    await invoke("set_global_hotkey", { hotkey: accel });
    return t("shortcutSet", { shortcut: accel });
  },
};

function gestureCaptureSpec(i) {
  return {
    button: gestureKeyBtns[i],
    fieldset: gestureFields,
    message: gestureMessage,
    get canceled() { return t("gestureKeyCanceled"); },
    async apply(key) {
      const keys = [...gestureKeys];
      keys[i] = key;
      await invoke("set_gesture_keys", { keys });
      const names = dimensionNames(wheelType.value);
      return t("gestureKeySet", { dim: names[i], key });
    },
  };
}

// ---- wiring --------------------------------------------------------------------------

scanBtn.addEventListener("click", () => {
  scanBtn.disabled = true;
  statusLabel.textContent = connected ? t("clearingConnected") : t("clearing");
  invoke("disconnect_and_scan_qr").then(refresh).catch((err) => {
    statusLabel.textContent = String(err);
  }).finally(() => {
    scanBtn.disabled = false;
  });
});

showPaletteBtn.addEventListener("click", () => {
  invoke("show_palette_at_cursor").catch((err) => {
    statusLabel.textContent = String(err);
  });
});

languageSelect.addEventListener("change", async () => {
  language = languageSelect.value;
  applyLanguage();
  renderScanAction(connected);
  await invoke("set_language", { language });
  await refresh();
});

altPickToggle.addEventListener("change", async () => {
  await invoke("set_show_after_alt_pick", { enabled: altPickToggle.checked });
  await refresh();
});

restrictToggle.addEventListener("change", async () => {
  await invoke("set_restrict_to_csp", { enabled: restrictToggle.checked });
  await refresh();
});

wheelType.addEventListener("change", async () => {
  await invoke("set_wheel_type", { wheelType: wheelType.value });
  await refresh();
});

paletteOffset.addEventListener("change", async () => {
  await invoke("set_palette_offset", { offset: paletteOffset.value });
  await refresh();
});

shortcutEnabled.addEventListener("change", async () => {
  const enabled = shortcutEnabled.checked;
  if (!enabled) cancelCapture();
  await invoke("set_hotkey_enabled", { enabled });
  shortcutMessage.textContent = enabled ? "" : t("shortcutDisabled");
  await refresh();
  // Enabling with no key yet: jump straight into recording so the next
  // keypress finishes setup.
  if (enabled && !currentShortcut) startCapture(shortcutCaptureSpec);
});

shortcutKeyBtn.addEventListener("click", (e) => onKeyFieldClick(e, shortcutCaptureSpec));

shortcutModifier.addEventListener("change", async () => {
  const { key } = splitShortcut(currentShortcut);
  if (!key) return; // no key recorded yet; combo applies once one is set
  const accel = composeAccel(shortcutModifier.value, key);
  shortcutMessage.textContent = t("registering");
  try {
    await invoke("set_global_hotkey", { hotkey: accel });
    shortcutMessage.textContent = t("shortcutSet", { shortcut: accel });
    await refresh();
  } catch (err) {
    shortcutMessage.textContent = String(err);
    syncModifierDropdown(splitShortcut(currentShortcut).mod);
  }
});

clearShortcutBtn.addEventListener("click", async () => {
  cancelCapture();
  await invoke("set_global_hotkey", { hotkey: "" });
  shortcutMessage.textContent = t("shortcutCleared");
  await refresh();
});

gesturesToggle.addEventListener("change", async () => {
  const enabled = gesturesToggle.checked;
  if (!enabled) cancelCapture();
  await invoke("set_color_gestures", { enabled });
  gestureMessage.textContent = enabled ? "" : t("gesturesDisabled");
  await refresh();
});

gestureKeyBtns.forEach((btn, i) => {
  btn.addEventListener("click", (e) => onKeyFieldClick(e, gestureCaptureSpec(i)));
});

gestureSensitivity.addEventListener("input", () => {
  gestureSensitivityValue.textContent = t("sensitivityValue", { px: gestureSensitivity.value });
});
gestureSensitivity.addEventListener("change", async () => {
  await invoke("set_gesture_sensitivity", { px: Number(gestureSensitivity.value) });
  await refresh();
});

closeBtn.addEventListener("click", () => {
  invoke("mark_welcome_seen").finally(() => invoke("close_status_settings"));
});

listen("phase-changed", (evt) => renderPhase(evt.payload));
listen("settings-changed", (evt) => renderSettings(evt.payload));
listen("global-hotkey-changed", () => {
  refresh().catch((err) => {
    shortcutMessage.textContent = String(err);
  });
});
listen("qr-scan-status", async (evt) => {
  try {
    const snapshot = await invoke("get_app_snapshot");
    renderPhase(snapshot.phase);
    renderScanAction(snapshot.connected);
    if (!evt.payload?.scanning && evt.payload?.message && !snapshot.connected) {
      statusLabel.textContent = evt.payload.message;
    }
  } catch (err) {
    statusLabel.textContent = String(err);
  }
});
listen("csp-process-status", () => {
  refresh().catch((err) => {
    statusLabel.textContent = String(err);
  });
});

showTab("connection", false);
invoke("mark_welcome_seen").catch(() => {});
refresh().catch((err) => {
  statusLabel.textContent = String(err);
});
