#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// Objective-C bridge — exposes the Swift MicStream class to the React Native bridge.

@interface RCT_EXTERN_MODULE(MicStream, RCTEventEmitter)

RCT_EXTERN_METHOD(startRecording:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopRecording:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
