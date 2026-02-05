# ============================================
# MLR Tools - Force Update Script
# ============================================
# This script downloads and installs the latest version of MLR Tools
# from GitHub Releases, even if the application won't start.
#
# IMPORTANT: Place this script in the same folder as mlr-tool.exe
#
# Usage: Right-click > "Run with PowerShell"
# ============================================

# Configuration
$GitHubRepo = "KylianBoss/MLRTools"
$AppName = "MLR Tools"
$ProcessName = "mlr-tool"  # Process name (without .exe)

# Colors for output
$Host.UI.RawUI.BackgroundColor = "Black"
$Host.UI.RawUI.ForegroundColor = "White"
Clear-Host

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   MLR Tools - Force Update Script      " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Function to display errors
function Write-Error-Message {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Function to display success messages
function Write-Success-Message {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

# Function to display info messages
function Write-Info-Message {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Yellow
}

try {
    # Step 1: Determine installation path from script location
    Write-Info-Message "Detecting installation path from script location..."
    $scriptPath = $PSScriptRoot
    
    if ([string]::IsNullOrEmpty($scriptPath)) {
        $scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
    }
    
    Write-Success-Message "Installation path: $scriptPath"
    Write-Host ""
    
    # Verify that MLR Tools.exe exists in this folder
    $appExePath = Join-Path $scriptPath "$AppName.exe"
    if (-not (Test-Path $appExePath)) {
        Write-Error-Message "MLR Tools executable not found in this folder!"
        Write-Host ""
        Write-Host "Expected: $appExePath" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "IMPORTANT: This script must be placed in the same folder as MLR Tools.exe" -ForegroundColor Red
        Write-Host ""
        Write-Host "Press any key to exit..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    
    Write-Success-Message "MLR Tools executable found"
    Write-Host ""
    
    # Step 2: Close the application if it's running
    Write-Info-Message "Checking if $AppName is running..."
    $runningProcess = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
    
    if ($runningProcess) {
        Write-Info-Message "$AppName is running. Closing..."
        Stop-Process -Name $ProcessName -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Write-Success-Message "$AppName closed successfully"
    } else {
        Write-Info-Message "$AppName is not running"
    }
    
    Write-Host ""
    
    # Step 3: Fetch latest release information from GitHub
    Write-Info-Message "Fetching latest version from GitHub..."
    $apiUrl = "https://api.github.com/repos/$GitHubRepo/releases/latest"
    
    try {
        $release = Invoke-RestMethod -Uri $apiUrl -Method Get -Headers @{
            "User-Agent" = "MLRTools-ForceUpdate-Script"
        }
    } catch {
        Write-Error-Message "Unable to contact GitHub: $_"
        Write-Host ""
        Write-Host "Check your internet connection or try again later." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Press any key to exit..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    
    $latestVersion = $release.tag_name
    Write-Success-Message "Latest version available: $latestVersion"
    
    # Find the .zip asset (like the built-in auto-updater)
    $updateAsset = $release.assets | Where-Object { $_.name -match "\.zip$" } | Select-Object -First 1
    
    if (-not $updateAsset) {
        Write-Error-Message "No update package (.zip) found in release $latestVersion"
        Write-Host ""
        Write-Host "Available assets:" -ForegroundColor Yellow
        foreach ($asset in $release.assets) {
            Write-Host "  - $($asset.name)" -ForegroundColor Gray
        }
        Write-Host ""
        Write-Host "Press any key to exit..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    
    $downloadUrl = $updateAsset.browser_download_url
    $downloadName = $updateAsset.name
    $downloadSize = [math]::Round($updateAsset.size / 1MB, 2)
    
    Write-Info-Message "Package: $downloadName ($downloadSize MB)"
    Write-Host ""
    
    # Step 4: Download the package
    $downloadPath = Join-Path $env:TEMP $downloadName
    Write-Info-Message "Downloading..."
    Write-Host "   URL: $downloadUrl" -ForegroundColor Gray
    Write-Host "   Destination: $downloadPath" -ForegroundColor Gray
    
    try {
        # Create a WebClient to show progress
        $webClient = New-Object System.Net.WebClient
        
        # Event handler for progress
        $progressEventHandler = {
            param($sender, $e)
            $percent = [math]::Round($e.ProgressPercentage, 0)
            Write-Progress -Activity "Downloading $downloadName" -Status "$percent% complete" -PercentComplete $percent
        }
        
        # Register event handler
        Register-ObjectEvent -InputObject $webClient -EventName DownloadProgressChanged -Action $progressEventHandler | Out-Null
        
        # Download the file
        $downloadTask = $webClient.DownloadFileTaskAsync($downloadUrl, $downloadPath)
        $downloadTask.Wait()
        
        # Cleanup events
        Unregister-Event -SourceIdentifier *
        Get-Job | Remove-Job -Force
        Write-Progress -Activity "Download" -Completed
        
        $webClient.Dispose()
        
    } catch {
        Write-Error-Message "Error downloading: $_"
        Write-Host ""
        Write-Host "Press any key to exit..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    
    Write-Success-Message "Download complete"
    Write-Host ""
    
    # Step 5: Extract the ZIP
    Write-Info-Message "Extracting package..."
    $extractPath = Join-Path $env:TEMP "MLRTools-Update-Extract"
    
    # Clean extraction folder if it exists
    if (Test-Path $extractPath) {
        Remove-Item -Path $extractPath -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    try {
        Expand-Archive -Path $downloadPath -DestinationPath $extractPath -Force
        Write-Success-Message "Extraction complete"
    } catch {
        Write-Error-Message "Error extracting: $_"
        Write-Host ""
        Write-Host "Press any key to exit..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    Write-Host ""
    
    # Step 6: Find the source folder in the extracted ZIP
    Write-Info-Message "Finding source folder in package..."
    
    # Look for "MLR Tools-win32-x64" folder or similar
    $sourceFolders = Get-ChildItem -Path $extractPath -Directory | Where-Object {
        $_.Name -match "MLR.*Tools" -or $_.Name -match "mlr-tool" -or $_.Name -match "win32-x64"
    }
    
    if ($sourceFolders.Count -eq 0) {
        Write-Error-Message "Source folder not found in package"
        Write-Host ""
        Write-Host "ZIP contents:" -ForegroundColor Yellow
        Get-ChildItem -Path $extractPath | ForEach-Object {
            Write-Host "  - $($_.Name)" -ForegroundColor Gray
        }
        Write-Host ""
        Write-Host "Press any key to exit..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    
    $sourceFolder = $sourceFolders[0].FullName
    Write-Success-Message "Source folder found: $($sourceFolders[0].Name)"
    Write-Host ""
    
    # Step 7: Replace application files
    Write-Info-Message "Replacing application files..."
    Write-Host "   Source: $sourceFolder" -ForegroundColor Gray
    Write-Host "   Destination: $scriptPath" -ForegroundColor Gray
    Write-Host ""
    
    try {
        # Create a backup of current folder (just in case)
        $backupPath = "$scriptPath-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Write-Info-Message "Creating backup: $(Split-Path -Leaf $backupPath)"
        Copy-Item -Path $scriptPath -Destination $backupPath -Recurse -Force -ErrorAction SilentlyContinue
        
        # Copy new files
        Write-Info-Message "Copying new files..."
        Copy-Item -Path "$sourceFolder\*" -Destination $scriptPath -Recurse -Force
        
        Write-Success-Message "Files replaced successfully!"
        Write-Host ""
        Write-Host "A backup was created:" -ForegroundColor Cyan
        Write-Host "  $backupPath" -ForegroundColor Gray
        Write-Host "  (You can delete it if everything works fine)" -ForegroundColor Gray
        
    } catch {
        Write-Error-Message "Error replacing files: $_"
        Write-Host ""
        Write-Host "Backup is available here:" -ForegroundColor Yellow
        Write-Host "  $backupPath" -ForegroundColor White
        Write-Host ""
        Write-Host "Press any key to exit..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    Write-Host ""
    
    # Step 8: Restart the application
    Write-Info-Message "Restarting application..."
    
    try {
        $exePath = Join-Path $scriptPath "$AppName.exe"
        
        if (-not (Test-Path $exePath)) {
            Write-Error-Message "Executable not found: $exePath"
        } else {
            Start-Process -FilePath $exePath
            
            Write-Host ""
            Write-Success-Message "Application restarted!"
            Write-Host ""
            Write-Host "=========================================" -ForegroundColor Green
            Write-Host "   $AppName has been updated!          " -ForegroundColor Green
            Write-Host "=========================================" -ForegroundColor Green
            Write-Host ""
            Write-Info-Message "The application should start in a few moments"
        }
        
    } catch {
        Write-Error-Message "Error restarting: $_"
        Write-Host ""
        Write-Host "You can launch manually from:" -ForegroundColor Yellow
        Write-Host "  $exePath" -ForegroundColor White
    }
    
    # Step 9: Clean up temporary files
    Write-Host ""
    Write-Info-Message "Cleaning up temporary files..."
    
    try {
        if (Test-Path $downloadPath) {
            Remove-Item -Path $downloadPath -Force -ErrorAction SilentlyContinue
        }
        if (Test-Path $extractPath) {
            Remove-Item -Path $extractPath -Recurse -Force -ErrorAction SilentlyContinue
        }
        Write-Success-Message "Temporary files deleted"
        
    } catch {
        Write-Host "   (Some temporary files could not be deleted)" -ForegroundColor Gray
    }
    
} catch {
    Write-Host ""
    Write-Error-Message "An unexpected error occurred:"
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Technical details:" -ForegroundColor Gray
    Write-Host $_.ScriptStackTrace -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
