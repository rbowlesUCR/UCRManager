# UCRManager Production Deployment Script
# Run this script on the production server with Administrator privileges

param(
    [Parameter(Mandatory=$true)]
    [string]$PostgresPassword
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "UCRManager Production Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$DeployDir = "C:\inetpub\wwwroot"
$AppDir = "$DeployDir\UCRManager"
$GitRepo = "https://github.com/rbowlesUCR/UCRManager.git"
$GitBranch = "feature/connectwise-integration"
$DatabaseName = "ucrmanager"
$PostgresUser = "postgres"

# Set PostgreSQL password for commands
$env:PGPASSWORD = $PostgresPassword
$PsqlPath = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
$PgDumpPath = "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"

Write-Host "[1/10] Verifying prerequisites..." -ForegroundColor Yellow

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "  ✓ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Node.js not found! Please install Node.js 18.x or 20.x" -ForegroundColor Red
    exit 1
}

# Check PostgreSQL
if (-not (Test-Path $PsqlPath)) {
    Write-Host "  ✗ PostgreSQL not found at $PsqlPath" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ PostgreSQL found" -ForegroundColor Green

# Check Git
try {
    $gitVersion = git --version
    Write-Host "  ✓ Git: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Git not found! Please install Git" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2/10] Creating deployment directory..." -ForegroundColor Yellow

if (-not (Test-Path $DeployDir)) {
    New-Item -ItemType Directory -Path $DeployDir -Force | Out-Null
    Write-Host "  ✓ Created $DeployDir" -ForegroundColor Green
} else {
    Write-Host "  ✓ Directory exists: $DeployDir" -ForegroundColor Green
}

Write-Host ""
Write-Host "[3/10] Cloning repository..." -ForegroundColor Yellow

if (Test-Path $AppDir) {
    Write-Host "  ! Application directory exists, pulling latest changes..." -ForegroundColor Yellow
    Set-Location $AppDir
    git fetch origin
    git checkout $GitBranch
    git pull origin $GitBranch
    Write-Host "  ✓ Updated to latest code" -ForegroundColor Green
} else {
    Set-Location $DeployDir
    git clone $GitRepo
    Set-Location $AppDir
    git checkout $GitBranch
    Write-Host "  ✓ Repository cloned" -ForegroundColor Green
}

Write-Host ""
Write-Host "[4/10] Creating database..." -ForegroundColor Yellow

# Check if database exists
$dbExists = & $PsqlPath -U $PostgresUser -lqt | Select-String -Pattern "^\s*$DatabaseName\s"

if ($dbExists) {
    Write-Host "  ! Database '$DatabaseName' already exists" -ForegroundColor Yellow
    $response = Read-Host "  Do you want to DROP and recreate it? (yes/no)"
    if ($response -eq "yes") {
        Write-Host "  Dropping existing database..." -ForegroundColor Yellow
        & $PsqlPath -U $PostgresUser -c "DROP DATABASE $DatabaseName;"
        & $PsqlPath -U $PostgresUser -c "CREATE DATABASE $DatabaseName;"
        Write-Host "  ✓ Database recreated" -ForegroundColor Green
    } else {
        Write-Host "  → Using existing database" -ForegroundColor Yellow
    }
} else {
    & $PsqlPath -U $PostgresUser -c "CREATE DATABASE $DatabaseName;"
    Write-Host "  ✓ Database created" -ForegroundColor Green
}

Write-Host ""
Write-Host "[5/10] Applying database schema..." -ForegroundColor Yellow

$schemaFile = "$AppDir\migrations\PRODUCTION_DEPLOYMENT.sql"
if (Test-Path $schemaFile) {
    & $PsqlPath -U $PostgresUser -d $DatabaseName -f $schemaFile
    Write-Host "  ✓ Schema applied" -ForegroundColor Green
} else {
    Write-Host "  ✗ Schema file not found: $schemaFile" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[6/10] Loading country codes..." -ForegroundColor Yellow

$countryCodesFile = "$AppDir\migrations\add_country_codes.sql"
if (Test-Path $countryCodesFile) {
    & $PsqlPath -U $PostgresUser -d $DatabaseName -f $countryCodesFile
    Write-Host "  ✓ Country codes loaded" -ForegroundColor Green
} else {
    Write-Host "  ! Country codes file not found (optional)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[7/10] Installing dependencies..." -ForegroundColor Yellow

Set-Location $AppDir
npm install --production
Write-Host "  ✓ Dependencies installed" -ForegroundColor Green

Write-Host ""
Write-Host "[8/10] Generating secrets..." -ForegroundColor Yellow

$SessionSecret = node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
$EncryptionKey = node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

Write-Host "  ✓ SESSION_SECRET generated" -ForegroundColor Green
Write-Host "  ✓ ENCRYPTION_KEY generated" -ForegroundColor Green

Write-Host ""
Write-Host "[9/10] Creating PM2 configuration..." -ForegroundColor Yellow

$DatabaseUrl = "postgresql://${PostgresUser}:${PostgresPassword}@localhost:5432/${DatabaseName}"

$ecosystemConfig = @"
module.exports = {
  apps: [{
    name: 'ucrmanager-prod',
    script: 'dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 443,
      DATABASE_URL: '$DatabaseUrl',
      SESSION_SECRET: '$SessionSecret',
      ENCRYPTION_KEY: '$EncryptionKey'
    },
    error_file: 'logs/pm2-error.log',
    out_file: 'logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    time: true
  }]
};
"@

$ecosystemConfig | Out-File -FilePath "$AppDir\ecosystem.config.js" -Encoding UTF8
Write-Host "  ✓ PM2 configuration created" -ForegroundColor Green

Write-Host ""
Write-Host "[10/10] Building and starting application..." -ForegroundColor Yellow

# Create logs directory
if (-not (Test-Path "$AppDir\logs")) {
    New-Item -ItemType Directory -Path "$AppDir\logs" -Force | Out-Null
}

# Build application
npm run build
Write-Host "  ✓ Application built" -ForegroundColor Green

# Install PM2 globally if not installed
try {
    pm2 --version | Out-Null
    Write-Host "  ✓ PM2 already installed" -ForegroundColor Green
} catch {
    Write-Host "  Installing PM2..." -ForegroundColor Yellow
    npm install -g pm2
    Write-Host "  ✓ PM2 installed" -ForegroundColor Green
}

# Stop existing instance if running
try {
    pm2 stop ucrmanager-prod 2>$null
    pm2 delete ucrmanager-prod 2>$null
} catch {
    # No existing instance
}

# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Configure startup
Write-Host "  Configuring PM2 to start on boot..." -ForegroundColor Yellow
pm2 startup

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Application Status:" -ForegroundColor Cyan
pm2 status

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Create admin user with this command:" -ForegroundColor White
Write-Host "   node -e `"const bcrypt = require('bcrypt'); bcrypt.hash('CHANGE_ME', 10).then(hash => console.log(\`INSERT INTO admin_users (username, password_hash, is_local_admin, created_at) VALUES ('admin', '\${hash}', true, NOW());\`))`"" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Run the SQL output in PostgreSQL:" -ForegroundColor White
Write-Host "   `$env:PGPASSWORD = '$PostgresPassword'; & `"$PsqlPath`" -U postgres -d ucrmanager -c `"[SQL_FROM_ABOVE]`"" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Open firewall for HTTPS:" -ForegroundColor White
Write-Host "   New-NetFirewallRule -DisplayName 'UCRManager HTTPS' -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Access application at: https://localhost" -ForegroundColor White
Write-Host ""
Write-Host "Logs: pm2 logs ucrmanager-prod" -ForegroundColor Yellow
Write-Host "Status: pm2 status" -ForegroundColor Yellow
Write-Host ""
