package com.wirelessmic;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public class MicForegroundService extends Service {
    public static final String ACTION_START = "ACTION_START";
    public static final String ACTION_STOP = "ACTION_STOP";
    public static final String EXTRA_ROOM_NAME = "EXTRA_ROOM_NAME";

    private static final String CHANNEL_ID = "wireless_mic_channel";
    private static final int NOTIFICATION_ID = 40401;
    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "WirelessMic::ServiceWakeLock");
            wakeLock.acquire(12 * 60 * 60 * 1000L); // 12 hours timeout safety
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_STOP.equals(action)) {
                stopForegroundService();
                return START_NOT_STICKY;
            } else if (ACTION_START.equals(action)) {
                String roomName = intent.getStringExtra(EXTRA_ROOM_NAME);
                startForegroundWithNotification(roomName != null ? roomName : "Meeting Room");
            }
        }
        return START_STICKY;
    }

    private void startForegroundWithNotification(String roomName) {
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this, 0, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Wireless Microphone Active")
                .setContentText("Connected to " + roomName + " (Low Latency PA)")
                .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pendingIntent)
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Android 14+ requires foregroundServiceType matching manifest declaration
            int type = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R)
                    ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                    : 0;
            startForeground(NOTIFICATION_ID, notification, type);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void stopForegroundService() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        stopForeground(true);
        stopSelf();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Wireless Microphone Session",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Maintains continuous audio capture pipeline when phone is locked");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopForegroundService();
        super.onDestroy();
    }
}
