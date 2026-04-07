/* popup.js — Reduced Motion Toggle */

let currentTab = null;
let currentOrigin = null;

const EMPTY_STATE = '<div class="empty-state">No other origins enabled</div>';

/* ── Helpers ── */

function displayOrigin(origin) {
  return origin.replace(/^https?:\/\//, '');
}

function setOriginEnabled(origin, enabled) {
  if (enabled) {
    chrome.storage.local.set({ [origin]: true });
  } else {
    chrome.storage.local.remove(origin);
  }
}

/* ── Inject / remove CSS in all tabs matching an origin ── */
async function applyToOrigin(origin, enabled) {
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

/* ── Remove CSS from every open tab regardless of origin ── */
async function clearAllTabs() {
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
    setOriginEnabled(origin, on);
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
    await applyToOrigin(origin, on);
  });

  return row;
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

  if (!currentOrigin || currentOrigin === 'null') {
    currentOriginEl.textContent = 'Not available on this page';
    currentToggle.disabled = true;
  } else {
    currentOriginEl.textContent = displayOrigin(currentOrigin);

    chrome.storage.local.get(null, (all) => {
      const enabled = all[currentOrigin] === true;
      currentToggle.checked = enabled;
      currentDot.classList.toggle('active', enabled);

      /* Other origins list */
      const othersList = document.getElementById('others-list');
      const others = Object.entries(all).filter(
        ([origin, val]) => origin !== currentOrigin && val === true
      );

      if (others.length === 0) {
        othersList.innerHTML = EMPTY_STATE;
      } else {
        others.forEach(([origin]) => {
          othersList.appendChild(makeRow(origin, true, false));
        });
      }
    });

    currentToggle.addEventListener('change', async () => {
      const on = currentToggle.checked;
      currentDot.classList.toggle('active', on);
      setOriginEnabled(currentOrigin, on);
      await applyToOrigin(currentOrigin, on);
    });
  }

  /* Clear all */
  document.getElementById('clear-all').addEventListener('click', async () => {
    await chrome.storage.local.clear();
    currentToggle.checked = false;
    currentDot.classList.remove('active');
    document.getElementById('others-list').innerHTML = EMPTY_STATE;
    await clearAllTabs();
  });
}

init();
