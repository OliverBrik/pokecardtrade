export function installChunkRecovery(browser) {
  browser.addEventListener('vite:preloadError', event => {
    const now = Date.now()
    // A persistent network failure must not cause an endless reload loop.
    try {
      const last = Number(browser.sessionStorage.getItem('kardvia:chunk-reload') || 0)
      if (last && now - last < 60000) return
      browser.sessionStorage.setItem('kardvia:chunk-reload', String(now))
    } catch { return }
    event.preventDefault()
    browser.location.reload()
  })
}
