# Proguard & R8 Rules for AirMic (Centralized Mic Mobile)
# Ensures native JNI methods, WebRTC C++ bindings, and React Native bridge calls are preserved.

# -------------------------------------------------------------
# 1. React Native Core & Hermes
# -------------------------------------------------------------
-keep class com.facebook.react.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.runtime.** { *; }
-keepattributes Signature, Exceptions, InnerClasses, EnclosingMethod
-keepattributes *Annotation*
-dontwarn com.facebook.react.**
-dontwarn javax.annotation.**

# -------------------------------------------------------------
# 2. LiveKit & WebRTC (C++ JNI Audio Pipeline)
# -------------------------------------------------------------
-keep class com.livekit.** { *; }
-keep class livekit.** { *; }
-keep class org.webrtc.** { *; }
-keepclasseswithmembernames class org.webrtc.** {
    native <methods>;
}
-dontwarn org.webrtc.**
-dontwarn com.livekit.**

# -------------------------------------------------------------
# 3. Google Play Services Code Scanner
# -------------------------------------------------------------
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.vision.** { *; }
-keep class com.google.android.gms.common.** { *; }
-dontwarn com.google.mlkit.**
-dontwarn com.google.android.gms.**

# -------------------------------------------------------------
# 4. AirMic Native Audio & Foreground Service Modules
# -------------------------------------------------------------
-keep class com.wirelessmic.** { *; }
-keepclassmembers class com.wirelessmic.** {
    @com.facebook.react.bridge.ReactMethod *;
}
