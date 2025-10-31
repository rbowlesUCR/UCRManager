#!/usr/bin/env pwsh
# Install MicrosoftTeams PowerShell Module
# Non-interactive installation script

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
$VerbosePreference = 'Continue'

Write-Host "Setting PSGallery as trusted repository..."
try {
    Set-PSRepository -Name PSGallery -InstallationPolicy Trusted -ErrorAction SilentlyContinue
    Write-Host "✓ PSGallery set as trusted"
} catch {
    Write-Host "Warning: Could not set PSGallery as trusted: $_"
}

Write-Host "`nInstalling MicrosoftTeams module..."
try {
    Install-Module -Name MicrosoftTeams `
        -Repository PSGallery `
        -Force `
        -AllowClobber `
        -Scope CurrentUser `
        -AcceptLicense `
        -SkipPublisherCheck `
        -Verbose
    Write-Host "✓ MicrosoftTeams module installed successfully"
} catch {
    Write-Host "Error installing MicrosoftTeams: $_"
    exit 1
}

Write-Host "`nVerifying installation..."
$module = Get-Module -ListAvailable -Name MicrosoftTeams
if ($module) {
    Write-Host "✓ MicrosoftTeams module found"
    Write-Host "  Version: $($module.Version)"
    Write-Host "  Path: $($module.ModuleBase)"
} else {
    Write-Host "✗ MicrosoftTeams module not found"
    exit 1
}

Write-Host "`n✓ Installation complete!"
exit 0
