const SERVICE_UUID     = '00001523-1212-efde-1523-785feabcd124';
const POWER_CHAR_UUID  = '00001525-1212-efde-1523-785feabcd124';
const IDENT_CHAR_UUID  = '00008421-1212-efde-1523-785feabcd124';

const POWER_ON      = new Uint8Array([0x01]);
const POWER_SLEEP   = new Uint8Array([0x00]);
const POWER_STANDBY = new Uint8Array([0x02]);
const IDENTIFY      = new Uint8Array([0x01]);

const POWER_LABELS = { 0: 'Sleep', 1: 'On', 2: 'Standby' };

let device = null;
let powerChar = null;
let identChar = null;

// UI refs
const statusEl        = document.getElementById('status');
const errorEl         = document.getElementById('error');
const disconnectedView = document.getElementById('disconnected-view');
const connectedView   = document.getElementById('connected-view');
const deviceNameEl    = document.getElementById('device-name');
const powerBadge      = document.getElementById('power-badge');
const connectBtn      = document.getElementById('connect-btn');
const disconnectBtn   = document.getElementById('disconnect-btn');
const btnOn           = document.getElementById('btn-on');
const btnStandby      = document.getElementById('btn-standby');
const btnSleep        = document.getElementById('btn-sleep');
const btnIdentify     = document.getElementById('btn-identify');

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
  [btnOn, btnStandby, btnSleep, btnIdentify, disconnectBtn].forEach(b => b.disabled = busy);
}

function updatePowerBadge(value) {
  const label = POWER_LABELS[value] ?? 'Unknown';
  powerBadge.textContent = label;
  powerBadge.className = 'badge badge-' + label.toLowerCase();
}

async function readPowerState() {
  try {
    const value = await powerChar.readValue();
    updatePowerBadge(value.getUint8(0));
  } catch {
    updatePowerBadge(undefined);
  }
}

async function writePower(bytes) {
  clearError();
  setActionsBusy(true);
  try {
    await powerChar.writeValueWithResponse(bytes);
    await readPowerState();
  } catch (err) {
    showError(`Write failed: ${err.message}`);
  } finally {
    setActionsBusy(false);
  }
}

async function writeIdentify() {
  if (!identChar) return;
  clearError();
  setActionsBusy(true);
  try {
    await identChar.writeValueWithResponse(IDENTIFY);
  } catch (err) {
    showError(`Identify failed: ${err.message}`);
  } finally {
    setActionsBusy(false);
  }
}

function onDisconnected() {
  device = null;
  powerChar = null;
  identChar = null;
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
      optionalServices: [SERVICE_UUID],
    });

    statusEl.textContent = 'Connecting\u2026';
    device.addEventListener('gattserverdisconnected', onDisconnected);

    const server  = await device.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);

    powerChar = await service.getCharacteristic(POWER_CHAR_UUID);

    try {
      identChar = await service.getCharacteristic(IDENT_CHAR_UUID);
    } catch {
      // Identify characteristic not available on all firmware versions
      identChar = null;
      btnIdentify.disabled = true;
      btnIdentify.title = 'Not supported by this device';
    }

    deviceNameEl.textContent = device.name || '(unnamed)';
    statusEl.textContent = 'Connected';
    setConnectedUI(true);
    await readPowerState();

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

btnOn.addEventListener('click',       () => writePower(POWER_ON));
btnStandby.addEventListener('click',  () => writePower(POWER_STANDBY));
btnSleep.addEventListener('click',    () => writePower(POWER_SLEEP));
btnIdentify.addEventListener('click', () => writeIdentify());

// Feature detection
if (!navigator.bluetooth) {
  connectBtn.disabled = true;
  showError(
    'Web Bluetooth is not available. ' +
    'Use Chrome on Android over HTTPS with Bluetooth enabled.'
  );
}
