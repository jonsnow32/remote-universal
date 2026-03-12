#import <React/RCTBridgeModule.h>

// Objective-C bridge — exposes the Swift AndroidTV class to the React Native bridge.

@interface RCT_EXTERN_MODULE(AndroidTV, NSObject)

RCT_EXTERN_METHOD(isPaired:(NSString *)ip
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(startPairing:(NSString *)ip
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(confirmPairing:(NSString *)ip
                  pin:(NSString *)pin
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(sendKey:(NSString *)ip
                  keyCode:(NSInteger)keyCode
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(unpair:(NSString *)ip
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
