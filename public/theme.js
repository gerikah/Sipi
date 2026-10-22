// Run before the page is painted. Storage may be blocked by the browser.
(() => {
  let saved
  try { saved = localStorage.getItem('sipi-theme') } catch { /* Use system preference. */ }
  const theme = saved === 'light' || saved === 'dark'
    ? saved
    : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
})()
