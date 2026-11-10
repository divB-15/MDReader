# ============================================================================
#  tests - CTest unit tests for the native host
#
#  Only pure helpers from src/host/encoding.cpp are tested here: no window, no
#  WebView2, no COM. The React side has its own Vitest suite in
#  src/frontend/tests/ (run with `npm test` from src/frontend).
# ============================================================================
add_executable(test_encoding
    test_encoding.cpp
    ${CMAKE_SOURCE_DIR}/src/host/encoding.cpp
)

target_include_directories(test_encoding PRIVATE
    ${CMAKE_SOURCE_DIR}/src/host
    ${CMAKE_SOURCE_DIR}/src
)
target_compile_definitions(test_encoding PRIVATE WIN32_LEAN_AND_MEAN NOMINMAX)
target_link_libraries(test_encoding PRIVATE kernel32)

add_test(NAME encoding COMMAND test_encoding)
