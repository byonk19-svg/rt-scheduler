@echo off
setlocal EnableExtensions DisableDelayedExpansion

set "ZIPFILE="
set "DESTDIR="

:parse
if "%~1"=="" goto run
if /I "%~1"=="-d" (
  set "DESTDIR=%~2"
  shift
  shift
  goto parse
)
if "%~1"=="-q" (
  shift
  goto parse
)
if "%~1"=="-o" (
  shift
  goto parse
)
if /I "%~1"=="-qo" (
  shift
  goto parse
)
if /I "%~1"=="-oq" (
  shift
  goto parse
)
if not defined ZIPFILE (
  set "ZIPFILE=%~1"
)
shift
goto parse

:run
if not defined ZIPFILE (
  echo unzip shim: missing zip file argument 1>&2
  exit /b 2
)

if not defined DESTDIR (
  set "DESTDIR=."
)

node "%~dp0..\scripts\lib\windows-unzip.mjs" "%ZIPFILE%" "%DESTDIR%" 1>nul
if errorlevel 1 (
  echo unzip shim: failed to extract "%ZIPFILE%" to "%DESTDIR%" 1>&2
  exit /b 1
)

exit /b 0
