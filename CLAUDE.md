# chrome-ble-playground

A minimal Web Bluetooth playground for scanning nearby BLE devices from Chrome on Android.

## Live URL
https://chrome-ble.karnetvr.com/

## Stack
Plain HTML/CSS/JS — no build tools, no framework, no npm.

## File Structure
- `index.html` — markup only
- `style.css` — all styles
- `app.js` — all Web Bluetooth logic

## Deployment
Hosted via GitHub Pages (custom domain: `chrome-ble.karnetvr.com`, HTTPS enforced).
Every push to `main` deploys automatically within ~60 seconds.

```bash
git add .
git commit -m "your message"
git push
```

## Web Bluetooth Notes
- Requires a secure context (HTTPS) — the API is unavailable on `http://` or `file://`
- Only works in Chrome (desktop and Android); not supported in Firefox or Safari
- Android Chrome requires location permission for BLE scanning (OS requirement)
- `navigator.bluetooth.requestDevice()` opens the browser's native device picker — the page does not get a raw scan list
- `acceptAllDevices: true` is used to show all nearby BLE devices
- Discovered devices accumulate across multiple scan taps (stored in a `Map` keyed by `device.id`)
- `device.id` is an opaque, origin-scoped identifier — not the real MAC address

## Debugging
- `navigator.bluetooth` is `undefined` → not Chrome, not HTTPS, or Bluetooth disabled
- Device picker is empty → Bluetooth off, location permission denied, or no discoverable devices nearby
- `SecurityError` → page not in a secure context
