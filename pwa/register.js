(() => {
  "use strict";
  if (location.protocol === "file:" || !("serviceWorker" in navigator) || !window.isSecureContext) return;
  if (window.__playgroundPwaRegistrationStarted) return;
  window.__playgroundPwaRegistrationStarted = true;

  const root = new URL("../", document.currentScript.src);
  const installButton = document.querySelector("#install-button");
  const installHelp = document.querySelector("#install-help");
  const offlineStatus = document.querySelector("#offline-status");
  const updatePanel = document.querySelector("#update-panel");
  const updateButton = document.querySelector("#update-button");
  const pageVersion = document.querySelector("[data-playground-build]")?.dataset.playgroundBuild;
  let installPrompt = null;
  let waitingWorker = null;
  let reloadForUpdate = false;
  let reloading = false;
  let controllerTried = false;
  let reloadTimer = 0;
  let versionTimer = 0;
  function reloadOnce() {
    if (!reloadForUpdate || reloading) return;
    reloading = true;
    window.clearTimeout(reloadTimer);
    window.location.reload();
  }

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  }

  function showUpdate(worker) {
    waitingWorker = worker;
    if (updatePanel) updatePanel.hidden = false;
    else if (!document.querySelector("[data-playground-update]")) {
      const notice = document.createElement("aside");
      notice.dataset.playgroundUpdate = ""; notice.setAttribute("role", "status");
      notice.style.cssText = "position:fixed;z-index:9999;right:1rem;bottom:1rem;display:flex;gap:.75rem;align-items:center;padding:.85rem 1rem;border-radius:.75rem;color:#fff;background:#17182d;box-shadow:0 8px 30px #0005;font:600 14px/1.3 system-ui";
      const text = document.createElement("span"); text.textContent = "Playground update available";
      const button = document.createElement("button"); button.type = "button"; button.textContent = "Reload";
      button.addEventListener("click", acceptUpdate); notice.append(text, button); document.body.append(notice);
    }
  }

  function checkUpdate(worker) {
    waitingWorker = worker;
    window.clearTimeout(versionTimer);
    if (!pageVersion) { showUpdate(worker); return; }
    versionTimer = window.setTimeout(() => showUpdate(worker), 2000);
    try { worker.postMessage({ type: "GET_VERSION" }); }
    catch { window.clearTimeout(versionTimer); showUpdate(worker); }
  }

  function acceptUpdate(event) {
    if (!waitingWorker || reloadForUpdate) return;
    reloadForUpdate = true;
    window.clearTimeout(versionTimer);
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    if (updateButton) updateButton.disabled = true;
    if (event?.currentTarget && "disabled" in event.currentTarget) event.currentTarget.disabled = true;
    window.clearTimeout(reloadTimer);
    reloadTimer = window.setTimeout(reloadOnce, 1000);
  }

  updateButton?.addEventListener("click", acceptUpdate);
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!reloadForUpdate || reloading || controllerTried) return;
    controllerTried = true;
    window.addEventListener("pagehide", () => { reloading = true; window.clearTimeout(reloadTimer); }, { once: true });
    window.location.reload();
  });
  navigator.serviceWorker.addEventListener("message", event => {
    if (event.data?.type === "PLAYGROUND_SHELL_READY" && offlineStatus) offlineStatus.textContent = "All games ready offline";
    if (event.data?.type === "PLAYGROUND_VERSION" && waitingWorker && event.source === waitingWorker && !reloadForUpdate) {
      window.clearTimeout(versionTimer);
      if (pageVersion && event.data.version === pageVersion) {
        waitingWorker.postMessage({ type: "SKIP_WAITING" });
        waitingWorker = null;
        if (updatePanel) updatePanel.hidden = true;
        document.querySelector("[data-playground-update]")?.remove();
      } else showUpdate(waitingWorker);
    }
  });

  window.addEventListener("beforeinstallprompt", event => {
    // Vendored game pages have no install button, so let the browser show its own UI.
    if (!installButton || isStandalone()) return;
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    if (installButton) installButton.hidden = true;
    if (installHelp) installHelp.hidden = true;
  });
  installButton?.addEventListener("click", async () => {
    if (!installPrompt) return;
    navigator.storage?.persist?.().catch(() => {});
    await installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    installButton.hidden = true;
  });
  if (isStandalone()) { if (installButton) installButton.hidden = true; if (installHelp) installHelp.hidden = true; }

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register(new URL("service-worker.js", root), { scope: root.pathname, updateViaCache: "none" });
      if (registration.waiting) checkUpdate(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => { if (worker.state === "installed" && navigator.serviceWorker.controller) checkUpdate(registration.waiting || worker); });
      });
      const checkForUpdate = () => {
        if (!document.hidden) registration.update().catch(() => {});
      };
      document.addEventListener("visibilitychange", checkForUpdate);
      window.addEventListener("pageshow", event => { if (event.persisted) checkForUpdate(); });
      const ready = await navigator.serviceWorker.ready;
      (ready.active || navigator.serviceWorker.controller)?.postMessage({ type: "CHECK_SHELL_READY" });
      checkForUpdate();
    } catch {
      if (offlineStatus) offlineStatus.textContent = "Offline setup failed — reconnect and reload to retry";
    }
  }, { once: true });
})();
