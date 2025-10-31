# SSL Certificate Setup Guide for UCRManager
**Server:** UCManagerv2 (Windows Server 2025)

---

## 📋 Table of Contents
1. [Azure DNS Configuration](#azure-dns-configuration)
2. [Option A: Let's Encrypt with Win-ACME (Free)](#option-a-lets-encrypt-with-win-acme-free)
3. [Option B: Azure Application Gateway (Premium)](#option-b-azure-application-gateway-premium)
4. [Option C: Custom Domain with SSL](#option-c-custom-domain-with-ssl)
5. [Configure Application for HTTPS](#configure-application-for-https)
6. [Update Azure AD Redirect URIs](#update-azure-ad-redirect-uris)

---

## 🌐 Azure DNS Configuration

### Method 1: Azure Public DNS Name (Free & Easy)

1. **Go to Azure Portal**: https://portal.azure.com
2. Navigate to: **Virtual Machines** → **UCManagerv2**
3. Click on **Public IP address** in the left menu or Overview
4. In Public IP configuration page:
   - Click **Configuration** in the left menu
   - Under **DNS name label (optional)**, enter: `ucrmanager` (or your preferred name)
   - Click **Save**

**Result:** Your VM will be accessible at:
```
ucrmanager.[region].cloudapp.azure.com
```
For example: `ucrmanager.eastus.cloudapp.azure.com`

**Check your region:**
- Look at your VM's location in the Overview page
- Common regions: `eastus`, `eastus2`, `westus`, `westus2`, `centralus`, `northeurope`, `westeurope`

### Method 2: Azure DNS Zone (Custom Domain)

If you have your own domain (e.g., `example.com`):

1. **Create Azure DNS Zone:**
   - Azure Portal → **DNS zones** → **+ Create**
   - Enter your domain name

2. **Update Domain Registrar:**
   - Copy the Azure name servers from the DNS zone
   - Update your domain registrar (GoDaddy, Namecheap, etc.) to use Azure name servers

3. **Create A Record:**
   - In DNS zone → **+ Record set**
   - Name: `ucrmanager` (or `@` for root)
   - Type: A
   - IP address: `20.168.122.70`
   - TTL: 3600

**Result:** Your VM accessible at: `ucrmanager.yourdomain.com`

---

## 🔒 Option A: Let's Encrypt with Win-ACME (Free)

**Win-ACME** is a Windows ACME client that automates Let's Encrypt certificate management.

### Prerequisites
- Azure DNS name configured (e.g., `ucrmanager.eastus.cloudapp.azure.com`)
- Port 443 open in Azure NSG (same as port 5000 instructions)
- Domain resolves to your server IP

### Step 1: Open Port 443 in Azure NSG

1. **Azure Portal** → **Virtual Machines** → **UCManagerv2** → **Networking**
2. Click on **Network Security Group**
3. **Inbound security rules** → **+ Add**
4. Configure:
   ```
   Source: Any
   Source port ranges: *
   Destination: Any
   Destination port ranges: 443
   Protocol: TCP
   Action: Allow
   Priority: 1010
   Name: AllowHTTPS443
   ```
5. Click **Add**

### Step 2: Configure Windows Firewall

```powershell
powershell -Command "New-NetFirewallRule -DisplayName 'UCRManager HTTPS Port 443' -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow"
```

### Step 3: Download Win-ACME

1. Download from: https://github.com/win-acme/win-acme/releases/latest
2. Download: `win-acme.v2.x.x.x.x64.trimmed.zip`
3. Extract to: `C:\win-acme`

### Step 4: Verify DNS Resolution

Before getting certificate, verify DNS works:

```bash
# From server
nslookup ucrmanager.eastus.cloudapp.azure.com

# Should return your IP: 20.168.122.70
```

### Step 5: Run Win-ACME

```powershell
# Open PowerShell as Administrator
cd C:\win-acme
.\wacs.exe
```

Follow the prompts:
1. Choose: **N: Create certificate (default settings)**
2. Choose: **2: Manual input**
3. Enter host: `ucrmanager.eastus.cloudapp.azure.com` (your DNS name)
4. Choose: **1: [http-01] Save verification files on (network) path**
5. Enter path: `C:\inetpub\wwwroot\UCRManager\dist\public`
6. Choose: **5: No additional store steps**
7. Choose: **3: No (additional) installation steps**
8. Confirm and wait for certificate generation

**Certificate Location:**
- Stored in Windows Certificate Store
- Also saved to: `C:\win-acme\[domain]\`
- Includes: `[domain]-chain.pem`, `[domain]-key.pem`

### Step 6: Configure Node.js HTTPS

Update your application to use HTTPS:

**Create file:** `C:\inetpub\wwwroot\UCRManager\server\https-config.ts`

```typescript
import fs from 'fs';
import https from 'https';
import path from 'path';

export function getHttpsOptions() {
  const certPath = 'C:\\win-acme\\[your-domain]';

  if (!fs.existsSync(certPath)) {
    throw new Error('SSL certificates not found. Run Win-ACME first.');
  }

  return {
    key: fs.readFileSync(path.join(certPath, '[domain]-key.pem')),
    cert: fs.readFileSync(path.join(certPath, '[domain]-chain.pem'))
  };
}
```

**Modify:** `server/index.ts` (around line 74)

```typescript
import { getHttpsOptions } from './https-config';

// ... existing code ...

const port = parseInt(process.env.PORT || '443', 10);

// Use HTTPS if certificates are available
let serverToListen;
try {
  const httpsOptions = getHttpsOptions();
  serverToListen = https.createServer(httpsOptions, app);
  console.log('HTTPS enabled');
} catch (error) {
  console.log('HTTPS not available, using HTTP:', error.message);
  serverToListen = server;
}

serverToListen.listen(port, "0.0.0.0", () => {
  log(`serving on port ${port} (${serverToListen instanceof https.Server ? 'HTTPS' : 'HTTP'})`);
});
```

### Step 7: Update Application Configuration

**Edit:** `C:\inetpub\wwwroot\UCRManager\.env`

```env
# Change port to 443
PORT=443

# Change to production for secure cookies
NODE_ENV=production
```

### Step 8: Rebuild and Restart

```bash
cd C:\inetpub\wwwroot\UCRManager
npm run build
pm2 restart ucrmanager
```

### Step 9: Automatic Certificate Renewal

Win-ACME automatically creates a scheduled task for renewal. Verify:

```powershell
powershell -Command "Get-ScheduledTask -TaskName 'win-acme*'"
```

Certificate will auto-renew 30 days before expiration.

---

## 🚀 Option B: Azure Application Gateway (Premium)

**Best for production with high traffic**

### Benefits:
- Built-in SSL termination
- Web Application Firewall (WAF)
- Load balancing
- Auto-scaling

### Cost: ~$125-250/month

### Setup:
1. **Azure Portal** → **Application Gateways** → **+ Create**
2. Configure:
   - **Frontend**: Public IP with DNS name
   - **Backend pool**: Add your VM (UCManagerv2)
   - **HTTP settings**: Port 5000, HTTP protocol
   - **SSL certificate**: Upload or use Azure-managed certificate
   - **Routing rule**: HTTPS (443) → HTTP (5000 to backend)

### Application Configuration:
- Keep app on port 5000 with HTTP
- Application Gateway handles SSL
- No changes to app code needed

---

## 🔐 Option C: Custom Domain with SSL

If you have a purchased domain (e.g., from GoDaddy, Namecheap):

### Step 1: Configure Azure DNS

1. **Azure Portal** → **DNS zones** → **+ Create**
2. Enter your domain: `yourdomain.com`
3. Copy the 4 name servers shown

### Step 2: Update Domain Registrar

1. Login to your domain registrar (GoDaddy, Namecheap, etc.)
2. Find DNS/Name Server settings
3. Replace existing name servers with Azure's 4 name servers
4. Save (propagation takes 24-48 hours)

### Step 3: Create DNS Records

In Azure DNS zone:

**A Record:**
```
Name: @ (or ucrmanager)
Type: A
TTL: 3600
IP: 20.168.122.70
```

**CNAME Record (optional, for www):**
```
Name: www
Type: CNAME
TTL: 3600
Value: yourdomain.com
```

### Step 4: Get SSL Certificate

Follow **Option A** (Win-ACME) steps above, using your domain name instead of Azure's cloudapp.azure.com name.

---

## ⚙️ Configure Application for HTTPS

### Update .env File

```env
# For HTTPS
PORT=443
NODE_ENV=production

# Database URL (unchanged)
DATABASE_URL=postgresql://postgres:4FC4E215649C6EBF3A390BAFE4B2ECD7@localhost:5432/ucrmanager

# Session Secret (unchanged)
SESSION_SECRET=qMLFVOwVd5VXQfIzgfMBZFjfpoQAZ4qbTz++VZJIcpfoHOb6dxbgqh/n4OyOaLN4
```

### Update Operator Config Redirect URI

In admin panel:
- Old: `http://20.168.122.70:5000/api/auth/callback`
- New: `https://ucrmanager.eastus.cloudapp.azure.com/api/auth/callback`

### Rebuild and Restart

```bash
cd C:\inetpub\wwwroot\UCRManager
npm run build
pm2 restart ucrmanager
pm2 save
```

---

## 🔄 Update Azure AD Redirect URIs

After setting up HTTPS, update your Azure AD app registration:

1. **Azure Portal** → **Azure Active Directory** → **App Registrations**
2. Select your operator app
3. Go to **Authentication**
4. Update/Add Redirect URI:
   - Old: `http://20.168.122.70:5000/api/auth/callback`
   - New: `https://ucrmanager.eastus.cloudapp.azure.com/api/auth/callback`
5. Click **Save**

Update in UCRManager admin panel:
- Settings → Operator Azure AD Configuration
- Update Redirect URI field
- Save Configuration

---

## 🧪 Testing HTTPS

### Test SSL Certificate

```bash
# From any computer
curl -I https://ucrmanager.eastus.cloudapp.azure.com

# Should show: HTTP/2 200
```

### Online SSL Test

Visit: https://www.ssllabs.com/ssltest/
Enter: `ucrmanager.eastus.cloudapp.azure.com`

Should receive A or A+ rating.

### Test Application

1. Browse to: `https://ucrmanager.eastus.cloudapp.azure.com`
2. Should show green padlock in browser
3. Login to admin panel
4. Test operator Microsoft login

---

## 🛠️ Troubleshooting

### Certificate Not Working

```bash
# Check certificate validity
powershell -Command "Get-ChildItem -Path Cert:\LocalMachine\My | Select-Object Subject, NotAfter, Thumbprint"

# Check if Win-ACME task exists
powershell -Command "Get-ScheduledTask | Where-Object {$_.TaskName -like '*win-acme*'}"
```

### Port 443 Access Denied

Application must run as Administrator to bind to port 443, or use IIS reverse proxy:

**Option 1: Run PM2 as Administrator**
```powershell
# Stop current PM2
pm2 delete ucrmanager

# Run PowerShell as Administrator
pm2 start dist/index.js --name "ucrmanager" --node-args="--env-file=.env"
pm2 save
```

**Option 2: Use IIS Reverse Proxy**
- Keep app on port 5000
- Configure IIS on port 443 to proxy to localhost:5000
- IIS handles SSL termination

### DNS Not Resolving

```bash
# Test DNS resolution
nslookup ucrmanager.eastus.cloudapp.azure.com

# Should return your IP: 20.168.122.70
```

If not resolving:
- Wait 5-10 minutes for DNS propagation
- Verify DNS name label in Azure is saved
- Check correct region in domain name

### Browser Shows "Not Secure"

- Certificate may not be trusted
- Check certificate CN matches domain name
- Verify certificate is installed correctly
- Clear browser cache and try again

---

## 📊 Quick Reference

### Recommended Setup for Production

1. **DNS**: Azure Public DNS (`ucrmanager.region.cloudapp.azure.com`)
2. **SSL**: Win-ACME with Let's Encrypt (Free, auto-renewing)
3. **Port**: 443 (HTTPS)
4. **NODE_ENV**: production

### Estimated Time
- DNS configuration: 5 minutes
- Win-ACME setup: 15 minutes
- Application update: 10 minutes
- **Total: ~30 minutes**

### Cost
- Azure Public DNS: **FREE**
- Let's Encrypt SSL: **FREE**
- No additional Azure charges

---

## 🔐 Security Best Practices

After HTTPS is enabled:

1. **Force HTTPS Redirect**
   - Add HTTP → HTTPS redirect in application
   - Close port 5000 externally

2. **HSTS Header**
   - Enable Strict-Transport-Security header
   - Prevents downgrade attacks

3. **Update NSG Rules**
   - Remove port 5000 rule from Azure NSG
   - Only allow 443 (HTTPS)

4. **Regular Updates**
   - Win-ACME auto-renews certificates
   - Check scheduled task is running
   - Monitor certificate expiration

---

**Last Updated:** October 31, 2025
**Server:** UCManagerv2 (Windows Server 2025)
**Application:** UCRManager v1.0.0
