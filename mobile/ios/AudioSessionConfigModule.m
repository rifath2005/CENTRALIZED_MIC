#import "AudioSessionConfigModule.h"

@implementation AudioSessionConfigModule

RCT_EXPORT_MODULE(AudioSessionConfigModule);

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

/**
 * Configures the iOS AVAudioSession for ultra-low latency voice communication:
 * 1. Mode: AVAudioSessionModeVoiceChat (activates hardware VoiceProcessingIO for AEC & NS)
 * 2. Hardware Input: Forces built-in bottom microphone capsule (AVAudioSessionOrientationBottom)
 * 3. Buffer Duration: Sets I/O buffer to 5ms (0.005s) for minimal hardware packetization delay
 * 4. Sample Rate: 48 kHz matching standard Opus studio quality
 */
RCT_EXPORT_METHOD(configureLowLatencyVoiceSession:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0), ^{
        NSError *error = nil;
        AVAudioSession *session = [AVAudioSession sharedInstance];

        // 1. Set Category with PlayAndRecord (required for simultaneous duplex signaling and record)
        AVAudioSessionCategoryOptions options = AVAudioSessionCategoryOptionDefaultToSpeaker |
                                                AVAudioSessionCategoryOptionAllowBluetooth;
        
        BOOL success = [session setCategory:AVAudioSessionCategoryPlayAndRecord
                                withOptions:options
                                      error:&error];
        if (!success || error) {
            reject(@"SET_CATEGORY_FAILED", @"Failed to set AVAudioSession category", error);
            return;
        }

        // 2. Set VoiceChat Mode (activates hardware AEC, Noise Suppression, and AGC)
        success = [session setMode:AVAudioSessionModeVoiceChat error:&error];
        if (!success || error) {
            reject(@"SET_MODE_FAILED", @"Failed to set AVAudioSession mode to VoiceChat", error);
            return;
        }

        // 3. Set Preferred Buffer Duration to 5ms (governing 300ms latency budget)
        NSTimeInterval bufferDuration = 0.005; // 5ms
        [session setPreferredIOBufferDuration:bufferDuration error:&error];
        if (error) {
            NSLog(@"[AudioSessionConfigModule] Warning: Unable to set preferred buffer duration: %@", error);
            error = nil;
        }

        // 4. Set Preferred Sample Rate to 48000 Hz
        [session setPreferredSampleRate:48000.0 error:&error];
        if (error) {
            NSLog(@"[AudioSessionConfigModule] Warning: Unable to set preferred sample rate: %@", error);
            error = nil;
        }

        // 5. Select Bottom Microphone Capsule
        NSArray<AVAudioSessionPortDescription *> *availableInputs = [session availableInputs];
        AVAudioSessionPortDescription *builtInMic = nil;
        for (AVAudioSessionPortDescription *port in availableInputs) {
            if ([port.portType isEqualToString:AVAudioSessionPortBuiltInMic]) {
                builtInMic = port;
                break;
            }
        }

        if (builtInMic) {
            [session setPreferredInput:builtInMic error:&error];
            if (error) {
                NSLog(@"[AudioSessionConfigModule] Warning: Set preferred input error: %@", error);
                error = nil;
            }

            // Prefer bottom capsule over top/back camera mics
            for (AVAudioSessionDataSourceDescription *source in builtInMic.dataSources) {
                if ([source.orientation isEqualToString:AVAudioSessionOrientationBottom]) {
                    [builtInMic setPreferredDataSource:source error:&error];
                    NSLog(@"[AudioSessionConfigModule] Successfully selected bottom microphone capsule.");
                    break;
                }
            }
        }

        // 6. Activate the configured session
        success = [session setActive:YES withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation error:&error];
        if (!success || error) {
            reject(@"SESSION_ACTIVATION_FAILED", @"Failed to activate AVAudioSession", error);
            return;
        }

        resolve(@{
            @"status": @"configured",
            @"sampleRate": @(session.sampleRate),
            @"ioBufferDurationMs": @(session.IOBufferDuration * 1000.0),
            @"inputChannels": @(session.inputNumberOfChannels)
        });
    });
}

RCT_EXPORT_METHOD(deactivateSession:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSError *error = nil;
    AVAudioSession *session = [AVAudioSession sharedInstance];
    BOOL success = [session setActive:NO withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation error:&error];
    if (!success && error) {
        reject(@"SESSION_DEACTIVATION_FAILED", @"Failed to deactivate AVAudioSession", error);
        return;
    }
    resolve(@{@"status": @"deactivated"});
}

@end
