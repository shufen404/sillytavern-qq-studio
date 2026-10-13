import AppKit
import WebKit
import Foundation

final class LocalService {
    let root: URL
    let port: Int
    let label: String
    let engine: URL
    let runtime: URL
    var origin: URL { URL(string: "http://localhost:\(port)")! }
    var plist: URL { root.appendingPathComponent("local-service.plist") }
    var log: URL { root.appendingPathComponent("Logs/service.log") }
    var domain: String { "gui/\(getuid())" }
    init() {
        let info = Bundle.main.infoDictionary ?? [:]
        port = info["QQStudioPort"] as? Int ?? 8020
        label = (Bundle.main.bundleIdentifier ?? "io.shufen.qqstudio.desktop") + ".server"
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        if let override = info["QQStudioDataDirectory"] as? String {
            root = URL(fileURLWithPath: override, isDirectory: true)
        } else {
            root = support.appendingPathComponent("SillyTavern QQ Studio", isDirectory: true)
        }
        let resources = Bundle.main.resourceURL!.resolvingSymlinksInPath()
        engine = resources.appendingPathComponent("Engine", isDirectory: true)
        runtime = resources.appendingPathComponent("runtime", isDirectory: true)
    }
    @discardableResult func control(_ args: [String]) -> (Int32, String) {
        let process = Process(), pipe = Pipe()
        process.executableURL = URL(fileURLWithPath: "/bin/launchctl")
        process.arguments = args
        process.standardOutput = pipe; process.standardError = pipe
        do {
            try process.run()
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            process.waitUntilExit()
            return (process.terminationStatus, String(data: data, encoding: .utf8) ?? "")
        } catch { return (-1, error.localizedDescription) }
    }
    func prepare() throws {
        let fm = FileManager.default
        for folder in [root, root.appendingPathComponent("data"), root.appendingPathComponent("Logs")] {
            try fm.createDirectory(at: folder, withIntermediateDirectories: true)
            try fm.setAttributes([.posixPermissions: 0o700], ofItemAtPath: folder.path)
        }
        let config = root.appendingPathComponent("config.yaml")
        if !fm.fileExists(atPath: config.path) {
            try fm.copyItem(at: engine.appendingPathComponent("default/config.yaml"), to: config)
        }
        try fm.setAttributes([.posixPermissions: 0o600], ofItemAtPath: config.path)
        if !fm.fileExists(atPath: log.path) { fm.createFile(atPath: log.path, contents: nil) }
        try fm.setAttributes([.posixPermissions: 0o600], ofItemAtPath: log.path)
        let job: [String: Any] = [
            "Label": label,
            "ProgramArguments": [runtime.appendingPathComponent("bin/node").path,
                engine.appendingPathComponent("server.js").path,
                "--listen", "false", "--port", String(port), "--browserLaunchEnabled", "false",
                "--dataRoot", root.appendingPathComponent("data").path,
                "--configPath", config.path],
            "WorkingDirectory": engine.path,
            "EnvironmentVariables": ["NODE_ENV": "production", "PATH": runtime.appendingPathComponent("bin").path + ":/usr/bin:/bin:/usr/sbin:/sbin"],
            "RunAtLoad": true, "KeepAlive": true, "ThrottleInterval": 3,
            "ProcessType": "Interactive",
            "StandardOutPath": log.path, "StandardErrorPath": log.path,
        ]
        let data = try PropertyListSerialization.data(fromPropertyList: job, format: .xml, options: 0)
        try data.write(to: plist, options: .atomic)
        try fm.setAttributes([.posixPermissions: 0o600], ofItemAtPath: plist.path)
    }
    func ensureStarted() throws {
        try prepare()
        if control(["print", "\(domain)/\(label)"]).0 == 0 { return }
        let result = control(["bootstrap", domain, plist.path])
        if result.0 != 0 && control(["print", "\(domain)/\(label)"]).0 != 0 {
            throw NSError(domain: "QQStudioService", code: Int(result.0), userInfo: [NSLocalizedDescriptionKey: "无法启动本地服务：\(result.1)"])
        }
    }
    func restart() throws {
        try ensureStarted()
        let result = control(["kickstart", "-k", "\(domain)/\(label)"])
        if result.0 != 0 { throw NSError(domain: "QQStudioService", code: Int(result.0), userInfo: [NSLocalizedDescriptionKey: result.1]) }
    }
    func stop() { _ = control(["bootout", "\(domain)/\(label)"]) }
}

final class DesktopApp: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    let service = LocalService()
    var window: NSWindow!
    var web: WKWebView!
    var cover: NSView!
    var status: NSTextField!
    var detail: NSTextField!
    var spinner: NSProgressIndicator!
    var timer: Timer?
    var checking = false
    var starting = false
    var pageLoaded = false
    var loadingPage = false
    var offlineSince: Date? = Date()
    var exiting = false
    let healthSession = URLSession(configuration: .ephemeral)

    func applicationDidFinishLaunching(_ notification: Notification) {
        makeMenus(); makeWindow()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        startService()
        timer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in self?.checkHealth() }
    }
    func makeMenus() {
        let bar = NSMenu()
        let appItem = NSMenuItem(); bar.addItem(appItem)
        let appMenu = NSMenu(); appItem.submenu = appMenu
        appMenu.addItem(withTitle: "关于 SillyTavern QQ Studio", action: #selector(about), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "隐藏 QQ Studio", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "退出 QQ Studio", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let editItem = NSMenuItem(); bar.addItem(editItem)
        let edit = NSMenu(title: "编辑"); editItem.submenu = edit
        edit.addItem(withTitle: "撤销", action: Selector(("undo:")), keyEquivalent: "z")
        edit.addItem(withTitle: "剪切", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "复制", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "粘贴", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "全选", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        let viewItem = NSMenuItem(); bar.addItem(viewItem)
        let view = NSMenu(title: "窗口与服务"); viewItem.submenu = view
        view.addItem(withTitle: "显示聊天窗口", action: #selector(showWindow), keyEquivalent: "0")
        view.addItem(withTitle: "打开设置", action: #selector(openSettings), keyEquivalent: ",")
        view.addItem(withTitle: "重新载入界面…", action: #selector(reloadPage), keyEquivalent: "r")
        view.addItem(.separator())
        view.addItem(withTitle: "重启后台服务…", action: #selector(restartService), keyEquivalent: "")
        view.addItem(withTitle: "打开数据文件夹", action: #selector(openData), keyEquivalent: "")
        view.addItem(withTitle: "查看服务日志", action: #selector(openLog), keyEquivalent: "")
        for menu in [appMenu, view] { for item in menu.items where item.action != #selector(NSApplication.hide(_:)) && item.action != #selector(NSApplication.terminate(_:)) { item.target = self } }
        NSApp.mainMenu = bar
    }
    func makeWindow() {
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1260, height: 820), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "SillyTavern QQ Studio"
        window.minSize = NSSize(width: 680, height: 500)
        window.center(); window.delegate = self; window.isReleasedWhenClosed = false
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self; web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = false
        web.translatesAutoresizingMaskIntoConstraints = false
        let root = NSView(); window.contentView = root; root.addSubview(web)
        NSLayoutConstraint.activate([web.leadingAnchor.constraint(equalTo: root.leadingAnchor),web.trailingAnchor.constraint(equalTo: root.trailingAnchor),web.topAnchor.constraint(equalTo: root.topAnchor),web.bottomAnchor.constraint(equalTo: root.bottomAnchor)])
        cover = NSView(); cover.wantsLayer = true; cover.layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor; cover.translatesAutoresizingMaskIntoConstraints = false; root.addSubview(cover)
        NSLayoutConstraint.activate([cover.leadingAnchor.constraint(equalTo: root.leadingAnchor),cover.trailingAnchor.constraint(equalTo: root.trailingAnchor),cover.topAnchor.constraint(equalTo: root.topAnchor),cover.bottomAnchor.constraint(equalTo: root.bottomAnchor)])
        let title = NSTextField(labelWithString: "QQ Studio"); title.font = .systemFont(ofSize: 30, weight: .semibold)
        status = NSTextField(labelWithString: "正在启动本地服务…"); status.font = .systemFont(ofSize: 16, weight: .medium)
        detail = NSTextField(wrappingLabelWithString: "无需打开终端。已保存的设置与聊天会从独立数据目录加载。"); detail.alignment = .center; detail.textColor = .secondaryLabelColor
        spinner = NSProgressIndicator(); spinner.style = .spinning; spinner.startAnimation(nil)
        let retry = NSButton(title: "重试连接", target: self, action: #selector(retryConnection))
        let logs = NSButton(title: "查看日志", target: self, action: #selector(openLog))
        let buttons = NSStackView(views: [retry,logs]); buttons.spacing = 12
        let stack = NSStackView(views: [title,spinner,status,detail,buttons]); stack.orientation = .vertical; stack.spacing = 20; stack.alignment = .centerX; stack.translatesAutoresizingMaskIntoConstraints = false; cover.addSubview(stack)
        NSLayoutConstraint.activate([stack.centerXAnchor.constraint(equalTo: cover.centerXAnchor),stack.centerYAnchor.constraint(equalTo: cover.centerYAnchor),stack.widthAnchor.constraint(lessThanOrEqualToConstant: 520),stack.leadingAnchor.constraint(greaterThanOrEqualTo: cover.leadingAnchor, constant: 30),detail.widthAnchor.constraint(lessThanOrEqualToConstant: 500)])
    }
    func locationIsSupported() -> Bool {
        let bundle = Bundle.main.bundleURL.resolvingSymlinksInPath().path
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        return !["Documents", "Desktop", "Downloads"].contains { bundle.hasPrefix(home + "/" + $0 + "/") }
    }
    func startService() {
        guard locationIsSupported() else {
            status.stringValue = "请先将 QQ Studio 安装到“应用程序”"
            detail.stringValue = "macOS 会限制后台服务从文稿、桌面和下载目录启动。请移动应用到 Applications 后再打开；桌面可以保留指向正式应用的快捷方式。"
            spinner.stopAnimation(nil)
            return
        }
        guard !starting && !exiting else { return }; starting = true
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }
            do { try self.service.ensureStarted(); DispatchQueue.main.async { self.starting = false; self.checkHealth() } }
            catch { DispatchQueue.main.async { self.starting = false; self.status.stringValue = "本地服务未能启动"; self.detail.stringValue = error.localizedDescription; self.spinner.stopAnimation(nil) } }
        }
    }
    func checkHealth() {
        guard locationIsSupported(), !checking && !exiting else { return }; checking = true
        var request = URLRequest(url: service.origin.appendingPathComponent("desktop-health.json"))
        request.timeoutInterval = 1.5; request.cachePolicy = .reloadIgnoringLocalCacheData
        healthSession.dataTask(with: request) { [weak self] data,response,error in
            guard let self = self else { return }
            let json = data.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String:Any] }
            let good = (response as? HTTPURLResponse)?.statusCode == 200 && json?["product"] as? String == "QQ Studio Desktop"
            DispatchQueue.main.async {
                self.checking = false; guard !self.exiting else { return }
                if good {
                    self.offlineSince = nil
                    if !self.pageLoaded && !self.loadingPage { self.loadingPage = true; self.web.load(URLRequest(url:self.service.origin)) }
                    if self.pageLoaded { self.cover.isHidden = true }
                } else {
                    if self.offlineSince == nil { self.offlineSince = Date() }
                    let elapsed = Date().timeIntervalSince(self.offlineSince!)
                    if elapsed > 3 || !self.pageLoaded { self.cover.isHidden = false; self.spinner.startAnimation(nil) }
                    self.status.stringValue = self.pageLoaded ? "本地服务恢复中…" : "正在启动本地服务…"
                    self.detail.stringValue = elapsed > 30 ? "启动时间较长。可查看日志；若端口被其他程序占用，请先关闭冲突的程序。" : "后台会自动尝试恢复。已载入的页面不会被强制刷新，以保留当前输入。"
                    if elapsed > 6 { self.startService() }
                }
            }
        }.resume()
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { pageLoaded = true; loadingPage = false; cover.isHidden = true }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { loadingPage = false; cover.isHidden = false; status.stringValue = "正在重新连接…"; checkHealth() }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { pageLoaded = false; loadingPage = false; checkHealth() }
    func isLocal(_ url: URL) -> Bool { url.scheme == "http" && url.host == "localhost" && url.port == service.port }
    func openExternal(_ url: URL) { if ["https","http"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) } }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if action.shouldPerformDownload { decisionHandler(.download); return }
        if isLocal(url) || url.scheme == "about" || url.scheme == "blob" { decisionHandler(.allow); return }
        if action.navigationType == .linkActivated { openExternal(url) }
        decisionHandler(.cancel)
    }
    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) { decisionHandler(response.canShowMIMEType ? .allow : .download) }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? { if let url = action.request.url { if isLocal(url) { web.load(URLRequest(url:url)) } else { openExternal(url) } }; return nil }
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel=NSOpenPanel(); panel.allowsMultipleSelection=parameters.allowsMultipleSelection; panel.canChooseDirectories=parameters.allowsDirectories; panel.canChooseFiles=true
        panel.beginSheetModal(for: window) { result in completionHandler(result == .OK ? panel.urls : nil) }
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) { let alert=NSAlert(); alert.messageText=message; alert.addButton(withTitle:"确定"); alert.beginSheetModal(for:window) { _ in completionHandler() } }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) { let alert=NSAlert(); alert.messageText=message; alert.addButton(withTitle:"确定"); alert.addButton(withTitle:"取消"); alert.beginSheetModal(for:window) { response in completionHandler(response == .alertFirstButtonReturn) } }
    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) { let alert=NSAlert(); alert.messageText=prompt; let field=NSTextField(frame:NSRect(x:0,y:0,width:300,height:24)); field.stringValue=defaultText ?? ""; alert.accessoryView=field; alert.addButton(withTitle:"确定"); alert.addButton(withTitle:"取消"); alert.beginSheetModal(for:window) { response in completionHandler(response == .alertFirstButtonReturn ? field.stringValue : nil) } }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate=self }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate=self }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) { let panel=NSSavePanel(); panel.nameFieldStringValue=suggestedFilename; panel.beginSheetModal(for:window) { result in completionHandler(result == .OK ? panel.url : nil) } }
    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) { let alert=NSAlert(); alert.messageText="文件保存失败"; alert.informativeText=error.localizedDescription; alert.beginSheetModal(for:window) }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool { showWindow(); return true }
    @objc func showWindow() { window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps:true) }
    @objc func openSettings() { showWindow(); web.evaluateJavaScript("document.querySelector('#studio-header [data-open=quick]')?.click()", completionHandler:nil) }
    @objc func openData() { NSWorkspace.shared.open(service.root) }
    @objc func openLog() { NSWorkspace.shared.open(service.log) }
    @objc func about() { let alert=NSAlert(); alert.messageText="SillyTavern QQ Studio 桌面版"; alert.informativeText="原生 macOS 窗口 · 内置 Node.js 与完整应用\n关闭窗口不会停止后台；⌘Q 会退出应用和后台服务。\n数据：\(service.root.path)\n\n基于 SillyTavern，保留 AGPL-3.0 许可。"; alert.beginSheetModal(for:window) }
    @objc func retryConnection() { spinner.startAnimation(nil); startService(); checkHealth() }
    @objc func reloadPage() { let alert=NSAlert(); alert.messageText="重新载入界面？"; alert.informativeText="尚未保存的输入和临时聊天可能丢失。"; alert.addButton(withTitle:"重新载入"); alert.addButton(withTitle:"取消"); alert.beginSheetModal(for:window) { [weak self] result in if result == .alertFirstButtonReturn { self?.web.reload() } } }
    @objc func restartService() { let alert=NSAlert(); alert.messageText="重启本地后台服务？"; alert.informativeText="正在生成的请求会中断，已保存的数据不会被删除。"; alert.addButton(withTitle:"重启"); alert.addButton(withTitle:"取消"); alert.beginSheetModal(for:window) { [weak self] result in guard result == .alertFirstButtonReturn, let self=self else{return}; self.cover.isHidden=false; self.status.stringValue="正在重启…"; DispatchQueue.global().async { try? self.service.restart() } } }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if exiting { return .terminateNow }; exiting=true; timer?.invalidate()
        guard pageLoaded else { service.stop(); return .terminateNow }
        var replied=false
        let finish: () -> Void = { [weak self] in guard !replied else{return}; replied=true; self?.service.stop(); NSApp.reply(toApplicationShouldTerminate:true) }
        let js="""
        const [{eventSource,event_types},main,context] = await Promise.all([import('/scripts/events.js'),import('/script.js'),import('/scripts/st-context.js')]);
        const saved=new Promise(resolve=>{const onSave=()=>{eventSource.removeListener(event_types.SETTINGS_UPDATED,onSave);resolve(true)};eventSource.on(event_types.SETTINGS_UPDATED,onSave);setTimeout(()=>{eventSource.removeListener(event_types.SETTINGS_UPDATED,onSave);resolve(false)},2500)});
        await main.saveSettings();
        try { await context.getContext().saveChat(); } catch {}
        return await saved;
        """
        web.callAsyncJavaScript(js,arguments:[:],in:nil,in:.page) { _ in finish() }
        DispatchQueue.main.asyncAfter(deadline:.now()+4) { finish() }
        return .terminateLater
    }
}
let application=NSApplication.shared
let delegate=DesktopApp()
application.delegate=delegate
application.setActivationPolicy(.regular)
application.run()
