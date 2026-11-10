# Centralized Mic: Complete Deployment & User Manual

Welcome to the **Centralized Mic** system. This system turns smartphones into ultra-low-latency (< 300ms) wireless conference microphones for meeting rooms, lecture halls, and boardrooms, broadcasting to a central receiver computer connected to the venue PA sound system.

---

## 1. Directory & File Anatomy

```
CENTRALIZED_MIC/
├── AirMic.apk                         # Pre-built universal Android installable binary (ready to sideload)
├── release_apks/                      # Architecture-specific release APKs (arm64-v8a, armeabi-v7a, x86_64)
│   ├── AirMic-arm64-v8a.apk           # For 99% of modern smartphones (Samsung, Xiaomi, Pixel, OnePlus)
│   └── AirMic-universal.apk           # Works on any Android device
│
├── server/                            # Node.js/Express LiveKit Token & Floor Authentication Server
│   ├── src/
│   │   ├── index.ts                   # Express server entry point, rate limiting, and CORS configuration
│   │   ├── routes/
│   │   │   ├── auth.ts                # Participant & host token generator (HMAC SHA-256 JWT)
│   │   │   └── health.ts              # Healthcheck endpoint (/api/health) for uptime monitoring
│   │   └── types.ts                   # Zod schemas & TypeScript type definitions
│   ├── .env                           # Local environment secrets (LiveKit keys, port, origins)
│   ├── .env.example                   # Template for server environment variables
│   └── package.json                   # Dependencies: express, livekit-server-sdk, zod, helmet
│
├── host/                              # React + Vite Web Audio Receiver (Runs on Boardroom Laptop)
│   ├── src/
│   │   ├── audio/
│   │   │   └── AudioProcessingGraph.ts# Web Audio DSP pipeline: 80Hz Highpass, -18dB Peak Limiter, 0.9 Ceiling
│   │   ├── components/
│   │   │   ├── AudioUnlockGate.tsx    # Modal to satisfy browser autoplay policy ("Start Session / Unmute")
│   │   │   ├── BoardroomRoster.tsx    # Live attendee roster showing online members and active speaker
│   │   │   ├── DeviceSelector.tsx     # Output soundcard router (HDMI, USB Audio Interface, 3.5mm, Dante)
│   │   │   ├── FullScreenQrModal.tsx  # Dedicated presentation overlay for large boardroom projectors
│   │   │   ├── ProjectorView.tsx      # Standalone high-contrast projection display
│   │   │   └── RoomQRCode.tsx         # Real-time QR generator pairing smartphones with room code
│   │   ├── hooks/
│   │   │   ├── useHostFloorArbiter.ts # Authoritative floor queue with 4.5s heartbeat watchdog
│   │   │   └── useHostLiveKit.ts      # WebRTC subscriber connection, track management, and latency tracking
│   │   ├── App.tsx                    # Main host interface uniting DSP, projector, and controls
│   │   └── index.html                 # HTML entry point
│   ├── package.json                   # Dependencies: @livekit/components-react, livekit-client, qrcode.react
│   └── vite.config.ts                 # Vite bundler configuration
│
├── mobile/                            # React Native iOS & Android Transmitter Client
│   ├── android/                       # Native Android Project (Gradle, Manifest, Java modules)
│   │   └── app/src/main/
│   │       ├── AndroidManifest.xml    # RECORD_AUDIO, FOREGROUND_SERVICE_MICROPHONE permissions
│   │       └── java/.../
│   │           ├── AudioConfigModule.java # Hardware AEC, NS, and VOICE_COMMUNICATION audio tuning
│   │           └── MicForegroundService.java # Android 14+ persistent background recording service
│   ├── ios/                           # Native iOS Project
│   │   └── Info.plist                 # NSMicrophoneUsageDescription, UIBackgroundModes ['audio']
│   ├── src/
│   │   ├── components/
│   │   │   ├── HoldToTalkButton.tsx   # Tactile push-to-talk button with dynamic color states
│   │   │   └── AudioLevelMeter.tsx    # Real-time RMS decibel volume visualizer
│   │   └── hooks/
│   │       ├── useFloorControl.ts     # PTT state machine (idle, requesting, speaking, queued)
│   │       ├── useLiveKitTransmitter.ts # WebRTC publisher, hardware microphone lock, auto-reconnect
│   │       └── useAudioLevel.ts       # Audio level sampler for the UI meter
│   ├── App.tsx                        # Main smartphone UI: Room code input, QR connect, Hold-to-Talk
│   └── package.json                   # Dependencies: @livekit/react-native, @livekit/react-native-webrtc
│
├── render.yaml                        # Infrastructure-as-code for 1-click Render cloud deployment
└── FULLSTACK_MOBILE_WEB_ARCHITECTURE.md # Detailed latency budget analysis and architecture document
```

---

## 2. Instant Run (Fastest Path — 3 Minutes)

The production backend is already deployed and live on Render:
- **Live Token Server:** `https://centralized-mic-token-server.onrender.com`
- **LiveKit Cloud SFU:** `wss://centralized-mic-v3q5zrd6.livekit.cloud`

### Step A: Run the Host Receiver (Room Laptop)
Connect your laptop to the room PA speakers (via 3.5mm AUX, HDMI, or USB Audio interface).
```bash
cd host
npm install
npm run dev
```
1. Open the URL displayed in the terminal (usually `http://localhost:5173`).
2. Click **"START SESSION / UNMUTE SPEAKERS"** (this unlocks audio in Chrome/Edge/Safari).
3. In **AUDIO OUTPUT SELECTION**, choose your PA system soundcard.
4. Note your room code (e.g. `BOARDROOM-1`) or click **"PRESENT FULL SCREEN QR"** to project it.

### Step B: Connect Smartphones (Transmitters)
Choose whichever method is most convenient:

#### Method 1: Install the Pre-built Android App (Recommended)
You do not need Android Studio to run the app. An APK is already built:
- **Direct Sideload:** Copy `AirMic.apk` (or `release_apks/AirMic-arm64-v8a.apk`) to your phone via USB cable, Google Drive, or messaging app, and tap to install.
- **Via ADB (if phone is plugged in with USB debugging):**
  ```bash
  /home/nabeel/Android/Sdk/platform-tools/adb install -r AirMic.apk
  ```
- **Open the App:** Enter the Room Code (e.g., `BOARDROOM-1`), choose your name, and tap **JOIN ROOM**.

#### Method 2: Scan QR with Phone Camera (Web Transmitter)
- On the host screen, click **"PRESENT FULL SCREEN QR"**.
- Have any iPhone or Android user scan the QR code with their default camera app.
- They will be taken directly into the mobile transmitter interface in Safari or Chrome without installing anything.

---

## 3. Local Development Guide

If you want to run every service locally on your development machine:

### 1. Token Server (`server/`)
```bash
cd server
npm install
cp .env.example .env
```
Ensure your `.env` contains:
```ini
LIVEKIT_URL=wss://centralized-mic-v3q5zrd6.livekit.cloud
LIVEKIT_API_KEY=your_key
LIVEKIT_API_SECRET=your_secret
PORT=4000
ALLOWED_ORIGIN=*
TOKEN_TTL=3600
```
Start the server:
```bash
# Development mode with hot-reload:
npm run dev

# Or build and run production mode:
npm run build
npm start
```
*Health check:* Test that it works by visiting `http://localhost:4000/api/health` in your browser. You should see `{"status":"ok"}`.

---

### 2. Host Receiver Web App (`host/`)
```bash
cd host
npm install
npm run dev
```
- Open `http://localhost:5173`.
- By default, it connects to the production token server (`https://centralized-mic-token-server.onrender.com`).
- To point the host to your local server instead, go to the in-app **Network Settings** tab and set the server URL to `http://localhost:4000`.

---

### 3. Mobile App Development (`mobile/`)
Requires Node 18+, JDK 21, and Android SDK configured at `~/Android/Sdk`.

#### Run on Android Device or Emulator:
```bash
cd mobile
npm install

# Start Metro Bundler:
npm start

# In a second terminal, build and launch debug build on device:
npm run android
```

#### Build a New Release APK:
```bash
cd mobile
npm run build:release-apk
```
The output APK is generated at:
`mobile/android/app/build/outputs/apk/release/app-release.apk`

---

## 4. Cloud Deployment Guide

### Deploying the Token Server & Host to Render

The repository includes a ready-to-deploy `render.yaml` blueprint.

1. **Push to GitHub:** Ensure your latest commits are on your GitHub repository:
   ```bash
   git push origin main
   ```
2. **Open Render Dashboard:** Go to [render.com](https://render.com) and click **New + > Blueprint**.
3. **Connect Repository:** Select your `CENTRALIZED_MIC` repository.
4. **Environment Variables:** Render will automatically detect the two services from `render.yaml`:
   - `centralized-mic-token-server` (Web Service)
   - `centralized-mic-receiver` (Static Site)
5. Fill in the required environment variables in Render's dashboard:
   - `LIVEKIT_URL`: Your LiveKit WebSocket URL
   - `LIVEKIT_API_KEY`: Your LiveKit API Key
   - `LIVEKIT_API_SECRET`: Your LiveKit API Secret
6. Click **Apply**. Both the token server and receiver will build and deploy automatically with free HTTPS certificates.

---

## 5. Boardroom Operation & Meeting Workflow

Here is how an operator manages an active meeting:

```
+---------------------------------------------------------------------------------------+
|                                    MEETING ROOM                                       |
|                                                                                       |
|   [Speaker's Smartphone]        [LiveKit Cloud SFU]          [Boardroom Host Laptop]   |
|   (AirMic App or Web)               (< 5ms routing)         (Connected to PA Speakers)|
|                                                                                       |
|     1. Hold Button     =======>      Encrypted       ======>   1. 80Hz Highpass       |
|        to Talk (PTT)                 Opus Audio                 2. -18dBFS Peak Limiter|
|                                                                 3. Output to PA System|
|                                                                                       |
|   [Other Participants]                                       [Projector Screen]       |
|   (Queue state: WAITING)                                     (Shows QR & Member Roster|
+---------------------------------------------------------------------------------------+
```

### 1. Host Preparation
1. Plug the host laptop's audio output (3.5mm headphone jack, USB DAC, or HDMI) into the room's PA amplifier or mixer.
2. Open the Host Receiver Web App in Chrome.
3. Click **"START SESSION / UNMUTE SPEAKERS"**.
4. Test the soundcard output with the test tone button if needed.
5. Click **"PRESENT FULL SCREEN QR"** or project the receiver window onto the room projector.

### 2. Participant Joining
1. Participants arrive in the room and either:
   - Open the **AirMic** app and enter the room code displayed on the screen (e.g. `BOARDROOM-1`).
   - Or scan the projector screen QR code with their phone camera.
2. Each participant types their name (e.g., "Alice - Finance").
3. The host's **Boardroom Attendance Roster** immediately updates showing the new participant as connected (🟢 Green indicator).

### 3. Push-to-Talk & Floor Arbitration
- **Speaking:** When a member wants to speak, they **press and hold** the large circular button.
  - The button turns green and says **"YOU ARE LIVE (TRANSMITTING)"**.
  - Their phone provides haptic feedback.
  - The host laptop receives the unmuted Opus audio stream and plays it through the room speakers.
  - Latency is under 180ms — speakers will not hear any disorienting delay.
- **Muting:** As soon as the speaker releases the button, the audio track is muted immediately.
- **Queueing:** If Person A is speaking and Person B presses the button:
  - Person B's button turns yellow: **"FLOOR BUSY - YOU ARE #1 IN QUEUE"**.
  - When Person A releases, the floor automatically passes to Person B.
- **Drop Recovery (Watchdog):** If a speaker's battery dies or phone disconnects while holding the button, the host floor arbiter's 4.5-second watchdog automatically revokes the lock and clears the floor for the next person.

### 4. Acoustic Feedback (Howling) Mitigation
Because phone microphones and PA speakers are in the same physical room, follow these simple acoustic best practices:
- **Software Protections (Built-in):**
  - **80Hz Highpass Filter:** Eliminates low-frequency handling noise and stage rumble.
  - **Dynamics Peak Limiter:** Caps audio peaks at -18dBFS to stop runaway feedback squeals.
  - **Software Volume Ceiling:** Clamped at 0.90 gain to prevent digital clipping.
- **Physical Guidelines:**
  - Hold the phone microphone within 10–15 cm (4–6 inches) of your mouth.
  - Do not hold the smartphone directly in front of the PA loudspeaker cone.
  - Keep the PA master gain at a comfortable listening level rather than maximum amplification.

---

## 6. Troubleshooting Common Issues

### Issue 1: "Server not responding" or 30-second delay on first join
- **Cause:** Render's free tier spins down the backend web service after 15 minutes of inactivity.
- **Fix:** Wait 30 seconds for the first spin-up, or ping `https://centralized-mic-token-server.onrender.com/api/health` in your browser before the meeting begins to warm up the server.

### Issue 2: `adb devices` shows nothing when phone is plugged in (Xiaomi / Redmi / MIUI)
If your phone is plugged in via USB but does not appear in `adb devices`:
1. Unlock your phone.
2. Pull down the notification shade and change **USB charging mode** to **"File Transfer (MTP)"**.
3. Go to **Settings > Developer Options** and enable:
   - **USB Debugging**
   - **Install via USB**
   - **USB Debugging (Security settings)** *(Requires SIM card insertion on MIUI)*
4. Disconnect and reconnect the cable. When prompted with **"Allow USB debugging from this computer?"**, check "Always allow" and tap **OK**.
5. Alternatively, skip ADB entirely and install `AirMic.apk` directly on the phone.

### Issue 3: No sound coming out of the room speakers
1. Verify you clicked **"START SESSION / UNMUTE SPEAKERS"** on the host page.
2. In the **Audio Output Selection** dropdown, confirm the correct physical device is selected (e.g. "External Headphones", "USB Audio Device", "HDMI").
3. Check the host app's live audio level meter when the speaker talks. If the meter moves green, WebRTC audio is arriving successfully; check the laptop's physical volume slider or amplifier cable.

### Issue 4: Phone microphone drops when the screen locks
- **Android:** The app runs a native `MicForegroundService` with a persistent notification (`AirMic Active`). Ensure battery optimization is set to "Unrestricted" for AirMic in Android Settings.
- **iOS:** Audio background mode is pre-configured in `Info.plist` (`UIBackgroundModes: audio`). Keep the app open or minimized without force-closing it.

---

## 7. Useful Project Commands Reference

| Task | Command |
|---|---|
| Run Token Server (Dev) | `cd server && npm run dev` |
| Build Token Server (Prod) | `cd server && npm run build && npm start` |
| Run Host Web Receiver | `cd host && npm run dev` |
| Build Host Web Receiver | `cd host && npm run build` |
| Install Pre-built APK via ADB | `/home/nabeel/Android/Sdk/platform-tools/adb install -r AirMic.apk` |
| Start Metro Bundler | `cd mobile && npm start` |
| Build Release APK | `cd mobile && npm run build:release-apk` |
| Check ADB Devices | `/home/nabeel/Android/Sdk/platform-tools/adb devices` |
