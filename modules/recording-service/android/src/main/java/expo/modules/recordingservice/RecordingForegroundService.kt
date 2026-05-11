package expo.modules.recordingservice

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.*
import androidx.core.app.NotificationCompat

class RecordingForegroundService : Service() {

    companion object {
        const val CHANNEL_ID = "memo_recording_fg"
        const val NOTIF_ID = 101
        const val ACTION_START  = "expo.modules.recordingservice.START"
        const val ACTION_STOP   = "expo.modules.recordingservice.STOP"
        const val ACTION_UPDATE = "expo.modules.recordingservice.UPDATE"
        const val ACTION_PAUSE  = "expo.modules.recordingservice.PAUSE"
        const val ACTION_RESUME = "expo.modules.recordingservice.RESUME"
        const val EXTRA_ELAPSED = "elapsed"
        const val EXTRA_PAUSED  = "paused"

        // JS layer subscribes here to hear about button taps
        var onEvent: ((String) -> Unit)? = null
    }

    private val handler = Handler(Looper.getMainLooper())
    private var elapsed = 0
    private var paused  = false
    private var tickRunnable: Runnable? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                elapsed = intent.getIntExtra(EXTRA_ELAPSED, 0)
                paused  = intent.getBooleanExtra(EXTRA_PAUSED, false)
                startForeground(NOTIF_ID, buildNotification())
                if (!paused) startTicker()
            }
            ACTION_STOP -> {
                stopTicker()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
            ACTION_UPDATE -> {
                elapsed = intent.getIntExtra(EXTRA_ELAPSED, elapsed)
                paused  = intent.getBooleanExtra(EXTRA_PAUSED, paused)
                if (paused) stopTicker() else startTicker()
                updateNotification()
            }
            ACTION_PAUSE -> {
                paused = true
                stopTicker()
                updateNotification()
                handler.post { onEvent?.invoke("pause") }
            }
            ACTION_RESUME -> {
                paused = false
                startTicker()
                updateNotification()
                handler.post { onEvent?.invoke("resume") }
            }
        }
        return START_STICKY
    }

    private fun startTicker() {
        stopTicker()
        tickRunnable = object : Runnable {
            override fun run() {
                if (!paused) {
                    elapsed++
                    updateNotification()
                    handler.postDelayed(this, 1000)
                }
            }
        }
        handler.postDelayed(tickRunnable!!, 1000)
    }

    private fun stopTicker() {
        tickRunnable?.let { handler.removeCallbacks(it) }
        tickRunnable = null
    }

    private fun fmt(secs: Int): String {
        val h = secs / 3600
        val m = (secs % 3600) / 60
        val s = secs % 60
        return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%02d:%02d".format(m, s)
    }

    private fun buildNotification(): Notification {
        val openIntent = packageManager.getLaunchIntentForPackage(packageName)
            ?.apply { flags = Intent.FLAG_ACTIVITY_SINGLE_TOP }
        val openPi = PendingIntent.getActivity(this, 0, openIntent, PendingIntent.FLAG_IMMUTABLE)

        val iconRes = resources.getIdentifier("notification_icon", "drawable", packageName)
            .takeIf { it != 0 } ?: android.R.drawable.ic_btn_speak_now

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(iconRes)
            .setContentTitle(if (paused) "⏸ Memo en pausa" else "🔴 Memo grabando")
            .setContentText(if (paused) "Pausado · ${fmt(elapsed)} grabados" else "Grabando · ${fmt(elapsed)}")
            .setContentIntent(openPi)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)

        if (paused) {
            val pi = PendingIntent.getService(
                this, 1,
                Intent(this, RecordingForegroundService::class.java).apply { action = ACTION_RESUME },
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            builder.addAction(0, "▶ Reanudar", pi)
        } else {
            val pi = PendingIntent.getService(
                this, 2,
                Intent(this, RecordingForegroundService::class.java).apply { action = ACTION_PAUSE },
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            builder.addAction(0, "⏸ Pausar", pi)
        }

        return builder.build()
    }

    private fun updateNotification() {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIF_ID, buildNotification())
    }

    private fun createChannel() {
        val ch = NotificationChannel(CHANNEL_ID, "Grabación activa", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Notificación persistente mientras se graba un memo"
            setSound(null, null)
            enableVibration(false)
            setShowBadge(false)
        }
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(ch)
    }

    override fun onDestroy() {
        stopTicker()
        super.onDestroy()
    }
}
