# Reduced Motion Toggle — Chrome Extension

A Manifest V3 Chrome extension that forces `prefers-reduced-motion` behaviour
on any origin via a popup toggle. No build step. Vanilla JS throughout.

---

## Architecture

```
manifest.json      Extension manifest (MV3)
popup.html         Popup UI — markup and styles (inline)
popup.js           Popup logic — reads storage, drives UI, injects CSS
content.js         Content script — re-applies CSS on page reload
constants.js       Shared constants (STYLE_ID, CSS)
icons/             PNG icons at 16, 32, 48, 128px
```

### Two-pronged injection

CSS is applied via two separate mechanisms that work together:

1. **Immediate** (`popup.js` → `chrome.scripting.executeScript`): When the user
   toggles, the popup directly executes a function in every matching tab. This
   works even if the content script isn't present (e.g. tabs opened before the
   extension was installed). Does not survive page reload.

2. **Persistence** (`content.js`): Runs at `document_start` on every page load.
   Reads `chrome.storage.local` and re-injects CSS if the origin is enabled.
   Handles the reload case that `executeScript` cannot.

Do not collapse these into one mechanism — each covers a gap the other has.

---

## Storage schema

`chrome.storage.local` stores only **enabled** origins:

```js
{ "https://example.com": true, "https://other.com": true }
```

Disabling an origin calls `chrome.storage.local.remove(origin)` — it is not
stored as `false`. When reading all origins, filter for `val === true`.

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
| `scripting`  | `chrome.scripting.executeScript` for immediate injection |
| `storage`    | Persist enabled origins across sessions |

The extension has no background service worker — none is needed.

---

## Popup UI

- Width: 280px fixed. Height is dynamic.
- Font: IBM Plex Mono (loaded from Google Fonts)
- Theme: dark (`#0e0e0e` bg), green accent (`#a8ff78`)
- Two sections: **Current tab** (always shown) + **Other origins** (scrollable, max-height 180px)
- "Other origins" shows only enabled origins. Disabling one removes it from the list.
- "Clear all" removes all storage keys and strips CSS from every open tab.

When adding UI elements, follow the existing pattern in `makeRow()`. Avoid
inline styles — use CSS classes defined in `popup.html`.

---

## Comment style

Use `/* block comments */` throughout. Do not use `//` line comments.

---

---

## Testing

No automated tests. Manual testing checklist:

- [ ] Toggle ON injects `<style id="reduced-motion-toggle-injected">` into page DOM
- [ ] Toggle OFF removes that element
- [ ] State persists after page reload (content script re-applies)
- [ ] State persists after popup is closed and reopened
- [ ] Toggling from "Other origins" list affects all open tabs for that origin
- [ ] "Clear all" removes CSS from every open tab, not just the current one
- [ ] Popup shows "Not available on this page" on `chrome://` pages
- [ ] Extension loads without errors on `chrome://extensions` (check for red errors)

To inspect injected CSS: DevTools → Elements → search for `reduced-motion-toggle-injected`.
To inspect storage: DevTools → Application → Storage → Extension storage.

---

## Possible future features

- Keyboard shortcut via `commands` manifest key
- Browser action badge showing enabled count
- Export/import origin list
- Per-tab mode (vs per-origin)
