/* background.js — Service worker for Reduced Motion Toggle */

importScripts('constants.js');

const PROTOCOL_VERSION = '1.3';

/* ── In-memory state (rebuilt on SW wake) ── */
const attachedTabs = new Set();
let reconciled = false;

/* ── Helpers ── */

function getMode(storage) {
  return storage[MODE_KEY] || DEFAULT_MODE;
}

function enabledOrigins(storage) {
  return Object.entries(storage)
    .filter(([k, v]) => !k.startsWith('_') && v === true)
    .map(([k]) => k);
}

async function getStorage() {
  return chrome.storage.local.get(null);
}

async function tabOrigin(tab) {
  try { return new URL(tab.url).origin; } catch (_) { return null; }
}

/* ── Debugger lifecycle ── */

async function enableDebuggerForTab(tabId) {
  if (!attachedTabs.has(tabId)) {
    try {
      await chrome.debugger.attach({ tabId }, PROTOCOL_VERSION);
      attachedTabs.add(tabId);
    } catch (_) {
      /* Tab may be chrome://, already attached, or closed */
      return;
    }
  }
  try {
    await chrome.debugger.sendCommand({ tabId }, 'Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
  } catch (_) { /* Tab may have closed between attach and command */ }
}

async function disableDebuggerForTab(tabId) {
  if (!attachedTabs.has(tabId)) return;
  try {
    await chrome.debugger.sendCommand({ tabId }, 'Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: '' }],
    });
  } catch (_) { /* ignore */ }
  try {
    await chrome.debugger.detach({ tabId });
  } catch (_) { /* ignore */ }
  attachedTabs.delete(tabId);
}

/* ── Origin-level operations ── */

async function applyDebuggerToOrigin(origin, enabled) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (await tabOrigin(tab) !== origin) continue;
    if (enabled) {
      await enableDebuggerForTab(tab.id);
    } else {
      await disableDebuggerForTab(tab.id);
    }
  }
}

async function clearAllDebugger() {
  const ids = [...attachedTabs];
  for (const tabId of ids) {
    await disableDebuggerForTab(tabId);
  }
}

/* ── CSS injection helpers (used during mode switch) ── */

async function injectCssInTab(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (styleId, css) => {
        if (document.getElementById(styleId)) return;
        const s = document.createElement('style');
        s.id = styleId;
        s.textContent = css;
        (document.head || document.documentElement).appendChild(s);
      },
      args: [STYLE_ID, CSS],
    });
  } catch (_) { /* restricted tab */ }
}

async function removeCssFromTab(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (styleId) => {
        const el = document.getElementById(styleId);
        if (el) el.remove();
      },
      args: [STYLE_ID],
    });
  } catch (_) { /* restricted tab */ }
}

/* ── Mode transitions ── */

async function switchToDebugger() {
  const storage = await getStorage();
  const origins = enabledOrigins(storage);
  const tabs = await chrome.tabs.query({});

  /* Remove injected CSS from all tabs */
  for (const tab of tabs) {
    await removeCssFromTab(tab.id);
  }

  /* Attach debugger to tabs with enabled origins */
  for (const tab of tabs) {
    const origin = await tabOrigin(tab);
    if (origin && origins.includes(origin)) {
      await enableDebuggerForTab(tab.id);
    }
  }

  await chrome.storage.local.set({ [MODE_KEY]: MODE_DEBUGGER });
}

async function switchToCss() {
  const storage = await getStorage();
  const origins = enabledOrigins(storage);

  /* Detach debugger from all tabs */
  await clearAllDebugger();

  /* Inject CSS into tabs with enabled origins */
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    const origin = await tabOrigin(tab);
    if (origin && origins.includes(origin)) {
      await injectCssInTab(tab.id);
    }
  }

  await chrome.storage.local.set({ [MODE_KEY]: MODE_CSS });
}

/* ── Reconcile state after SW wake ── */

async function reconcileOnWake() {
  if (reconciled) return;
  reconciled = true;

  const storage = await getStorage();
  if (getMode(storage) !== MODE_DEBUGGER) return;

  const origins = enabledOrigins(storage);
  if (origins.length === 0) return;

  /* Discover tabs that still have our debugger attached */
  try {
    const targets = await chrome.debugger.getTargets();
    for (const t of targets) {
      if (t.attached && t.tabId) attachedTabs.add(t.tabId);
    }
  } catch (_) { /* ignore */ }

  /* Ensure all enabled-origin tabs are attached */
  const tabs = await chrome.tabs.query({});
  const enabledTabIds = new Set();

  for (const tab of tabs) {
    const origin = await tabOrigin(tab);
    if (origin && origins.includes(origin)) {
      enabledTabIds.add(tab.id);
      await enableDebuggerForTab(tab.id);
    }
  }

  /* Detach tabs that should no longer be attached */
  for (const tabId of [...attachedTabs]) {
    if (!enabledTabIds.has(tabId)) {
      await disableDebuggerForTab(tabId);
    }
  }
}

/* ── Message handler ─��� */

async function handleMessage(msg) {
  await reconcileOnWake();

  if (msg.action === 'enableOrigin') {
    const { origin, enabled } = msg;
    if (enabled) {
      await chrome.storage.local.set({ [origin]: true });
    } else {
      await chrome.storage.local.remove(origin);
    }
    const storage = await getStorage();
    if (getMode(storage) === MODE_DEBUGGER) {
      await applyDebuggerToOrigin(origin, enabled);
    }
    return { ok: true };
  }

  if (msg.action === 'clearAll') {
    const storage = await getStorage();
    const keys = Object.keys(storage).filter(k => !k.startsWith('_'));
    await chrome.storage.local.remove(keys);

    if (getMode(storage) === MODE_DEBUGGER) {
      await clearAllDebugger();
    }
    return { ok: true };
  }

  if (msg.action === 'modeChange') {
    if (msg.mode === MODE_DEBUGGER) {
      await switchToDebugger();
    } else {
      await switchToCss();
    }
    return { ok: true };
  }

  return { ok: false, error: 'unknown action' };
}

/* ── Event listeners ── */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg).then(sendResponse);
  return true;
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  await reconcileOnWake();

  const storage = await getStorage();
  if (getMode(storage) !== MODE_DEBUGGER) return;

  const origin = await tabOrigin(tab);
  if (!origin) return;

  const origins = enabledOrigins(storage);
  if (origins.includes(origin)) {
    await enableDebuggerForTab(tabId);
  } else if (attachedTabs.has(tabId)) {
    await disableDebuggerForTab(tabId);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  attachedTabs.delete(tabId);
});

chrome.debugger.onDetach.addListener((source) => {
  attachedTabs.delete(source.tabId);
});

chrome.runtime.onStartup.addListener(() => reconcileOnWake());
chrome.runtime.onInstalled.addListener(() => reconcileOnWake());
