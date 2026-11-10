#include "bridge.h"

#include "dialogs.h"
#include "documents.h"
#include "encoding.h"
#include "window_manager.h"

#include <shellapi.h>

#include <algorithm>
#include <cctype>
#include <cstdio>
#include <string>
#include <vector>

void ApplyWindowIcons(HWND owner) {
  // webview registers its window class without an icon, so the title bar and
  // the taskbar would fall back to the generic one.
  HINSTANCE module = GetModuleHandleW(nullptr);
  if (HICON big = static_cast<HICON>(LoadImageW(
          module, MAKEINTRESOURCEW(1), IMAGE_ICON, GetSystemMetrics(SM_CXICON),
          GetSystemMetrics(SM_CYICON), LR_SHARED))) {
    SendMessageW(owner, WM_SETICON, ICON_BIG, reinterpret_cast<LPARAM>(big));
  }
  if (HICON small = static_cast<HICON>(LoadImageW(
          module, MAKEINTRESOURCEW(1), IMAGE_ICON, GetSystemMetrics(SM_CXSMICON),
          GetSystemMetrics(SM_CYSMICON), LR_SHARED))) {
    SendMessageW(owner, WM_SETICON, ICON_SMALL, reinterpret_cast<LPARAM>(small));
  }
}

void BindHostApi(webview::webview &window, HWND owner, int windowId) {
  window.bind("mrOpenFile", [owner](std::string) -> std::string {
    std::wstring path = PickFile(owner);
    return path.empty() ? std::string{} : DocJson(path);
  });
  window.bind("mrOpenFolder", [owner](std::string) -> std::string {
    std::wstring root = PickFolder(owner);
    return root.empty() ? std::string{} : FolderJson(root);
  });
  window.bind("mrOpenPath", [](std::string request) -> std::string {
    std::wstring path = ToWide(FirstArgument(request));
    return path.empty() ? std::string{} : DocJson(path);
  });
  window.bind("mrReadImage", [](std::string request) -> std::string {
    std::wstring path = ToWide(FirstArgument(request));
    return path.empty() ? std::string("{\"ok\":false}") : ImageJson(path);
  });
  window.bind("mrOpenUrl", [](std::string request) -> std::string {
    std::string url = FirstArgument(request);
    std::string lower = url;
    std::transform(lower.begin(), lower.end(), lower.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    bool allowed = lower.rfind("http://", 0) == 0 || lower.rfind("https://", 0) == 0 ||
                   lower.rfind("mailto:", 0) == 0 || lower.rfind("tel:", 0) == 0;
    if (allowed) {
      std::wstring wide = ToWide(url);
      if (!wide.empty()) {
        ShellExecuteW(nullptr, L"open", wide.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
      }
    }
    return {};
  });
  window.bind("mrSetTitle", [&window](std::string request) -> std::string {
    std::string title = FirstArgument(request);
    window.set_title(title.empty() ? "MDReader" : title);
    return {};
  });
  window.bind("mrSetTopmost", [owner](std::string request) -> std::string {
    // Lets the reading window hover above the editor the user is typing in.
    // NOACTIVATE keeps the current focus on whatever is being edited.
    bool on = FirstArgument(request) == "1";
    SetWindowPos(owner, on ? HWND_TOPMOST : HWND_NOTOPMOST, 0, 0, 0, 0,
                 SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
    return {};
  });
  window.bind("mrWindowReady", [windowId](std::string) -> std::string {
    // The renderer calls this once after installing __mrHostMessage. Commands
    // that arrived before the page was ready (command-line files, a tab handed
    // over by another window) are handed back in one batch.
    return mdreader::WindowManager::Get().TakeInit(windowId);
  });
  window.bind("mrTabDrop", [windowId](std::string request) -> std::string {
    // Three string arguments: "x,y,last", the tab's JSON payload, its id.
    std::vector<std::string> args = JsonStringArguments(request);
    if (args.size() < 3) {
      return "{}";
    }
    int x = 0;
    int y = 0;
    int last = 0;
    if (std::sscanf(args[0].c_str(), "%d,%d,%d", &x, &y, &last) != 3) {
      return "{}";
    }
    mdreader::TabDropRequest drop;
    drop.sourceId = windowId;
    drop.x = x;
    drop.y = y;
    drop.docJson = args[1];
    drop.docId = args[2];
    drop.lastTab = last != 0;
    mdreader::WindowManager::Get().QueueTabDrop(drop);
    return "{}";
  });
}
