# Changelog

## v1.0.0 — 2026-04-07

Initial release.

- Popup toggle to force `prefers-reduced-motion` on any origin
- Per-origin persistence via `chrome.storage.local`
- Two-pronged CSS injection (immediate via `executeScript` + persistent via content script)
- "Other origins" list with individual toggles
- "Clear all" to remove reduced-motion from every open tab
- Dark theme UI with IBM Plex Mono
- Shared `constants.js` for DRY `STYLE_ID` / `CSS` definitions
