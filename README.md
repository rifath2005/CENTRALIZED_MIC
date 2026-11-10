# Centralized Mic: Ultra-Low-Latency Wireless Microphone System

A cross-platform mobile wireless microphone system (iOS & Android via React Native) and meeting room PA host receiver (React & Web Audio) over LiveKit WebRTC, engineered with a strict **< 300ms end-to-end latency budget** to prevent disorienting speech echo in conference rooms and auditoriums.

---

## 📖 Complete Documentation & User Manual

For an in-depth, step-by-step walkthrough covering every file, deployment setup, boardroom workflow, and troubleshooting tips, see:
👉 **[DEPLOYMENT_AND_USER_GUIDE.md](file:///home/nabeel/Downloads/CENTRALIZED_MIC/DEPLOYMENT_AND_USER_GUIDE.md)**

---

## 📂 Repository Structure

```
.
├── AirMic.apk                         # Pre-compiled universal Android binary (ready to install)
├── release_apks/                      # Architecture-specific APKs (arm64-v8a, armeabi-v7a, x86_64)
├── server/                            # Node.js/Express token server for LiveKit Cloud
│   ├── src/index.ts                   # Token issuing endpoint, rate limiting, and CORS
│   └── .env                           # LiveKit credentials and configuration
├── host/                              # React Web Audio Receiver application
│   ├── src/audio/AudioProcessingGraph # Web Audio DSP pipeline (-18dB limiter, 80Hz highpass)
│   ├── src/components/                # Projector QR display, Boardroom Roster, Audio Gate
│   └── src/hooks/                     # Floor Arbiter with 4.5s drop recovery watchdog
├── mobile/                            # React Native iOS & Android client
│   ├── android/                       # Native Android: MicForegroundService (Android 14+)
│   ├── ios/                           # Native iOS: VoiceChat audio session & bottom capsule
│   └── src/                           # Tactile hold-to-talk button, floor client, RMS meter
├── render.yaml                        # Automated Render Cloud Deployment blueprint
└── DEPLOYMENT_AND_USER_GUIDE.md       # Complete deployment & boardroom operation manual
```

---

## ⚡ Instant Test (3 Minutes)

The production backend is already live:
- **Token Server:** `https://centralized-mic-token-server.onrender.com`
- **LiveKit Cloud SFU:** `wss://centralized-mic-v3q5zrd6.livekit.cloud`

### 1. Launch the Host Receiver (Meeting Room Laptop)
Connect your laptop to the PA speakers, then run:
```bash
cd host
npm install
npm run dev
```
1. Open the URL (e.g. `http://localhost:5173`) in Chrome or Edge.
2. Click **"START SESSION / UNMUTE SPEAKERS"**.
3. Select your PA output device in the **Audio Output Selection** dropdown.
4. Click **"PRESENT FULL SCREEN QR"** to project the code on the boardroom screen.

### 2. Connect Smartphones (Speakers)
- **Install the Android App:** Copy `AirMic.apk` from the root folder to your Android phone and install it (or run `/home/nabeel/Android/Sdk/platform-tools/adb install -r AirMic.apk`).
- **Or use Web Transmitter:** Scan the QR code with iPhone or Android camera to open the instant web microphone.
- Enter the room code (e.g., `BOARDROOM-1`), hold the button to speak!
