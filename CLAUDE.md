# chrome-ble-playground

A Web Bluetooth playground for scanning BLE devices and controlling SteamVR Lighthouse V2 base stations from Chrome.

## Live URL
https://chrome-ble.karnetvr.com/

## Stack
Plain HTML/CSS/JS — no build tools, no framework, no npm.

## File Structure
- `index.html` — BLE scanner page
- `basestation.html` — SteamVR base station control page
- `style.css` — all styles (shared across pages)
- `app.js` — BLE scanner logic
- `basestation.js` — base station connection and power control logic

## Deployment
Hosted via GitHub Pages (custom domain: `chrome-ble.karnetvr.com`, HTTPS enforced).
Every push to `main` deploys automatically within ~60 seconds.

```bash
git add .
git commit -m "your message"
git push
```

## Web Bluetooth Notes
- Requires a secure context (HTTPS) — unavailable on `http://` or `file://`
- Supported in Chrome on Android and Chrome on desktop (Windows, macOS, Linux)
- Not supported in Firefox or Safari
- Android Chrome requires location permission for BLE scanning (OS requirement)
- Linux desktop requires BlueZ 5.40+

## Base Station GATT Profile (Lighthouse V2 — LHB-* devices)

### Lighthouse V2 Service — `00001523-1212-efde-1523-785feabcd124`

| Characteristic | UUID | Properties | Notes |
|---|---|---|---|
| Current-Power-State | `00001525-1212-efde-1523-785feabcd124` | READ, WRITE, NOTIFY | Power state — write commands, read/notify reflects actual state |
| Unidentified-Write | `00008421-1212-efde-1523-785feabcd124` | WRITE | Purpose unknown — not used |
| Unidentified-State | `00001524-1212-efde-1523-785feabcd124` | READ, WRITE, NOTIFY | Observed values: `0x00`, `0x02` — semantics unknown |

**Write values for Current-Power-State:**
- `0x01` → Power On
- `0x00` → Sleep
- `0x02` → Standby

**Read/notification values for Current-Power-State:**
- `0x00` → Sleep
- `0x01` → Booting (transient)
- `0x02` → Standby
- `0x08` → Waking (transient)
- `0x09` → Powering On (transient, ~seconds while spinning up from sleep)
- `0x0B` → On

### Calibration Service — `00000000-0060-7990-5544-1cce81af42f0`

| Characteristic | UUID | Properties | Notes |
|---|---|---|---|
| Calibration Data | `00000010-0060-7990-5544-1cce81af42f0` | READ | Raw calibration byte array, variable length |

### Secure DFU Service — `0xFE59`

Nordic Semiconductor proprietary DFU service.
Spec: https://docs.nordicsemi.com/bundle/sdk_nrf5_v17.1.0/page/lib_dfu_transport_ble.html

### Device Information Service — `0x180A`

Bluetooth SIG standard service (Assigned Number `0x180A`).
Spec: https://www.bluetooth.com/specifications/assigned-numbers/ (GATT Services section)

## Debugging
- `navigator.bluetooth` is `undefined` → not Chrome, not HTTPS, or Bluetooth disabled
- Device picker is empty → Bluetooth off, location permission denied (Android), or no discoverable devices nearby
- `SecurityError` → page not in a secure context
- Base station not appearing in picker → the scanner filters by name prefix `LHB-`; ensure the device is powered on and actively advertising (motor spinning or status LED active). The Lighthouse service UUID is not advertised — filtering by service UUID would always return empty.
