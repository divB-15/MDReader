cmake_minimum_required(VERSION 3.20)

project(MDReader VERSION 1.0.3.0 LANGUAGES CXX)
enable_language(RC)
enable_testing()

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Embedding the front-end HTML needs Python 3 (standard library only).
# Honour an explicit PYTHON_EXECUTABLE, otherwise let CMake locate any
# Python 3 on PATH. This keeps the build portable across machines.
if(DEFINED ENV{PYTHON_EXECUTABLE} AND NOT DEFINED Python3_EXECUTABLE)
  set(Python3_EXECUTABLE "$ENV{PYTHON_EXECUTABLE}")
endif()
find_package(Python3 COMPONENTS Interpreter REQUIRED)

# Version and icon live in a resource script, so Explorer, the taskbar and the
# file properties dialog all show the same thing. Keep in sync with README.
set(APP_VERSION "1.0.3.0")
string(REPLACE "." "," APP_VERSION_COMMA "${APP_VERSION}")
set(APP_ICON "${CMAKE_CURRENT_SOURCE_DIR}/assets/mdreader.ico")
# Application manifest (DPI awareness / supportedOS / asInvoker). It is
# configured from a template so the assemblyIdentity version follows project
# VERSION, then compiled into the exe as an RT_MANIFEST resource next to the icon.
set(APP_MANIFEST "${CMAKE_BINARY_DIR}/app.manifest")
configure_file(
  "${CMAKE_CURRENT_SOURCE_DIR}/src/app.manifest.in"
  "${APP_MANIFEST}"
  @ONLY)

configure_file(
  "${CMAKE_CURRENT_SOURCE_DIR}/src/app.rc.in"
  "${CMAKE_BINARY_DIR}/mdreader.rc"
  @ONLY)

# The renderer is a single HTML file built by Vite and embedded into the exe.
set(EMBEDDED_CPP "${CMAKE_BINARY_DIR}/embedded_html.cpp")
add_custom_command(
  OUTPUT "${EMBEDDED_CPP}"
  COMMAND "${Python3_EXECUTABLE}" "${CMAKE_CURRENT_SOURCE_DIR}/tools/embed_html.py"
          "${CMAKE_CURRENT_SOURCE_DIR}/src/frontend/dist/index.html"
          "${EMBEDDED_CPP}"
  DEPENDS "${CMAKE_CURRENT_SOURCE_DIR}/src/frontend/dist/index.html"
          "${CMAKE_CURRENT_SOURCE_DIR}/tools/embed_html.py"
  COMMENT "Embedding frontend HTML"
  VERBATIM)

# webview is vendored under third_party/webview so a clean checkout builds with no
# network access. Only if that copy is missing does CMake fall back to cloning it.
if(MINGW)
  set(WEBVIEW_USE_COMPAT_MINGW ON CACHE BOOL "" FORCE)
endif()
# The WebView2 SDK headers (WebView2.h) ship with the project as well; without
# this hint webview would download the NuGet package from nuget.org.
if(WIN32 AND NOT DEFINED MSWebView2_ROOT)
  set(MSWebView2_ROOT "${CMAKE_CURRENT_SOURCE_DIR}/third_party/mswebview2")
endif()
set(WEBVIEW_LOCAL "${CMAKE_CURRENT_SOURCE_DIR}/third_party/webview")
if(EXISTS "${WEBVIEW_LOCAL}/CMakeLists.txt")
  message(STATUS "webview: using the vendored copy in third_party/webview")
  add_subdirectory("${WEBVIEW_LOCAL}" "${CMAKE_BINARY_DIR}/webview" EXCLUDE_FROM_ALL)
else()
  message(STATUS "webview: third_party copy missing, fetching 0.12.0 from GitHub")
  include(FetchContent)
  FetchContent_Declare(
    webview
    GIT_REPOSITORY https://github.com/webview/webview
    GIT_TAG 0.12.0)
  FetchContent_MakeAvailable(webview)
endif()

add_executable(MDReader WIN32
  "${CMAKE_CURRENT_SOURCE_DIR}/src/main.cpp"
  "${CMAKE_CURRENT_SOURCE_DIR}/src/host/portable.cpp"
  "${CMAKE_CURRENT_SOURCE_DIR}/src/host/encoding.cpp"
  "${CMAKE_CURRENT_SOURCE_DIR}/src/host/documents.cpp"
  "${CMAKE_CURRENT_SOURCE_DIR}/src/host/dialogs.cpp"
  "${CMAKE_CURRENT_SOURCE_DIR}/src/host/server.cpp"
  "${CMAKE_CURRENT_SOURCE_DIR}/src/host/bridge.cpp"
  "${CMAKE_CURRENT_SOURCE_DIR}/src/host/window_manager.cpp"
  "${EMBEDDED_CPP}"
  "${CMAKE_BINARY_DIR}/mdreader.rc")

# There is exactly one exe in the project, and it sits in bin/ next to the
# portable WebView2 profile it creates at runtime.
set_target_properties(MDReader PROPERTIES
  RUNTIME_OUTPUT_DIRECTORY "${CMAKE_SOURCE_DIR}/bin"
  RUNTIME_OUTPUT_DIRECTORY_RELEASE "${CMAKE_SOURCE_DIR}/bin"
  RUNTIME_OUTPUT_DIRECTORY_DEBUG "${CMAKE_SOURCE_DIR}/bin")

target_include_directories(MDReader PRIVATE
  "${CMAKE_CURRENT_SOURCE_DIR}/src"
  "${CMAKE_CURRENT_SOURCE_DIR}/third_party")
target_compile_definitions(MDReader PRIVATE
  WIN32_LEAN_AND_MEAN
  NOMINMAX
  _WIN32_WINNT=0x0A00)
target_link_libraries(MDReader PRIVATE
  webview::core
  ws2_32
  comdlg32
  shell32
  ole32
  user32
  advapi32)

if(MINGW)
  # Ship one standalone executable: no libgcc/libstdc++/winpthread DLLs needed.
  # -municode selects the wWinMain entry point on MinGW.
  target_link_options(MDReader PRIVATE
    -municode
    -static
    -static-libgcc
    -static-libstdc++)
endif()

add_subdirectory(tests)
