package com.taskchecker.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannel();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);

            // 기본 알림 채널 (긴 진동 패턴)
            NotificationChannel channel = new NotificationChannel(
                "taskchecker_default",
                "TaskChecker 알림",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("체크리스트 알림");
            channel.enableVibration(true);
            // 긴진동-짧은진동-긴진동 패턴
            channel.setVibrationPattern(new long[]{0, 500, 200, 500});
            manager.createNotificationChannel(channel);
        }
    }
}
