@echo off
rem Abre o site da Eletron Paulista no navegador (servidor local na porta 3412).
rem Se o servidor ja estiver no ar, so abre o navegador.
cd /d "%~dp0"
netstat -ano | findstr /r /c:":3412 .*LISTENING" >nul
if %errorlevel%==0 (
  start "" http://localhost:3412
  exit /b
)
node build.mjs
start "" http://localhost:3412
node scripts\serve.mjs 3412
