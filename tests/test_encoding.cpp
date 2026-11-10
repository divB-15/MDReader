// Unit tests for the host's pure helpers. No window, no WebView2, no COM.
// Build with: ctest --test-dir build --output-on-failure

#include "encoding.h"

#include <iostream>
#include <string>

namespace {
int checks = 0;
int failures = 0;
} // namespace

#define CHECK(expr)                                                                  \
  do {                                                                               \
    ++checks;                                                                        \
    if (!(expr)) {                                                                  \
      ++failures;                                                                   \
      std::cerr << "FAIL line " << __LINE__ << ": " #expr << std::endl;             \
    }                                                                               \
  } while (false)

int main() {
  /* ---- UTF-8 <-> UTF-16 ---- */
  CHECK(ToWide("").empty());
  CHECK(ToUtf8(L"").empty());
  CHECK(ToUtf8(ToWide("ascii text")) == "ascii text");
  CHECK(ToUtf8(ToWide(u8"中文 Markdown")) == u8"中文 Markdown");
  CHECK(ToUtf8(ToWide("\xF0\x9F\x98\x80")) == "\xF0\x9F\x98\x80"); // U+1F600
  CHECK(ToWide("\xF0\x9F\x98\x80").size() == 2);                   // surrogate pair

  /* ---- JSON escaping ---- */
  CHECK(JsonEscape("") == "");
  CHECK(JsonEscape("plain text") == "plain text");
  CHECK(JsonEscape("a\"b") == "a\\\"b");
  CHECK(JsonEscape("C:\\notes\\a.md") == "C:\\\\notes\\\\a.md");
  CHECK(JsonEscape("a\nb\tc") == "a\\nb\\tc");
  CHECK(JsonEscape("\b\f\r") == "\\b\\f\\r");
  CHECK(JsonEscape(std::string("\x01", 1)) == "\\u0001");
  CHECK(JsonEscape(std::string("\x1f", 1)) == "\\u001f");
  CHECK(JsonEscape(u8"中文") == u8"中文");

  /* ---- bound-call argument unpacking ---- */
  CHECK(FirstArgument("[\"C:\\\\a.md\"]") == "C:\\a.md");
  CHECK(FirstArgument("[\"hello\"]") == "hello");
  CHECK(FirstArgument("[\"a\", \"b\"]") == "a");
  CHECK(FirstArgument("  [ \"1\" ] ") == "1");
  CHECK(FirstArgument("\"bare string\"") == "bare string");
  CHECK(FirstArgument("[]").empty());
  CHECK(FirstArgument("").empty());
  CHECK(FirstArgument("[\"a\\nb\"]") == "a\nb");
  CHECK(FirstArgument("[\"a\\tb\\\"c\"]") == "a\tb\"c");
  CHECK(FirstArgument("[\"\\u4e2d\"]") == u8"中");
  CHECK(FirstArgument("[\"\\ud83d\\ude00\"]") == "\xF0\x9F\x98\x80");
  CHECK(FirstArgument("[\"\\uZZZZ\"]").empty());
  CHECK(FirstArgument("[\"unterminated]").length() > 0); // tolerant: returns what it read

  /* ---- multiple binding arguments (tab transfer) ---- */
  const std::string drop = "[\"120,36,1\",\"{\\\"path\\\":\\\"D:/a.md\\\"}\",\"D:/a.md\"]";
  std::vector<std::string> args = JsonStringArguments(drop);
  CHECK(args.size() == 3);
  CHECK(args[0] == "120,36,1");
  CHECK(args[1] == "{\"path\":\"D:/a.md\"}");
  CHECK(args[2] == "D:/a.md");
  CHECK(JsonStringArguments("[]").empty());
  CHECK(JsonStringArguments("  [ \"a\" , \"b\" ] ").size() == 2);
  CHECK(FirstArgument(drop) == "120,36,1");

  /* ---- Base64 ---- */
  CHECK(Base64Encode("") == "");
  CHECK(Base64Encode("f") == "Zg==");
  CHECK(Base64Encode("fo") == "Zm8=");
  CHECK(Base64Encode("foo") == "Zm9v");
  CHECK(Base64Encode("foobar") == "Zm9vYmFy");
  CHECK(Base64Encode(std::string("\x00\x01\x02", 3)) == "AAEC");

  /* ---- MIME table ---- */
  CHECK(MimeForExtension(".png") == "image/png");
  CHECK(MimeForExtension(".jpg") == "image/jpeg");
  CHECK(MimeForExtension(".jpeg") == "image/jpeg");
  CHECK(MimeForExtension(".svg") == "image/svg+xml");
  CHECK(MimeForExtension(".webp") == "image/webp");
  CHECK(MimeForExtension(".gif") == "image/gif");
  CHECK(MimeForExtension(".md").empty());
  CHECK(MimeForExtension(".PNG").empty()); // caller lowercases first

  /* ---- path normalization ---- */
  CHECK(NormalizePath(std::filesystem::path("C:/a/b.md")) == "C:/a/b.md");
  CHECK(NormalizePath(std::filesystem::path(L"C:\\a\\b.md")) == "C:/a/b.md");

  std::cout << checks << " checks, " << failures << " failed" << std::endl;
  return failures == 0 ? 0 : 1;
}
