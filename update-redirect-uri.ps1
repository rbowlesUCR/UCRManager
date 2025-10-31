$env:PGPASSWORD = '4FC4E215649C6EBF3A390BAFE4B2ECD7'
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ucrmanager -c "UPDATE operator_config SET redirect_uri = 'https://ucrmanager.westus3.cloudapp.azure.com/api/auth/callback';"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d ucrmanager -c "SELECT redirect_uri FROM operator_config;"
