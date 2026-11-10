#pragma once

// JS <-> C++ bridge and the window chrome that webview does not set up itself.

#include "webview_include.h"

#include <string>

void ApplyWindowIcons(HWND owner);

// `windowId` ties this webview to the process-wide window registry, so a tab
// drag or a forwarded file can be routed back to the right renderer.
void BindHostApi(webview::webview &window, HWND owner, int windowId);
