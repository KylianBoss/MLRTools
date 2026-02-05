# ============================================
# MLR Tools - Force Update Script
# ============================================
# Ce script télécharge et installe la dernière version de MLR Tools
# depuis GitHub Releases, même si l'application ne démarre plus.
#
# Usage: Clic droit > "Exécuter avec PowerShell"
# ============================================

# Configuration
$GitHubRepo = "KylianBoss/MLRTools"
$AppName = "MLR Tools"
$ProcessName = "mlr-tool"  # Nom du processus (sans .exe)

# Couleurs pour l'output
$Host.UI.RawUI.BackgroundColor = "Black"
$Host.UI.RawUI.ForegroundColor = "White"
Clear-Host

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   MLR Tools - Force Update Script      " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Fonction pour afficher les erreurs
function Write-Error-Message {
    param([string]$Message)
    Write-Host "[ERREUR] $Message" -ForegroundColor Red
}

# Fonction pour afficher les succès
function Write-Success-Message {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

# Fonction pour afficher les infos
function Write-Info-Message {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Yellow
}

try {
    # Étape 1: Fermer l'application si elle est en cours d'exécution
    Write-Info-Message "Vérification si $AppName est en cours d'exécution..."
    $runningProcess = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
    
    if ($runningProcess) {
        Write-Info-Message "$AppName est en cours d'exécution. Fermeture en cours..."
        Stop-Process -Name $ProcessName -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Write-Success-Message "$AppName fermé avec succès"
    } else {
        Write-Info-Message "$AppName n'est pas en cours d'exécution"
    }
    
    Write-Host ""
    
    # Étape 2: Récupérer les informations de la dernière release
    Write-Info-Message "Récupération de la dernière version depuis GitHub..."
    $apiUrl = "https://api.github.com/repos/$GitHubRepo/releases/latest"
    
    try {
        $release = Invoke-RestMethod -Uri $apiUrl -Method Get -Headers @{
            "User-Agent" = "MLRTools-ForceUpdate-Script"
        }
    } catch {
        Write-Error-Message "Impossible de contacter GitHub: $_"
        Write-Host ""
        Write-Host "Vérifiez votre connexion internet ou essayez plus tard." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Appuyez sur une touche pour quitter..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    
    $latestVersion = $release.tag_name
    Write-Success-Message "Dernière version disponible: $latestVersion"
    
    # Trouver l'asset .zip (comme l'auto-updater de l'app)
    $updateAsset = $release.assets | Where-Object { $_.name -match "\.zip$" } | Select-Object -First 1
    
    if (-not $updateAsset) {
        Write-Error-Message "Aucun package de mise à jour (.zip) trouvé dans la release $latestVersion"
        Write-Host ""
        Write-Host "Assets disponibles:" -ForegroundColor Yellow
        foreach ($asset in $release.assets) {
            Write-Host "  - $($asset.name)" -ForegroundColor Gray
        }
        Write-Host ""
        Write-Host "Appuyez sur une touche pour quitter..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    
    $downloadUrl = $updateAsset.browser_download_url
    $downloadName = $updateAsset.name
    $downloadSize = [math]::Round($updateAsset.size / 1MB, 2)
    
    Write-Info-Message "Package: $downloadName ($downloadSize MB)"
    Write-Host ""
    
    # Étape 3: Télécharger le package
    $downloadPath = Join-Path $env:TEMP $downloadName
    Write-Info-Message "Téléchargement en cours..."
    Write-Host "   URL: $downloadUrl" -ForegroundColor Gray
    Write-Host "   Destination: $downloadPath" -ForegroundColor Gray
    
    try {
        # Créer un WebClient pour afficher la progression
        $webClient = New-Object System.Net.WebClient
        
        # Event handler pour la progression
        $progressEventHandler = {
            param($sender, $e)
            $percent = [math]::Round($e.ProgressPercentage, 0)
            Write-Progress -Activity "Téléchargement de $installerName" -Status "$percent% complété" -PercentComplete $percent
        }
        
        # Enregistrer l'event handler
        Register-ObjectEvent -InputObject $webClient -EventName DownloadProgressChanged -Action $progressEventHandler | Out-Null
        
        # Télécharger le fichier
        $downloadTask = $webClient.DownloadFileTaskAsync($downloadUrl, $downloadPath)
        $downloadTask.Wait()
        
        # Nettoyer les events
        Unregister-Event -SourceIdentifier *
        Get-Job | Remove-Job -Force
        Write-Progress -Activity "Téléchargement" -Completed
        
        $webClient.Dispose()
        
    } catch {
        Write-Error-Message "Erreur lors du téléchargement: $_"
        Write-Host ""
        Write-Host "Appuyez sur une touche pour quitter..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    
    Write-Success-Message "Téléchargement terminé"
    Write-Host ""
    
    # Étape 4: Extraire le ZIP
    Write-Info-Message "Extraction du package..."
    $extractPath = Join-Path $env:TEMP "MLRTools-Update-Extract"
    
    # Nettoyer le dossier d'extraction s'il existe
    if (Test-Path $extractPath) {
        Remove-Item -Path $extractPath -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    try {
        Expand-Archive -Path $downloadPath -DestinationPath $extractPath -Force
        Write-Success-Message "Extraction terminée"
    } catch {
        Write-Error-Message "Erreur lors de l'extraction: $_"
        Write-Host ""
        Write-Host "Appuyez sur une touche pour quitter..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    Write-Host ""
    
    # Étape 5: Trouver le dossier de l'application installée
    Write-Info-Message "Recherche de l'installation existante..."
    
    # Chercher le processus en cours pour trouver le chemin d'installation
    $appPath = $null
    $runningProcess = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
    
    if ($runningProcess) {
        try {
            $appPath = Split-Path -Parent $runningProcess.Path
            Write-Success-Message "Installation trouvée: $appPath"
        } catch {
            Write-Host "   (Impossible de déterminer le chemin depuis le processus)" -ForegroundColor Gray
        }
    }
    
    # Si pas trouvé via le processus, chercher dans les emplacements standards
    if (-not $appPath) {
        $possiblePaths = @(
            "$env:LOCALAPPDATA\Programs\mlr-tool",
            "$env:LOCALAPPDATA\Programs\MLR Tools",
            "C:\Program Files\MLR Tools",
            "C:\Program Files (x86)\MLR Tools"
        )
        
        foreach ($path in $possiblePaths) {
            if (Test-Path $path) {
                $appPath = $path
                Write-Success-Message "Installation trouvée: $appPath"
                break
            }
        }
    }
    
    if (-not $appPath) {
        Write-Error-Message "Impossible de trouver l'installation de $AppName"
        Write-Host ""
        Write-Host "Chemins vérifiés:" -ForegroundColor Yellow
        $possiblePaths | ForEach-Object {
            Write-Host "  - $_" -ForegroundColor Gray
        }
        Write-Host ""
        Write-Host "Appuyez sur une touche pour quitter..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    Write-Host ""
    
    # Étape 6: Trouver le dossier source dans le ZIP extrait
    Write-Info-Message "Recherche du dossier source dans le package..."
    
    # Chercher le dossier "MLR Tools-win32-x64" ou similaire
    $sourceFolders = Get-ChildItem -Path $extractPath -Directory | Where-Object {
        $_.Name -match "MLR.*Tools" -or $_.Name -match "mlr-tool"
    }
    
    if ($sourceFolders.Count -eq 0) {
        Write-Error-Message "Dossier source non trouvé dans le package"
        Write-Host ""
        Write-Host "Contenu du ZIP:" -ForegroundColor Yellow
        Get-ChildItem -Path $extractPath | ForEach-Object {
            Write-Host "  - $($_.Name)" -ForegroundColor Gray
        }
        Write-Host ""
        Write-Host "Appuyez sur une touche pour quitter..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    
    $sourceFolder = $sourceFolders[0].FullName
    Write-Success-Message "Dossier source trouvé: $($sourceFolders[0].Name)"
    Write-Host ""
    
    # Étape 7: Remplacer les fichiers
    Write-Info-Message "Remplacement des fichiers de l'application..."
    Write-Host "   Source: $sourceFolder" -ForegroundColor Gray
    Write-Host "   Destination: $appPath" -ForegroundColor Gray
    Write-Host ""
    
    try {
        # Créer un backup du dossier actuel (au cas où)
        $backupPath = "$appPath-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Write-Info-Message "Création d'un backup: $(Split-Path -Leaf $backupPath)"
        Copy-Item -Path $appPath -Destination $backupPath -Recurse -Force -ErrorAction SilentlyContinue
        
        # Copier les nouveaux fichiers
        Write-Info-Message "Copie des nouveaux fichiers..."
        Copy-Item -Path "$sourceFolder\*" -Destination $appPath -Recurse -Force
        
        Write-Success-Message "Fichiers remplacés avec succès!"
        Write-Host ""
        Write-Host "Un backup a été créé:" -ForegroundColor Cyan
        Write-Host "  $backupPath" -ForegroundColor Gray
        Write-Host "  (Vous pouvez le supprimer si tout fonctionne bien)" -ForegroundColor Gray
        
    } catch {
        Write-Error-Message "Erreur lors du remplacement: $_"
        Write-Host ""
        Write-Host "Le backup est disponible ici:" -ForegroundColor Yellow
        Write-Host "  $backupPath" -ForegroundColor White
        Write-Host ""
        Write-Host "Appuyez sur une touche pour quitter..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
    Write-Host ""
    
    # Étape 8: Relancer l'application
    Write-Info-Message "Redémarrage de l'application..."
    
    try {
        $exePath = Join-Path $appPath "$ProcessName.exe"
        
        if (-not (Test-Path $exePath)) {
            Write-Error-Message "Exécutable non trouvé: $exePath"
        } else {
            Start-Process -FilePath $exePath
            
            Write-Host ""
            Write-Success-Message "Application redémarrée!"
            Write-Host ""
            Write-Host "=========================================" -ForegroundColor Green
            Write-Host "   $AppName a été mis à jour!" -ForegroundColor Green
            Write-Host "=========================================" -ForegroundColor Green
            Write-Host ""
            Write-Info-Message "L'application devrait démarrer dans quelques instants"
        }
        
    } catch {
        Write-Error-Message "Erreur lors du redémarrage: $_"
        Write-Host ""
        Write-Host "Vous pouvez lancer manuellement depuis:" -ForegroundColor Yellow
        Write-Host "  $exePath" -ForegroundColor White
    }
    
    # Étape 9: Nettoyer les fichiers temporaires
    Write-Host ""
    Write-Info-Message "Nettoyage des fichiers temporaires..."
    
    try {
        if (Test-Path $downloadPath) {
            Remove-Item -Path $downloadPath -Force -ErrorAction SilentlyContinue
        }
        if (Test-Path $extractPath) {
            Remove-Item -Path $extractPath -Recurse -Force -ErrorAction SilentlyContinue
        }
        Write-Success-Message "Fichiers temporaires supprimés"
        
    } catch {
        Write-Host "   (Certains fichiers temporaires n'ont pas pu être supprimés)" -ForegroundColor Gray
    }
    
} catch {
    Write-Host ""
    Write-Error-Message "Une erreur inattendue s'est produite:"
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Détails techniques:" -ForegroundColor Gray
    Write-Host $_.ScriptStackTrace -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "Appuyez sur une touche pour quitter..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
