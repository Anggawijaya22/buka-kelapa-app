const KEY = 'bk_theme';

export function getTheme() {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function setTheme(theme) {
  try { localStorage.setItem(KEY, theme); } catch {}
  document.documentElement.setAttribute('data-theme', theme);
}
