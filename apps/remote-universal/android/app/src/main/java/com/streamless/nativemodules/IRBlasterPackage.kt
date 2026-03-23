package com.streamless.nativemodules

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager

class IRBlasterPackage : BaseReactPackage() {
    override fun getModule(name: String, context: ReactApplicationContext): NativeModule? =
        when (name) {
            "IRBlaster"    -> IRBlasterModule(context)
            "USBIRBlaster" -> USBIRBlasterModule(context)
            else           -> null
        }

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
        ReactModuleInfoProvider {
            mapOf(
                "IRBlaster" to ReactModuleInfo(
                    "IRBlaster",
                    IRBlasterModule::class.java.name,
                    false, false, false, false
                ),
                "USBIRBlaster" to ReactModuleInfo(
                    "USBIRBlaster",
                    USBIRBlasterModule::class.java.name,
                    false, false, false, false
                )
            )
        }

    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
