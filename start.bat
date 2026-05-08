@echo off
REM ==========================================
REM MedAI Diagnostics Platform - Start Script
REM Backend + Frontend
REM ==========================================

echo.
echo  ==================================================
echo   MedAI Diagnostics Platform - Starting...
echo  ==================================================
echo.

REM --- Check Python 3.11 ---
echo [1/6] Checking Python 3.11...
py -3.11 --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python 3.11 not found!
    pause
    exit /b 1
)
echo       OK

REM --- Check Node ---
echo [2/6] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found!
    pause
    exit /b 1
)
echo       OK

REM --- Setup Python 3.11 venv ---
echo [3/6] Setting up backend environment...
if not exist ".venv311\Scripts\python.exe" (
    echo       Creating Python 3.11 virtual environment...
    py -3.11 -m venv .venv311
    call .venv311\Scripts\activate.bat
    python -m pip install --upgrade pip setuptools wheel >nul 2>&1
    pip install -r backend\requirements.txt
    if errorlevel 1 (
        echo [ERROR] Backend install failed!
        pause
        exit /b 1
    )
) else (
    call .venv311\Scripts\activate.bat
    REM Sync dependencies in case requirements.txt was updated since last run.
    REM Idempotent: pip skips already-satisfied packages quickly.
    echo       Syncing backend dependencies...
    pip install -q -r backend\requirements.txt
    if errorlevel 1 (
        echo [WARN] Dependency sync had issues - continuing anyway.
    )
)
echo       Backend environment ready

REM --- Train AI models if missing ---
echo [4/6] Checking AI models...
if not exist "backend\models\symptom_disease_model.pkl" (
    echo       Training Symptom Checker model...
    pushd backend
    python train_symptom_model.py
    popd
)
if not exist "backend\models\skin_disease_model.h5" (
    echo       Generating Skin Analyzer model...
    pushd backend
    python train_skin_model.py
    popd
)
echo       All AI models ready

REM --- Setup frontend ---
echo [5/6] Setting up frontend...
if not exist "frontend\node_modules\next\package.json" (
    echo       Installing frontend packages...
    pushd frontend
    call npm install
    popd
)
echo       Frontend ready

REM --- Kill any existing processes on ports 8000 and 3001 ---
echo [6/6] Launching services...
echo       Cleaning up old processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
timeout /t 2 /nobreak >nul

REM --- Start Backend ---
start "MedAI Backend" cmd /k "cd /d %~dp0 && call .venv311\Scripts\activate.bat && cd backend && python main.py"
echo       Backend starting on http://localhost:8000 ...
timeout /t 5 /nobreak >nul

REM --- Start Frontend ---
start "MedAI Frontend" cmd /k "cd /d %~dp0frontend && set PORT=3001 && npm run dev"
echo       Frontend starting on http://localhost:3001 ...
timeout /t 8 /nobreak >nul

echo.
echo  ==================================================
echo   MedAI Diagnostics Platform is RUNNING!
echo  ==================================================
echo.
echo   Frontend:       http://localhost:3001
echo   Backend API:    http://localhost:8000
echo   API Docs:       http://localhost:8000/docs
echo   Doctor Login:   http://localhost:3001/login
echo   Patients:       http://localhost:3001/patients
echo   Prescriptions:  http://localhost:3001/prescription
echo.
echo   7 Modules Active:
echo     - Smart Symptom Checker
echo     - Skin Infection Analyzer
echo     - AI Clinical Consultant
echo     - MLOps Dashboard
echo     - Patient Management
echo     - Prescription Generator
echo     - Multi-Language Support
echo.

start http://localhost:3001
pause
