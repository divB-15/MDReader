#pragma once

// Document / folder / image reading and the JSON payloads sent to the renderer.

#include <string>
#include <vector>

// Every document handed over on the command line (Explorer can pass several
// selected files to "Open with"). Paths are absolute and UTF-16.
std::vector<std::wstring> StartupDocumentPaths();
std::wstring StartupDocumentPath();

std::string DocJson(const std::wstring &path);
std::string FolderJson(const std::wstring &root);
std::string ImageJson(const std::wstring &path);
