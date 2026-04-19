// ── BLE Constants ──────────────────────────────────────────────────────────
const LIGHTHOUSE_SERVICE_UUID  = '00001523-1212-efde-1523-785feabcd124';
const CURRENT_POWER_STATE_UUID = '00001525-1212-efde-1523-785feabcd124'; // READ/WRITE/NOTIFY
const CALIBRATION_SERVICE_UUID = '00000000-0060-7990-5544-1cce81af42f0';
const CALIBRATION_DATA_UUID    = '00000010-0060-7990-5544-1cce81af42f0'; // READ

const CMD_ON      = new Uint8Array([0x01]);
const CMD_SLEEP   = new Uint8Array([0x00]);
const CMD_STANDBY = new Uint8Array([0x02]);

const POWER_STATES = {
  0x00: { label: 'Sleep',       cls: 'sleep' },
  0x01: { label: 'Booting',     cls: 'transition' },
  0x02: { label: 'Standby',     cls: 'standby' },
  0x08: { label: 'Waking',      cls: 'transition' },
  0x09: { label: 'Powering On', cls: 'transition' },
  0x0B: { label: 'On',          cls: 'on' },
};

// ── Device state ───────────────────────────────────────────────────────────
// Map<deviceId, { device, server, powerChar, calibChar,
//                 connected, connecting, lastSeen, watching,
//                 _onDisconnected, _onAdvertisement, _onPowerChanged }>
const deviceStates = new Map();

// ── localStorage helpers ───────────────────────────────────────────────────
function getNicknames() {
  try { return JSON.parse(localStorage.getItem('ble_nicknames') || '{}'); } catch { return {}; }
}
function setNickname(id, name) {
  const n = getNicknames();
  n[id] = name;
  localStorage.setItem('ble_nicknames', JSON.stringify(n));
}
function getAutoReconnect() {
  try { return new Set(JSON.parse(localStorage.getItem('ble_auto_reconnect') || '[]')); } catch { return new Set(); }
}
function setAutoReconnect(id, enabled) {
  const s = getAutoReconnect();
  if (enabled) s.add(id); else s.delete(id);
  localStorage.setItem('ble_auto_reconnect', JSON.stringify([...s]));
}
function getHidden() {
  try { return new Set(JSON.parse(localStorage.getItem('ble_hidden') || '[]')); } catch { return new Set(); }
}
function hideDevice(id) {
  const s = getHidden();
  s.add(id);
  localStorage.setItem('ble_hidden', JSON.stringify([...s]));
}

// ── Permission status ──────────────────────────────────────────────────────
function renderPermStatus() {
  const webBtRow   = document.getElementById('perm-web-bt');
  const backendRow = document.getElementById('perm-new-backend');

  const hasWebBt   = !!navigator.bluetooth;
  const hasBackend = hasWebBt && typeof navigator.bluetooth.getDevices === 'function';

  function applyBadge(row, ok, okLabel, failLabel) {
    const badge = row.querySelector('.perm-badge');
    badge.textContent = ok ? okLabel : failLabel;
    badge.className   = 'perm-badge ' + (ok ? 'perm-ok' : 'perm-fail');
  }

  applyBadge(webBtRow,   hasWebBt,   'Enabled', 'Not available');
  applyBadge(backendRow, hasBackend, 'Enabled', 'Disabled');
  backendRow.querySelector('.perm-hint').hidden = hasBackend;
}

// ── Card helpers ───────────────────────────────────────────────────────────
function getCard(id) { return document.getElementById('card-' + id); }

function createCard(device) {
  const id = device.id;

  const card = document.createElement('div');
  card.className = 'device-card';
  card.id = 'card-' + id;

  // Static structure — no user data in innerHTML
  card.innerHTML = `
    <div class="card-header">
      <div class="card-title">
        <input class="nickname-input" type="text" title="Click to rename" />
        <span class="device-subname"></span>
      </div>
      <div class="card-indicators">
        <span class="avail-dot"></span>
        <span class="badge">Disconnected</span>
      </div>
    </div>
    <div class="card-inline-error"></div>
    <div class="action-grid">
      <button class="action-btn btn-on" disabled>Power On</button>
      <button class="action-btn btn-standby" disabled>Standby</button>
      <button class="action-btn btn-sleep" disabled>Sleep</button>
      <button class="action-btn btn-calibration" disabled>Get Cal. Data</button>
    </div>
    <pre class="cal-data"></pre>
    <div class="card-footer">
      <label class="auto-reconnect-label">
        <input type="checkbox" class="auto-reconnect-check" />
        Auto-reconnect
      </label>
      <div class="footer-btns">
        <button class="connect-btn">Connect</button>
        <button class="remove-btn">Remove</button>
      </div>
    </div>
  `;

  // Set user-data values programmatically
  const nicknames     = getNicknames();
  const autoReconnect = getAutoReconnect();
  card.querySelector('.nickname-input').value               = nicknames[id] || device.name || '(unnamed)';
  card.querySelector('.auto-reconnect-check').checked       = autoReconnect.has(id);

  // Events
  card.querySelector('.nickname-input').addEventListener('blur', () => {
    const input = card.querySelector('.nickname-input');
    const val   = input.value.trim() || device.name || '(unnamed)';
    input.value = val;
    setNickname(id, val);
    updateSubname(id);
  });

  card.querySelector('.auto-reconnect-check').addEventListener('change', e => {
    setAutoReconnect(id, e.target.checked);
  });

  card.querySelector('.connect-btn').addEventListener('click', () => {
    const state = deviceStates.get(id);
    if (state?.connected) {
      state.device.gatt.disconnect();
    } else {
      connectDevice(id);
    }
  });

  card.querySelector('.remove-btn').addEventListener('click', () => removeCard(id));

  card.querySelector('.btn-on').addEventListener('click',          () => writePower(id, CMD_ON));
  card.querySelector('.btn-standby').addEventListener('click',     () => writePower(id, CMD_STANDBY));
  card.querySelector('.btn-sleep').addEventListener('click',       () => writePower(id, CMD_SLEEP));
  card.querySelector('.btn-calibration').addEventListener('click', () => readCalibration(id));

  document.getElementById('device-list').appendChild(card);
  updateSubname(id);
  updateCard(id);
}

function updateSubname(id) {
  const card = getCard(id);
  if (!card) return;
  const state   = deviceStates.get(id);
  const device  = state?.device;
  if (!device) return;
  const nickname  = card.querySelector('.nickname-input').value;
  const subEl     = card.querySelector('.device-subname');
  const showSub   = nickname && nickname !== device.name && !!device.name;
  subEl.textContent = showSub ? device.name : '';
  subEl.hidden      = !showSub;
}

function updateCard(id) {
  const card = getCard(id);
  if (!card) return;
  const state = deviceStates.get(id);

  const connected  = state?.connected  ?? false;
  const connecting = state?.connecting ?? false;
  const lastSeen   = state?.lastSeen   ?? null;
  const available  = lastSeen !== null && (Date.now() - lastSeen) < 30_000;

  // Availability dot
  const dot = card.querySelector('.avail-dot');
  if (connected) {
    dot.className = 'avail-dot connected';
    dot.title = 'Connected';
  } else if (available) {
    dot.className = 'avail-dot available';
    dot.title = 'Advertising — nearby';
  } else {
    dot.className = 'avail-dot';
    dot.title = 'Not seen recently';
  }

  // Dim card when device is neither connected nor recently seen
  card.classList.toggle('unavailable', !connected && !available && !connecting);

  // Power badge — only overwrite when not connected (connected state is managed by onPowerChanged)
  if (!connected) {
    const badge = card.querySelector('.badge');
    if (connecting) {
      badge.textContent = 'Connecting\u2026';
      badge.className   = 'badge badge-transition';
    } else {
      badge.textContent = 'Disconnected';
      badge.className   = 'badge';
    }
  }

  // Action buttons
  const busy = connecting;
  card.querySelector('.btn-on').disabled          = !connected || busy;
  card.querySelector('.btn-standby').disabled     = !connected || busy;
  card.querySelector('.btn-sleep').disabled       = !connected || busy;
  card.querySelector('.btn-calibration').disabled = !connected || busy || !state?.calibChar;

  const connectBtn = card.querySelector('.connect-btn');
  connectBtn.textContent = connected ? 'Disconnect' : (connecting ? 'Connecting\u2026' : 'Connect');
  connectBtn.disabled    = connecting;
}

function removeCard(id) {
  const state = deviceStates.get(id);
  if (state) {
    // Remove listeners first so events don't fire after cleanup
    state.device.removeEventListener('gattserverdisconnected', state._onDisconnected);
    state.device.removeEventListener('advertisementreceived',  state._onAdvertisement);
    if (state.watching) {
      try { state.device.stopWatchingAdvertisements(); } catch {}
    }
    if (state.connected) {
      try { state.device.gatt.disconnect(); } catch {}
    }
    deviceStates.delete(id);
  }
  hideDevice(id);
  getCard(id)?.remove();
}

function showCardError(id, msg) {
  const card = getCard(id);
  if (!card) return;
  const el = card.querySelector('.card-inline-error');
  el.textContent    = msg;
  el.style.display  = msg ? 'block' : 'none';
}

function clearCardError(id) { showCardError(id, ''); }

// ── Power badge ────────────────────────────────────────────────────────────
function updatePowerBadge(id, value) {
  const card = getCard(id);
  if (!card) return;
  const ps    = POWER_STATES[value] ?? { label: `Unknown (0x${value.toString(16).toUpperCase().padStart(2, '0')})`, cls: '' };
  const badge = card.querySelector('.badge');
  badge.textContent = ps.label;
  badge.className   = 'badge' + (ps.cls ? ' badge-' + ps.cls : '');
}

// ── Advertisement watching ─────────────────────────────────────────────────
function startWatching(id) {
  const state = deviceStates.get(id);
  if (!state || state.watching || state.connected || state.connecting) return;
  if (typeof state.device.watchAdvertisements !== 'function') return;
  try {
    state.device.watchAdvertisements();
    state.watching = true;
  } catch {}
}

function stopWatching(id) {
  const state = deviceStates.get(id);
  if (!state || !state.watching) return;
  try { state.device.stopWatchingAdvertisements(); } catch {}
  state.watching = false;
}

// Refresh availability dots every 5 s (for the 30 s timeout)
setInterval(() => {
  for (const [id, state] of deviceStates) {
    if (!state.connected && !state.connecting) updateCard(id);
  }
}, 5_000);

// ── Connect flow ───────────────────────────────────────────────────────────
async function connectDevice(id) {
  const state = deviceStates.get(id);
  if (!state || state.connected || state.connecting) return;

  clearCardError(id);
  state.connecting = true;
  updateCard(id);

  stopWatching(id);

  try {
    const server = await state.device.gatt.connect();
    state.server = server;

    // Lighthouse V2 service
    const lighthouseService = await server.getPrimaryService(LIGHTHOUSE_SERVICE_UUID);
    const powerChar         = await lighthouseService.getCharacteristic(CURRENT_POWER_STATE_UUID);
    state.powerChar = powerChar;

    const onPowerChanged = e => updatePowerBadge(id, e.target.value.getUint8(0));
    state._onPowerChanged = onPowerChanged;
    powerChar.addEventListener('characteristicvaluechanged', onPowerChanged);
    await powerChar.startNotifications();

    const initialValue = await powerChar.readValue();
    updatePowerBadge(id, initialValue.getUint8(0));

    // Calibration service (optional)
    try {
      const calService  = await server.getPrimaryService(CALIBRATION_SERVICE_UUID);
      state.calibChar   = await calService.getCharacteristic(CALIBRATION_DATA_UUID);
    } catch {
      state.calibChar = null;
    }

    state.connected  = true;
    state.connecting = false;
    updateCard(id);

  } catch (err) {
    state.connecting = false;
    state.connected  = false;
    updateCard(id);
    if (err.name !== 'NotFoundError') {
      showCardError(id, `Connection failed: ${err.name} \u2014 ${err.message}`);
    }
    startWatching(id);
  }
}

// ── Write power command ────────────────────────────────────────────────────
async function writePower(id, bytes) {
  const state = deviceStates.get(id);
  if (!state?.powerChar) return;
  clearCardError(id);
  const card = getCard(id);
  if (card) {
    card.querySelector('.btn-on').disabled      = true;
    card.querySelector('.btn-standby').disabled = true;
    card.querySelector('.btn-sleep').disabled   = true;
  }
  try {
    await state.powerChar.writeValueWithResponse(bytes);
  } catch (err) {
    showCardError(id, `Write failed: ${err.message}`);
  } finally {
    updateCard(id);
  }
}

// ── Read calibration ───────────────────────────────────────────────────────
async function readCalibration(id) {
  const state = deviceStates.get(id);
  if (!state?.calibChar) return;
  clearCardError(id);
  const card  = getCard(id);
  const calEl = card?.querySelector('.cal-data');
  const btn   = card?.querySelector('.btn-calibration');
  if (btn) btn.disabled = true;
  if (calEl) calEl.textContent = 'Reading\u2026';
  try {
    const value = await state.calibChar.readValue();
    const bytes = [];
    for (let i = 0; i < value.byteLength; i++) {
      bytes.push(value.getUint8(i).toString(16).toUpperCase().padStart(2, '0'));
    }
    if (calEl) calEl.textContent = bytes.join(' ');
  } catch (err) {
    if (calEl) calEl.textContent = '';
    showCardError(id, `Calibration read failed: ${err.message}`);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ── Register device (create state + card + event listeners) ───────────────
function registerDevice(device) {
  const id = device.id;
  if (deviceStates.has(id)) return;

  const _onDisconnected = () => {
    const s = deviceStates.get(id);
    if (!s) return;
    if (s.powerChar && s._onPowerChanged) {
      try { s.powerChar.removeEventListener('characteristicvaluechanged', s._onPowerChanged); } catch {}
      s._onPowerChanged = null;
    }
    s.connected  = false;
    s.connecting = false;
    s.server     = null;
    s.powerChar  = null;
    s.calibChar  = null;
    const calEl = getCard(id)?.querySelector('.cal-data');
    if (calEl) calEl.textContent = '';
    updateCard(id);
    startWatching(id);
    if (getAutoReconnect().has(id)) {
      setTimeout(() => connectDevice(id), 2_000);
    }
  };

  const _onAdvertisement = () => {
    const s = deviceStates.get(id);
    if (!s) return;
    s.lastSeen = Date.now();
    updateCard(id);
  };

  device.addEventListener('gattserverdisconnected', _onDisconnected);
  device.addEventListener('advertisementreceived',  _onAdvertisement);

  deviceStates.set(id, {
    device,
    server:          null,
    powerChar:       null,
    calibChar:       null,
    connected:       false,
    connecting:      false,
    lastSeen:        null,
    watching:        false,
    _onDisconnected,
    _onAdvertisement,
    _onPowerChanged: null,
  });

  createCard(device);
  startWatching(id);
}

// ── Add Base Station button ────────────────────────────────────────────────
document.getElementById('add-btn').addEventListener('click', async () => {
  const addBtn  = document.getElementById('add-btn');
  const errorEl = document.getElementById('error');
  addBtn.disabled = true;
  errorEl.style.display = 'none';

  try {
    const device = await navigator.bluetooth.requestDevice({
      filters:          [{ namePrefix: 'LHB-' }],
      optionalServices: [LIGHTHOUSE_SERVICE_UUID, CALIBRATION_SERVICE_UUID],
    });
    registerDevice(device);
    connectDevice(device.id);
  } catch (err) {
    if (err.name !== 'NotFoundError') {
      errorEl.textContent   = `${err.name} \u2014 ${err.message}`;
      errorEl.style.display = 'block';
      setTimeout(() => { errorEl.style.display = 'none'; }, 6_000);
    }
  } finally {
    addBtn.disabled = false;
  }
});

// ── Init ───────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  renderPermStatus();

  if (!navigator.bluetooth) {
    document.getElementById('add-btn').disabled = true;
    return;
  }

  if (typeof navigator.bluetooth.getDevices !== 'function') return;

  const hidden  = getHidden();
  const devices = await navigator.bluetooth.getDevices();
  for (const device of devices) {
    if (!hidden.has(device.id)) {
      registerDevice(device);
    }
  }
});
