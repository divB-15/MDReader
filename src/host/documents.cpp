#include "documents.h"

#include "encoding.h"

#include <windows.h>
#include <shellapi.h>

#include <algorithm>
#include <cctype>
#include <filesystem>
#include <string>
#include <vector>

namespace fs = std::filesystem;

namespace {

struct ScannedFile {
  std::string full;
  std::string name;
  std::string dir;
  std::string rel;
};

bool ReadFileBytes(const std::wstring &path, std::string &out, size_t max_bytes) {
  HANDLE handle =
      CreateFileW(path.c_str(), GENERIC_READ,
                  FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                  nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
  if (handle == INVALID_HANDLE_VALUE) {
    return false;
  }
  LARGE_INTEGER size{};
  if (!GetFileSizeEx(handle, &size) || size.QuadPart < 0 ||
      static_cast<unsigned long long>(size.QuadPart) > max_bytes) {
    CloseHandle(handle);
    return false;
  }
  out.assign(static_cast<size_t>(size.QuadPart), '\0');
  size_t offset = 0;
  while (offset < out.size()) {
    DWORD chunk = 0;
    DWORD want = static_cast<DWORD>(std::min<size_t>(out.size() - offset, 1u << 20));
    if (!ReadFile(handle, out.data() + offset, want, &chunk, nullptr) || chunk == 0) {
      break;
    }
    offset += chunk;
  }
  CloseHandle(handle);
  out.resize(offset);
  return true;
}

std::string LowerExtension(const fs::path &path) {
  std::string ext = ToUtf8(path.extension().wstring());
  std::transform(ext.begin(), ext.end(), ext.begin(),
                 [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
  return ext;
}

bool IsMarkdownFile(const fs::path &path) {
  std::string ext = LowerExtension(path);
  return ext == ".md" || ext == ".markdown" || ext == ".mdown" || ext == ".mkd" ||
         ext == ".mdx" || ext == ".txt";
}

std::vector<ScannedFile> ScanFolder(const std::wstring &root) {
  std::vector<ScannedFile> files;
  fs::path root_path(root);
  fs::recursive_directory_iterator end;
  fs::recursive_directory_iterator it(
      root_path, fs::directory_options::skip_permission_denied);
  try {
    for (; it != end; ++it) {
      if (files.size() >= 4000) {
        break;
      }
      try {
        const auto &entry = *it;
        if (entry.is_directory()) {
          std::string name = ToUtf8(entry.path().filename().wstring());
          std::string lower = name;
          std::transform(lower.begin(), lower.end(), lower.begin(),
                         [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
          if ((!name.empty() && name[0] == '.') || lower == "node_modules" ||
              it.depth() >= 12) {
            it.disable_recursion_pending();
          }
          continue;
        }
        if (!entry.is_regular_file() || !IsMarkdownFile(entry.path())) {
          continue;
        }
        ScannedFile item;
        item.full = NormalizePath(entry.path());
        item.name = ToUtf8(entry.path().filename().wstring());
        item.dir = NormalizePath(entry.path().parent_path());
        fs::path relative = entry.path().lexically_relative(root_path);
        item.rel = NormalizePath(relative);
        files.push_back(std::move(item));
      } catch (const fs::filesystem_error &) {
        // A single unreadable entry (vanished, locked, too long a path) must not
        // abort the rest of the listing.
      }
    }
  } catch (const fs::filesystem_error &) {
    // The iteration itself failed; keep what has been collected so far.
  }
  std::sort(files.begin(), files.end(),
            [](const ScannedFile &a, const ScannedFile &b) { return a.rel < b.rel; });
  return files;
}

} // namespace

std::vector<std::wstring> StartupDocumentPaths() {
  std::vector<std::wstring> result;
  int argc = 0;
  LPWSTR *argv = CommandLineToArgvW(GetCommandLineW(), &argc);
  if (argv) {
    for (int i = 1; i < argc; ++i) {
      std::wstring arg = argv[i];
      if (arg.empty() || arg[0] == L'-' || !fs::exists(fs::path(arg))) {
        continue;
      }
      // "打开方式" hands over whatever the shell had, which may be relative to
      // a working directory we do not share; the document path has to be
      // absolute before it reaches the renderer or its images will not resolve.
      std::error_code ignored;
      fs::path absolute = fs::weakly_canonical(fs::path(arg), ignored);
      if (ignored) {
        absolute = fs::absolute(fs::path(arg), ignored);
      }
      if (!ignored) {
        result.push_back(absolute.wstring());
      }
    }
    LocalFree(argv);
  }
  return result;
}

std::wstring StartupDocumentPath() {
  std::vector<std::wstring> paths = StartupDocumentPaths();
  return paths.empty() ? std::wstring{} : paths.front();
}

std::string DocJson(const std::wstring &path) {
  std::string content;
  if (!ReadFileBytes(path, content, 32u << 20)) {
    return {};
  }
  fs::path file(path);
  std::string full = NormalizePath(file);
  std::string name = ToUtf8(file.filename().wstring());
  std::string dir = NormalizePath(file.parent_path());
  return "{\"path\":\"" + JsonEscape(full) + "\",\"name\":\"" + JsonEscape(name) +
         "\",\"dir\":\"" + JsonEscape(dir) + "\",\"content\":\"" +
         JsonEscape(content) + "\"}";
}

std::string FolderJson(const std::wstring &root) {
  fs::path root_path(root);
  std::string normalized = NormalizePath(root_path);
  std::string name = ToUtf8(root_path.filename().wstring());
  std::vector<ScannedFile> files = ScanFolder(root);
  std::string out = "{\"root\":\"" + JsonEscape(normalized) + "\",\"name\":\"" +
                    JsonEscape(name) + "\",\"files\":[";
  for (size_t i = 0; i < files.size(); ++i) {
    const ScannedFile &file = files[i];
    if (i) {
      out += ",";
    }
    out += "{\"path\":\"" + JsonEscape(file.full) + "\",\"name\":\"" +
           JsonEscape(file.name) + "\",\"dir\":\"" + JsonEscape(file.dir) +
           "\",\"rel\":\"" + JsonEscape(file.rel) + "\"}";
  }
  out += "]}";
  return out;
}

std::string ImageJson(const std::wstring &path) {
  std::string mime = MimeForExtension(LowerExtension(fs::path(path)));
  if (mime.empty()) {
    return "{\"ok\":false}";
  }
  std::string bytes;
  if (!ReadFileBytes(path, bytes, 40u << 20)) {
    return "{\"ok\":false}";
  }
  return "{\"ok\":true,\"mime\":\"" + mime + "\",\"data\":\"" +
         Base64Encode(bytes) + "\"}";
}
