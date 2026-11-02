/*
  MathesnackLinks – reicht geöffnete Links an handleOpenURL(url) der App weiter.

  Drei Wege, auf denen ein Link ankommt (cordova-ios 8, UIScene):

  1. Warmstart, Universal Link: CDVSceneDelegate meldet
     scene:continueUserActivity: als CDVPluginContinueUserActivityNotification.
  2. Kaltstart, Universal Link oder mathesnack://: iOS übergibt den Link in
     scene:willConnectToSession:options:. Zu diesem Zeitpunkt existiert noch
     kein Plugin (Cordova lädt sie in viewDidLoad). Deshalb wird die Methode
     beim Laden der Klasse ergänzt und der Link zwischengespeichert.
  3. Warmstart, mathesnack://: liefert Cordova selbst (CDVHandleOpenURL).
     Kommt der Link zusätzlich hier an, verwirft handleOpenURL das Duplikat.

  Zugestellt wird erst, wenn die Seite geladen ist, und über das klebrige
  deviceready-Ereignis – es feuert auch, wenn es schon vorbei war.
*/

#import <Cordova/CDVPlugin.h>
#import <Cordova/CDVPluginNotifications.h>
#import <Cordova/CDVSceneDelegate.h>
#import <UIKit/UIKit.h>
#import <objc/runtime.h>

@interface MathesnackLinks : CDVPlugin
@property (nonatomic, assign) BOOL pageLoaded;
+ (void)queueURL:(NSURL *)url;
@end

/* Links, die vor dem Laden der Seite eintreffen */
static NSMutableArray<NSURL *> *MSLPending = nil;
/* Die eine Instanz des Plugins; lebt so lange wie die App */
static MathesnackLinks *MSLInstance = nil;

@implementation MathesnackLinks

+ (void)load
{
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        Class cls = [CDVSceneDelegate class];
        SEL sel = @selector(scene:willConnectToSession:options:);
        Method method = class_getInstanceMethod(cls, sel);
        if (method == NULL) {
            NSLog(@"MathesnackLinks: scene:willConnectToSession:options: nicht gefunden – Kaltstart-Links werden nicht abgefangen.");
            return;
        }

        typedef void (*MSLConnectIMP)(id, SEL, UIScene *, UISceneSession *, UISceneConnectionOptions *);
        MSLConnectIMP original = (MSLConnectIMP)method_getImplementation(method);

        IMP replacement = imp_implementationWithBlock(^(id delegate, UIScene *scene, UISceneSession *session, UISceneConnectionOptions *options) {
            original(delegate, sel, scene, session, options);

            for (NSUserActivity *activity in options.userActivities) {
                if ([activity.activityType isEqualToString:NSUserActivityTypeBrowsingWeb]) {
                    [MathesnackLinks queueURL:activity.webpageURL];
                }
            }
            for (UIOpenURLContext *context in options.URLContexts) {
                [MathesnackLinks queueURL:context.URL];
            }
        });

        method_setImplementation(method, replacement);
    });
}

+ (void)queueURL:(NSURL *)url
{
    if (url == nil) {
        return;
    }
    if (MSLInstance != nil && MSLInstance.pageLoaded) {
        [MSLInstance deliverURL:url];
        return;
    }
    if (MSLPending == nil) {
        MSLPending = [NSMutableArray array];
    }
    [MSLPending addObject:url];
}

- (void)pluginInitialize
{
    MSLInstance = self;
    NSNotificationCenter *center = [NSNotificationCenter defaultCenter];
    [center addObserver:self
               selector:@selector(onContinueUserActivity:)
                   name:CDVPluginContinueUserActivityNotification
                 object:nil];
    [center addObserver:self
               selector:@selector(onPageDidLoad:)
                   name:CDVPageDidLoadNotification
                 object:nil];
}

- (void)onContinueUserActivity:(NSNotification *)notification
{
    id object = notification.object;
    if (![object isKindOfClass:[NSUserActivity class]]) {
        return;
    }
    NSUserActivity *activity = (NSUserActivity *)object;
    if ([activity.activityType isEqualToString:NSUserActivityTypeBrowsingWeb]) {
        [MathesnackLinks queueURL:activity.webpageURL];
    }
}

- (void)onPageDidLoad:(NSNotification *)notification
{
    self.pageLoaded = YES;
    if (MSLPending.count == 0) {
        return;
    }
    NSArray<NSURL *> *urls = [MSLPending copy];
    [MSLPending removeAllObjects];
    for (NSURL *url in urls) {
        [self deliverURL:url];
    }
}

- (void)deliverURL:(NSURL *)url
{
    NSString *text = url.absoluteString;
    if (text.length == 0) {
        return;
    }
    /* JSON-Kodierung sorgt für sauberes Escaping von Anführungszeichen usw. */
    NSData *json = [NSJSONSerialization dataWithJSONObject:@[text] options:0 error:NULL];
    if (json == nil) {
        return;
    }
    NSString *argument = [[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding];
    NSString *js = [NSString stringWithFormat:
        @"document.addEventListener('deviceready',function(){if(typeof handleOpenURL==='function'){handleOpenURL(%@[0]);}});",
        argument];
    [self.commandDelegate evalJs:js];
}

- (void)dealloc
{
    [[NSNotificationCenter defaultCenter] removeObserver:self];
}

@end
