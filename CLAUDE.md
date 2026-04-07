# Reduced Motion Toggle — Chrome Extension

A Manifest V3 Chrome extension that emulates or forces `prefers-reduced-motion`
on any origin via a popup toggle. Two modes: **Emulate** (DevTools protocol) and
**CSS Override** (brute-force injection). No build step. Vanilla JS throughout.

---

## Architecture

```
manifest.json      Extension manifest (MV3)
background.js      Service worker — debugger lifecycle, message handling
popup.html         Popup UI — markup and styles (inline)
popup.js           Popup logic — reads storage, drives UI, delegates to SW or injects CSS
content.js         Content script — re-applies CSS on page reload (CSS mode only)
constants.js       Shared constants (STYLE_ID, CSS, mode keys)
icons/             PNG icons at 16, 32, 48, 128px
```

### Two modes

The extension supports two modes, selectable via the popup:

1. **Emulate** (`background.js` → `chrome.debugger`): Uses
   `Emulation.setEmulatedMedia` to set `prefers-reduced-motion: reduce` via the
   Chrome DevTools Protocol. This is the most accurate approach — both CSS
   `@media (prefers-reduced-motion: reduce)` queries and
   `window.matchMedia('(prefers-reduced-motion: reduce)')` return true. Shows a
   yellow "debugging this browser" infobar per tab.

2. **CSS Override** (`popup.js` + `content.js`): Injects a `<style>` element
   that brute-force overrides animation/transition properties. Does not change
   the actual media feature — sites' own `@media` queries and `matchMedia()`
   checks will not trigger. Useful when the infobar is unwanted.

### CSS mode: two-pronged injection

In CSS mode, styles are applied via two mechanisms:

1. **Immediate** (`popup.js` → `chrome.scripting.executeScript`): When the user
   toggles, the popup directly executes a function in every matching tab. Works
   even if the content script isn't present. Does not survive page reload.

2. **Persistence** (`content.js`): Runs at `document_start` on every page load.
   Reads storage and re-injects CSS if the origin is enabled and mode is `css`.

Do not collapse these into one mechanism — each covers a gap the other has.

### Service worker (`background.js`)

The service worker manages the debugger lifecycle:

- **In-memory state**: `attachedTabs` (Set of tabIds) — rebuilt on wake via
  `chrome.debugger.getTargets()`.
- **Tab events**: `onUpdated` attaches/detaches debugger based on origin;
  `onRemoved` cleans up the set.
- **Debugger events**: `onDetach` removes tab from set. If the user dismisses
  the infobar, the extension does not re-attach until next navigation.
- **Messages from popup**: `enableOrigin`, `clearAll`, `modeChange`.
- **Mode transitions**: switching modes cleans up the old mechanism and applies
  the new one to all enabled-origin tabs.

---

## Storage schema

`chrome.storage.local` stores enabled origins and a mode key:

```js
{
  "_mode": "debugger",           /* or "css" */
  "https://example.com": true,
  "https://other.com": true
}
```

- Keys prefixed with `_` are meta keys. Origin keys always start with `http`.
- Disabling an origin calls `chrome.storage.local.remove(origin)` — not `false`.
- When reading origins, filter: `key does not start with '_'` AND `val === true`.
- Default mode (when `_mode` is absent): `"css"` (non-breaking for upgrades).

---

## CSS injection

The injected stylesheet deliberately uses `0.01ms` rather than `none`:

```css
*, *::before, *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
  scroll-behavior: auto !important;
}
```

Using `none` would suppress `transitionend` and `animationend` events, breaking
JS that listens for them. `0.01ms` is imperceptible but still fires the events.

Do not change this to `none` or `0s`.

---

## Permissions

| Permission   | Why |
|--------------|-----|
| `activeTab`  | Access current tab URL and inject scripts |
| `scripting`  | `chrome.scripting.executeScript` for CSS mode injection |
| `storage`    | Persist enabled origins and mode across sessions |
| `debugger`   | `chrome.debugger.attach` + `Emulation.setEmulatedMedia` |
| `tabs`       | Service worker needs `tab.url` from `chrome.tabs.query` |

---

## Message protocol (popup → service worker)

| Action | Payload | SW behaviour |
|--------|---------|--------------|
| `enableOrigin` | `{ origin, enabled }` | Write storage, attach/detach debugger (debugger mode) |
| `clearAll` | `{}` | Remove origin keys from storage, detach all debuggers |
| `modeChange` | `{ mode }` | Full transition: clean up old mode, apply new mode |

In CSS mode the popup writes storage and injects CSS directly — no SW message
needed except for `modeChange`.

---

## Popup UI

- Width: 280px fixed. Height is dynamic.
- Font: IBM Plex Mono (loaded from Google Fonts)
- Theme: dark (`#0e0e0e` bg), green accent (`#a8ff78`)
- **Mode bar**: segmented control (Emulate / CSS Override) with hint text
- **Current tab**: always shown
- **Other origins**: scrollable, max-height 180px, shows only enabled origins
- **Clear all**: removes all storage keys and strips CSS / detaches debugger

When adding UI elements, follow the existing pattern in `makeRow()`. Avoid
inline styles — use CSS classes defined in `popup.html`.

---

## Comment style

Use `/* block comments */` throughout. Do not use `//` line comments.

---

## Testing

No automated tests. Manual testing checklist:

### CSS mode
- [ ] Toggle ON injects `<style id="reduced-motion-toggle-injected">` into page DOM
- [ ] Toggle OFF removes that element
- [ ] State persists after page reload (content script re-applies)
- [ ] `window.matchMedia('(prefers-reduced-motion: reduce)').matches` returns `false`

### Emulate (debugger) mode
- [ ] Toggle ON shows "debugging this browser" infobar
- [ ] `window.matchMedia('(prefers-reduced-motion: reduce)').matches` returns `true`
- [ ] Sites' own `@media (prefers-reduced-motion: reduce)` styles activate
- [ ] Toggle OFF detaches debugger, infobar disappears
- [ ] Navigating within enabled origin: emulation persists
- [ ] Navigating away from enabled origin: debugger detaches

### Both modes
- [ ] State persists after popup is closed and reopened
- [ ] Toggling from "Other origins" list affects all open tabs for that origin
- [ ] "Clear all" removes CSS / detaches debugger from every open tab
- [ ] Popup shows "Not available on this page" on `chrome://` pages
- [ ] Mode switch transitions cleanly (CSS removed when entering emulate, debugger detached when entering CSS)
- [ ] Extension loads without errors on `chrome://extensions`

To inspect injected CSS: DevTools → Elements → search for `reduced-motion-toggle-injected`.
To verify emulation: DevTools → Console → `matchMedia('(prefers-reduced-motion: reduce)').matches`.
To inspect storage: DevTools → Application → Storage → Extension storage.

---

## Possible future features

- Keyboard shortcut via `commands` manifest key
- Browser action badge showing enabled count
- Export/import origin list
- Per-tab mode (vs per-origin)
