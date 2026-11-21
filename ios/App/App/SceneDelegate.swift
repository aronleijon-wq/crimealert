import UIKit
import WebKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        // The launch screen shows meanwhile; the site is loaded only once the old copy is gone
        clearWebCache {
            self.window?.rootViewController = MainViewController()
            self.window?.makeKeyAndVisible()
            SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
        }
    }

    /// The web view keeps its own copy of the site between launches, and neither an App Store
    /// update nor the site's own version check (in pages older than mid-November 2026) moves it to
    /// a new version: only deleting the app did. So the copy is dropped at every launch, and the
    /// site is fetched fresh. Cookies and stored data stay, so nobody is signed out.
    private func clearWebCache(then done: @escaping () -> Void) {
        var finished = false
        let finish = {
            guard !finished else { return }
            finished = true
            done()
        }
        let types: Set<String> = [WKWebsiteDataTypeDiskCache, WKWebsiteDataTypeMemoryCache, WKWebsiteDataTypeFetchCache]
        WKWebsiteDataStore.default().removeData(ofTypes: types, modifiedSince: .distantPast) {
            DispatchQueue.main.async(execute: finish)
        }
        // Never hold the launch for long
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5, execute: finish)
    }

    func sceneWillEnterForeground(_ scene: UIScene) {
        // Back from the background: the site checks whether a newer version is live (src/lib/appVersion.ts)
        (window?.rootViewController as? MainViewController)?.webView?.evaluateJavaScript(
            "document.dispatchEvent(new Event('crimealert-app-resumed'))", completionHandler: nil)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
