// UCRManager Production PM2 Configuration Template
// Copy this file to ecosystem.config.js and fill in the values

module.exports = {
  apps: [{
    // Application name in PM2
    name: 'ucrmanager-prod',

    // Entry point (built application)
    script: 'dist/index.js',

    // Number of instances (1 recommended for now)
    instances: 1,

    // Auto-restart on crash
    autorestart: true,

    // Don't watch files (production)
    watch: false,

    // Restart if memory exceeds 1GB
    max_memory_restart: '1G',

    // Environment variables
    env: {
      // Application environment
      NODE_ENV: 'production',

      // Port to listen on (443 for HTTPS)
      PORT: 443,

      // Database connection string
      // Format: postgresql://username:password@host:port/database
      DATABASE_URL: 'postgresql://postgres:CHANGE_THIS_PASSWORD@localhost:5432/ucrmanager',

      // Session secret (64 random characters)
      // Generate with: node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
      SESSION_SECRET: 'GENERATE_64_CHAR_RANDOM_STRING',

      // Encryption key for ConnectWise/3CX credentials (32-byte base64)
      // Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
      ENCRYPTION_KEY: 'GENERATE_32_BYTE_BASE64_KEY',

      // Optional: Microsoft Graph Integration
      // GRAPH_CLIENT_ID: '',
      // GRAPH_CLIENT_SECRET: '',
      // GRAPH_TENANT_ID: '',

      // Optional: SSL Certificate Paths
      // SSL_CERT_PATH: 'C:\\Certificates\\server.crt',
      // SSL_KEY_PATH: 'C:\\Certificates\\server.key',
    },

    // Logging configuration
    error_file: 'logs/pm2-error.log',
    out_file: 'logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

    // Merge logs from all instances
    merge_logs: true,

    // Time zone
    time: true,
  }],

  // Deployment configuration (optional - for future use)
  deploy: {
    production: {
      // User to connect as
      user: 'Administrator',

      // Server to deploy to
      host: 'PRODUCTION_SERVER_IP',

      // Remote directory
      ref: 'origin/main',
      repo: 'https://github.com/rbowlesUCR/UCRManager.git',
      path: 'C:\\inetpub\\wwwroot\\UCRManager',

      // Post-deploy commands
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
    }
  }
};
