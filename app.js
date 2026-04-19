const btn = document.getElementById('scan-btn');
const statusEl = document.getElementById('status');
const errorEl = document.getElementById('error');
const resultsEl = document.getElementById('results');

// Accumulate devices across multiple scan taps
const seenDevices = new Map(); // device.id -> device

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.style.display = 'block';
}

function clearError() {
  errorEl.style.display = 'none';
}

function renderDevices() {
  resultsEl.innerHTML = '';

  seenDevices.forEach(device => {
    const card = document.createElement('div');
    card.className = 'device-card';

    const nameEl = document.createElement('div');
    nameEl.className = 'device-name' + (device.name ? '' : ' unknown');
    nameEl.textContent = device.name || '(unnamed device)';

    const idEl = document.createElement('div');
    idEl.className = 'device-id';
    idEl.textContent = device.id;

    card.appendChild(nameEl);
    card.appendChild(idEl);
    resultsEl.appendChild(card);
  });
}

// Feature detection on load
window.addEventListener('DOMContentLoaded', () => {
  if (!navigator.bluetooth) {
    btn.disabled = true;
    showError(
      'Web Bluetooth is not available. ' +
      'Requires Google Chrome (not Chromium) over HTTPS with Bluetooth enabled. ' +
      'On Linux, also enable it at chrome://flags → search "Web Bluetooth".'
    );
  }
});

btn.addEventListener('click', async () => {
  clearError();
  btn.disabled = true;
  statusEl.textContent = 'Opening device picker\u2026';

  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
    });

    seenDevices.set(device.id, device);
    statusEl.textContent = `${seenDevices.size} device${seenDevices.size !== 1 ? 's' : ''} found`;
    renderDevices();

  } catch (err) {
    if (err.name === 'NotFoundError') {
      // User cancelled the picker — not a real error
      statusEl.textContent = 'Scan cancelled';
    } else if (err.name === 'SecurityError') {
      showError('Security error: this page must be served over HTTPS.');
      statusEl.textContent = 'Error';
    } else {
      showError(`Unexpected error: ${err.name} — ${err.message}`);
      statusEl.textContent = 'Error';
    }
  } finally {
    btn.disabled = false;
  }
});
