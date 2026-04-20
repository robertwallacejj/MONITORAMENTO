@echo off
setlocal
cd /d %~dp0\..
where python >nul 2>nul
if %errorlevel%==0 (
  echo Iniciando servidor em http://localhost:8000
  python -m http.server 8000
  goto :eof
)

where py >nul 2>nul
if %errorlevel%==0 (
  echo Iniciando servidor em http://localhost:8000
  py -m http.server 8000
  goto :eof
)

echo Python nao encontrado. Instale o Python 3 ou abra o projeto diretamente pelo index.html.
pause
