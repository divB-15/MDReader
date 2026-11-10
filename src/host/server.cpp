#include "server.h"

#include "httplib.h"

#include <thread>
#include <utility>

struct LocalServer::Impl {
  explicit Impl(std::string html) : page(std::move(html)) {
    server.Get("/", [this](const httplib::Request &, httplib::Response &response) {
      // The page is rebuilt into every exe, but the URL stays the same across
      // upgrades; without this WebView2 may keep serving the old page.
      response.set_header("Cache-Control", "no-store, must-revalidate");
      response.set_content(page, "text/html; charset=utf-8");
    });
    server.Get("/favicon.ico", [](const httplib::Request &, httplib::Response &response) {
      response.set_header("Cache-Control", "no-store, must-revalidate");
      response.status = 204;
    });
  }

  std::string page;
  httplib::Server server;
  std::thread worker;
  int port = 0;
};

LocalServer::LocalServer(std::string html)
    : impl_(std::make_unique<Impl>(std::move(html))) {}

LocalServer::~LocalServer() { Stop(); }

int LocalServer::Start() {
  for (int candidate = 17890; candidate < 17900; ++candidate) {
    if (impl_->server.bind_to_port("127.0.0.1", candidate)) {
      impl_->port = candidate;
      break;
    }
  }
  if (!impl_->port) {
    return 0;
  }
  impl_->worker = std::thread([this] { impl_->server.listen_after_bind(); });
  return impl_->port;
}

std::string LocalServer::Url() const {
  return "http://127.0.0.1:" + std::to_string(impl_->port) + "/";
}

void LocalServer::Stop() {
  if (!impl_) {
    return;
  }
  impl_->server.stop();
  if (impl_->worker.joinable()) {
    impl_->worker.join();
  }
}
