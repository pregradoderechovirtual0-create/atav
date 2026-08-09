import { ROL_JEFA_SUPREMA } from '@/lib/roles'

const JEFA_THEME_CLASS = 'theme-jefa-suprema'
const JEFA_PINK_PREF_KEY = 'atav-jefa-pink-theme'

const JEFA_VARS: Record<string, string> = {
  '--color-primary': '#f7bbc9',
  '--color-background': '#fffafb',
  '--color-surface': '#fffcfc',
  '--color-text': '#73112d',
}

export function isJefaPinkThemePreferred(): boolean {
  if (typeof localStorage === 'undefined') return true
  const stored = localStorage.getItem(JEFA_PINK_PREF_KEY)
  if (stored === null) return true
  return stored === 'true'
}

export function setJefaPinkThemePreference(enabled: boolean): void {
  localStorage.setItem(JEFA_PINK_PREF_KEY, enabled ? 'true' : 'false')
}

export function applyThemeForRole(rol: string | null) {
  const root = document.documentElement
  root.classList.remove(JEFA_THEME_CLASS)

  Object.keys(JEFA_VARS).forEach(key => root.style.removeProperty(key))

  const shouldApplyPink = rol === ROL_JEFA_SUPREMA && isJefaPinkThemePreferred()
  if (shouldApplyPink) {
    Object.entries(JEFA_VARS).forEach(([key, value]) => {
      root.style.setProperty(key, value)
    })
    root.classList.add(JEFA_THEME_CLASS)
  }
}

export function setJefaPinkTheme(enabled: boolean, rol: string) {
  setJefaPinkThemePreference(enabled)
  applyThemeForRole(rol)
}
