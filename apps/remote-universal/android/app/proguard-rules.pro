# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.swmansion.rnscreens.** { *; }

# Keep JS interface classes accessed via reflection
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
}
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
}

# Expo modules
-keep class expo.modules.** { *; }

# expo-sqlite: class only present at JVM level, suppress R8 missing-class error
-dontwarn expo.modules.kotlin.runtime.Runtime
-dontwarn expo.modules.kotlin.runtime.**

# ── Native modules (loaded by name via RN bridge — must not be renamed/stripped) ──
-keep class com.streamless.nativemodules.** { *; }
-keep class com.streamless.remote.** { *; }

# ── SSL/TLS for LAN device pairing (Android TV TLS, Samsung WSS 8002) ──────────
# Anonymous X509TrustManager in LanSslConfigurator uses interface methods
-keep class * implements javax.net.ssl.X509TrustManager { *; }
-keep class * implements javax.net.ssl.SSLSocketFactory { *; }
-keep class * implements javax.net.ssl.HostnameVerifier { *; }

# OkHttp (used by SamsungTizenPairing WebSocket and LanSslConfigurator)
-keep class okhttp3.** { *; }
-keepclassmembers class okhttp3.** { *; }

# Kotlin coroutines / reflection (used in AndroidTVModule async executor)
-keep class kotlin.** { *; }
-keep class kotlinx.coroutines.** { *; }
-dontwarn kotlin.**
-dontwarn kotlinx.**

# Suppress warnings for missing optional classes
-dontwarn com.facebook.react.**
-dontwarn okio.**
-dontwarn okhttp3.**
-dontwarn com.squareup.okhttp.**
