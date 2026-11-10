# MDReader 源码架构说明

> 改代码前先看这份。这里只讲**模块边界与数据怎么流**，功能清单见 `README.md`。

## 1. 两层程序

MDReader 其实是两个程序被塞进一个 exe：

| 层 | 语言 | 位置 | 职责 |
|---|---|---|---|
| **宿主线程** | C++17 / Win32 / WebView2 | `src/main.cpp` + `src/host/` | 建窗、本地 HTTP 服务、读文件、原生对话框、把设置留在 exe 旁 |
| **渲染层** | React 19 + TypeScript | `src/frontend/` | 界面、Markdown 管线、设置状态，编译成**一个** `dist/index.html` 嵌进 exe |

两层之间只有两条通道：

- **JS → C++**：`webview::bind` 注册的 `mr*` 函数（打开文件、读图片、改标题、置顶、拖出标签、报告窗口就绪……）。
- **C++ → JS**：`window.__mrHostMessage(cmd)`，由宿主线程在窗口就绪后 `eval` 下发；`127.0.0.1:17890–17899` 上的本地 HTTP 服务只提供 `/`（那一整页 HTML）和 `/favicon.ico`。

没有 WebSocket、没有 Node 进程、没有后端。

**一个进程 = 所有窗口。** 第二次启动 exe 不会再建窗口：`WM_COPYDATA` 把命令行文件交给已在运行的进程，由它在原窗口里开新标签。只有把标签拖出窗口才创建第二个 `webview::webview`；所有窗口共用同一个本地服务端口和同一条 Win32 消息循环。

## 2. 宿主线程模块图

```text
                       src/main.cpp
        (wWinMain：单实例判定 / DPI / COM / 本地服务 / 共享消息循环)
                              │
        ┌─────────────┬───────┴───────┬──────────────┬─────────────┐
        ▼             ▼               ▼              ▼             ▼
   portable.*     server.*       bridge.*       documents.*     dialogs.*
   便携 profile   本地 HTTP       JS↔C++ 桥      读文件 / JSON    原生对话框
   浏览器参数     端口管理       窗口图标        路径规范化       GetOpenFileName
        │             │               │              │             │
        └─────────────┴───────┬───────┴──────────────┴─────────────┘
                              ▼
                        encoding.*
        UTF-8↔UTF-16 / JSON 转义 / Base64 / 路径分隔符 / 参数解包
                              │
                              ▼
                    webview_include.h
        （唯一 include webview.h 的地方，带 profile 宏替换）
```

依赖方向只有一条：**`main → window_manager → bridge → {portable, server, documents, dialogs} → encoding`**。
`encoding` 不认识窗口、不认识 WebView2，所以能链进 `tests/test_encoding.cpp` 当纯函数测。

`window_manager.*` 是多窗口的唯一真相：命名互斥 + 隐藏 IPC 窗口、每个 `WindowHost`（id / HWND / webview / 就绪标志 / 待发命令队列）、拖放命中测试、窗口回收。
`bridge.cpp` 的 `mrTabDrop` / `mrWindowReady` 只是把请求转给它；它反过来通过 `BindHostApi()` 给每个窗口装一套只认自己 `windowId` 的绑定。

每个文件顶部都有一行注释说明职责；`src/host/*.h` 是跨模块的唯一声明处，进程级状态集中在 `window_manager.cpp` 的文件内单例里。

## 3. 一次「打开文件」的完整路径

```text
用户点工具栏 / Ctrl+O / 拖入 .md / 命令行参数
        │
        ▼
App.tsx: handleOpenFile / useDragDrop / handleCommand(启动队列)
        │
        ▼
platform.openFile() ──► window.mrOpenFile('')
        │                       │
        │                       ▼  bridge.cpp
        │               PickFile() → DocJson()
        │                  │            │
        │                  │            └─ ReadFileBytes + JsonEscape
        │                  ▼
        │              JSON 字符串（webview 会先 JSON.parse 一次再交给 JS）
        │
        ▼
parseHostDoc() → DocSource → store.openDoc()
        │
        ▼
useDocumentRender(doc) → unified 管线 → html + headings
        │
        ▼
Reader.tsx 渲染；图片走 mrReadImage（Base64 内联）
```

## 4. 标签页规则（v1.0 修订）

这是界面里最容易改错的一条，改动前先记住三行代码各自的职责：

| 位置 | 规则 | 为什么 |
|---|---|---|
| `App.tsx` | **无条件**渲染 `<TabBar />`（只受专注模式控制） | 以前是 `docs.length > 1 && <TabBar />`，导致只开 1 个文档时没有标签栏、也没有关闭按钮；而且打开第 2 个文件会凭空多出 34px 的一行，界面结构突变 |
| `TabBar.tsx` | `docs.length === 0` 时返回 `null` | 空状态是 Welcome 页，不是"一个空标签" |
| `store.closeDoc` | 关掉最后一个标签时把 `lastDocPath` 清空 | 否则下次启动会自动重开用户刚关掉的文件，「关闭」等于没关；「最近打开」列表仍保留它 |

`Ctrl+W` 走 `closeActive()`，与点标签上的 `×` 是同一条路径。专注模式 (`settings.focus`) 会整体隐藏工具条和标签栏，退出按钮单独浮在右上角。

**标签顺序（v1.0.3）**：同一窗口内拖动标签是**重排**，不是拖出。松手位置由 `TabBar` 自己判断，分三种：

| 松手位置 | 结果 | 实现 |
|---|---|---|
| 标签栏内（纵向放宽 10/28 px） | `store.moveDoc(id, 插入位)` 重排，不出窗口 | 纯算术在 `lib/tabs.ts`：`dropIndex(centers, x, dragged)` → `markerIndex` |
| 窗口内、标签栏外 | 什么都不做（原来的「取消」） | 不再走 IPC |
| 窗口外 | 交给宿主做命中测试（合并 / 拆窗） | `platform.tabDrop` 保持原样 |

插入位置用「**减去被拖标签后的下标**」表达，这正是 `moveItem` 的 `to`；两者都写在 `lib/tabs.ts` 里单测，别在组件里现算。拖动过程中显示的是标签之间的插入线（`is-drop-before` / `is-drop-after` 的 inset 阴影），不再显示浮动标签——标签本身就在光标下。只有指针出窗时才出现幽灵标签。

⛔ 激活态指示线在**上边框**（`border-top`）。下边框紧贴 `App.tsx` 的 `.progress-rail`（`top:0` 的 2 px 阅读进度条），两条强调色线相距 1 px，会被读成一条。

### 4.1 多窗口与标签页转移（v1.0.1）

**启动**：`main.cpp` 先跑 `TryBecomePrimary()`（按 exe 目录哈希命名的互斥量）。不是主实例就
`FindWindowW(MDReader_IPC_<hash>)` + `WM_COPYDATA` 把命令行路径（可多个）送过去，然后退出；
空路径表示"只是又点了一次图标"，主实例只把自己前置。隐藏 IPC 窗口**不能**是 message-only
窗口，否则 `FindWindowW` 找不到。

**窗口启动协议**：所有窗口都 `navigate()` 同一个 URL。React 挂载时先装
`window.__mrHostMessage`，再调 `mrWindowReady(windowId)`；宿主把之前排队的命令一次性返回
`{windowId, restore, commands:[...]}`。命令只有四种：

| 命令 | 作用 |
|---|---|
| `open` | 按路径开一个标签（命令行文件、第二次启动转发、`mdreader:open-path`） |
| `add` | 接收别的窗口拖过来的标签；`host` 文档只带元数据，目标窗口用 `mrOpenPath` 重读磁盘 |
| `remove` | 标签已被别人接管，源窗口关掉该标签 |
| `toast` | 失败提示 |

`restore=true` 只给主窗口且没有命令行文件；JS 在 `commands` 非空时也不会再重开 `lastDocPath`。
`lib/hostCommands.ts` 负责过滤不合法命令与生成传输载荷，是纯函数，可单测。

**拖出 / 拖回**：`TabBar.tsx` 用 `setPointerCapture` 拿住指针（拖到窗口外仍收得到 move/up），
超过 6px 才进入拖动态并显示幽灵标签。松手时 `mrTabDrop("x,y,last", docJson, docId)`；
宿主在 `WM_APP+1` 的延迟任务里用 **`GetCursorPos` 的物理屏幕坐标**做
`WindowFromPoint → GetAncestor(GA_ROOT)` 命中测试：

- 命中别的 MDReader 窗口 → `add` 给目标 + `remove` 给源（标签合并回去）；
- 命中源窗口 → 取消；
- 其它 → 新建一个 `webview::webview`，`add` 排进它的待发队列。

源窗口只剩这一个标签时，先建好目标再 `WM_CLOSE` 掉它（Chromium 的行为）。
`GetCursorPos` 而不是 `ClientToScreen(clientX, clientY)`：JS 给的是 CSS 像素，进程只做了
系统级 DPI 感知，缩放屏下换算会偏。

## 5. 前端分层

```text
src/frontend/src/
├── components/       纯展示 + 局部交互（Reader / TabBar / Toolbar / Sidebar / ...）
│   └── settings/     设置面板的三个分区
├── hooks/            useDocumentRender / useTypography / useShortcuts / useDragDrop
├── lib/
│   ├── markdown/     unified 管线（remark → rehype → 清洗 → KaTeX → 行号）
│   ├── platform/     桌面桥 / 浏览器 File API / 拖放内存文档 / 路径工具
│   ├── nav, search, sample, types
│   ├── tabs.ts       标签重排的插入位算术（纯函数，单测）
│   └── toc.ts        标题列表 → 目录树 / 折叠集合（纯函数，单测）
├── store/            zustand：文档、UI、设置（持久化到 WebView2 profile）
└── styles/           base / themes / markdown 三份 CSS
```

依赖方向：**`components → hooks → lib / store`**。`lib/platform` 把「桌面」和「浏览器拖放」两种文档来源收敛成同一个 `DocSource`，上层不判断 `isDesktop()`。

**侧栏目录（v1.0.3）**：`Heading[]` 是扁平的（`id / text / level`），`lib/toc.ts` 的 `buildTocTree` 按 level 用栈嵌成树，`Sidebar.tsx` 只渲染树、不再自己算缩进。折叠状态是组件内的 `Set<string>`（折叠的节点 id），三个图标按钮分别给出「全部展开 / 展开到第一层 / 全部折叠」的集合；换文档时清空，不跨文件沿用。`TocRows` 每一行是 `[chevron][标题]` 两个并列 `<button>`——按钮不能套按钮。左侧强调条挂在**行**上（`.toc-row`），不挂在标题按钮上，否则缩进一深就会在中间冒出一根竖线。

## 6. 踩过的坑（改动时务必保留）

1. **便携 profile 靠宏替换**。webview 0.12 在 `webview.h` 的 `embed()` 里用
   `SHGetFolderPathW(CSIDL_APPDATA)` + `PathCombineW` 拼出 `%APPDATA%\MDReader.exe`，且忽略
   `WEBVIEW2_USER_DATA_FOLDER`。`webview_include.h` 在 include 之前把这两个名字换成
   `portable.cpp` 的实现，指向 `<exe 目录>\MDReader.exe.WebView2`。
   ⛔ **所有需要 webview.h 的翻译单元都必须走 `webview_include.h`**：`embed()` 是头文件里的
   内联函数，若某个 TU 看到的是未替换版本，ODR 合并后 profile 会随机跑回 `%APPDATA%`。
2. **真实声明必须在宏之前**。`webview_include.h` 先 include `<shlobj.h>` / `<shlwapi.h>` 和
   `portable.h`，再 `#define`，否则 SDK 头会被我们的替换函数污染。
3. **bind 回调拿到的是 JSON 数组**。`["C:\\a.md"]` 要先过 `FirstArgument()` 解一层；
   `mrTabDrop` 这样的多参数绑定用 `JsonStringArguments()` 一次解出全部字符串。
4. **返回值必须是合法 JSON**。webview 会对返回值做 `JSON.parse`，取消类操作返回字符串
   `"{}"`，`mrWindowReady` 返回的是一整个 JSON 对象。空 `std::string{}` 会让 JS 侧 promise
   永远挂着（旧代码里有几处，别再照抄）。
5. **控制内核体积**：`ConfigureBrowserArguments()` 必须在创建窗口**之前**设置
   `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--disable-component-update --disable-gpu-shader-disk-cache`。
   不设的话组件更新器会把 profile 从几 MB 撑到 70 MB 以上（DRM、广告规则、语音模型……全用不上）。
6. **端口与 localStorage 绑定**。端口在 17890–17899 里顺延，换了端口后同源策略下设置会
   "看起来回到默认"。一个进程只用**一个**端口，所以所有窗口同源、共享设置；`App.tsx` 监听
   `storage` 事件把设置/最近文件同步给别的窗口（比较后再写，避免来回 ping-pong）。
7. **公式与代码块的插件顺序**：`remark-math` 把行间公式导出成
   `<pre><code class="language-math">`，所以 `rehypeKatex` 必须排在 `rehypeHighlight` /
   行号插件**之前**，否则行号会被插进 LaTeX 源码。
8. **代码行号始终输出、由 CSS 控制显隐**，于是「换行」「行号」两个开关是纯样式切换，
   不需要重新渲染 Markdown。
9. **HTML 是构建时嵌进去的**：只改 TSX 不跑 `npm run build` + `build.bat`，exe 里还是旧页面。
10. **`build/` 不能跟着搬家**：`CMakeCache.txt` 记绝对路径，挪目录后要删掉重建。
11. **第二个 `webview::webview` 的构造会泵一个嵌套消息循环**（等 WebView2 环境就绪）。
    所以 `CreateHost()` 必须先把 `WindowHost` 放进注册表再构造，否则这段时间里转发进来的文件
    没有地方排队；拖放任务用 `WM_APP+1` 延迟执行并加 `busy_` 防重入。
12. **只调一次 `run()`**。webview 用静态窗口计数，关到 0 才 `PostQuitMessage`；主窗口被
    拖空后先关掉也不影响消息循环。所有 `webview` 对象必须留到 `run()` 返回后再析构
    （`WindowManager::Run()` 里 `hosts_.clear()`），否则是悬空 this。
13. **多个窗口共用同一个便携 profile**：webview 0.12 每个窗口各建一个 WebView2 environment，
    它们的 options 必须完全一致（都传 `nullptr`），否则第二个会因
    `HRESULT_FROM_WIN32(ERROR_INVALID_STATE)` 起不来。
14. **别把 IPC 窗口做成 message-only**（`HWND_MESSAGE`），`FindWindowW` 枚举不到它。
    类/互斥量名字里不能带路径分隔符，所以用 exe 目录的 FNV 哈希做后缀。
15. **拖放坐标取 `GetCursorPos`**，不用 JS 的 `clientX/clientY`（CSS 像素，缩放屏会偏）。
    `TabBar` 的幽灵标签要 portal 到 `body`，否则被 `.tabbar { overflow-x: auto }` 裁掉。
16. **`\(…\)` / `\[…\]` 只能在解析前改写**。CommonMark 把 `\` + ASCII 标点当转义，`\(` 进到树里
    只剩 `(`，公式里的 `\,` / `\{` 也一并被吃掉 —— 所以**不能**写成 remark 插件（拿到 text 节点时
    反斜杠已经没了）。`lib/markdown/mathDelimiters.ts` 在 `processor.process()` 之前跑，跳过围栏代码、
    行内代码与已有 `$…$` 区域，把两种写法统一成 `$…$` / `$$…$$`。两个约束别忘：生成的 `$$` 必须
    **独占一行**（写在同一行的 `$$x$$` 只会被当成行内公式），四空格缩进代码块与裸 HTML 块不在识别范围内。

## 7. 测试分工

| 改了什么 | 跑什么 |
|---|---|
| `encoding.cpp` / 路径 / JSON / Base64 / 多参数解包 | `ctest --test-dir build --output-on-failure`（CTest，无窗口） |
| 标签重排的插入位 / 目录树的嵌套与折叠集合 | `cd src/frontend && npm test` 里的 `tests/tabOrder.test.ts`、`tests/toc.test.ts`（纯函数） |
| Markdown 管线 / 设置迁移 / 路径 / 标签页 / 窗口初始化载荷 | `cd src/frontend && npm test`（Vitest，无窗口） |
| 类型检查 | `cd src/frontend && npx tsc --noEmit` |
| 布局 / 标签栏 / 拖出拖回 / 单实例 | 真开窗口看：启动两次 exe 数窗口，拖标签到窗口外再拖回来 |
