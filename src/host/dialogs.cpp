#include "dialogs.h"

#include <commdlg.h>
#include <objbase.h>
#include <shlobj.h>

#include <cstdio>
#include <vector>

std::wstring PickFile(HWND owner) {
  std::vector<wchar_t> buffer(32768, L'\0');
  wchar_t filter[] =
      L"Markdown 文档 (*.md;*.markdown;*.mdown;*.txt)\0*.md;*.markdown;*.mdown;*.mkd;*.mdx;*.txt\0"
      L"所有文件 (*.*)\0*.*\0";
  OPENFILENAMEW options{};
  // Without this the common dialog rejects the structure outright and returns
  // before ever creating a window, which looks exactly like a dead button.
  options.lStructSize = sizeof(options);
  options.hwndOwner = owner;
  options.lpstrFilter = filter;
  options.lpstrFile = buffer.data();
  options.nMaxFile = static_cast<DWORD>(buffer.size());
  options.lpstrTitle = L"打开 Markdown 文档";
  options.Flags = OFN_FILEMUSTEXIST | OFN_PATHMUSTEXIST | OFN_NOCHANGEDIR | OFN_EXPLORER;
  SetLastError(0);
  if (!GetOpenFileNameW(&options)) {
    DWORD code = CommDlgExtendedError();
    if (code != 0) {
      wchar_t message[256];
      swprintf_s(message, L"打开文件对话框失败（错误码 0x%04X）。", code);
      MessageBoxW(owner, message, L"MDReader", MB_ICONERROR);
    }
    return {};
  }
  return buffer.data();
}

std::wstring PickFolder(HWND owner) {
  BROWSEINFOW browse{};
  browse.hwndOwner = owner;
  browse.lpszTitle = L"选择一个文件夹（会列出其中的 Markdown 文档）";
  browse.ulFlags = BIF_RETURNONLYFSDIRS | BIF_NEWDIALOGSTYLE | BIF_DONTGOBELOWDOMAIN;
  LPITEMIDLIST item = SHBrowseForFolderW(&browse);
  if (!item) {
    return {};
  }
  wchar_t path[MAX_PATH] = {};
  bool ok = SHGetPathFromIDListW(item, path);
  CoTaskMemFree(item);
  return ok ? std::wstring(path) : std::wstring{};
}
