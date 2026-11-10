# MDReader

Windows 上的一款本地 Markdown 阅读器：**打开 `.md` 就排成适合长读的版式，多文档各占一个标签页，单文件 exe、绿色便携、离线可用。**

界面用 React 19 + TypeScript 写好后编译成一个 HTML 文件，整个嵌进 exe；渲染交给系统自带的 Edge WebView2。宿主外壳是约 950 行 C++17（14 个文件，按职责分在 `src\host\` 下），前端约 5200 行（35 个源文件），不带任何 DLL、不依赖 .NET 或 Node 运行时。

![MDReader](assets/mdreader.png)

---

> **当前版本：v1.0.3.0**（2026-11-10）。功能见下面的[功能特性](#功能特性)。

---

## 目录

- [功能特性](#功能特性)
- [第一部分：如何使用](#第一部分如何使用)
  - [1. 运行程序](#1-运行程序)
  - [2. 界面说明](#2-界面说明)
  - [3. 标签页：打开与关闭](#3-标签页打开与关闭)
  - [4. 打开文档的四种方式](#4-打开文档的四种方式)
  - [5. 阅读与排版设置](#5-阅读与排版设置)
  - [6. 图片、公式与代码块](#6-图片公式与代码块)
  - [7. 快捷键](#7-快捷键)
- [第二部分：如何从源码编译](#第二部分如何从源码编译)
  - [环境准备](#环境准备)
  - [方式一：双击 build.bat（推荐）](#方式一双击-buildbat推荐)
  - [方式二：手动执行命令](#方式二手动执行命令)
  - [构建系统做了什么](#构建系统做了什么)
  - [修改前端后再构建](#修改前端后再构建)
  - [单元测试](#单元测试)
- [项目结构](#项目结构)
- [源码架构说明](docs/ARCHITECTURE.md)
- [工作原理](#工作原理)
- [常见问题](#常见问题)
- [已知限制](#已知限制)
- [第三方组件](#第三方组件)
- [关于 AI 使用](#关于-ai-使用)

---

## 功能特性

- **再打开一个 `.md` 不弹新窗口**：程序已运行时，从资源管理器双击、`打开方式` 或命令行再给一个文件，只会在原窗口里多一个标签页
- **标签可以拖出来 / 拖回去**：把标签拖到窗口外松手，会为它单独开一个窗口；拖到另一个 MDReader 窗口上松手，就并回那个窗口的标签栏。只剩一个标签的窗口被拖空后会自动关闭
- **同窗口内拖动标签可重排**（v1.0.3.0）：在标签栏上左右拖，标签之间出现一条插入线，松手即换位；拖出标签栏但仍在窗口内松手则不动
- **单文档也是标签页**（v1.0.0.0 修订）：只要有一个文档打开，标签栏就在，不再等第二个文件出现
- **可以关掉最后一个标签**（v1.0.0.0 修订）：标签上的 `×` 与 `Ctrl+W` 都有效，关完回到欢迎页
- **多标签页**：拖入或打开多个文档，每个各占一页，点标题切换
- **文件夹模式**：左侧列出目录下所有 `.md`，按相对路径分组，跳过 `.` 开头目录与 `node_modules`
- **大纲目录可折叠**（v1.0.3.0）：按标题层级嵌成树，每节前面的箭头可单独折叠；标题栏三个图标按钮分别是「全部展开 / 展开到第一层 / 全部折叠」，不占文字宽度。仍然跟随阅读位置高亮，并自动滚到可见处
- **阅读进度条、滚动位置记忆、「最近打开」列表**
- **专注模式**：隐藏工具条、标签栏、侧栏与状态栏，正文居中
- **三套主题**：纸白 / 护眼 / 夜间
- **排版可调**：字号、行距、段间距、版心宽度（最宽 1400 px）；正文 / 标题 / 引用 / 代码四类结构，**中文与西文字体分别设置**，同一段里各用各的字体；四类结构各自的缩进
- **代码块**：带语言标记的块左上角显示语言名，highlight.js 语法高亮（18 类 token 独立配色），可选「代码换行」与「代码行号」
- **公式**：行内 `$x^2$` 与行间 `$$…$$` 由 KaTeX 渲染，`\(…\)` / `\[…\]` 两种写法同样识别；行间公式永不折行，超宽时下方出现横向滚动条
- **图片**：相对路径图片自动读取并内联显示，独占一段的图片自动居中并用 alt 文本作说明；点击看大图可缩放、拖动、`←/→` 切换；找不到的图片显示占位提示
- **搜索**：`Ctrl+F` 只高亮命中处，按 `Enter` / `Shift+Enter` 才跳转
- **窗口置顶**开关：让窗口浮在别的程序之上，适合一边看一边写
- **标准工程结构**（v1.0.0.0 修订）：根目录只留工程文件，源码在 `src\`，成品在 `bin\`，`tests\` + `docs\ARCHITECTURE.md` + `tools\` 齐备
- **单一 exe、绿色便携**：设置、最近文件、阅读进度全在程序文件夹内，不写注册表、不写 `%APPDATA%`
- **离线**：界面走 `127.0.0.1` 本地端口，只有文档里引用了网络图片才需要联网

---

# 第一部分：如何使用

## 1. 运行程序

直接双击 `bin\MDReader.exe`，无需安装。

`bin\` 是「拷走就能用」的一整套：程序会在 exe 旁边生成 `MDReader.exe.WebView2\`，实测稳定在 **约 5 MB**。里面**真正属于本程序的数据只有 50 KB 左右**（`EBWebView\Default\Local Storage\` 下的设置、最近文件、阅读进度），其余是 Edge 内核自己重建的骨架文件。

| 路径 | 内容 |
|---|---|
| `bin\MDReader.exe` | 主程序（约 6.3 MB，含图标与版本资源） |
| `bin\MDReader.exe.WebView2\` | 运行时生成：设置、最近文件、阅读进度 + 浏览器内核数据 |
| `sample\` | 示例文档与相对路径图片，可以直接打开试手 |

程序启动时会关闭内核的「组件更新器」与「着色器磁盘缓存」（`--disable-component-update --disable-gpu-shader-disk-cache`）。不开这两个开关时，内核会在后台把 DRM 模块、广告过滤规则、语音识别模型、断字词典等拉进这个目录，体积会从几 MB 涨到 **70 MB 以上**，而这些组件对阅读 Markdown 毫无用处。

> **提示**：如果目录已经变大，关闭程序后除 `Default\Local Storage` 以外的东西都能删，下次启动会重建，设置与最近文件不受影响。

> **从旧布局升级注意**：v1.0.0.0 修订版把 exe 从项目根目录挪进了 `bin\`。若之前根目录已有 `MDReader.exe.WebView2\`，请把它一并移到 `bin\` 里，设置和「最近打开」才会跟着走；留在原地的那份程序不会再读。

把整个文件夹放到**有写入权限**的位置（不要放 `C:\Program Files`）。整个文件夹拷到别的机器，设置也跟着走。

### 运行依赖

| 项 | 说明 |
|---|---|
| **Microsoft Edge WebView2 Runtime** | **唯一**需要安装的外部组件。Windows 11 自带；Windows 10 只要装过基于 Chromium 的新版 Edge 也自带。两者都没有时装一次（微软官方免费，装完永久有效）：https://developer.microsoft.com/microsoft-edge/webview2/ |
| 系统 | Windows 10 1803 及以上 / Windows 11（WebView2 的最低要求），x64 |
| 网络 | **不需要**。界面通过 `127.0.0.1` 上的本地端口（17890–17899）交给内核渲染，全程不出网；只有文档里引用了网络图片时才需要联网 |

**明确不需要**：.NET Framework / .NET、Visual C++ 运行库、Node.js、Python、任何随附的 DLL（`objdump -p` 里只有 `KERNEL32 / USER32 / ADVAPI32 / SHELL32 / SHLWAPI / comdlg32 / ole32 / WS2_32` 和 UCRT 的 `api-ms-win-crt-*`，全是 Windows 自带）。缺 WebView2 时程序会弹中文提示并打开下载页，不会静默退出。

## 2. 界面说明

```text
┌──────────────────────────────────────────────────────────────┐
│ [侧栏] 文档名          [打开][文件夹][搜索][主题][专注][设置]│ ← 工具条 46 px
├──────────────────────────────────────────────────────────────┤
│ 示例文档.md ×   笔记.md ×                                    │ ← 标签栏 34 px（有文档就常驻）
├────────────────┬─────────────────────────────────────────────┤
│ 文件列表       │ ▔▔▔▔▔▔▔▔ 阅读进度条                         │
│ （文件夹模式） │                                             │
│ 大纲目录       │        正文，版心宽度可调，居中排版         │
│ （跟随高亮）   │                                             │
├────────────────┴─────────────────────────────────────────────┤
│ 字数 / 阅读进度 / 主题                                       │ ← 状态栏 28 px
└──────────────────────────────────────────────────────────────┘
```

| 区域 | 高度 | 说明 |
|---|---|---|
| 工具条 | 46 px | 侧栏开关、当前文档名、打开文件 / 文件夹、搜索、主题、专注模式、阅读设置 |
| 标签栏 | 34 px | **只要有文档就在**；每个标签带 `×`；标签过多时横向滚动；拖动可重排顺序 |
| 侧栏 | 246 px 宽 | 上半是文件夹里的文件列表，下半是当前文档的大纲目录（可折叠）；`Ctrl+B` 可隐藏 |
| 正文 | 剩余空间 | 顶部 2 px 进度条，`max-width` 由版心宽度设置决定。标签的激活线在标签**上边**，避免与进度条并成一条 |
| 状态栏 | 28 px | 字数、阅读进度、当前主题等 |

专注模式（`Ctrl+Shift+M`）会把工具条、标签栏、侧栏、状态栏整体隐藏，只在右上角留一个「退出专注」按钮。这是**唯一**会改变界面结构的操作。

## 3. 标签页：打开与关闭

这是本次修订的重点。以前标签栏只在打开 **2 个以上**文档时才出现，结果是：只开一个文档时界面里根本没有关闭按钮，而且打开第二个文件的瞬间会凭空多出一行、正文往上跳一下。

| 场景 | 修订前 | 修订后 |
|---|---|---|
| 打开 1 个文档 | 没有标签栏，找不到关闭按钮 | 标签栏常驻，标签上带 `×` |
| 再打开第 2、第 3 个 | 界面突然多出 34 px 一行，正文位置变化 | 结构不变，只是多一个标签 |
| 关闭最后一个文档 | 界面上没有可点的关闭入口（只能按 `Ctrl+W`） | 点 `×` 或按 `Ctrl+W`，回到欢迎页 |
| 关闭后重启程序 | 又自动打开刚关掉的那个文件 | 停在欢迎页；文件仍在「最近打开」里，点一下即可回来 |

**为什么关掉最后一个还要清掉「上次文档」？** 程序本来会记住最后打开的路径、下次启动自动恢复阅读。用户主动关掉全部标签就是「这篇看完了」的意思；若不清掉，重启时文件又自己弹回来，「关闭」等于没关。所以 `store.closeDoc` 在标签数归零时把 `lastDocPath` 一起清空，但「最近打开」列表保留 —— 想再看随时能点回来。

> **提示**：标签栏只在「一个都没有」时消失，此时显示的是欢迎页（打开文件 / 打开文件夹 / 查看示例 / 最近打开）。也就是说，**有文档时界面结构恒定**，不存在「一个文档」和「多个文档」两套布局。

## 4. 打开文档的四种方式

| 方式 | 操作 | 说明 |
|---|---|---|
| 打开文件 | `Ctrl+O` 或点工具条的文件图标 | 原生打开对话框，支持 `.md` / `.markdown` / `.mdown` / `.mkd` / `.mdx` / `.txt` |
| 打开文件夹 | `Ctrl+Shift+O` | 递归列出目录里的 Markdown（最多 4000 个，深度上限 12 层），左侧按相对路径分组 |
| 拖放 | 把 `.md`、图片或整个文件夹拖进窗口 | 拖入的文件走浏览器 File API，不依赖宿主的读盘桥 |
| 命令行 | `MDReader.exe 文档.md` | 也可用右键「打开方式」；路径会被转成绝对路径，否则文档里的相对图片找不到 |

- 重新打开同一路径会**重新读盘**：文件在外部被编辑过，切回标签或再打开一次就能看到新内容。
- 支持从「最近打开」列表点开（存在 WebView2 的 `localStorage` 里）。
- 支持 `sample\示例.md` 与 `sample\images\diagram.svg` 这组相对路径图片示例。

## 5. 阅读与排版设置

点工具条的设置图标打开面板，设置即时生效并持久化到 `MDReader.exe.WebView2\`。

| 分组 | 设置项 | 说明 |
|---|---|---|
| 主题 | 纸白 / 护眼 / 夜间 | 三套主题，也可 `Ctrl+Shift+T` 循环切换 |
| 字号 | 字号、行距、段间距、版心宽度 | 版心最宽 1400 px；`Ctrl+=` / `Ctrl+-` 快速调字号，`Ctrl+0` 复位 |
| 字体 | 正文 / 标题 / 引用 / 代码，中英文分别设置 | 同一段里中文用中文字体、西文用西文字体，互不挤占 |
| 缩进 | 正文段落 / 引用段落 / 列表项 / 代码块 | 四类结构各自独立，代码块不受「正文首行缩进」影响 |
| 开关 | 代码换行、代码行号、窗口置顶、侧栏 | 「代码换行」关掉时长行横向滚动，打开时折行 |

> **代码行号为什么切换得这么快？** 行号 DOM 始终输出，只是由 CSS 控制显隐。所以「换行」「行号」是纯样式切换，不需要重新跑一遍 Markdown 渲染。

## 6. 图片、公式与代码块

| 内容 | 行为 |
|---|---|
| 相对路径图片 | 宿主读盘后以 Base64 内联，不需要网络；支持 png / jpg / gif / webp / bmp / ico / svg / avif / tiff |
| 独占一段的图片 | 自动居中，alt 文本作说明 |
| 点击图片 | 打开灯箱：滚轮或 `+` / `-` 缩放、拖动、`←/→` 在同文档图片间切换、`Esc` 关闭 |
| 图片缺失 | 显示占位提示，不是破图标 |
| 行内 / 行间公式 | `$…$`、`$$…$$`、`\(…\)`、`\[…\]` 四种写法都由 KaTeX 渲染；行间公式永不折行，超宽时下方出现横向滚动条，短公式居中、超宽时从左端起排 |
| `\[…\]` 夹在段落中间 | 降级成行内公式渲染（KaTeX 的行间公式不能塞进段落中间），内容照常显示、只是不独占一行 |
| 代码块 | 带语言标记时左上角显示语言名；highlight.js 着色；可选换行与行号，行号在左侧装订线，横向滚动时不跟着跑 |
| 表格 | 按内容宽度居中，列多时可横向滚动 |

## 7. 快捷键

| 快捷键 | 作用 |
|---|---|
| `Ctrl+O` | 打开文件 |
| `Ctrl+Shift+O` | 打开文件夹 |
| `Ctrl+W` | **关闭当前标签**（包括最后一个） |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | 在标签间循环切换（只有 1 个时无动作） |
| `Ctrl+F` | 搜索（`Enter` / `Shift+Enter` 上下跳） |
| `Ctrl+B` | 显示 / 隐藏侧栏 |
| `Ctrl+Shift+T` | 切换主题 |
| `Ctrl+Shift+M` | 专注模式 / 退出专注 |
| `Ctrl+=` / `Ctrl+-` / `Ctrl+0` | 放大 / 缩小 / 复位字号 |
| `Esc` | 依次关闭灯箱、设置面板、搜索框、专注模式 |

---

# 第二部分：如何从源码编译

工程是标准 C++ 布局（与 CopyMath / Palette 一致）：根目录放 `CMakeLists.txt` + `src/` + `tests/` + `assets/` + `docs/` + `tools/`，编译中间文件全在 `build/`，成品输出到 `bin\`。前端是 `src\frontend\` 里的一个 Vite 子工程。

## 环境准备

| 工具 | 用途 | 版本参考 |
|---|---|---|
| CMake | 构建 | ≥ 3.20；用 `PATH` 上的 cmake 即可，本机若没有可在 `.build.local.bat` 设 `CMAKE`，`build.bat` 会自动找 |
| MinGW-w64 g++ | 编译宿主外壳 | GCC 16.1.0（本机 MinGW-w64），需 `g++.exe` / `windres.exe` / `mingw32-make.exe`，在 `PATH` 上即可 |
| Python 3 | 把前端 dist 转成 C++ 字符串 | 3.8+（仅 `tools\embed_html.py`，标准库即可） |
| Node.js 18+ | **仅**在修改 / 测试前端时需要 | 本机 22.22.2；平时编 exe 不需要 |

**源码已自包含**，不联网也能编出 exe：

- `third_party\webview\` —— webview 0.12.0 全量源码（MIT）
- `third_party\mswebview2\` —— WebView2 SDK 头文件（`WebView2.h` 等）
- `third_party\httplib.h` —— cpp-httplib 单头文件版
- `src\frontend\dist\index.html` —— 前端构建产物（约 2.5 MB 单文件，已随源码提供）

`src\frontend\node_modules\`（约 160 MB）**不随源码提供**；`CMakeLists.txt` 里没有任何 npm / node 调用，只读现成的 `dist\index.html`。所以改 C++、编译 exe、运行程序都不受影响，只有「要改前端」或「要跑前端单元测试」时才需要装回来。

## 方式一：双击 build.bat（推荐）

根目录的 `build.bat` 是薄封装：检查 `g++` 与前端 dist → 找 cmake → 配置（`MinGW Makefiles` + Release）→ 编译。脚本内部 `cd /d "%~dp0"`，从哪儿双击都行。

```bat
[i] cmake: <你 PATH 里或 .build.local.bat 指定的 cmake>
[1/2] configure ...
[2/2] build ...
Build OK: bin\MDReader.exe
```

> `build.bat` 刻意只用 **ASCII + CRLF**：`.bat` 里写中文在 GBK 控制台下会乱码，纯 LF 换行则会让 `^` 续行解析出错（`.editorconfig` 里也标了）。

> ⚠ **exe 里的 HTML 是构建时嵌进去的**：只改 TSX 不跑 `npm run build` 再 `build.bat`，exe 里还是旧页面。见下一节。

## 方式二：手动执行命令

在项目根目录（`CMakeLists.txt` 那一层）执行：

```bat
cmake -S . -B build -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
ctest --test-dir build --output-on-failure
```

也可以自己指定 cmake：`set CMAKE=C:\path\to\cmake.exe`，再执行上面三条。

> ⛔ `build\` 不能跟着搬家：`CMakeCache.txt` 记的是绝对路径。挪了工程目录就删掉 `build\` 重新配置。

## 构建系统做了什么

| 配置 | 作用 |
|---|---|
| `project(MDReader VERSION 1.0.3.0 LANGUAGES CXX)` + `enable_language(RC)` | 版本号与图标进资源脚本；RC 语言必须显式打开，否则图标与版本号都会丢 |
| `configure_file(src\app.rc.in → build\mdreader.rc)` | 把 `APP_VERSION` / `APP_ICON` 填进 `.rc`，Explorer、任务栏、属性对话框显示同一套信息 |
| `add_custom_command` + `tools\embed_html.py` | 把 `src\frontend\dist\index.html` 包成 `R"MRHTML(...)"` 的 `embedded_html.cpp`，随 dist 变更自动重跑 |
| `add_executable(MDReader WIN32 ...)` | `WIN32` = GUI 子系统（`-mwindows`），运行不弹黑框 |
| `target_include_directories(... src, third_party)` | 源码里照旧写 `#include "host/portable.h"` / `#include "httplib.h"` |
| `RUNTIME_OUTPUT_DIRECTORY = bin` | 成品落在 `bin\`，全工程只有这一份 exe |
| `-municode -static -static-libgcc -static-libstdc++` | 选 `wWinMain` 入口、静态链运行库，分发的 exe 不依赖额外 DLL |
| `add_subdirectory(third_party\webview)` | 用内置副本，不联网；`WEBVIEW_USE_COMPAT_MINGW` 让 MinGW 编得过 COM 头 |
| `enable_testing()` + `add_subdirectory(tests)` | CTest 跑 `test_encoding` |

版本号出现在三处并保持一致：`CMakeLists.txt` 的 `project(VERSION)`、同文件里的 `APP_VERSION`、资源模板 `src\app.rc.in` 的 `VS_VERSION_INFO`（由 configure_file 填充）。

## 修改前端后再构建

第一次改前端前先把依赖装回来（**需要联网**）：

```bat
cd src\frontend
npm ci               :: 严格按 package-lock.json 还原，版本与当初完全一致
npm run build        :: 产出 dist\index.html
cd ..\..
build.bat
```

- 用 `npm ci` 而不是 `npm install`：前者只看 `package-lock.json`，不会顺手升级版本，也更快。`package-lock.json` 必须和 `package.json` 一起保存。
- 装完可以再删掉 `node_modules` 回收 160 MB，不影响已生成的 `dist\index.html`。
- 国内网络慢时先设镜像：`npm config set registry https://registry.npmmirror.com`。
- `vite.config.ts` 里 `viteSingleFile()` + `assetsInlineLimit` 把 JS、CSS、KaTeX 字体全部内联成**一个** HTML，宿主才能把它嵌进 exe。

## 单元测试

两套测试互不重叠，都不需要开窗口：

| 套件 | 命令 | 规模 | 覆盖 |
|---|---|---|---|
| CTest（宿主） | `ctest --test-dir build --output-on-failure` | **44 条断言** | `encoding.cpp` 的 UTF-8↔UTF-16 往返、JSON 转义、`FirstArgument` 解包（含 `\u` 与代理对）、Base64、MIME 表、路径分隔符 |
| Vitest（前端） | `cd src\frontend && npm test` | **43 个用例** | Markdown 渲染、设置迁移、路径工具、拖放内存文档、**标签页生命周期** |
| 类型检查 | `cd src\frontend && npx tsc --noEmit` | — | 全量 TS 类型 |

CTest 没有引第三方测试框架（一个 `CHECK` 宏 + 计数），只链 `src\host\encoding.cpp`，所以是一个纯控制台程序，秒级结束。

---

## 项目结构

```text
MDReader_v1.0/
├── CMakeLists.txt              构建入口（版本号、资源、前端内嵌、测试）
├── build.bat                   Windows 一键编译：找 cmake → 配置 → 编译
├── README.md
├── LICENSE                     MIT
├── .gitignore                  build/、bin/、node_modules/、运行时 profile
├── .clang-format / .editorconfig
├── cmake\mingw-x64.cmake      可选的 MinGW 交叉编译工具链（默认构建不用）
│
├── bin\                        ← 成品（整个目录拷走即用，全工程只有这一份 exe）
│   ├── MDReader.exe            双击运行
│   └── MDReader.exe.WebView2\  **运行时生成**：设置、最近文件、阅读进度
│
├── sample\                     示例文档与相对路径图片（给用户试手，不参与构建）
├── assets\                     **只放构建输入**
│   ├── mdreader.ico            多尺寸图标（16–256，小尺寸单独优化）
│   └── mdreader.png            README 预览图（从 .ico 导出的 256 px）
│
├── src\
│   ├── main.cpp                wWinMain：DPI / COM / 建窗 / 消息循环
│   ├── app.rc.in               版本资源模板（CMake 填充版本号与图标路径）
│   ├── host\                   宿主外壳，按职责分文件
│   │   ├── portable.*          便携 profile、浏览器启动参数
│   │   ├── webview_include.h   **唯一** include webview.h 的地方（带宏替换）
│   │   ├── encoding.*          UTF-8/UTF-16、JSON 转义、Base64、参数解包
│   │   ├── documents.*         读文件、扫描文件夹、拼 JSON、启动参数
│   │   ├── dialogs.*           原生「打开文件 / 文件夹」对话框
│   │   ├── server.*            127.0.0.1 本地 HTTP 服务（pimpl 隔离 httplib）
│   │   └── bridge.*            webview bind 绑定、窗口图标
│   └── frontend\               React 19 + TypeScript + Vite
│       ├── components\         Reader / TabBar / Toolbar / Sidebar / 灯箱 / 设置面板
│       ├── hooks\              排版变量、文档渲染、快捷键、拖放
│       ├── lib\markdown\       unified 管线：remark → rehype → 清洗 → KaTeX → 行号
│       ├── lib\platform\       平台抽象：桌面走 C++ 桥，浏览器 / 拖放走 File API
│       ├── store\              zustand：文档、UI、设置（持久化到 WebView2 profile）
│       ├── styles\             base / themes / markdown 三份 CSS
│       ├── tests\              Vitest 用例
│       └── dist\index.html     构建产物（已随源码提供）
│
├── third_party\                webview 0.12.0 / WebView2 SDK 头 / httplib.h
├── tools\embed_html.py        把 dist/index.html 转成 embedded_html.cpp
├── tests\                      CTest：test_encoding.cpp + CMakeLists.txt
├── docs\ARCHITECTURE.md       模块图、数据流、标签页规则、十个坑
└── build\                     **CMake 生成**：编译中间文件（不入库，可随时删）
```

| 位置 | 作用 |
|---|---|
| `CMakeLists.txt` / `build.bat` | 唯一构建入口与一键封装 |
| `bin\` | 成品与运行时数据，整个目录拷走即用 |
| `assets\` | 只放**构建输入**：图标与 README 图；不放运行时要读的东西 |
| `src\host\` | 宿主外壳。依赖方向 `main → {portable, server, bridge, documents, dialogs} → encoding` |
| `src\frontend\` | 界面与 Markdown 管线，编译成一个 HTML |
| `third_party\` | 随源码提供的第三方头 / 源码，保证离线可编译 |
| `tests\` | CTest 单元测试（只链 `encoding.cpp`） |
| `tools\` | 开发期脚本，不参与运行 |
| `docs\ARCHITECTURE.md` | 改代码前先看这份：模块边界、数据流、踩过的坑 |
| `build\` | CMake 生成物，`.gitignore` 已忽略 |

细节见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

## 工作原理

```text
   启动 MDReader.exe
          │
          ├─ ① 设置浏览器参数（关掉组件更新器 / 着色器缓存）
          ├─ ② 在 exe 旁创建并试写 MDReader.exe.WebView2\
          ├─ ③ 把内嵌 HTML 挂到 127.0.0.1:17890–17899 的 /
          ▼
   ④ 建 WebView2 窗口 → 导航到本地地址 → React 接管界面
          │
          ├─ JS 调 C++：mrOpenFile / mrOpenPath / mrReadImage / mrSetTitle / ...
          │       └─ webview::bind 回调拿到 JSON 数组 → FirstArgument() 解一层
          ▼
   ⑤ 文档内容 → unified 管线（remark → rehype → 清洗 → KaTeX → 行号）
          │
          ▼
   ⑥ Reader 渲染；相对路径图片经 mrReadImage 以 Base64 内联
```

细节说明：

- **界面怎么送到窗口里**：`src\host\server.cpp` 在 `127.0.0.1:17890–17899` 起一个本地 HTTP 服务，把嵌进 exe 的 HTML 从 `/` 发出去，端口被占用时自动往后退。响应带 `Cache-Control: no-store`，否则升级 exe 后 WebView2 可能还在显示旧页面。
- **JS 调 C++ 的两个坑**：① 回调收到的参数是 **JSON 数组**（`["C:\\a.md"]`），要用 `FirstArgument()` 解一层；② 返回给 JS 的值会被 webview 先 `JSON.parse` 一次，所以返回对象别再二次 parse，但空串会被当成非法 JSON 而 reject —— 取消类操作要返回 `{}` 或带引号的字符串。
- **便携 profile**：webview 0.12 把 WebView2 数据目录硬编码成 `%APPDATA%\MDReader.exe`。`src\host\webview_include.h` 在 `#include "webview/webview.h"` 前用宏把 `SHGetFolderPathW` / `PathCombineW` 替换成 `portable.cpp` 的本地实现，指向 exe 目录下的 `MDReader.exe.WebView2`。⛔ **所有翻译单元都必须经这个头包含 webview.h**，否则 `embed()` 的内联定义会出现两个版本，ODR 合并后 profile 可能跑回 `%APPDATA%`。
- **控制内核体积**：`portable.cpp::ConfigureBrowserArguments()` 必须在创建窗口**之前**设置环境变量。这是 webview 0.12 唯一能改内核参数的口子；若外部已定义该变量则不覆盖。
- **公式与代码块的顺序**：`remark-math` 把行间公式导出成 `<pre><code class="language-math">`，所以 `rehypeKatex` 必须排在 `rehypeHighlight` / 行号插件**之前**，否则行号会被插进 LaTeX 源码。
- **代码行号**：行号始终输出、由 CSS 控制显隐，两个开关是纯样式切换，不需要重新渲染 Markdown。
- **状态以 store 为准**：`docs` 数组是标签页的唯一来源，`TabBar` 自己订阅；`App.tsx` 不再用 `docs.length` 决定要不要画标签栏，界面结构因此恒定。

## 常见问题

**Q：只开一个文档时，关闭按钮在哪？**
在文件名右边的 `×`。v1.0.0.0 修订前标签栏只在前 2 个以上文档时出现，所以那时确实找不到按钮；现在只要打开一个文档就有标签栏。也可以直接按 `Ctrl+W`。

**Q：关掉最后一个文档后，下次启动它又自己打开了？**
本次修订已经修掉：标签数归零时会同时清掉「上次文档」路径，启动后停在欢迎页。若你用的是**修订前的 exe**，请重新编一次（或换用 `bin\MDReader.exe`），因为这是前端逻辑，旧 exe 内嵌的是旧页面。

**Q：升级后设置 / 最近文件不见了？**
因为 exe 从项目根目录挪到了 `bin\`，运行时数据目录也跟着走。把原来根目录的 `MDReader.exe.WebView2\` 整个移到 `bin\` 里再启动即可恢复；不要只拷里面的 `Local Storage` 文件夹。

**Q：`MDReader.exe.WebView2\` 有 70 多 MB，能删吗？**
能，但**先关掉程序**。除 `Default\Local Storage` 以外的东西都能删，下次启动会重建，设置与最近文件不受影响。程序已通过两个浏览器开关阻止它继续膨胀；若仍在涨，检查是不是外部定义了 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` 覆盖了默认值。

**Q：改了 TSX，重新编译 exe 后界面没变？**
exe 里的 HTML 是**构建时**嵌进去的。顺序必须是：`cd src\frontend` → `npm run build`（更新 `dist\index.html`）→ 回根目录 `build.bat`。只跑 `build.bat` 会复用旧 dist。

**Q：编不过，报找不到 `WebView2.h` 或想联网下载？**
确认 `third_party\webview\CMakeLists.txt` 与 `third_party\mswebview2\WebView2.h` 都在。第一次配置应打印 `webview: using the vendored copy in third_party/webview` 与 `Found MSWebView2: …/third_party/mswebview2`。若看到 `fetching 0.12.0 from GitHub`，说明目录被挪走或删了。

**Q：`build.bat` 提示 `g++ was not found in PATH`？**
把 MinGW 的 `bin` 目录（如 `mingw64\bin`）加进 PATH 后重开命令行。`build.bat` 也支持自己指定 cmake：`set CMAKE=C:\path\to\cmake.exe`。

**Q：文档里的图片显示成占位提示？**
按顺序查三件事：① 图片路径是不是相对 `.md` 所在目录写的；② 扩展名是否在支持列表里（png / jpg / gif / webp / bmp / ico / svg / avif / tiff）；③ 文件是否超过 40 MB。用「打开方式」或命令行启动时，程序会把文档路径转成绝对路径，正是为了保证相对图片能解析。

**Q：换一台电脑要重装吗？**
不用。把 `bin\` 整个目录拷过去就能跑（设置与运行时目录都在里面，用的是相对路径），源码那一套不用带。但目标机器同样需要 **WebView2 Runtime**（Windows 11 / 装过新版 Edge 的 Windows 10 自带）。

## 已知限制

- exe 未做数字证书签名（Authenticode），Windows SmartScreen 可能提示「未知发布者」；exe「属性 → 详细信息」里已写入公司名与 MIT 版权，但那只是版本资源，并不等同于代码签名，无法消除该提示。
- 不支持编辑；只读文档，不会修改源文件。
- 没有注册 `.md` 文件关联，请用「打开文件」或右键「打开方式」。
- 页面走本地端口，若安全软件禁止程序监听本机端口会启动失败（换端口也无效）。
- 阅读设置存在 WebView2 的 `localStorage` 里，**与端口绑定**：极端情况下端口被占用换了端口，设置会看起来回到默认值。把端口腾出来重启即可恢复。
- 文件夹模式最多列 4000 个文件、最深 12 层，会跳过 `.` 开头目录与 `node_modules`。
- `\(…\)` / `\[…\]` 只在**围栏代码块、行内代码、已有 `$…$` 公式之外**生效：四空格缩进代码块与裸 HTML 块里的 `\(` 仍会被改写成公式。
- `\(…\)` 必须写在**同一行内**；跨行的行内公式保持原样。
- 想显示字面的 `\(`，写成 `\\(`。

## 第三方组件

| 组件 | 版本 | 许可 |
|---|---|---|
| webview | 0.12.0 | MIT |
| cpp-httplib | 单头文件版 | MIT |
| Microsoft WebView2 SDK | 1.0.1150.38 | Microsoft（随 Edge WebView2 分发） |
| React / React DOM | 19 | MIT |
| zustand | 5 | MIT |
| unified（remark / rehype 系列） | 11 / 4–7 | MIT |
| KaTeX | 0.16 | MIT |
| highlight.js | 11 | BSD-3-Clause |
| lucide-react | 0.468 | ISC |
| Vite / Vitest / TypeScript | 6 / 2 / 5.7 | MIT / Apache-2.0 |

> **架构与设计参考**：本程序的界面布局与功能组织参考了以下两个开源 Markdown 阅读器项目（均为 MIT 许可）：
> [Scorpse/markview](https://github.com/Scorpse/markview) 与 [szdytom/markview](https://github.com/szdytom/markview)。

## 关于 AI 使用

> 本项目由 AI 在人类作者实质性指导下生成，按 MIT 许可证授权。
>
> AI 生成的代码可能存在人类未察觉的疏漏，请自行评估 AI 生成代码的质量与安全性，本项目不提供任何形式的担保。
