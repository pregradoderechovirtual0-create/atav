const VERSION_KEY = 'atav-app-version'
const CHECK_INTERVAL_MS = 5 * 60 * 1000

async function fetchServerVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?_=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json() as { version?: string }
    return typeof data.version === 'string' ? data.version : null
  } catch {
    return null
  }
}

/** Compara version.json del servidor con la guardada; recarga si hay deploy nuevo. */
export async function sincronizarVersionApp(): Promise<void> {
  const serverVersion = await fetchServerVersion()
  if (!serverVersion) return

  const localVersion = localStorage.getItem(VERSION_KEY)
  if (localVersion && localVersion !== serverVersion) {
    localStorage.setItem(VERSION_KEY, serverVersion)
    window.location.reload()
    return
  }

  if (!localVersion) {
    localStorage.setItem(VERSION_KEY, serverVersion)
  }
}

export function iniciarControlVersionApp() {
  void sincronizarVersionApp()

  const interval = window.setInterval(() => {
    void sincronizarVersionApp()
  }, CHECK_INTERVAL_MS)

  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      void sincronizarVersionApp()
    }
  }

  document.addEventListener('visibilitychange', onVisible)

  return () => {
    window.clearInterval(interval)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
