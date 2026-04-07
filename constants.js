/* constants.js — Shared constants for Reduced Motion Toggle */

const STYLE_ID = 'reduced-motion-toggle-injected';

const CSS = `
*, *::before, *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
  scroll-behavior: auto !important;
}
`;

const MODE_KEY = '_mode';
const MODE_DEBUGGER = 'debugger';
const MODE_CSS = 'css';
const DEFAULT_MODE = 'debugger';
