// Before the page is drawn: dark mode if the visitor chose it (remembered in this browser), or
// else if their system prefers it. A file of its own, rather than inline in index.html, so the
// security policy can allow only the site's own script files.
try {
  const stored = localStorage.getItem('theme')
  const dark = stored
    ? stored === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.classList.toggle('dark', dark)
} catch {
  // Storage can be unavailable (private browsing, for one): then the default, light, is used.
}
