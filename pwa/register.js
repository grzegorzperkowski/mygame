(() => {
  "use strict";
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  if (window.__playgroundPwaRegistrationStarted) return;
  window.__playgroundPwaRegistrationStarted = true;

  const root = new URL("../", document.currentScript.src);
  const installButton = document.querySelector("#install-button");
  const installHelp = document.querySelector("#install-help");
  const offlineStatus = document.querySelector("#offline-status");
  const updatePanel = document.querySelector("#update-panel");
  const updateButton = document.querySelector("#update-button");
  let installPrompt = null;
  let waitingWorker = null;
  let reloadForUpdate = false;

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

  function acceptUpdate() {
    if (!waitingWorker) return;
    reloadForUpdate = true;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    if (updateButton) updateButton.disabled = true;
  }

  updateButton?.addEventListener("click", acceptUpdate);
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (reloadForUpdate) window.location.reload(); });
  navigator.serviceWorker.addEventListener("message", event => {
    if (event.data?.type === "PLAYGROUND_SHELL_READY" && offlineStatus) offlineStatus.textContent = "All games ready offline";
  });

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault(); installPrompt = event;
    if (installButton && !isStandalone()) installButton.hidden = false;
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    if (installButton) installButton.hidden = true;
    if (installHelp) installHelp.hidden = true;
  });
  installButton?.addEventListener("click", async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    installButton.hidden = true;
  });
  if (isStandalone()) { if (installButton) installButton.hidden = true; if (installHelp) installHelp.hidden = true; }

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register(new URL("service-worker.js", root), { scope: root.pathname, updateViaCache: "none" });
      if (registration.waiting) showUpdate(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => { if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdate(registration.waiting || worker); });
      });
      const ready = await navigator.serviceWorker.ready;
      (ready.active || navigator.serviceWorker.controller)?.postMessage({ type: "CHECK_SHELL_READY" });
      registration.update().catch(() => {});
    } catch {
      if (offlineStatus) offlineStatus.textContent = "Offline setup failed — reconnect and reload to retry";
    }
  }, { once: true });
})();
