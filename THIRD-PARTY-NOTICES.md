# 第三方组件与许可声明（THIRD-PARTY NOTICES）

MDReader 以 MIT 许可证发布（见 `LICENSE`）。本项目在 `third_party/` 下随源码附带了若干
第三方组件，前端依赖通过 npm 解析并在 `src/frontend/dist/index.html` 中内联打包。
本文件汇总这些组件的版权与许可，以满足各自许可证的「保留版权声明与许可文本」要求。

---

## 一、随源码附带的第三方组件（third_party/）

### 1. webview —— `third_party/webview/`
- **版本**：0.12.0
- **许可证**：MIT
- **版权**：Copyright (c) 2017 Serge Zaitsev；Copyright (c) 2022 Steffen André Langnes
- **来源**：https://github.com/webview/webview
- **许可全文**：已随副本提供于 `third_party/webview/LICENSE`。

### 2. cpp-httplib —— `third_party/httplib.h`
- **版本**：0.18.3（单头文件版）
- **许可证**：MIT
- **版权**：Copyright (c) 2024 Yuji Hirose. All rights reserved.
- **来源**：https://github.com/yhirose/cpp-httplib
- **许可全文**：已内嵌在该头文件顶部（第 1–6 行）。

### 3. Microsoft Edge WebView2 SDK 头文件 —— `third_party/mswebview2/`
- **包含文件**：`WebView2.h`、`WebView2EnvironmentOptions.h`
- **许可证**：Microsoft BSD 式许可证（见下文全文）
- **版权**：Copyright (C) Microsoft Corporation. All rights reserved.
- **来源**：Microsoft.Web.WebView2 NuGet 包（https://www.nuget.org/packages/Microsoft.Web.WebView2）

**许可全文（Microsoft Edge WebView2 SDK）：**

```
Copyright (C) Microsoft Corporation. All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice,
  this list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* The name of Microsoft Corporation, or the names of its contributors, may
  not be used to endorse or promote products derived from this software
  without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
```

> 注：上述 WebView2 SDK 头文件仅用于**编译期**引用，运行期依赖由最终用户机器上的
> Microsoft Edge WebView2 Runtime 提供（Windows 11 自带 / Windows 10 可免费安装）。
> 本仓库不打包、不分发该 Runtime 本身。

---

## 二、前端 npm 依赖（构建/运行期，经 vite 内联进 dist）

下列依赖由 `src/frontend/package.json` 声明，经 `npm ci` 解析、`vite build` 打包进
`src/frontend/dist/index.html`。它们**不**随仓库以源码形式分发（node_modules 已被忽略），
但其代码经打包后存在于已提交的 `dist/index.html` 中，故在此一并声明。

| 组件 | 版本范围 | 许可证 |
| --- | --- | --- |
| react / react-dom | ^19.0.0 | MIT |
| katex | ^0.16.22 | MIT |
| highlight.js | ^11.11.1 | BSD-3-Clause |
| lucide-react | ^0.468.0 | ISC |
| unified | ^11.0.5 | MIT |
| remark-parse | ^11.0.0 | MIT |
| remark-gfm | ^4.0.1 | MIT |
| remark-math | ^6.0.0 | MIT |
| remark-breaks | ^4.0.0 | MIT |
| remark-rehype | ^11.1.2 | MIT |
| rehype-raw | ^7.0.0 | MIT |
| rehype-sanitize | ^6.0.0 | MIT |
| rehype-katex | ^7.0.1 | MIT |
| rehype-highlight | ^7.0.2 | MIT |
| rehype-stringify | ^10.0.1 | MIT |
| unist-util-visit | ^5.0.0 | MIT |
| zustand | ^5.0.2 | MIT |
| vite | ^6.0.5 | MIT |
| vite-plugin-singlefile | ^2.0.3 | MIT |
| vitest | ^2.1.9 | MIT |
| @vitejs/plugin-react | ^4.3.4 | MIT |
| typescript | ~5.7.2 | Apache-2.0 |
| @types/react | ^19.0.0 | MIT |
| @types/react-dom | ^19.0.0 | MIT |

各依赖的完整许可文本随其各自的 npm 包/源码仓库提供（见 `package-lock.json` 中记录的来源）。

---

## 三、本仓库明确不纳入（已在 .gitignore 排除，切勿提交）

- `build/`、`bin/` —— 构建产物与可执行文件；`bin/MDReader.exe.WebView2/` 含**运行时
  设置、最近打开文件、阅读进度**等用户数据，绝不可上传。
- `node_modules/` —— 前端依赖，按需 `npm ci` 还原。
- `.build.local.bat` —— 本机构建覆盖（含本地工具链绝对路径，如
  `D:\My_programs\.venv\...\cmake.exe`），已被忽略。
- `.workbuddy/`、`.vscode/`、`.idea/` —— 编辑器/agent 工作数据。
