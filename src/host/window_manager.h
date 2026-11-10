#pragma once

// One process owns every reader window.
//
// A second launch of the exe does not create a window: it finds the hidden IPC
// window of the running process, sends its command-line documents over
// WM_COPYDATA and exits. The renderer of the running process turns each path
// into another tab of its existing window.
//
// Dragging a tab out of a window is the ONLY thing that creates a new window.
// The host hit-tests the drop point: over another MDReader window the tab is
// moved there, anywhere else a new window is created for it.

#include "webview_include.h"

#include <deque>
#include <memory>
#include <string>
#include <vector>

namespace mdreader {

struct WindowHost {
  int id = 0;
  HWND hwnd = nullptr;
  std::unique_ptr<webview::webview> view;
  bool ready = false;    // renderer has called mrWindowReady
  bool restore = false;  // may reopen the last document on startup
  bool alive = true;
  std::vector<std::string> pending;  // JSON commands waiting for mrWindowReady
};

struct TabDropRequest {
  int sourceId = 0;
  int x = 0;
  int y = 0;
  std::string docJson;
  std::string docId;
  bool lastTab = false;
};

// True when this process owns the named instance slot. Call exactly once,
// before any window or COM object is created.
bool TryBecomePrimary();

// Hands the command-line documents to the running instance. Waits a few
// seconds for its IPC window if it is still starting up.
bool ForwardToPrimary(const std::vector<std::wstring> &paths);

class WindowManager {
public:
  static WindowManager &Get();

  // Creates the IPC window and the first reader window. Every window of the
  // process shares one local server, hence one URL / one origin.
  bool Start(const std::string &url, const std::vector<std::wstring> &startup,
             std::wstring &error);

  // Runs the shared Win32 message loop until the last window closes, then
  // destroys every webview before wWinMain uninitializes COM.
  void Run();

  // Entry points used by the IPC window procedure and the JS bindings.
  void ProcessDrops();
  void OpenExternalPath(const std::wstring &path);
  void FocusWindow();
  void QueueTabDrop(const TabDropRequest &request);
  std::string TakeInit(int windowId);

private:
  WindowManager() = default;

  WindowHost *Find(int id);
  WindowHost *FindAliveByHwnd(HWND hwnd);
  WindowHost *FirstAlive();
  WindowHost *PreferredWindow();
  int AliveCount();
  bool CreateIpcWindow(std::wstring &error);
  bool CreateHost(bool primary, const POINT *position,
                  const std::vector<std::string> &initialCommands, bool restore,
                  std::wstring &error);
  void Deliver(WindowHost *host, const std::string &command);
  void HandleDrop(const TabDropRequest &request);

  HWND ipc_ = nullptr;
  std::wstring ipc_class_;
  std::string url_;
  std::vector<std::unique_ptr<WindowHost>> hosts_;
  std::vector<std::string> unassigned_;  // commands received before any host
  std::deque<TabDropRequest> drops_;
  int next_id_ = 1;
  bool busy_ = false;
};

} // namespace mdreader
