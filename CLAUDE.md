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
- Supported in Chrome on Android and Chrome on desktop (Windows, Mac, Linux)
- Not supported in Firefox or Safari
- Android Chrome requires location permission for BLE scanning (OS requirement)
- Linux desktop requires BlueZ 5.40+ and the `chrome://flags/#enable-web-bluetooth` flag

## Base Station GATT Profile (Lighthouse V2 — LHB-* devices)

| Item | Value |
|---|---|
| Service UUID | `00001523-1212-efde-1523-785feabcd124` |
| Power characteristic | `00001525-1212-efde-1523-785feabcd124` |
| Identify characteristic | `00008421-1212-efde-1523-785feabcd124` |

Power state byte values: `0x01` = On, `0x00` = Sleep, `0x02` = Standby

## Debugging
- `navigator.bluetooth` is `undefined` → not Chrome, not HTTPS, or Bluetooth disabled
- Device picker is empty → Bluetooth off, location permission denied (Android), or no discoverable devices nearby
- `SecurityError` → page not in a secure context
- Base station not appearing in picker → device may be asleep; wake it manually first
