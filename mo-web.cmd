@echo off
cd /d "%~dp0"
if not defined BOOTSTRAP_ADMIN_CODE set /p BOOTSTRAP_ADMIN_CODE=Ma admin khoi tao (5 chu so): 
start "" http://127.0.0.1:4209
node server.cjs
pause
