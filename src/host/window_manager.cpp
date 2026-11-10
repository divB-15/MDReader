#include "window_manager.h"

#include "bridge.h"
#include "encoding.h"
#include "portable.h"

#include <algorithm>
#include <cstdio>
#include <exception>
#include <utility>

namespace mdreader {
namespace {

constexpr DWORD kIpcMagic = 0x4D524457;  // "MRDW"
constexpr UINT kIpcDropMessage = WM_APP + 1;

// Kept open for the whole process: the slot is released when the last window
// closes and wWinMain returns.
HANDLE g_instance_mutex = nullptr;

// Scope the mutex and IPC class to the exe's directory, so two independent
// copies of the portable app never steal each other's documents.
std::wstring InstanceTag() {
  std::string key = ToUtf8(ExeDirectory());
  for (char &c : key) {
    if (c >= 'A' && c <= 'Z') {
      c = static_cast<char>(c - 'A' + 'a');
    }
  }
  unsigned long long hash = 1469598103934665603ULL;
  for (unsigned char c : key) {
    hash ^= c;
    hash *= 1099511628211ULL;
  }
  char hex[32] = {};
  std::snprintf(hex, sizeof(hex), "%016llx", hash);
  return ToWide(hex);
}

std::wstring IpcClassName() { return L"MDReader_IPC_" + InstanceTag(); }
std::wstring MutexName() { return L"Local\\MDReader_" + InstanceTag(); }

std::string OpenCommand(const std::wstring &path) {
  return "{\"type\":\"open\",\"path\":\"" + JsonEscape(ToUtf8(path)) + "\"}";
}

std::string AddCommand(const std::string &docJson) {
  return "{\"type\":\"add\",\"doc\":" + docJson + "}";
}

std::string RemoveCommand(const std::string &id) {
  return "{\"type\":\"remove\",\"id\":\"" + JsonEscape(id) + "\"}";
}

std::string ToastCommand(const char *text) {
  return std::string("{\"type\":\"toast\",\"text\":\"") + text + "\"}";
}

bool SendOneDocument(HWND ipc, const std::wstring &path) {
  std::wstring payload = path;
  payload.push_back(L'\0');
  COPYDATASTRUCT data{};
  data.dwData = kIpcMagic;
  data.cbData = static_cast<DWORD>(payload.size() * sizeof(wchar_t));
  data.lpData = const_cast<wchar_t *>(payload.data());
  DWORD_PTR result = 0;
  LRESULT sent = SendMessageTimeoutW(
      ipc, WM_COPYDATA, 0, reinterpret_cast<LPARAM>(&data), SMTO_ABORTIFHUNG,
      3000, &result);
  return sent != 0 && result == 1;
}

LRESULT CALLBACK IpcWndProc(HWND hwnd, UINT message, WPARAM wparam,
                            LPARAM lparam) {
  switch (message) {
  case WM_COPYDATA: {
    COPYDATASTRUCT *data = reinterpret_cast<COPYDATASTRUCT *>(lparam);
    if (!data || data->dwData != kIpcMagic || !data->lpData ||
        data->cbData < sizeof(wchar_t)) {
      return 0;
    }
    const wchar_t *text = static_cast<const wchar_t *>(data->lpData);
    size_t count = data->cbData / sizeof(wchar_t);
    std::wstring path;
    path.reserve(count);
    for (size_t i = 0; i < count && text[i]; ++i) {
      path.push_back(text[i]);
    }
    WindowManager &manager = WindowManager::Get();
    if (path.empty()) {
      manager.FocusWindow();  // plain second launch: just bring the app up
    } else {
      manager.OpenExternalPath(path);
    }
    return 1;
  }
  case kIpcDropMessage:
    WindowManager::Get().ProcessDrops();
    return 0;
  default:
    return DefWindowProcW(hwnd, message, wparam, lparam);
  }
}

} // namespace

bool TryBecomePrimary() {
  // Ownership is irrelevant: only ERROR_ALREADY_EXISTS matters. FALSE also
  // guarantees a second instance never waits on a mutex held by the first.
  g_instance_mutex = CreateMutexW(nullptr, FALSE, MutexName().c_str());
  if (!g_instance_mutex) {
    return true;  // no IPC possible; behave like a standalone instance
  }
  return GetLastError() != ERROR_ALREADY_EXISTS;
}

bool ForwardToPrimary(const std::vector<std::wstring> &paths) {
  std::wstring class_name = IpcClassName();
  HWND ipc = nullptr;
  // The first instance may still be creating its WebView2 environment; it
  // registers the IPC window before that, but a fast double-click can win.
  for (int attempt = 0; attempt < 80 && !ipc; ++attempt) {
    ipc = FindWindowW(class_name.c_str(), nullptr);
    if (!ipc) {
      Sleep(50);
    }
  }
  if (!ipc) {
    return false;
  }
  if (paths.empty()) {
    return SendOneDocument(ipc, L"");
  }
  bool ok = true;
  for (const std::wstring &path : paths) {
    ok = SendOneDocument(ipc, path) && ok;
  }
  return ok;
}

WindowManager &WindowManager::Get() {
  static WindowManager manager;
  return manager;
}

bool WindowManager::CreateIpcWindow(std::wstring &error) {
  ipc_class_ = IpcClassName();
  HINSTANCE instance = GetModuleHandleW(nullptr);
  WNDCLASSEXW wc{};
  wc.cbSize = sizeof(wc);
  wc.lpfnWndProc = IpcWndProc;
  wc.hInstance = instance;
  wc.lpszClassName = ipc_class_.c_str();
  if (!RegisterClassExW(&wc) && GetLastError() != ERROR_CLASS_ALREADY_EXISTS) {
    error = L"无法注册单实例通信窗口。";
    return false;
  }
  // Hidden, but NOT a message-only window: FindWindowW cannot see those.
  ipc_ = CreateWindowExW(0, ipc_class_.c_str(), L"MDReader IPC", WS_POPUP, 0, 0,
                         1, 1, nullptr, nullptr, instance, nullptr);
  if (!ipc_) {
    error = L"无法创建单实例通信窗口。";
    return false;
  }
  return true;
}

bool WindowManager::Start(const std::string &url,
                          const std::vector<std::wstring> &startup,
                          std::wstring &error) {
  url_ = url;
  if (!CreateIpcWindow(error)) {
    return false;
  }
  std::vector<std::string> commands;
  commands.reserve(startup.size());
  for (const std::wstring &path : startup) {
    commands.push_back(OpenCommand(path));
  }
  return CreateHost(true, nullptr, commands, commands.empty(), error);
}

bool WindowManager::CreateHost(bool primary, const POINT *position,
                               const std::vector<std::string> &initialCommands,
                               bool restore, std::wstring &error) {
  // Reserve the slot BEFORE constructing the webview: its constructor pumps a
  // nested message loop, during which a second instance may already forward a
  // document. That command needs a host to queue onto.
  hosts_.push_back(std::make_unique<WindowHost>());
  WindowHost *host = hosts_.back().get();
  host->id = next_id_++;
  host->restore = restore;
  try {
    host->view = std::make_unique<webview::webview>(false, nullptr);
  } catch (const std::exception &failure) {
    error = L"MDReader 启动失败：\n\n" + ToWide(failure.what());
    hosts_.pop_back();
    return false;
  }
  host->hwnd = static_cast<HWND>(host->view->window().value());
  host->view->set_title("MDReader");
  if (primary) {
    host->view->set_size(1180, 820, WEBVIEW_HINT_NONE);
    host->view->set_size(860, 600, WEBVIEW_HINT_MIN);
  } else {
    host->view->set_size(980, 700, WEBVIEW_HINT_NONE);
    host->view->set_size(720, 520, WEBVIEW_HINT_MIN);
  }
  ApplyWindowIcons(host->hwnd);

  if (position) {
    // webview shows its window during construction; hide/place/show avoids a
    // visible jump from CW_USEDEFAULT to the drop point.
    // Keep the WHOLE window on the virtual screen. Dropping a tab near the
    // right edge must not leave the detached window mostly off-screen.
    RECT bounds{};
    GetWindowRect(host->hwnd, &bounds);
    int width = bounds.right - bounds.left;
    int height = bounds.bottom - bounds.top;
    int x = position->x - 120;
    int y = position->y - 24;
    int vx = GetSystemMetrics(SM_XVIRTUALSCREEN);
    int vy = GetSystemMetrics(SM_YVIRTUALSCREEN);
    int vw = GetSystemMetrics(SM_CXVIRTUALSCREEN);
    int vh = GetSystemMetrics(SM_CYVIRTUALSCREEN);
    x = std::max(vx, std::min(x, vx + vw - width));
    y = std::max(vy, std::min(y, vy + vh - height));
    ShowWindow(host->hwnd, SW_HIDE);
    SetWindowPos(host->hwnd, nullptr, x, y, 0, 0,
                 SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE);
    ShowWindow(host->hwnd, SW_SHOW);
  }

  for (const std::string &command : unassigned_) {
    host->pending.push_back(command);
  }
  unassigned_.clear();
  for (const std::string &command : initialCommands) {
    host->pending.push_back(command);
  }

  // Bindings must exist before navigate(): webview injects them at load time.
  // Detached windows have no startup document of their own; the tab arrives as
  // a queued "add" command instead.
  BindHostApi(*host->view, host->hwnd, host->id);
  host->view->navigate(url_);
  return true;
}

void WindowManager::Run() {
  if (hosts_.empty() || !hosts_.front()->view) {
    return;
  }
  // A single thread pumps every window; webview posts WM_QUIT only when its
  // process-wide window count reaches zero.
  webview::webview *runner = hosts_.front()->view.get();
  runner->run();
  hosts_.clear();
  if (ipc_) {
    DestroyWindow(ipc_);
    ipc_ = nullptr;
  }
}

WindowHost *WindowManager::Find(int id) {
  for (const auto &entry : hosts_) {
    if (entry->id == id) {
      return entry.get();
    }
  }
  return nullptr;
}

WindowHost *WindowManager::FindAliveByHwnd(HWND hwnd) {
  if (!hwnd || !IsWindow(hwnd)) {
    return nullptr;
  }
  for (const auto &entry : hosts_) {
    if (entry->alive && entry->hwnd == hwnd) {
      return entry.get();
    }
  }
  return nullptr;
}

WindowHost *WindowManager::FirstAlive() {
  for (const auto &entry : hosts_) {
    if (entry->alive && entry->hwnd && IsWindow(entry->hwnd)) {
      return entry.get();
    }
  }
  return nullptr;
}

int WindowManager::AliveCount() {
  int count = 0;
  for (const auto &entry : hosts_) {
    if (entry->alive && entry->hwnd && IsWindow(entry->hwnd)) {
      ++count;
    }
  }
  return count;
}

void WindowManager::Deliver(WindowHost *host, const std::string &command) {
  if (!host) {
    unassigned_.push_back(command);
    return;
  }
  if (!host->alive || !host->ready || !host->view ||
      !IsWindow(host->hwnd)) {
    host->pending.push_back(command);
    return;
  }
  try {
    host->view->eval("(window.__mrHostMessage||function(c){})(" + command + ")");
  } catch (const std::exception &) {
    host->pending.push_back(command);
  }
}

std::string WindowManager::TakeInit(int windowId) {
  WindowHost *host = Find(windowId);
  if (!host) {
    return "{\"windowId\":0,\"restore\":false,\"commands\":[]}";
  }
  host->ready = true;
  std::string commands;
  for (const std::string &command : host->pending) {
    if (!commands.empty()) {
      commands += ",";
    }
    commands += command;
  }
  host->pending.clear();
  // React StrictMode can call this twice in a dev build; the second call must
  // not restore a second document.
  bool restore = host->restore;
  host->restore = false;
  return "{\"windowId\":" + std::to_string(windowId) + ",\"restore\":" +
         (restore ? "true" : "false") + ",\"commands\":[" + commands + "]}";
}

WindowHost *WindowManager::PreferredWindow() {
  HWND foreground = GetForegroundWindow();
  WindowHost *target = nullptr;
  if (foreground) {
    target = FindAliveByHwnd(GetAncestor(foreground, GA_ROOT));
  }
  return target ? target : FirstAlive();
}

void WindowManager::OpenExternalPath(const std::wstring &path) {
  WindowHost *target = PreferredWindow();
  Deliver(target, OpenCommand(path));
  if (target && IsWindow(target->hwnd)) {
    ShowWindow(target->hwnd, SW_RESTORE);
    SetForegroundWindow(target->hwnd);
  }
}

void WindowManager::FocusWindow() {
  WindowHost *target = PreferredWindow();
  if (target && IsWindow(target->hwnd)) {
    ShowWindow(target->hwnd, SW_RESTORE);
    SetForegroundWindow(target->hwnd);
  }
}

void WindowManager::QueueTabDrop(const TabDropRequest &request) {
  drops_.push_back(request);
  if (ipc_) {
    PostMessageW(ipc_, kIpcDropMessage, 0, 0);
  }
}

void WindowManager::ProcessDrops() {
  if (busy_) {
    return;  // the outer drain loop will pick up the queued request
  }
  busy_ = true;
  while (!drops_.empty()) {
    TabDropRequest request = std::move(drops_.front());
    drops_.pop_front();
    try {
      HandleDrop(request);
    } catch (const std::exception &) {
      // A single failed drag must not stall the window's message pump.
    }
  }
  busy_ = false;
}

void WindowManager::HandleDrop(const TabDropRequest &request) {
  WindowHost *source = Find(request.sourceId);
  if (!source || !IsWindow(source->hwnd)) {
    return;
  }

  // JS coordinates are CSS pixels and the process is only system-DPI-aware, so
  // the physical cursor position is the reliable drop point (and keeps the
  // hit test exact on scaled displays).
  POINT point{};
  if (!GetCursorPos(&point)) {
    point.x = request.x;
    point.y = request.y;
    ClientToScreen(source->hwnd, &point);
  }

  HWND hit = WindowFromPoint(point);
  HWND root = hit ? GetAncestor(hit, GA_ROOT) : nullptr;
  WindowHost *target = FindAliveByHwnd(root);
  if (target == source) {
    return;  // released inside the source window: nothing to do
  }

  std::string add = AddCommand(request.docJson);
  if (target) {
    Deliver(target, add);
    ShowWindow(target->hwnd, SW_RESTORE);
    SetForegroundWindow(target->hwnd);
  } else {
    std::wstring error;
    if (!CreateHost(false, &point, {add}, false, error)) {
      Deliver(source, ToastCommand("无法创建新窗口"));
      return;
    }
  }

  Deliver(source, RemoveCommand(request.docId));
  // Chrome closes a window when its last tab leaves it. Keep the process alive
  // by creating the destination first, then retiring the now-empty window.
  if (request.lastTab && AliveCount() > 1) {
    source->alive = false;
    PostMessageW(source->hwnd, WM_CLOSE, 0, 0);
  }
}

} // namespace mdreader
