# SillyTavern QQ Studio v1.1.0

sillytavern的个性化页面设计，把它变成比较通用的了聊天界面

## macOS 桌面版

本版增加原生 macOS 窗口，内置 Node.js、完整 SillyTavern 和依赖。打开应用会启动后台；关闭窗口不会停止服务；Command+Q 会保存设置并彻底退出。后台意外退出后会自动重启。没有配置登录自启。

下载 `SillyTavern-QQ-Studio-v1.1.0-macOS-arm64.zip`，解压后先把应用放入 `/Applications` 或 `~/Applications`，再打开。不要直接从文稿、桌面或下载目录运行；桌面可以放指向已安装应用的快捷方式。

此预发布包仅针对 Apple Silicon（M 系列）Mac，最低部署目标 macOS 13，仅在开发者当前 Mac 上测试。尚未完成 Apple Developer ID 签名、公证和其他系统实机验证。如果系统阻止运行，请勿关闭系统安全保护；请等待正式签名版或自行审查源码构建。没有提供 Windows、Intel Mac 安装程序。

## 数据和隐私

数据默认保存在 `~/Library/Application Support/SillyTavern QQ Studio/`，与程序包分离。公开包不包含开发者的聊天、密钥、人设或个人图片。旧安装的数据迁移必须另行备份和授权，不会通过 GitHub 同步个人数据。用户需自行配置模型/API。

本机服务仅监听回环地址，桌面版默认使用 8020 端口。进程自动恢复不能修复外部网络或模型 API 故障，也不能恢复已经中断且尚未保存的生成内容。

## 源码与构建

源代码包根目录包含完整 SillyTavern 本体和定制界面；`desktop/macos/App.swift` 是原生外壳，`desktop/macos/build_desktop.py` 负责组装应用。

1. 安装 Node.js 20+ 和 npm，运行 `npm ci --omit=dev --ignore-scripts`。
2. 在 Mac 安装 Xcode Command Line Tools，使用 swiftc 链接 AppKit、WebKit，编译 App.swift。
3. 准备官方 macOS ARM64 Node.js 分发目录，含 bin/node、lib/node_modules/npm 和 LICENSE。
4. 运行 build_desktop.py，提供 --engine、--dependencies、--runtime、--binary、--icon、--output 参数。构建脚本不收集用户数据。

源码方式在 Windows/macOS/Linux 仍可运行 `npm run start:studio`；需要 Node.js，关闭服务终端会停止程序，这与原生桌面版不同。

## 本版修复和测试

- 默认上下文 8192，最大输出 4096，修复首次聊天预算冲突。
- 已验证原生窗口显示、个性化保存和关闭窗口后后台继续运行。
- 已故意结束隔离测试版后台，确认自动恢复，已保存主题仍保留。
- 后台由当前用户会话管理，不需要终端常开，没有禁用系统安全功能。

## 来源与许可

基于 SillyTavern 1.19.0，AGPL-3.0，见 LICENSE、STUDIO-NOTICE.md。完整可编辑源码随源码包提供。Node.js 和其他依赖保留各自许可证。不是 SillyTavern 或腾讯/QQ 官方产品。
