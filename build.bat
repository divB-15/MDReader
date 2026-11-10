@echo off
REM ===========================================================================
REM  MDReader - one-click build.
REM
REM  Build steps:
REM    1. Build the React front-end into src/frontend/dist (Node + npm):
REM         cd src\frontend && npm ci && npm run build
REM    2. Build the C++ host shell with CMake + MinGW-w64.
REM
REM  Requirements for building from source:
REM    * Node.js + npm (on PATH) for the front-end
REM    * CMake (on PATH, or set CMAKE=<path\to\cmake.exe>)
REM    * MinGW-w64 (g++.exe / mingw32-make.exe on PATH)
REM  A git-ignored ".build.local.bat" next to this script may pre-set CMAKE /
REM  CXX for convenience; it is never part of the release.
REM
REM  Keep this file CRLF + ASCII only.
REM ===========================================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"

if exist "%~dp0.build.local.bat" call "%~dp0.build.local.bat"

if not exist "src\frontend\dist\index.html" (
  echo [!] src\frontend\dist\index.html is missing.
  echo     Run: cd src\frontend ^&^& npm ci ^&^& npm run build
  exit /b 1
)

where g++ >nul 2>nul
if errorlevel 1 (
  echo [!] g++ was not found in PATH.
  echo     Install MinGW-w64 and add its bin folder to PATH, then run this again.
  exit /b 1
)

REM Locate CMake: an explicit CMAKE=... wins; else require it on PATH.
if not defined CMAKE (
  where cmake >nul 2>nul && set "CMAKE=cmake"
)
if not defined CMAKE (
  echo [!] cmake was not found.
  echo     Install it from https://cmake.org/download/, or run: python -m pip install cmake
  echo     Already installed somewhere else? Pass it in:
  echo       set CMAKE=C:\path\to\cmake.exe
  exit /b 1
)
echo [i] cmake: %CMAKE%

"%CMAKE%" -S . -B build -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release
if errorlevel 1 exit /b 1

"%CMAKE%" --build build -j
if errorlevel 1 exit /b 1

echo.
echo Build OK: bin\MDReader.exe
