# dsh-pet —— uTools 桌面宠物（dsh 状态桌宠）

> 🚀 基于 [uTools 官方网址](https://www.u-tools.cn/)（[uTools 开发者文档](https://www.u-tools.cn/docs/developer/)）的插件机制开发，挂件形态参考 uTools「挂件」插件。

uTools 桌面宠物：直连 **dsh-tab-alert 宿主插件**的 WebSocket 事件流
（`ws://127.0.0.1:<port>/tab-alert/stream`），以**单一圆角矩形状态面板**
实时展示当前任务状态；需要你处理/完成/出错时桌宠动画 + 音效提醒。
真正常驻桌面的悬浮窗（置顶、透明、可拖拽），切到任何软件都看得到。

> ⚠️ 需要 dsh 侧安装 **dsh-tab-alert** 宿主插件（提供 `/tab-alert/stream` WebSocket 端点），
> 见 [github.com/Suef-666/dsh-tab-alert](https://github.com/Suef-666/dsh-tab-alert)（独立可安装/卸载的 dsh 插件）。

## 功能

- **单一圆角矩形状态面板**（无任务时隐藏，状态变化只在一个面板内原地更新）：
  - 干活/思考：`任务标题` + `干活`（灰）徽标 + `处理中 . / .. / ...` 每秒循环动画
  - 回复中：`任务标题` + `回复中`（青）徽标 + AI 流式文本实时滚动
  - 等你：`任务标题` + `提问/授权/审查`（橙）徽标 + `等你操作`（常驻等待）
  - 完成：`任务标题` + `完成`（绿）；出错：`任务标题` + `出错`（红）——数秒后自动收起
- **注意力提醒**：状态切换到"等你/完成/出错"时桌宠跳动 + 音效（3 秒防抖；音效、跳动、实时消息框均可独立开关）
- **可拖拽**：锚点式 + 自校准换算 + 尺寸守卫——多屏/不同缩放率下 1:1 跟手、不抖不沉不放大
- 右键菜单：切换置顶 / 测试音效 / 关闭

## 安装 / 卸载

### 1) dsh 宿主插件（dsh-tab-alert，独立插件）

前置：dsh CLI 可用。克隆 [dsh-tab-alert](https://github.com/Suef-666/dsh-tab-alert) 仓库后，在其目录内：

```powershell
# 安装（link: 开发链接；也可直接：dsh plugin --profile web add link:<绝对路径>）
powershell -ExecutionPolicy Bypass -File .\install.ps1
# 卸载
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1
# 重启 dsh 生效；验证：dsh plugin --profile web list
```

### 2) 本桌宠（uTools 插件）

- **安装**：uTools 开发者模式（`Alt+Space` 呼出 → 设置 → 插件管理 → 开发者模式）→
  「导入插件」→ 选择本目录 `dsh-pet` → 触发 `dsh桌宠` → 点「创建桌宠」
  （勾选"启动自动建宠"则每次启动自动创建）。
- **卸载**：uTools 插件管理 → 右键 dsh 桌宠 → 移除插件。
- 修改代码后：主面板右上角 ⚙ 里的"创建桌宠"会先销毁旧窗再建新窗；
  版本号机制（右下角 `vX.Y.Z` 徽标）保证桌宠窗口自动重载最新代码。

## 设置（uTools 主面板，⚙ 折叠）

| 项 | 说明 |
|---|---|
| dsh 地址 | 事件流 WebSocket 地址（默认 `http://127.0.0.1:3081`） |
| 实时消息框 | 圆角矩形状态面板总开关 |
| 音效 / 音量 | 注意力事件音效与音量 |
| 桌宠跳动 | 注意力事件桌宠跳动动画 |
| 置顶 | 桌宠窗口置顶 |
| 启动自动建宠 | 插件启动即自动创建桌宠 |

## 文件

```
dsh-pet/
├── plugin.json       uTools 插件清单（platform: win32）
├── preload.js        主窗口 preload：createPetWin（createBrowserWindow 悬浮窗）+ 拖拽主进程逻辑
├── index.html        主面板：dsh 界面嵌入（可选套壳）+ 设置界面（⚙）+ 创建桌宠
└── pet/
    ├── index.html    桌宠窗口：🐳 + 单一状态面板 + WS 直连 + 拖拽 + 右键菜单
    └── preload.js    桌宠窗口 preload：ipc 辅助（拖拽/置顶/关闭）
```

## 卡片状态

| 徽标 | 含义 |
|---|---|
| 思考（紫） | turn/start 后、首个工具前 |
| 干活（灰） | 工具调用中（处理中… 点点动画） |
| 回复中（青） | assistant/chunk 流式输出中（实时滚动） |
| 提问/授权/审查（橙） | 等你操作 |
| 完成（绿） | turn/end completed |
| 出错（红） | turn/end error |

## 已知限制

- 事件流只在 dsh 宿主进程运行时可用（dsh 关了桌宠断线，自动重连 3s）
- docker 环境的 dsh 需保持端口映射；改端口在设置里改 URL
- `platform: ["win32"]`（挂件形态目前 Windows 优先，同 uTools「挂件」插件）

## 未来规划（Roadmap）

- **独立 Electron 套壳**：后续考虑**不依赖 uTools**，做一个独立的 Electron 应用外壳——
  桌宠悬浮窗与 dsh 界面都由原生 BrowserWindow 承载，把当前基于
  `utools.createBrowserWindow` / `utools.*` API 的部分抽象成独立层
  （拖拽锚点式定位、自校准换算、尺寸守卫等逻辑已与 uTools 解耦，可直接迁移），
  摆脱 uTools 插件机制的约束（无 plugin.json 依赖、无开发者模式导入）。
- **桌面宠物功能进一步完善**：
  - 宠物表现：更多动画与情绪状态（待机/走路/干活/开心），宠物可切换；
  - 交互：点击状态面板跳转对应 dsh 会话、气泡跟随、目标进度条展示；
  - 通知：消息历史 / 免打扰时段 / 自定义提醒规则；
  - 跨平台：macOS / Linux 支持（当前 `platform: ["win32"]`）。
