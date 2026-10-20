import UIKit
import Capacitor
import UserNotifications
import AuthenticationServices

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Set before launch ends, so tapping a notification that started the app is seen too
        UNUserNotificationCenter.current().delegate = PushCenter.shared
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        PushCenter.shared.didRegister(token: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        PushCenter.shared.didFail(error)
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

/// The site's bridge to what only the app can do: notifications through Apple and signing in
/// with Google or Apple. The site uses them through src/lib/nativeApp.ts.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(CrimeAlertPushPlugin())
        bridge?.registerPluginInstance(CrimeAlertAuthPlugin())
    }
}

// MARK: - Notifications through Apple (APNs)

/// Hears from iOS about notifications from launch on, and passes it on to the site
final class PushCenter: NSObject, UNUserNotificationCenterDelegate {
    static let shared = PushCenter()

    weak var plugin: CrimeAlertPushPlugin? {
        didSet { deliverOpened() }
    }
    private var openedPath: String?
    private var waitingForToken: [CAPPluginCall] = []

    // Show notifications also while the app is open
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .list, .sound])
    }

    // Tapping a notification opens the page it is about
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        let path = response.notification.request.content.userInfo["url"] as? String
        DispatchQueue.main.async {
            self.openedPath = path
            self.deliverOpened()
        }
        completionHandler()
    }

    private func deliverOpened() {
        guard let plugin = plugin, let path = openedPath else { return }
        openedPath = nil
        // Kept until the site listens, when the tap is what started the app
        plugin.notifyListeners("opened", data: ["url": path], retainUntilConsumed: true)
    }

    func waitForToken(_ call: CAPPluginCall) {
        waitingForToken.append(call)
    }

    func didRegister(token: Data) {
        let hex = token.map { String(format: "%02x", $0) }.joined()
        #if DEBUG
        let environment = "sandbox"
        #else
        let environment = "production"
        #endif
        let calls = waitingForToken
        waitingForToken = []
        calls.forEach { $0.resolve(["token": hex, "environment": environment]) }
    }

    func didFail(_ error: Error) {
        let calls = waitingForToken
        waitingForToken = []
        calls.forEach { $0.reject(error.localizedDescription) }
    }
}

@objc(CrimeAlertPushPlugin)
public class CrimeAlertPushPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CrimeAlertPushPlugin"
    public let jsName = "CrimeAlertPush"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "checkPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "register", returnType: CAPPluginReturnPromise)
    ]

    override public func load() {
        DispatchQueue.main.async {
            // Capacitor would otherwise take these over (handleApplicationNotifications in its config)
            UNUserNotificationCenter.current().delegate = PushCenter.shared
            PushCenter.shared.plugin = self
        }
    }

    private static func permission(_ status: UNAuthorizationStatus) -> String {
        switch status {
        case .authorized, .provisional, .ephemeral: return "granted"
        case .denied: return "denied"
        default: return "prompt"
        }
    }

    @objc func checkPermission(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            call.resolve(["permission": CrimeAlertPushPlugin.permission(settings.authorizationStatus)])
        }
    }

    @objc func requestPermission(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in
            UNUserNotificationCenter.current().getNotificationSettings { settings in
                call.resolve(["permission": CrimeAlertPushPlugin.permission(settings.authorizationStatus)])
            }
        }
    }

    /// The device token Apple sends this phone's notifications to
    @objc func register(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            PushCenter.shared.waitForToken(call)
            UIApplication.shared.registerForRemoteNotifications()
        }
    }
}

// MARK: - Signing in with Google or Apple

/// Google refuses sign-in inside an app's web view, so it happens in Apple's sign-in sheet (a
/// Safari window of its own). The site's page /app-login signs in there and hands the session
/// back through crimealert://auth, which only this sheet can receive.
@objc(CrimeAlertAuthPlugin)
public class CrimeAlertAuthPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "CrimeAlertAuthPlugin"
    public let jsName = "CrimeAlertAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise)
    ]

    private var session: ASWebAuthenticationSession?

    @objc func signIn(_ call: CAPPluginCall) {
        guard let address = call.getString("url"), let url = URL(string: address), url.host == "crimealert.se" else {
            call.reject("Ogiltig adress")
            return
        }
        DispatchQueue.main.async {
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "crimealert") { [weak self] callback, error in
                self?.session = nil
                if let callback = callback {
                    call.resolve(["url": callback.absoluteString])
                } else if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
                    call.reject("Avbrutet", "CANCELLED")
                } else {
                    call.reject(error?.localizedDescription ?? "Inloggningen misslyckades")
                }
            }
            session.presentationContextProvider = self
            // Nothing is left behind in Safari: each sign-in starts fresh
            session.prefersEphemeralWebBrowserSession = true
            self.session = session
            session.start()
        }
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }
}
