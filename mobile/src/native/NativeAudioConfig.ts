import { NativeModules, Platform } from 'react-native';

const { AudioSessionConfigModule, AudioConfigModule } = NativeModules;

export interface NativeAudioStatus {
  status: string;
  sampleRate?: number;
  ioBufferDurationMs?: number;
  inputChannels?: number;
  mode?: number;
}

export const NativeAudio = {
  /**
   * Configures native platform audio layers for ultra-low latency (<300ms budget):
   * - iOS: AVAudioSession VoiceChat mode, bottom capsule, 5ms IO buffer.
   * - Android: AudioManager MODE_IN_COMMUNICATION with hardware AEC/NS.
   */
  async configureLowLatencyVoice(): Promise<NativeAudioStatus | null> {
    try {
      if (Platform.OS === 'ios') {
        if (AudioSessionConfigModule?.configureLowLatencyVoiceSession) {
          const res = await AudioSessionConfigModule.configureLowLatencyVoiceSession();
          console.log('[NativeAudio] iOS Voice Session configured:', res);
          return res;
        }
      } else if (Platform.OS === 'android') {
        if (AudioConfigModule?.configureVoiceMode) {
          const res = await AudioConfigModule.configureVoiceMode();
          console.log('[NativeAudio] Android Voice Mode configured:', res);
          return res;
        }
      }
    } catch (error) {
      console.warn('[NativeAudio] Failed to configure native low latency audio session:', error);
    }
    return null;
  },

  /**
   * Starts Android foreground service to keep mic active under lock screen.
   */
  async startForegroundService(roomName: string): Promise<void> {
    if (Platform.OS === 'android' && AudioConfigModule?.startMicForegroundService) {
      try {
        await AudioConfigModule.startMicForegroundService(roomName);
        console.log('[NativeAudio] Foreground service started for room:', roomName);
      } catch (err) {
        console.warn('[NativeAudio] Failed to start foreground service:', err);
      }
    }
  },

  /**
   * Stops Android foreground service upon room disconnect.
   */
  async stopForegroundService(): Promise<void> {
    if (Platform.OS === 'android' && AudioConfigModule?.stopMicForegroundService) {
      try {
        await AudioConfigModule.stopMicForegroundService();
        console.log('[NativeAudio] Foreground service stopped');
      } catch (err) {
        console.warn('[NativeAudio] Failed to stop foreground service:', err);
      }
    }
  },

  /**
   * Deactivates iOS audio session.
   */
  async deactivateSession(): Promise<void> {
    if (Platform.OS === 'ios' && AudioSessionConfigModule?.deactivateSession) {
      try {
        await AudioSessionConfigModule.deactivateSession();
      } catch (err) {
        console.warn('[NativeAudio] Failed to deactivate iOS session:', err);
      }
    }
  },

  /**
   * Scans QR code via Google Code Scanner bottom sheet
   */
  async scanQRCode(): Promise<string | null> {
    if (Platform.OS === 'android' && AudioConfigModule?.scanQRCode) {
      try {
        const result = await AudioConfigModule.scanQRCode();
        console.log('[NativeAudio] QR Code scanned:', result);
        return result;
      } catch (err) {
        console.warn('[NativeAudio] QR Scan error or cancelled:', err);
      }
    }
    return null;
  },
};
