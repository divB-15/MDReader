#pragma once

// Portable profile support for the WebView2 host.
//
// webview 0.12 hardcodes `%APPDATA%\<exe name>` as its user-data folder and
// ignores WEBVIEW2_USER_DATA_FOLDER. The only way to redirect it without
// patching the vendored header is to replace the two shell calls it makes
// while computing that path. See webview_include.h for the actual redirection.

#include <windows.h>
#include <shlobj.h>
#include <shlwapi.h>

#include <string>

std::wstring ExeDirectory();
std::wstring PortableProfileDirectory();

// Signatures must match SHGetFolderPathW / PathCombineW exactly: these are the
// functions webview.h calls after the macro substitution.
HRESULT WINAPI PortableFolderPath(HWND, int, HANDLE, DWORD, LPWSTR);
LPWSTR WINAPI PortablePathCombine(LPWSTR, LPCWSTR, LPCWSTR);

// Creates <exe dir>\MDReader.exe.WebView2 and verifies it is writable, so a
// read-only install location fails early with a useful message.
bool EnsureProfileDirectory(std::wstring &error);

// Must run before the WebView2 loader creates the browser process.
void ConfigureBrowserArguments();
