package expo.modules.recordingservice

import android.content.Context
import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class RecordingServiceModule : Module() {

    private val ctx: Context
        get() = requireNotNull(appContext.reactContext) { "React context is null" }

    override fun definition() = ModuleDefinition {
        Name("RecordingService")

        Events("onPause", "onResume")

        // Start the foreground service showing the recording notification
        Function("start") { elapsed: Int, paused: Boolean ->
            RecordingForegroundService.onEvent = { event ->
                when (event) {
                    "pause"  -> sendEvent("onPause")
                    "resume" -> sendEvent("onResume")
                }
            }
            serviceIntent(RecordingForegroundService.ACTION_START) {
                putExtra(RecordingForegroundService.EXTRA_ELAPSED, elapsed)
                putExtra(RecordingForegroundService.EXTRA_PAUSED, paused)
            }.also { startFg(it) }
        }

        // Update elapsed time and paused state without stopping the service
        Function("update") { elapsed: Int, paused: Boolean ->
            serviceIntent(RecordingForegroundService.ACTION_UPDATE) {
                putExtra(RecordingForegroundService.EXTRA_ELAPSED, elapsed)
                putExtra(RecordingForegroundService.EXTRA_PAUSED, paused)
            }.also { ctx.startService(it) }
        }

        // Stop the foreground service and remove the notification
        Function("stop") { ->
            ctx.startService(serviceIntent(RecordingForegroundService.ACTION_STOP))
        }
    }

    private fun serviceIntent(action: String, block: Intent.() -> Unit = {}): Intent =
        Intent(ctx, RecordingForegroundService::class.java).apply {
            this.action = action
            block()
        }

    private fun startFg(intent: Intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ctx.startForegroundService(intent)
        } else {
            ctx.startService(intent)
        }
    }
}
