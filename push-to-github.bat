@echo off
chcp 65001 > nul
echo ===================================================
echo   Elite CRM - Pushing Project to GitHub 🚀
echo ===================================================
echo.
echo 1. Please go to github.com and create a PRIVATE repository.
echo 2. Copy the repository URL (e.g., https://github.com/username/repo.git)
echo.
set /p repo_url="Enter GitHub Repository URL: "

if "%repo_url%"=="" (
    echo.
    echo [Error] URL cannot be empty!
    pause
    exit /b
)

echo.
echo Connecting local repository to GitHub...
git remote remove origin >nul 2>&1
git remote add origin %repo_url%
git branch -M main

echo.
echo Pushing files to GitHub...
echo [Notice] A window may pop up asking you to sign in to your GitHub account.
echo Please authenticate in that window to complete the upload!
echo.
git push -u origin main

if %errorlevel% neq 0 (
    echo.
    echo [Error] Failed to push code to GitHub. Please check your credentials.
    pause
    exit /b
)

echo.
echo ===================================================
echo   Success! Your project is now online on GitHub! 🎉
echo ===================================================
pause
