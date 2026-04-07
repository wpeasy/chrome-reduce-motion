# Reduced Motion Toggle

A Chrome extension that forces reduced-motion behaviour on any site, per origin,
with a single toggle in the browser toolbar.

## What it does

Injects a stylesheet that overrides animation and transition durations to
`0.01ms` — imperceptible to users but still firing JS transition events.
Settings persist across page reloads and browser restarts, per origin.

## Install (development)

1. Download and unzip the extension folder
2. Go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select the unzipped folder
5. The clock icon appears in your toolbar

## Usage

Click the toolbar icon to open the popup:

- **Current tab** — toggle reduced motion for the current site's origin
- **Other origins** — lists all other origins where reduced motion is enabled;
  each can be toggled off individually
- **Clear all** — disables reduced motion on every origin and all open tabs

## How it works

CSS is applied via two mechanisms:

- **Immediate**: `chrome.scripting.executeScript` injects a `<style>` tag into
  every open tab matching the origin when you toggle. Works without a page reload.
- **Persistent**: A content script running at `document_start` checks storage
  and re-applies the stylesheet on every page load.

## Permissions

| Permission  | Purpose |
|-------------|---------|
| `activeTab` | Read current tab URL |
| `scripting` | Inject CSS into page |
| `storage`   | Remember enabled origins |

No data leaves your browser. Nothing is sent to any server.

## Browser support

Works in any Chromium-based browser: Chrome, Edge, Brave, Arc.

## Development

See `CLAUDE.md` for architecture notes, known tech debt, and testing checklist.
