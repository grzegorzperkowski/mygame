const statusLabel = document.querySelector('.connection-label');

function updateConnectionStatus() {
  const online = navigator.onLine;
  document.body.classList.toggle('is-offline', !online);
  statusLabel.textContent = online ? 'Ready to play' : 'Offline mode';
}

window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);
updateConnectionStatus();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}
