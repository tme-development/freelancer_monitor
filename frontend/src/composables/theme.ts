import { ref } from 'vue';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme_mode';
const themeMode = ref<ThemeMode>('light');

function getPreferredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function readStoredTheme(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
  return raw === 'dark' || raw === 'light' ? raw : null;
}

export function applyTheme(mode: ThemeMode): void {
  themeMode.value = mode;
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.classList.toggle('dark', mode === 'dark');
    root.style.colorScheme = mode;
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  }
}

export function initTheme(initial?: ThemeMode | null): ThemeMode {
  const mode = initial ?? readStoredTheme() ?? getPreferredTheme();
  applyTheme(mode);
  return mode;
}

export function useTheme() {
  return {
    themeMode,
    applyTheme,
    initTheme,
  };
}
