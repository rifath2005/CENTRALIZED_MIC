package com.wirelessmic;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.os.Build;
import androidx.annotation.NonNull;

import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanner;
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions;
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

public class AudioConfigModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;

    public AudioConfigModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @NonNull
    @Override
    public String getName() {
        return "AudioConfigModule";
    }

    /**
     * Configures Android AudioManager for low latency communication:
     * - MODE_IN_COMMUNICATION ensures Android's hardware AEC, AGC, and NS (acoustic echo
     *   cancellation and noise suppressor) are attached to the capture pipeline.
     */
    @ReactMethod
    public void configureVoiceMode(Promise promise) {
        try {
            AudioManager audioManager = (AudioManager) reactContext.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
                audioManager.setSpeakerphoneOn(false);

                WritableMap map = Arguments.createMap();
                map.putString("status", "configured");
                map.putInt("mode", AudioManager.MODE_IN_COMMUNICATION);
                promise.resolve(map);
            } else {
                promise.reject("AUDIO_MANAGER_NULL", "AudioManager service unavailable");
            }
        } catch (Exception e) {
            promise.reject("AUDIO_CONFIG_ERROR", e.getMessage(), e);
        }
    }

    /**
     * Starts the Android 14+ Foreground Service with microphone type
     * to keep the WebRTC audio capture alive when the screen is locked.
     */
    @ReactMethod
    public void startMicForegroundService(String roomName, Promise promise) {
        try {
            Intent serviceIntent = new Intent(reactContext, MicForegroundService.class);
            serviceIntent.setAction(MicForegroundService.ACTION_START);
            serviceIntent.putExtra(MicForegroundService.EXTRA_ROOM_NAME, roomName);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(serviceIntent);
            } else {
                reactContext.startService(serviceIntent);
            }
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("START_SERVICE_ERROR", e.getMessage(), e);
        }
    }

    /**
     * Stops the foreground service when disconnecting from the room.
     */
    @ReactMethod
    public void stopMicForegroundService(Promise promise) {
        try {
            Intent serviceIntent = new Intent(reactContext, MicForegroundService.class);
            serviceIntent.setAction(MicForegroundService.ACTION_STOP);
            reactContext.startService(serviceIntent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("STOP_SERVICE_ERROR", e.getMessage(), e);
        }
    }

    /**
     * Scans QR Code using Google Play Services Code Scanner without requiring camera permissions.
     */
    @ReactMethod
    public void scanQRCode(Promise promise) {
        Activity currentActivity = getCurrentActivity();
        if (currentActivity == null) {
            promise.reject("ACTIVITY_NULL", "Current activity is null");
            return;
        }

        try {
            GmsBarcodeScannerOptions options = new GmsBarcodeScannerOptions.Builder()
                .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
                .enableAutoZoom()
                .build();

            GmsBarcodeScanner scanner = GmsBarcodeScanning.getClient(currentActivity, options);
            scanner.startScan()
                .addOnSuccessListener(barcode -> {
                    String rawValue = barcode.getRawValue();
                    promise.resolve(rawValue);
                })
                .addOnCanceledListener(() -> {
                    promise.resolve(null);
                })
                .addOnFailureListener(e -> {
                    promise.reject("SCAN_FAILED", e.getMessage(), e);
                });
        } catch (Exception e) {
            promise.reject("SCANNER_INIT_ERROR", e.getMessage(), e);
        }
    }
}
