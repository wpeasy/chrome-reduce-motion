/* content.js — Reduced Motion Toggle */

/* Apply on page load if this origin is enabled in storage */
chrome.storage.local.get([location.origin], (result) => {
  if (result[location.origin] !== true) return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  (document.head || document.documentElement).appendChild(style);
});
