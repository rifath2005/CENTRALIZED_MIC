# Centralized Mic: Ultra-Low-Latency Wireless Microphone System

A cross-platform mobile wireless microphone system (iOS & Android via React Native) and meeting room PA host receiver (React & Web Audio) over LiveKit WebRTC, engineered with a strict **< 300ms end-to-end latency budget** to prevent disorienting speech echo in conference rooms and auditoriums.

---

## Repository Structure

```
.
├── server/          # Node.js/Express token server for LiveKit Cloud
├── mobile/          # React Native iOS & Android client with native audio tuning
│   ├── ios/         # Info.plist & AudioSessionConfigModule (VoiceChat & bottom mic)
│   ├── android/     # AndroidManifest.xml & MicForegroundService (Android 14+)
│   └── src/         # Hold-to-talk UI, WebRTC transmitter, & floor control
├── host/            # React Web Audio Receiver application
│   └── src/         # Web Audio DSP pipeline, Peak Limiter, & Floor Arbiter
└── README.md
```

---

## 1. Quick Start

### Step 1: Token Server Setup
```bash
cd server
cp .env.example .env
# Fill in your LiveKit Cloud URL, API Key, and API Secret in .env
npm install
npm run dev
# Server runs on http://localhost:4000
```

### Step 2: Host Receiver (Meeting Room Computer)
```bash
cd host
npm install
npm run dev
# Receiver runs on http://localhost:3000
```
1. Open `http://localhost:3000` on the meeting room computer connected to the PA sound system.
2. Click **"START SESSION / UNMUTE SPEAKERS"** to satisfy browser autoplay policies.
3. Select your PA output soundcard (e.g., Dante, USB Audio Interface, Line Out).

### Step 3: Mobile Transmitter (Smartphones)
```bash
cd mobile
npm install
# For iOS:
cd ios && pod install && cd ..
npm run ios
# For Android:
npm run android
```
Point camera at the QR code on the receiver screen or enter the room code (e.g., `BOARDROOM-1`). Hold down the large button to speak!
