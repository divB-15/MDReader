#include "encoding.h"

#include <windows.h>

#include <algorithm>
#include <cstdio>

namespace fs = std::filesystem;

std::wstring ToWide(const std::string &text) {
  if (text.empty()) {
    return {};
  }
  std::wstring out(text.size(), L'\0');
  int length = MultiByteToWideChar(CP_UTF8, 0, text.c_str(),
                                   static_cast<int>(text.size()), out.data(),
                                   static_cast<int>(out.size()));
  if (length <= 0) {
    return {};
  }
  out.resize(static_cast<size_t>(length));
  return out;
}

std::string ToUtf8(const std::wstring &text) {
  if (text.empty()) {
    return {};
  }
  std::string out(text.size() * 2 + 8, '\0');
  int length = WideCharToMultiByte(CP_UTF8, 0, text.c_str(),
                                   static_cast<int>(text.size()), out.data(),
                                   static_cast<int>(out.size()), nullptr, nullptr);
  if (length <= 0) {
    return {};
  }
  out.resize(static_cast<size_t>(length));
  return out;
}

std::string JsonEscape(const std::string &text) {
  std::string out;
  out.reserve(text.size() + 16);
  for (unsigned char c : text) {
    switch (c) {
    case '"':
      out += "\\\"";
      break;
    case '\\':
      out += "\\\\";
      break;
    case '\b':
      out += "\\b";
      break;
    case '\f':
      out += "\\f";
      break;
    case '\n':
      out += "\\n";
      break;
    case '\r':
      out += "\\r";
      break;
    case '\t':
      out += "\\t";
      break;
    default:
      if (c < 0x20) {
        char buffer[8];
        snprintf(buffer, sizeof(buffer), "\\u%04x", c);
        out += buffer;
      } else {
        out.push_back(static_cast<char>(c));
      }
    }
  }
  return out;
}

std::string NormalizePath(const fs::path &path) {
  std::string text = ToUtf8(path.wstring());
  std::replace(text.begin(), text.end(), '\\', '/');
  return text;
}

namespace {

void AppendUtf8(std::string &out, unsigned code) {
  if (code < 0x80) {
    out.push_back(static_cast<char>(code));
  } else if (code < 0x800) {
    out.push_back(static_cast<char>(0xC0 | (code >> 6)));
    out.push_back(static_cast<char>(0x80 | (code & 0x3F)));
  } else if (code < 0x10000) {
    out.push_back(static_cast<char>(0xE0 | (code >> 12)));
    out.push_back(static_cast<char>(0x80 | ((code >> 6) & 0x3F)));
    out.push_back(static_cast<char>(0x80 | (code & 0x3F)));
  } else {
    out.push_back(static_cast<char>(0xF0 | (code >> 18)));
    out.push_back(static_cast<char>(0x80 | ((code >> 12) & 0x3F)));
    out.push_back(static_cast<char>(0x80 | ((code >> 6) & 0x3F)));
    out.push_back(static_cast<char>(0x80 | (code & 0x3F)));
  }
}

bool ParseHex4(const std::string &text, size_t &offset, unsigned &out) {
  if (offset + 4 > text.size()) {
    return false;
  }
  out = 0;
  for (int i = 0; i < 4; ++i) {
    char digit = text[offset + static_cast<size_t>(i)];
    out <<= 4;
    if (digit >= '0' && digit <= '9') {
      out |= static_cast<unsigned>(digit - '0');
    } else if (digit >= 'a' && digit <= 'f') {
      out |= static_cast<unsigned>(digit - 'a' + 10);
    } else if (digit >= 'A' && digit <= 'F') {
      out |= static_cast<unsigned>(digit - 'A' + 10);
    } else {
      return false;
    }
  }
  offset += 4;
  return true;
}

} // namespace

static void SkipJsonSpace(const std::string &text, size_t &index) {
  while (index < text.size() && (text[index] == ' ' || text[index] == '\t' ||
                                text[index] == '\n' || text[index] == '\r')) {
    ++index;
  }
}

// `index` must point at the opening quote; on return it sits just past the
// closing one. Tolerant like the original binding decoder: a truncated string
// simply yields whatever was read.
static std::string DecodeJsonString(const std::string &text, size_t &index) {
  const size_t size = text.size();
  if (index >= size || text[index] != '"') {
    return {};
  }
  ++index;
  std::string out;
  out.reserve(size - index);
  while (index < size) {
    char current = text[index++];
    if (current == '"') {
      break;
    }
    if (current != '\\') {
      out.push_back(current);
      continue;
    }
    if (index >= size) {
      break;
    }
    char escape = text[index++];
    switch (escape) {
    case '"':
    case '\\':
    case '/':
      out.push_back(escape);
      break;
    case 'b':
      out.push_back('\b');
      break;
    case 'f':
      out.push_back('\f');
      break;
    case 'n':
      out.push_back('\n');
      break;
    case 'r':
      out.push_back('\r');
      break;
    case 't':
      out.push_back('\t');
      break;
    case 'u': {
      unsigned code = 0;
      if (!ParseHex4(text, index, code)) {
        return out;
      }
      if (code >= 0xD800 && code <= 0xDBFF && index + 1 < size &&
          text[index] == '\\' && text[index + 1] == 'u') {
        size_t next = index + 2;
        unsigned low = 0;
        if (ParseHex4(text, next, low) && low >= 0xDC00 && low <= 0xDFFF) {
          code = 0x10000 + ((code - 0xD800) << 10) + (low - 0xDC00);
          index = next;
        }
      }
      AppendUtf8(out, code);
      break;
    }
    default:
      out.push_back(escape);
      break;
    }
  }
  return out;
}

std::vector<std::string> JsonStringArguments(const std::string &request) {
  std::vector<std::string> out;
  size_t index = 0;
  SkipJsonSpace(request, index);
  if (index < request.size() && request[index] == '[') {
    ++index;
    SkipJsonSpace(request, index);
  }
  // Only string arguments are used by MDReader's bindings; a bare string is
  // accepted as a one-element list so the legacy calls keep working.
  while (index < request.size()) {
    SkipJsonSpace(request, index);
    if (index >= request.size() || request[index] != '"') {
      break;
    }
    out.push_back(DecodeJsonString(request, index));
    SkipJsonSpace(request, index);
    if (index < request.size() && request[index] == ',') {
      ++index;
      continue;
    }
    break;
  }
  return out;
}

std::string FirstArgument(const std::string &request) {
  std::vector<std::string> arguments = JsonStringArguments(request);
  return arguments.empty() ? std::string{} : arguments.front();
}

std::string Base64Encode(const std::string &data) {
  static const char alphabet[] =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  std::string out;
  out.reserve((data.size() + 2) / 3 * 4);
  size_t i = 0;
  while (i + 2 < data.size()) {
    unsigned value = (static_cast<unsigned char>(data[i]) << 16) |
                     (static_cast<unsigned char>(data[i + 1]) << 8) |
                     static_cast<unsigned char>(data[i + 2]);
    out.push_back(alphabet[(value >> 18) & 63]);
    out.push_back(alphabet[(value >> 12) & 63]);
    out.push_back(alphabet[(value >> 6) & 63]);
    out.push_back(alphabet[value & 63]);
    i += 3;
  }
  if (i + 1 == data.size()) {
    unsigned value = static_cast<unsigned char>(data[i]) << 16;
    out.push_back(alphabet[(value >> 18) & 63]);
    out.push_back(alphabet[(value >> 12) & 63]);
    out += "==";
  } else if (i + 2 == data.size()) {
    unsigned value = (static_cast<unsigned char>(data[i]) << 16) |
                     (static_cast<unsigned char>(data[i + 1]) << 8);
    out.push_back(alphabet[(value >> 18) & 63]);
    out.push_back(alphabet[(value >> 12) & 63]);
    out.push_back(alphabet[(value >> 6) & 63]);
    out += "=";
  }
  return out;
}

std::string MimeForExtension(const std::string &ext) {
  if (ext == ".png") return "image/png";
  if (ext == ".jpg" || ext == ".jpeg") return "image/jpeg";
  if (ext == ".gif") return "image/gif";
  if (ext == ".webp") return "image/webp";
  if (ext == ".bmp") return "image/bmp";
  if (ext == ".ico") return "image/x-icon";
  if (ext == ".svg") return "image/svg+xml";
  if (ext == ".avif") return "image/avif";
  if (ext == ".tif" || ext == ".tiff") return "image/tiff";
  return {};
}
