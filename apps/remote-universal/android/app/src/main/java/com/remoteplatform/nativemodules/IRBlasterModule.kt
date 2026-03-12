package com.remoteplatform.nativemodules

import android.content.Context
import android.hardware.ConsumerIrManager
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableArray

/**
 * React Native native module wrapping Android's ConsumerIrManager.
 *
 * Exposed as NativeModules.IRBlaster in JavaScript.
 *
 * Supported from Android 4.4 (API 19). On unsupported devices or API levels,
 * hasIrEmitter() returns false and transmit() rejects cleanly.
 */
class IRBlasterModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "IRBlaster"

    private val irManager: ConsumerIrManager? by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            reactContext.getSystemService(Context.CONSUMER_IR_SERVICE) as? ConsumerIrManager
        } else {
            null
        }
    }

    /**
     * Returns whether this device has a built-in IR emitter.
     * Always false on iOS or devices without dedicated IR hardware.
     */
    @ReactMethod
    fun hasIrEmitter(promise: Promise) {
        try {
            promise.resolve(irManager?.hasIrEmitter() == true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    /**
     * Transmits an IR signal using Android's ConsumerIrManager.
     *
     * @param carrierFrequency  Carrier frequency in Hz (e.g. 38000 for most remote controls)
     * @param pattern           ReadableArray of alternating mark/space durations in microseconds
     *                          (e.g. [9000, 4500, 560, 560, ...])
     */
    @ReactMethod
    fun transmit(carrierFrequency: Int, pattern: ReadableArray, promise: Promise) {
        try {
            val manager = irManager
            if (manager == null) {
                promise.reject(
                    "IR_NOT_AVAILABLE",
                    "ConsumerIrManager not available — requires Android 4.4 (API 19) or higher"
                )
                return
            }
            if (!manager.hasIrEmitter()) {
                promise.reject(
                    "IR_NOT_AVAILABLE",
                    "This device does not have an IR emitter"
                )
                return
            }
            val timings = IntArray(pattern.size()) { i -> pattern.getInt(i) }
            manager.transmit(carrierFrequency, timings)
            promise.resolve(null)
        } catch (e: SecurityException) {
            promise.reject(
                "IR_PERMISSION_DENIED",
                "IR transmit permission denied: ${e.message}",
                e
            )
        } catch (e: Exception) {
            promise.reject(
                "IR_TRANSMIT_ERROR",
                e.message ?: "Unknown error during IR transmit",
                e
            )
        }
    }

    /**
     * Returns the carrier frequency ranges (Hz) supported by this device's IR emitter
     * as an array of [minFreq, maxFreq] pairs.
     *
     * Useful for verifying a code's carrier frequency is compatible before transmitting.
     */
    @ReactMethod
    fun getCarrierFrequencies(promise: Promise) {
        try {
            val manager = irManager
            if (manager == null || !manager.hasIrEmitter()) {
                promise.resolve(Arguments.createArray())
                return
            }
            val result: WritableArray = Arguments.createArray()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                for (range in manager.carrierFrequencies) {
                    val pair: WritableArray = Arguments.createArray()
                    pair.pushInt(range.minFrequency)
                    pair.pushInt(range.maxFrequency)
                    result.pushArray(pair)
                }
            }
            promise.resolve(result)
        } catch (e: Exception) {
            // Non-fatal: return empty list
            promise.resolve(Arguments.createArray())
        }
    }
}
