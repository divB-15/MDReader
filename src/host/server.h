#pragma once

// The renderer is a local HTTP page served from the exe's embedded HTML.
// cpp-httplib stays behind a pimpl so its heavy header is compiled once.

#include <cstddef>
#include <memory>
#include <string>

extern const char kEmbeddedHtml[];
extern const size_t kEmbeddedHtmlSize;

class LocalServer {
public:
  explicit LocalServer(std::string html);
  ~LocalServer();

  LocalServer(const LocalServer &) = delete;
  LocalServer &operator=(const LocalServer &) = delete;

  // Binds 127.0.0.1 on the first free port in 17890-17899 and starts serving.
  // Returns the chosen port, or 0 when all ten are taken.
  int Start();
  std::string Url() const;
  void Stop();

private:
  struct Impl;
  std::unique_ptr<Impl> impl_;
};
