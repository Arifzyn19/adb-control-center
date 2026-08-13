# ADB Control Center

A production-grade, web-based **Android Device Management and ADB Control** platform. Connect Android devices over **Wireless ADB pairing** and control them entirely from your browser.

Built as a single **Nuxt 4 + Nitro** application — the browser only talks to the Nuxt server over HTTP/WebSocket; **all ADB operations run server-side** on Nitro. No ADB is ever executed in the browser.

```
Browser ── HTTP / WebSocket ──► Nuxt Application ──► Nitro Server ──► ADB ──► Android Device
```

## Features

- **Wireless pairing** — pair devices via 6-digit code + QR code scanning, and manual pairing.
- **Device management** — list, filter, connect, disconnect, and remove devices.
- **Live dashboard** — battery, storage, memory, IP, connection type, and status per device.
- **Interactive terminal** — real-time shell over WebSocket (xterm.js).
- **Logcat streaming** — live filtered log output over WebSocket.
- **Apps manager** — list, launch, force-stop, enable/disable, clear data, uninstall, extract, install/reinstall APKs.
- **File manager** — browse, upload, download, rename, delete, mkdir, and install APKs from device storage.
- **Process manager** — view processes, kill by PID.
- **Services & properties** — inspect running services and device properties.
- **Screenshots** — capture, view, auto-refresh, and rotate.
- **Realtime device status** — WebSocket push of device state changes.

## Requirements

- Node.js 20+ (developed on Node 24)
- [ADB](https://developer.android.com/tools/adb) available on the server's `PATH` (required only at runtime for device operations)
- An Android device with **Wireless debugging** enabled (Android 11+)

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Configuration

Runtime configuration is provided via environment variables (see `nuxt.config.ts`):

| Variable | Default | Description |
| --- | --- | --- |
| `ADB_PATH` | `adb` | Path to the adb binary |
| `ADB_SERVER_PORT` | `5037` | adb server port |
| `ADB_PAIRING_PASSWORD` | `adb-control-center` | Fallback pairing password |
| `MAX_DEVICES` | `8` | Maximum concurrently stored devices |
| `LOGCAT_MAX_BUFFER` | `2000` | Logcat buffer size (lines) |
| `ADB_CONTROL_TOKEN` | `change-me` | Auth token used to sign in — **change in production** |
| `SESSION_TTL` | `86400` | Session TTL in seconds |

> **Security:** set `ADB_CONTROL_TOKEN` to a strong secret before exposing the app publicly. The app authenticates via Bearer token sessions and the WebSocket endpoints require the same token.

## Build & Deploy

```bash
npm run typecheck   # zero-error typecheck
npm run build       # outputs to .output/
node .output/server/index.mjs   # run the production server
```

## Stack

- Nuxt 4 / Nitro (SSR + server API + WebSockets)
- Vue 3, Tailwind CSS, lucide-vue-next icons
- @xterm/xterm for the terminal
- zod for validation, bonjour-service for service discovery, qrcode for pairing QR codes
