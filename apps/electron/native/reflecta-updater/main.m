#import <AppKit/AppKit.h>
#import <Sparkle/Sparkle.h>
#import <signal.h>

@interface ReflectaUpdater : NSObject <SPUUpdaterDelegate, SPUStandardUserDriverDelegate>
@property(nonatomic, strong) SPUUpdater *updater;
@property(nonatomic, strong) SPUStandardUserDriver *userDriver;
@property(nonatomic, strong) dispatch_source_t focusSignal;
@property(nonatomic) BOOL modalAlertVisible;
@property(nonatomic) BOOL updateCycleFinished;
@end

@implementation ReflectaUpdater

- (BOOL)startWithBundlePath:(NSString *)bundlePath foreground:(BOOL)foreground {
    NSBundle *bundle = [NSBundle bundleWithPath:bundlePath];
    if (bundle == nil) {
        fprintf(stderr, "Invalid application bundle: %s\n", bundlePath.UTF8String);
        return NO;
    }

    self.userDriver = [[SPUStandardUserDriver alloc] initWithHostBundle:bundle delegate:self];
    self.updater = [[SPUUpdater alloc] initWithHostBundle:bundle
                                       applicationBundle:bundle
                                              userDriver:self.userDriver
                                                delegate:self];

    NSError *error = nil;
    if (![self.updater startUpdater:&error]) {
        fprintf(stderr, "Unable to start Sparkle: %s\n", error.localizedDescription.UTF8String);
        return NO;
    }

    signal(SIGUSR1, SIG_IGN);
    self.focusSignal = dispatch_source_create(
        DISPATCH_SOURCE_TYPE_SIGNAL,
        SIGUSR1,
        0,
        dispatch_get_main_queue()
    );
    __weak ReflectaUpdater *weakSelf = self;
    dispatch_source_set_event_handler(self.focusSignal, ^{
        [NSApp activateIgnoringOtherApps:YES];
        [weakSelf.updater checkForUpdates];
    });
    dispatch_resume(self.focusSignal);

    if (foreground) {
        [NSApp activateIgnoringOtherApps:YES];
        [self.updater checkForUpdates];
    } else {
        [self.updater checkForUpdatesInBackground];
    }
    return YES;
}

- (void)updater:(SPUUpdater *)updater
    didFinishUpdateCycleForUpdateCheck:(SPUUpdateCheck)updateCheck
                                 error:(NSError *)error {
    self.updateCycleFinished = YES;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 250 * NSEC_PER_MSEC), dispatch_get_main_queue(), ^{
        if (!self.modalAlertVisible && !self.updater.sessionInProgress) {
            [NSApp terminate:nil];
        }
    });
}

- (void)standardUserDriverWillShowModalAlert {
    self.modalAlertVisible = YES;
}

- (void)standardUserDriverDidShowModalAlert {
    self.modalAlertVisible = NO;
    if (self.updateCycleFinished) {
        [NSApp terminate:nil];
    }
}

@end

static void printUsage(const char *executable) {
    fprintf(stderr, "Usage: %s app-bundle (--foreground|--background)\n", executable);
}

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        if (argc != 3) {
            printUsage(argv[0]);
            return EXIT_FAILURE;
        }

        NSString *mode = [NSString stringWithUTF8String:argv[2]];
        BOOL foreground = [mode isEqualToString:@"--foreground"];
        if (!foreground && ![mode isEqualToString:@"--background"]) {
            printUsage(argv[0]);
            return EXIT_FAILURE;
        }

        [NSApplication sharedApplication];
        [NSApp setActivationPolicy:NSApplicationActivationPolicyAccessory];

        ReflectaUpdater *updater = [[ReflectaUpdater alloc] init];
        NSString *bundlePath = [NSString stringWithUTF8String:argv[1]];
        if (![updater startWithBundlePath:bundlePath foreground:foreground]) {
            return EXIT_FAILURE;
        }

        [NSApp run];
    }
    return EXIT_SUCCESS;
}
