#!/bin/bash
# Lance le banc Formules : tue d'abord un navigateur resté sur le port CDP 9684, puis écrit le journal.
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { \$_.CommandLine -like '*remote-debugging-port=9684*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }" >/dev/null 2>&1
cd /d/Projet/ForgeOffice/apps/web/tests/e2e
timeout 400 node excel-formulas.mjs "$@" > "$LOG" 2>&1
