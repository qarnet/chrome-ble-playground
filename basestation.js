// Lighthouse V2 Service
const LIGHTHOUSE_SERVICE_UUID    = '00001523-1212-efde-1523-785feabcd124';
const UPDATE_POWER_STATE_UUID    = '00008421-1212-efde-1523-785feabcd124'; // WRITE only
const CURRENT_POWER_STATE_UUID   = '00001525-1212-efde-1523-785feabcd124'; // READ/WRITE/NOTIFY
const UNIDENTIFIED_STATE_UUID    = '00001524-1212-efde-1523-785feabcd124'; // READ/WRITE/NOTIFY

// Calibration Service
const CALIBRATION_SERVICE_UUID   = '00000000-0060-7990-5544-1cce81af42f0';
const CALIBRATION_DATA_UUID      = '00000010-0060-7990-5544-1cce81af42f0'; // READ

// Power command bytes (written to UPDATE_POWER_STATE_UUID)
const CMD_ON      = new Uint8Array([0x01]);
const CMD_SLEEP   = new Uint8Array([0x00]);
const CMD_STANDBY = new Uint8Array([0x02]);

// Power state values (read from CURRENT_POWER_STATE_UUID via notifications)
const POWER_STATES = {
  0x00: { label: 'Sleep',       cls: 'sleep' },
  0x01: { label: 'Booting',     cls: 'transition' },
  0x02: { label: 'Standby',     cls: 'standby' },
  0x08: { label: 'Waking',      cls: 'transition' },
  0x09: { label: 'Powering On', cls: 'transition' },
  0x0B: { label: 'On',          cls: 'on' },
};

let device           = null;
let updatePowerChar  = null;  // write commands here
let currentPowerChar = null;  // read/subscribe state here
let calibChar        = null;

// UI refs
const statusEl         = document.getElementById('status');
const errorEl          = document.getElementById('error');
const disconnectedView = document.getElementById('disconnected-view');
const connectedView    = document.getElementById('connected-view');
const deviceNameEl     = document.getElementById('device-name');
const powerBadge       = document.getElementById('power-badge');
const connectBtn       = document.getElementById('connect-btn');
const disconnectBtn    = document.getElementById('disconnect-btn');
const btnOn            = document.getElementById('btn-on');
const btnStandby       = document.getElementById('btn-standby');
const btnSleep         = document.getElementById('btn-sleep');
const btnCalibration   = document.getElementById('btn-calibration');
const calDataEl        = document.getElementById('cal-data');

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.style.display = 'block';
}

function clearError() {
  errorEl.style.display = 'none';
}

function setConnectedUI(connected) {
  disconnectedView.hidden = connected;
  connectedView.hidden = !connected;
}

function setActionsBusy(busy) {
  [btnOn, btnStandby, btnSleep, btnCalibration, disconnectBtn].forEach(b => b.disabled = busy);
}

function updatePowerBadge(value) {
  const state = POWER_STATES[value] ?? { label: `Unknown (0x${value.toString(16).toUpperCase().padStart(2, '0')})`, cls: '' };
  powerBadge.textContent = state.label;
  powerBadge.className = 'badge' + (state.cls ? ' badge-' + state.cls : '');
}

function onPowerStateChanged(event) {
  updatePowerBadge(event.target.value.getUint8(0));
}

async function writePower(bytes) {
  clearError();
  setActionsBusy(true);
  try {
    await updatePowerChar.writeValueWithResponse(bytes);
  } catch (err) {
    showError(`Write failed: ${err.message}`);
  } finally {
    setActionsBusy(false);
  }
}

async function readCalibration() {
  clearError();
  btnCalibration.disabled = true;
  calDataEl.textContent = 'Reading\u2026';
  try {
    const value = await calibChar.readValue();
    const bytes = [];
    for (let i = 0; i < value.byteLength; i++) {
      bytes.push(value.getUint8(i).toString(16).toUpperCase().padStart(2, '0'));
    }
    calDataEl.textContent = bytes.join(' ');
  } catch (err) {
    calDataEl.textContent = '';
    showError(`Calibration read failed: ${err.message}`);
  } finally {
    btnCalibration.disabled = false;
  }
}

function onDisconnected() {
  if (currentPowerChar) {
    currentPowerChar.removeEventListener('characteristicvaluechanged', onPowerStateChanged);
  }
  device           = null;
  updatePowerChar  = null;
  currentPowerChar = null;
  calibChar        = null;
  calDataEl.textContent = '';
  statusEl.textContent = 'Disconnected';
  setConnectedUI(false);
}

connectBtn.addEventListener('click', async () => {
  clearError();
  connectBtn.disabled = true;
  statusEl.textContent = 'Opening picker\u2026';

  try {
    device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'LHB-' }],
      optionalServices: [LIGHTHOUSE_SERVICE_UUID, CALIBRATION_SERVICE_UUID],
    });

    statusEl.textContent = 'Connecting\u2026';
    device.addEventListener('gattserverdisconnected', onDisconnected);

    const server = await device.gatt.connect();

    // Lighthouse V2 service
    const lighthouseService = await server.getPrimaryService(LIGHTHOUSE_SERVICE_UUID);
    updatePowerChar  = await lighthouseService.getCharacteristic(UPDATE_POWER_STATE_UUID);
    currentPowerChar = await lighthouseService.getCharacteristic(CURRENT_POWER_STATE_UUID);

    // Subscribe to power state notifications
    currentPowerChar.addEventListener('characteristicvaluechanged', onPowerStateChanged);
    await currentPowerChar.startNotifications();

    // Initial state read
    const initialValue = await currentPowerChar.readValue();
    updatePowerBadge(initialValue.getUint8(0));

    // Calibration service
    try {
      const calService = await server.getPrimaryService(CALIBRATION_SERVICE_UUID);
      calibChar = await calService.getCharacteristic(CALIBRATION_DATA_UUID);
    } catch {
      calibChar = null;
      btnCalibration.disabled = true;
      btnCalibration.title = 'Calibration service not available';
    }

    deviceNameEl.textContent = device.name || '(unnamed)';
    statusEl.textContent = 'Connected';
    setConnectedUI(true);

  } catch (err) {
    if (err.name !== 'NotFoundError') {
      showError(`Connection failed: ${err.name} — ${err.message}`);
    }
    statusEl.textContent = 'Disconnected';
  } finally {
    connectBtn.disabled = false;
  }
});

disconnectBtn.addEventListener('click', () => {
  if (device?.gatt?.connected) {
    device.gatt.disconnect();
  }
});

btnOn.addEventListener('click',          () => writePower(CMD_ON));
btnStandby.addEventListener('click',     () => writePower(CMD_STANDBY));
btnSleep.addEventListener('click',       () => writePower(CMD_SLEEP));
btnCalibration.addEventListener('click', () => readCalibration());

// Feature detection
if (!navigator.bluetooth) {
  connectBtn.disabled = true;
  showError(
    'Web Bluetooth is not available. ' +
    'Use Chrome on Android or Chrome on desktop (Windows, macOS, Linux) ' +
    'over HTTPS with Bluetooth enabled.'
  );
}
