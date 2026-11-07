const statusLabel = document.querySelector(".connection-label");
const RESULT_APPS = ["15puzzle", "2048", "blockfall", "minesweeper", "sudoku", "matematyka", "solitaire"];

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

function requestPersistentStorage() {
  navigator.storage?.persist?.().catch(() => {});
}

function setupSolitaireHost() {
  if (!window.matchMedia("(display-mode: standalone)").matches && navigator.standalone !== true) return;
  const link = document.querySelector(".game-card.solitaire");
  const shell = document.querySelector(".page-shell");
  if (!link || !shell || new URL(link.href).origin !== location.origin) return;
  const route = "#solitaire";
  const title = document.title;
  let frame = null;
  let returning = false;

  function syncView() {
    returning = false;
    if (location.hash === route) {
      if (frame) return;
      frame = document.createElement("iframe");
      frame.id = "playground-solitaire";
      frame.name = "playground-solitaire";
      frame.title = "Pasjans Klondike";
      frame.src = link.href;
      frame.addEventListener("load", () => frame?.focus());
      shell.inert = true;
      document.body.classList.add("solitaire-open");
      document.title = "Pasjans Klondike — Playground";
      document.body.append(frame);
    } else if (frame) {
      frame.remove();
      frame = null;
      shell.inert = false;
      document.body.classList.remove("solitaire-open");
      document.title = title;
      renderResults();
      link.focus({ preventScroll: true });
    }
  }

  function openGame() {
    if (frame) return;
    history.pushState({ playgroundGame: "solitaire" }, "", route);
    syncView();
  }

  link.addEventListener("click", event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openGame();
  });
  // Native Back may have already canceled the child's pointer before this event.
  window.navigation?.addEventListener("navigate", event => {
    if (frame && !returning && event.navigationType === "traverse"
      && event.destination.sameDocument && event.cancelable) event.preventDefault();
  });
  window.addEventListener("message", event => {
    if (!frame || event.origin !== location.origin || event.source !== frame.contentWindow) return;
    if (event.data?.type === "PLAYGROUND_EXIT_SOLITAIRE") {
      returning = true;
      history.back();
    } else if (event.data?.type === "PLAYGROUND_RELOAD") location.reload();
  });
  window.addEventListener("popstate", syncView);
  window.addEventListener("hashchange", syncView);

  if (location.hash === route) {
    const entries = window.navigation?.entries?.() || [];
    const previous = entries[(window.navigation?.currentEntry?.index ?? 0) - 1];
    if (!previous?.sameDocument) {
      // A direct game URL needs a launcher entry in this document for Back/exit.
      const launcher = new URL(location.href);
      launcher.hash = "";
      history.replaceState(null, "", launcher.href);
      openGame();
    } else syncView();
  }
}

document.querySelectorAll(".game-card").forEach(card => {
  card.addEventListener("pointerdown", requestPersistentStorage, { once: true, passive: true });
});

window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);
window.addEventListener("pageshow", renderResults);
document.addEventListener("visibilitychange", () => { if (!document.hidden) renderResults(); });
updateConnectionStatus();
renderResults();
setupSolitaireHost();

