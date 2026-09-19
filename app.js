const statusLabel = document.querySelector(".connection-label");
const RESULT_APPS = ["15puzzle", "2048", "blockfall", "minesweeper", "sudoku", "matematyka"];

function updateConnectionStatus() {
  const online = navigator.onLine;
  document.body.classList.toggle("is-offline", !online);
  statusLabel.textContent = online ? "Ready to play" : "Offline mode";
}

function renderResults() {
  for (const app of RESULT_APPS) {
    const target = document.querySelector(`[data-result="${app}"]`);
    if (!target) continue;
    try {
      const result = JSON.parse(localStorage.getItem(`playground.result.${app}.v1`));
      const primary = result?.summary?.primary;
      const secondary = result?.summary?.secondary;
      if (result?.version !== 1 || result.app !== app || !Number.isFinite(result.updatedAt) || typeof primary !== "string" || typeof secondary !== "string") continue;
      const strong = document.createElement("strong"); strong.textContent = primary.slice(0, 80);
      const detail = document.createElement("span"); detail.textContent = secondary.slice(0, 100);
      target.replaceChildren(strong, detail);
    } catch { /* Malformed or blocked storage must not affect the shelf. */ }
  }
}

document.querySelector("#persist-button")?.addEventListener("click", async event => {
  const button = event.currentTarget;
  if (!navigator.storage?.persist) { button.textContent = "Storage persistence is not supported here"; button.disabled = true; return; }
  try {
    const granted = await navigator.storage.persist();
    button.textContent = granted ? "Offline games protected on this device" : "Browser will manage offline storage";
  } catch { button.textContent = "Could not change storage settings"; }
  button.disabled = true;
});

window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);
window.addEventListener("pageshow", renderResults);
document.addEventListener("visibilitychange", () => { if (!document.hidden) renderResults(); });
updateConnectionStatus();
renderResults();

