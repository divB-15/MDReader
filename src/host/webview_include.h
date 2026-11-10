#pragma once

// The ONE place where webview.h is included.
//
// webview 0.12 computes its profile directory with SHGetFolderPathW(CSIDL_APPDATA)
// + PathCombineW(..., currentExeName) inside an inline member of browser_engine
// (webview.h: embed()). Redirecting those two calls to portable.cpp makes the
// profile land at <exe dir>\MDReader.exe.WebView2 instead of %APPDATA%.
//
// Two rules, both easy to break when the host is split across translation units:
//   1. The real prototypes must be visible BEFORE the macros are defined, or the
//      SDK headers would be parsed against our replacements.
//   2. Every TU that includes webview.h must go through this header, so all
//      inline definitions of embed() see the same substitution (ODR).
//
// Do not include "webview/webview.h" directly anywhere else.

#include <windows.h>
#include <shlobj.h>
#include <shlwapi.h>
#include <objbase.h>

#include "portable.h"

#define SHGetFolderPathW PortableFolderPath
#define PathCombineW PortablePathCombine
#include "webview/webview.h"
#undef SHGetFolderPathW
#undef PathCombineW
