// MDReader - Win32 / WebView2 host.
//
// This file is only the entry point: single-instance negotiation, DPI / COM
// setup, portable profile check, local server, then the shared message loop.
// Everything else lives in src/host/; see docs/ARCHITECTURE.md.

#include "host/documents.h"
#include "host/encoding.h"
#include "host/portable.h"
#include "host/server.h"
#include "host/window_manager.h"

#include <objbase.h>
#include <shellapi.h>
#include <windows.h>

#include <string>
#include <vector>

namespace {

void ShowStartupError(const std::wstring &error) {
  bool missing_runtime = error.find(L"WebView2") != std::wstring::npos;
  std::wstring message;
  if (missing_runtime) {
    message = L"MDReader 需要 Microsoft Edge WebView2 Runtime，但这台机器上没有找到。\n\n"
              L"Windows 11 与装过新版 Edge 的 Windows 10 都自带它；"
              L"如果确实缺失，点“确定”会打开微软的下载页面，装完再启动本程序即可。";
  } else {
    message = error;
  }
  MessageBoxW(nullptr, message.c_str(), L"MDReader", MB_ICONERROR);
  if (missing_runtime) {
    ShellExecuteW(nullptr, L"open",
                  L"https://developer.microsoft.com/microsoft-edge/webview2/",
                  nullptr, nullptr, SW_SHOWNORMAL);
  }
}

} // namespace

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE previous, LPWSTR command_line,
                    int show) {
  (void)instance;
  (void)previous;
  (void)command_line;
  (void)show;

  SetProcessDPIAware();

  // A second launch is not a second window. Hand its files to the process that
  // is already running and leave; that process opens one tab per path.
  std::vector<std::wstring> startup = StartupDocumentPaths();
  if (!mdreader::TryBecomePrimary()) {
    if (!mdreader::ForwardToPrimary(startup)) {
      MessageBoxW(nullptr,
                  L"MDReader 已经在运行，但没能把这个文件交给它。\n\n"
                  L"请稍等片刻再试，或直接在已打开的窗口里按 Ctrl+O 打开。",
                  L"MDReader", MB_ICONINFORMATION);
    }
    return 0;
  }

  CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
  ConfigureBrowserArguments();

  std::wstring profile_error;
  if (!EnsureProfileDirectory(profile_error)) {
    MessageBoxW(nullptr, profile_error.c_str(), L"MDReader", MB_ICONERROR);
    CoUninitialize();
    return 1;
  }

  LocalServer server(std::string(kEmbeddedHtml, kEmbeddedHtmlSize));
  if (!server.Start()) {
    MessageBoxW(nullptr, L"无法在 127.0.0.1 上启动本地服务（端口 17890-17899 都被占用）。",
                L"MDReader", MB_ICONERROR);
    CoUninitialize();
    return 1;
  }

  mdreader::WindowManager &windows = mdreader::WindowManager::Get();
  std::wstring error;
  if (!windows.Start(server.Url(), startup, error)) {
    ShowStartupError(error);
    server.Stop();
    CoUninitialize();
    return 1;
  }

  windows.Run();
  server.Stop();
  CoUninitialize();
  return 0;
}
