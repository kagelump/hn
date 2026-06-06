import Foundation
import Capacitor
import WebKit

@objc(ReaderFetchPlugin)
public class ReaderFetchPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ReaderFetchPlugin"
    public let jsName = "ReaderFetch"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "fetchHtml", returnType: CAPPluginReturnPromise)
    ]

    @objc func fetchHtml(_ call: CAPPluginCall) {
        let urlString = (call.options["url"] as? String) ?? ""
        guard !urlString.isEmpty, let url = URL(string: urlString) else {
            call.perform(NSSelectorFromString("resolve:"), with: ["error": "Invalid URL"] as NSDictionary)
            return
        }

        let timeout = (call.options["timeout"] as? Int) ?? 15000

        nonisolated(unsafe) let capturedCall = call
        Task { @MainActor in
            let config = WKWebViewConfiguration()
            config.preferences.javaScriptEnabled = true

            let webView = WKWebView(frame: .zero, configuration: config)
            let handler = WebViewHandler(webView: webView, call: capturedCall, timeout: timeout)
            handler.load(url: url)
        }
    }
}

class WebViewHandler: NSObject, WKNavigationDelegate {
    private let webView: WKWebView
    private let call: CAPPluginCall
    private var timeoutItem: DispatchWorkItem?

    init(webView: WKWebView, call: CAPPluginCall, timeout: Int) {
        self.webView = webView
        self.call = call
        super.init()

        webView.navigationDelegate = self

        let workItem = DispatchWorkItem { [weak self] in
            self?.finish(error: "Request timed out")
        }
        timeoutItem = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(timeout), execute: workItem)
    }

    func load(url: URL) {
        webView.load(URLRequest(url: url))
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.evaluateJavaScript("document.documentElement.outerHTML") { [weak self] result, error in
            guard let self = self else { return }

            if let error = error {
                self.finish(error: "Failed to extract HTML: \(error.localizedDescription)")
                return
            }

            guard let html = result as? String else {
                self.finish(error: "No HTML content returned")
                return
            }

            self.finish(html: html)
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        finish(error: "Page load failed: \(error.localizedDescription)")
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        finish(error: "Page load failed: \(error.localizedDescription)")
    }

    private func finish(html: String) {
        timeoutItem?.cancel()
        timeoutItem = nil
        call.perform(NSSelectorFromString("resolve:"), with: ["html": html] as NSDictionary)
    }

    private func finish(error: String) {
        timeoutItem?.cancel()
        timeoutItem = nil
        call.perform(NSSelectorFromString("resolve:"), with: ["error": error] as NSDictionary)
    }
}
