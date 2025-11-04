$env:PGPASSWORD = '4FC4E215649C6EBF3A390BAFE4B2ECD7'

& 'C:\Program Files\PostgreSQL\16\bin\psql.exe' -U postgres -d ucrmanager -f 'C:\inetpub\wwwroot\UCRManager\migrations\add_dual_auth_columns.sql'

Write-Host "Migration completed"
