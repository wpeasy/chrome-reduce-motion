/* popup.js — Reduced Motion Toggle */

let currentTab = null;
let currentOrigin = null;
let currentMode = DEFAULT_MODE;

const EMPTY_STATE = '<div class="empty-state">No other origins enabled</div>';

const MODE_HINTS = {
  [MODE_DEBUGGER]: 'Sets prefers-reduced-motion via DevTools protocol',
  [MODE_CSS]: 'Overrides animations with injected stylesheet',
};

/* ── Helpers ── */

function displayOrigin(origin) {
  return origin.replace(/^https?:\/\//, '');
}

function isOriginKey(key) {
  return !key.startsWith('_');
}

/* ── CSS-mode injection (direct from popup) ── */

async function applyToOriginCss(origin, enabled) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try {
      if (new URL(tab.url).origin !== origin) continue;
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (enabled, styleId, css) => {
          if (enabled) {
            if (document.getElementById(styleId)) return;
            const s = document.createElement('style');
            s.id = styleId;
            s.textContent = css;
            (document.head || document.documentElement).appendChild(s);
          } else {
            const el = document.getElementById(styleId);
            if (el) el.remove();
          }
        },
        args: [enabled, STYLE_ID, CSS],
      });
    } catch (_) { /* tab may be a chrome:// page, skip */ }
  }
}

async function clearAllTabsCss() {
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: t.id },
        func: (styleId) => {
          const el = document.getElementById(styleId);
          if (el) el.remove();
        },
        args: [STYLE_ID],
      });
    } catch (_) { /* skip restricted tabs */ }
  }
}

/* ── Mode-aware actions ── */

async function toggleOrigin(origin, enabled) {
  if (currentMode === MODE_DEBUGGER) {
    await chrome.runtime.sendMessage({
      action: 'enableOrigin', origin, enabled,
    });
  } else {
    if (enabled) {
      chrome.storage.local.set({ [origin]: true });
    } else {
      chrome.storage.local.remove(origin);
    }
    await applyToOriginCss(origin, enabled);
  }
}

async function clearAll() {
  if (currentMode === MODE_DEBUGGER) {
    await chrome.runtime.sendMessage({ action: 'clearAll' });
  } else {
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter(isOriginKey);
    await chrome.storage.local.remove(keys);
    await clearAllTabsCss();
  }
}

/* ── Build a toggle row for an origin ── */
function makeRow(origin, enabled, isCurrent) {
  const row = document.createElement('div');
  row.className = 'origin-row' + (isCurrent ? ' current' : '');

  const left = document.createElement('div');
  left.className = 'origin-left';

  const dot = document.createElement('span');
  dot.className = 'status-dot' + (enabled ? ' active' : '');

  const name = document.createElement('span');
  name.className = 'origin-name';
  name.textContent = displayOrigin(origin);
  name.title = origin;

  left.append(dot, name);

  const label = document.createElement('label');
  label.className = 'switch';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = enabled;

  const slider = document.createElement('span');
  slider.className = 'slider';

  label.append(input, slider);
  row.append(left, label);

  input.addEventListener('change', async () => {
    const on = input.checked;
    dot.classList.toggle('active', on);
    /* Remove row from "others" list after a beat, then check if list is empty */
    if (!on && !isCurrent) {
      setTimeout(() => {
        row.remove();
        const list = document.getElementById('others-list');
        if (!list.querySelector('.origin-row')) {
          list.innerHTML = EMPTY_STATE;
        }
      }, 200);
    }
    await toggleOrigin(origin, on);
  });

  return row;
}

/* ── Mode UI ── */

function setModeUi(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  document.getElementById('mode-hint').textContent = MODE_HINTS[mode] || '';
}

/* ── Init ── */
async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  try {
    currentOrigin = new URL(tab.url).origin;
  } catch (_) {
    currentOrigin = null;
  }

  /* Current tab row */
  const currentOriginEl = document.getElementById('current-origin');
  const currentDot = document.getElementById('current-dot');
  const currentToggle = document.getElementById('current-toggle');

  /* Read storage and set up UI */
  const all = await chrome.storage.local.get(null);
  currentMode = all[MODE_KEY] || DEFAULT_MODE;
  setModeUi(currentMode);

  if (!currentOrigin || currentOrigin === 'null') {
    currentOriginEl.textContent = 'Not available on this page';
    currentToggle.disabled = true;
  } else {
    currentOriginEl.textContent = displayOrigin(currentOrigin);

    const enabled = all[currentOrigin] === true;
    currentToggle.checked = enabled;
    currentDot.classList.toggle('active', enabled);

    /* Other origins list */
    const othersList = document.getElementById('others-list');
    const others = Object.entries(all).filter(
      ([key, val]) => isOriginKey(key) && key !== currentOrigin && val === true
    );

    if (others.length === 0) {
      othersList.innerHTML = EMPTY_STATE;
    } else {
      others.forEach(([origin]) => {
        othersList.appendChild(makeRow(origin, true, false));
      });
    }

    currentToggle.addEventListener('change', async () => {
      const on = currentToggle.checked;
      currentDot.classList.toggle('active', on);
      await toggleOrigin(currentOrigin, on);
    });
  }

  /* Mode toggle */
  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const newMode = btn.dataset.mode;
      if (newMode === currentMode) return;
      setModeUi(newMode);
      await chrome.runtime.sendMessage({ action: 'modeChange', mode: newMode });
    });
  });

  /* Clear all */
  document.getElementById('clear-all').addEventListener('click', async () => {
    await clearAll();
    currentToggle.checked = false;
    currentDot.classList.remove('active');
    document.getElementById('others-list').innerHTML = EMPTY_STATE;
  });
}

init();
