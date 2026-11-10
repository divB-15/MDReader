#pragma once

// Pure string / encoding helpers. No windows.h needed beyond what the .cpp
// itself includes, so these functions can be linked into a plain console test.

#include <filesystem>
#include <string>
#include <vector>

std::wstring ToWide(const std::string &text);
std::string ToUtf8(const std::wstring &text);
std::string JsonEscape(const std::string &text);

// Windows paths are handed to JS with forward slashes; the renderer builds
// image URLs from them and treats '\' as an escape character.
std::string NormalizePath(const std::filesystem::path &path);

// A bound webview function receives a JSON array of arguments, e.g.
// `["C:\\notes\\a.md"]`. Every binding takes at most one string.
std::string FirstArgument(const std::string &request);

// Same decoder, but keeps every string argument of the binding call. The tab
// transfer bridge passes three strings (coords, doc JSON, doc id) at once.
std::vector<std::string> JsonStringArguments(const std::string &request);

std::string Base64Encode(const std::string &data);
std::string MimeForExtension(const std::string &ext);
