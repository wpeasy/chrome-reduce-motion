# Changelog

## v1.0.1 — 2026-04-07

- **New: Emulate mode** — uses `chrome.debugger` with `Emulation.setEmulatedMedia` to truly set `prefers-reduced-motion: reduce` via DevTools protocol. Both CSS `@media` queries and `window.matchMedia()` respond correctly.
- **Mode toggle in popup** — switch between Emulate (accurate, shows debugger infobar) and CSS Override (brute-force, no infobar)
- **New: background service worker** (`background.js`) — manages debugger attach/detach lifecycle across tabs and navigations
- Added `debugger` and `tabs` permissions
- Content script now skips CSS injection when in Emulate mode
- Storage schema extended with `_mode` meta key (defaults to `css` for existing installs)

## v1.0.0 — 2026-04-07

Initial release.

- Popup toggle to force `prefers-reduced-motion` on any origin
- Per-origin persistence via `chrome.storage.local`
- Two-pronged CSS injection (immediate via `executeScript` + persistent via content script)
- "Other origins" list with individual toggles
- "Clear all" to remove reduced-motion from every open tab
- Dark theme UI with IBM Plex Mono
- Shared `constants.js` for DRY `STYLE_ID` / `CSS` definitions
