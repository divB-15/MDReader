#include "portable.h"

#include "encoding.h"

#include <filesystem>

namespace fs = std::filesystem;

std::wstring ExeDirectory() {
  wchar_t buffer[32768];
  DWORD length = GetModuleFileNameW(nullptr, buffer, ARRAYSIZE(buffer));
  if (length == 0 || length >= ARRAYSIZE(buffer)) {
    return {};
  }
  std::wstring path(buffer, length);
  size_t slash = path.find_last_of(L"\\/");
  if (slash == std::wstring::npos) {
    return {};
  }
  return path.substr(0, slash);
}

std::wstring PortableProfileDirectory() {
  std::wstring dir = ExeDirectory();
  if (dir.empty()) {
    return {};
  }
  return dir + L"\\MDReader.exe.WebView2";
}

HRESULT WINAPI PortableFolderPath(HWND, int, HANDLE, DWORD, LPWSTR path) {
  std::wstring dir = ExeDirectory();
  if (dir.empty() || !path) {
    return E_FAIL;
  }
  lstrcpynW(path, dir.c_str(), MAX_PATH);
  return S_OK;
}

LPWSTR WINAPI PortablePathCombine(LPWSTR destination, LPCWSTR, LPCWSTR) {
  std::wstring dir = PortableProfileDirectory();
  if (dir.empty() || !destination) {
    return nullptr;
  }
  lstrcpynW(destination, dir.c_str(), MAX_PATH);
  return destination;
}

bool EnsureProfileDirectory(std::wstring &error) {
  std::wstring profile = PortableProfileDirectory();
  if (profile.empty()) {
    error = L"无法确定程序所在目录。";
    return false;
  }
  std::error_code code;
  fs::create_directories(fs::path(profile), code);
  if (code) {
    error = L"无法创建数据文件夹：\n" + profile + L"\n\n" + ToWide(code.message());
    return false;
  }
  // Existence is not enough: a read-only medium creates nothing at write time
  // but fails later with a message from WebView2 that explains very little.
  std::wstring probe = profile + L"\\write-test.tmp";
  HANDLE handle = CreateFileW(probe.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS,
                              FILE_ATTRIBUTE_TEMPORARY, nullptr);
  if (handle == INVALID_HANDLE_VALUE) {
    error = L"程序所在的文件夹不可写：\n" + profile +
            L"\n\n请把 MDReader.exe 放到有写入权限的文件夹后再运行。";
    return false;
  }
  CloseHandle(handle);
  DeleteFileW(probe.c_str());
  return true;
}

// WebView2 drags a complete Chromium profile along. Its component updater keeps
// pulling DRM modules, ad-filter rules, speech models and hyphenation data into
// the portable folder, which is how a reader that stores ~50 KB of settings ends
// up with a 70+ MB directory. None of that is used here, so the updater and the
// on-disk shader cache are switched off. The WebView2 loader reads this variable
// when the browser is created; a value that is already present (handy while
// debugging) wins.
void ConfigureBrowserArguments() {
  wchar_t existing[2] = {};
  if (GetEnvironmentVariableW(L"WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", existing,
                              2) != 0) {
    return;
  }
  SetEnvironmentVariableW(L"WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
                          L"--disable-component-update --disable-gpu-shader-disk-cache");
}
