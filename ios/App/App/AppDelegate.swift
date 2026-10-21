import UIKit
import Capacitor
import UserNotifications
import AuthenticationServices
import StoreKit

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

/// The site's bridge to what only the app can do: notifications through Apple, signing in with
/// Google or Apple, and buying Pro through the App Store. The site uses them through
/// src/lib/nativeApp.ts and src/lib/appStore.ts.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(CrimeAlertPushPlugin())
        bridge?.registerPluginInstance(CrimeAlertAuthPlugin())
        bridge?.registerPluginInstance(CrimeAlertStorePlugin())
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

// MARK: - Pro through the App Store (StoreKit 2)

/// Buys and restores Pro. The site sends the transaction ids to the server (apple-subscription),
/// which asks Apple what they give; nothing here decides who has Pro.
@objc(CrimeAlertStorePlugin)
public class CrimeAlertStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CrimeAlertStorePlugin"
    public let jsName = "CrimeAlertStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "products", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "entitlements", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manage", returnType: CAPPluginReturnPromise)
    ]

    private var updates: Task<Void, Never>?

    override public func load() {
        // Renewals, purchases approved later (Ask to Buy) and refunds arrive here while the app runs
        updates = Task.detached { [weak self] in
            for await result in Transaction.updates {
                guard case .verified(let transaction) = result else { continue }
                await transaction.finish()
                let id = String(transaction.id)
                DispatchQueue.main.async {
                    self?.notifyListeners("transaction", data: ["transactionId": id], retainUntilConsumed: true)
                }
            }
        }
    }

    deinit {
        updates?.cancel()
    }

    private static func period(_ period: Product.SubscriptionPeriod) -> String {
        let unit: String
        switch period.unit {
        case .day: unit = "day"
        case .week: unit = "week"
        case .month: unit = "month"
        case .year: unit = "year"
        @unknown default: unit = "month"
        }
        return "\(period.value) \(unit)"
    }

    /// The Pro subscriptions with their prices in the user's own currency
    @objc func products(_ call: CAPPluginCall) {
        let ids = call.getArray("ids", String.self) ?? []
        Task {
            do {
                var list: [[String: Any]] = []
                for product in try await Product.products(for: ids) {
                    var item: [String: Any] = [
                        "id": product.id,
                        "title": product.displayName,
                        "description": product.description,
                        "price": product.displayPrice,
                        "amount": NSDecimalNumber(decimal: product.price).doubleValue,
                        "currency": product.priceFormatStyle.currencyCode
                    ]
                    if let subscription = product.subscription {
                        item["period"] = CrimeAlertStorePlugin.period(subscription.subscriptionPeriod)
                        if let offer = subscription.introductoryOffer, offer.paymentMode == .freeTrial,
                           await subscription.isEligibleForIntroOffer {
                            item["trial"] = CrimeAlertStorePlugin.period(offer.period)
                        }
                    }
                    list.append(item)
                }
                call.resolve(["products": list])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    /// Buys a subscription for the signed-in account (its id goes with the purchase to Apple)
    @objc func purchase(_ call: CAPPluginCall) {
        guard let id = call.getString("productId"),
              let account = call.getString("accountId").flatMap({ UUID(uuidString: $0) }) else {
            call.reject("Saknar produkt eller konto")
            return
        }
        Task {
            do {
                guard let product = try await Product.products(for: [id]).first else {
                    call.reject("Produkten finns inte i App Store")
                    return
                }
                switch try await product.purchase(options: [.appAccountToken(account)]) {
                case .success(let verification):
                    guard case .verified(let transaction) = verification else {
                        call.reject("Apple kunde inte bekräfta köpet")
                        return
                    }
                    await transaction.finish()
                    call.resolve(["transactionId": String(transaction.id)])
                case .pending:
                    // Waits for approval (Ask to Buy); it arrives through Transaction.updates
                    call.resolve(["pending": true])
                case .userCancelled:
                    call.reject("Avbrutet", "CANCELLED")
                @unknown default:
                    call.reject("Köpet gick inte igenom")
                }
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    private func currentTransactions() async -> [String] {
        var ids: [String] = []
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result, transaction.productType == .autoRenewable {
                ids.append(String(transaction.id))
            }
        }
        return ids
    }

    /// The subscriptions this Apple ID has now
    @objc func entitlements(_ call: CAPPluginCall) {
        Task {
            call.resolve(["transactionIds": await currentTransactions()])
        }
    }

    /// "Återställ köp": fetches the purchases from Apple again (asks for the Apple ID password)
    @objc func restore(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
            } catch {
                call.reject(error.localizedDescription)
                return
            }
            call.resolve(["transactionIds": await currentTransactions()])
        }
    }

    /// Apple's own sheet for changing or cancelling the subscription
    @objc func manage(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let scene = self.bridge?.viewController?.view.window?.windowScene else {
                call.reject("Kunde inte öppna prenumerationer")
                return
            }
            do {
                try await AppStore.showManageSubscriptions(in: scene)
                call.resolve()
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }
}
