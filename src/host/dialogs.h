#pragma once

// Native "open file" / "open folder" dialogs.

#include <windows.h>

#include <string>

std::wstring PickFile(HWND owner);
std::wstring PickFolder(HWND owner);
