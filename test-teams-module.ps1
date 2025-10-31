#!/usr/bin/env pwsh
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

try {
    Write-Output "Testing MicrosoftTeams module installation..."
    
    # Check if module is available
    $module = Get-Module -ListAvailable -Name MicrosoftTeams
    if ($module) {
        Write-Output "SUCCESS: MicrosoftTeams module found"
        Write-Output "Version: $($module.Version)"
        Write-Output "Path: $($module.ModuleBase)"
        
        # Try to import it
        Import-Module MicrosoftTeams -ErrorAction Stop
        Write-Output "SUCCESS: Module imported successfully"
        
        # List some available commands
        $commands = Get-Command -Module MicrosoftTeams | Select-Object -First 5 Name
        Write-Output "Sample commands available:"
        $commands | ForEach-Object { Write-Output "  - $($_.Name)" }
        
        exit 0
    } else {
        Write-Output "ERROR: MicrosoftTeams module not found"
        exit 1
    }
} catch {
    Write-Output "ERROR: $_"
    exit 1
}
