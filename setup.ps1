# setup.ps1 - Aiddam Windows Dev Environment Setup
# Usage: powershell -ExecutionPolicy Bypass -File setup.ps1

$ErrorActionPreference = "Stop"

function Write-Step { param($msg) Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-OK   { param($msg) Write-Host "   OK  $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "   !!  $msg" -ForegroundColor Yellow }

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoRoot

# 1. Git config
Write-Step "1/6  Git config"
git config --global user.name "asakasimo1"
git config core.hooksPath .githooks
Write-OK "user.name = asakasimo1"
Write-OK "hooksPath = .githooks"

# 2. Sync app branch
Write-Step "2/6  Sync app branch"
$branch = git symbolic-ref --short HEAD 2>$null
if ($branch -ne "app") {
    git checkout app
}
git pull origin app
Write-OK "origin/app synced"

# 3. Install Doppler CLI
Write-Step "3/6  Doppler CLI"
if (Get-Command doppler -ErrorAction SilentlyContinue) {
    Write-OK "Already installed: $(doppler --version)"
} else {
    Write-Warn "Installing Doppler..."
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install --id Doppler.doppler -e --silent
    } else {
        $dopplerDir = "$env:USERPROFILE\.doppler\bin"
        New-Item -ItemType Directory -Force -Path $dopplerDir | Out-Null
        $apiUrl  = "https://api.github.com/repos/DopplerHQ/cli/releases/latest"
        $release = Invoke-RestMethod -Uri $apiUrl -Headers @{ "User-Agent" = "setup-script" }
        $asset   = $release.assets | Where-Object { $_.name -like "*windows_amd64*" } | Select-Object -First 1
        $tmpZip  = "$env:TEMP\doppler.zip"
        Write-Warn "Downloading: $($asset.browser_download_url)"
        Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $tmpZip
        Expand-Archive -Path $tmpZip -DestinationPath $dopplerDir -Force
        Remove-Item $tmpZip
        $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
        if ($userPath -notlike "*$dopplerDir*") {
            [Environment]::SetEnvironmentVariable("Path", "$userPath;$dopplerDir", "User")
            $env:Path += ";$dopplerDir"
        }
    }
    Write-OK "Doppler CLI installed"
}

# 4. Doppler login and project setup
Write-Step "4/6  Doppler login (browser will open)"
doppler login

Write-Step "     Doppler project setup (aidam / dev)"
doppler setup --project aidam --config dev
Write-OK "Doppler configured"

# 5. npm install
Write-Step "5/6  npm install"
npm install
Write-OK "node_modules ready"

# 6. Register aidam function in PowerShell profile
Write-Step "6/6  Register aidam dev command"
$profileDir = Split-Path $PROFILE
if (-not (Test-Path $profileDir)) {
    New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
}
if (-not (Test-Path $PROFILE)) {
    New-Item -ItemType File -Force -Path $PROFILE | Out-Null
}
$existingProfile = Get-Content $PROFILE -Raw -ErrorAction SilentlyContinue
if ($existingProfile -like "*function aidam*") {
    Write-OK "aidam function already registered"
} else {
    $repoPath = $RepoRoot
    $aliasBlock = @"

# Aiddam dev server (registered by setup.ps1)
function aidam {
    Set-Location "$repoPath"
    doppler run -- npm run dev
}
"@
    Add-Content $PROFILE $aliasBlock
    Write-OK "aidam function registered (open new terminal to use)"
}

# Done
Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host "  Setup complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host "  Start dev (new terminal): aidam" -ForegroundColor Yellow
Write-Host "  Or right now: doppler run -- npm run dev" -ForegroundColor Yellow
Write-Host ""
