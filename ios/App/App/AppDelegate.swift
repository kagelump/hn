import UIKit
import Capacitor
import WebKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private static var originalImp: IMP?
    private nonisolated(unsafe) var statusTapWebView: WKWebView?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        swizzleStatusBarTap()
        return true
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Capture the web view reference once the window is ready
        if statusTapWebView == nil,
           let vc = window?.rootViewController as? CAPBridgeViewController,
           let wv = vc.webView {
            statusTapWebView = wv

            NotificationCenter.default.addObserver(
                forName: NSNotification.Name("statusBarTap"),
                object: nil,
                queue: .main
            ) { [weak self] _ in
                guard let webView = self?.statusTapWebView else { return }
                DispatchQueue.main.async {
                    webView.evaluateJavaScript("""
                        var el = document.querySelector('.show-page .pagebd-container');
                        if (el) { el.scrollTo({ top: 0, behavior: 'smooth' }); }
                    """)
                }
            }
        }
    }

    private func swizzleStatusBarTap() {
        guard let cls = NSClassFromString("UIStatusBarManager") as? NSObject.Type else { return }
        let sel = NSSelectorFromString("handleTapAction:")
        guard let orig = class_getInstanceMethod(cls, sel) else { return }

        let origIMP = method_getImplementation(orig)
        AppDelegate.originalImp = origIMP

        let swizzedBlock: @convention(block) (NSObject, AnyObject?) -> Void = { instance, arg in
            // Forward to original implementation
            typealias OrigFn = @convention(c) (NSObject, Selector, AnyObject?) -> Void
            let origFn = unsafeBitCast(origIMP, to: OrigFn.self)
            origFn(instance, sel, arg)

            // Notify the web layer
            NotificationCenter.default.post(name: NSNotification.Name("statusBarTap"), object: nil)
        }

        method_setImplementation(orig, imp_implementationWithBlock(swizzedBlock))
    }

    // MARK: - Lifecycle

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        let selector = NSSelectorFromString("application:continueUserActivity:restorationHandler:")
        if ApplicationDelegateProxy.shared.responds(to: selector) {
            let proxy = ApplicationDelegateProxy.shared as AnyObject
            let result = proxy.perform(selector, with: application, with: userActivity)
            return (result?.takeUnretainedValue() as? Bool) ?? false
        }
        return false
    }
}
