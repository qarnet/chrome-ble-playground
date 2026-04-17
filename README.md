# chrome-ble-playground

A Web Bluetooth playground for scanning BLE devices and controlling SteamVR Lighthouse V2 base stations from Chrome.

**Live site:** https://chrome-ble.karnetvr.com/

## Pages

- **Scanner** — scans for nearby BLE devices and lists their names and IDs
- **Base Station** — connects to a SteamVR Lighthouse V2 base station and controls its power state (on, standby, sleep, identify)

## Requirements

- Chrome on Android or Chrome on desktop (Windows, Mac, Linux)
- Bluetooth enabled
- Android: location permission granted to Chrome
- Linux: BlueZ 5.40+ and `chrome://flags/#enable-web-bluetooth` enabled
