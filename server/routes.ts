import type { Express } from "express";
import { createServer, type Server } from "http";
import cookieParser from "cookie-parser";
import { storage } from "./storage";
import {
  getAuthUrl,
  getTokenFromCode,
  createJWT,
  verifyJWT,
  hashPassword,
  comparePassword,
  requireOperatorAuth,
  requireAdminAuth,
  invalidateMsalClientCache,
} from "./auth";
import { getGraphClient, getTeamsVoiceUsers, getVoiceRoutingPolicies, assignPhoneNumberAndPolicy, validateTenantPermissions } from "./graph";
import { insertCustomerTenantSchema, insertAuditLogSchema, insertConfigurationProfileSchema, insertTenantPowershellCredentialsSchema, type InsertOperatorConfig, type InsertCustomerTenant } from "@shared/schema";
import { encrypt, decrypt } from "./encryption";
import {
  testPowerShellConnectivity,
  testTeamsModuleInstallation,
  testCertificateConnection,
  getVoiceRoutingPoliciesCert,
  assignPhoneNumberCert,
  grantVoiceRoutingPolicyCert,
  assignPhoneAndPolicyCert,
  generateTeamsCertificate,
  type PowerShellCertificateCredentials,
  type PowerShellCredentials,
} from "./powershell";
import { powershellSessionManager } from "./powershell-session";

export async function registerRoutes(app: Express): Promise<Server> {
  // Middleware
  app.use(cookieParser());

  // ===== OPERATOR AUTHENTICATION ROUTES =====
  
  // Initiate Azure AD login
  app.get("/api/auth/login", async (req, res) => {
    try {
      const authUrl = await getAuthUrl();
      res.redirect(authUrl);
    } catch (error) {
      console.error("Error generating auth URL:", error);
      
      // Check if error is due to missing operator config
      if (error instanceof Error && error.message.includes("Operator configuration not found")) {
        return res.status(503).send(
          "Operator authentication is currently unavailable. Please contact the administrator to configure Azure AD credentials."
        );
      }
      
      res.status(500).json({ error: "Failed to initiate login" });
    }
  });

  // Handle OAuth callback
  app.get("/api/auth/callback", async (req, res) => {
    try {
      console.log("OAuth callback received. Query params:", req.query);
      const { code, error, error_description } = req.query;

      // Check if Microsoft returned an error
      if (error) {
        console.error("Microsoft OAuth error:", error, error_description);
        return res.status(400).send(`Authentication failed: ${error_description || error}`);
      }

      if (!code || typeof code !== "string") {
        console.error("No authorization code provided in callback");
        return res.status(400).send("Authorization code not provided");
      }

      console.log("Exchanging authorization code for tokens...");
      const tokenResponse = await getTokenFromCode(code);
      console.log("Token exchange successful. User ID:", tokenResponse.uniqueId);
      
      const azureUserId = tokenResponse.uniqueId;
      const email = tokenResponse.account.username;
      const displayName = tokenResponse.account.name;
      const tenantId = tokenResponse.account.tenantId;

      // Check if user exists in operator_users table
      let operatorUser = await storage.getOperatorUser(azureUserId);
      
      // If user doesn't exist, create them with default "user" role
      if (!operatorUser) {
        console.log("Creating new operator user:", email);
        operatorUser = await storage.createOperatorUser({
          azureUserId,
          email,
          displayName,
          role: "user",
          isActive: true,
        });
      } else if (!operatorUser.isActive) {
        // User exists but is inactive
        console.warn("Inactive user attempted login:", email);
        return res.status(403).send("Your account has been deactivated. Please contact the administrator.");
      }

      // Create session with role information
      const session = {
        id: azureUserId,
        email,
        displayName,
        tenantId,
        role: operatorUser.role as "admin" | "user",
        isLocalAdmin: false,
      };

      const token = createJWT(session);

      console.log("[AUTH DEBUG] Setting cookie for user:", email);
      console.log("[AUTH DEBUG] Cookie settings:", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: "lax",
        nodeEnv: process.env.NODE_ENV
      });

      res.cookie("operatorToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: "lax",
        path: "/",
      });

      console.log("[AUTH DEBUG] Cookie set. Token length:", token.length);
      console.log("[AUTH DEBUG] Headers before redirect:", res.getHeaders());
      console.log("[AUTH DEBUG] Redirecting to /dashboard for user:", email);
      res.redirect(303, "/dashboard");
    } catch (error) {
      console.error("Error during OAuth callback:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
      
      // Check if error is due to missing operator config
      if (error instanceof Error && error.message.includes("Operator configuration not found")) {
        return res.status(503).send(
          "Operator authentication is currently unavailable. Please contact the administrator to configure Azure AD credentials."
        );
      }
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).send(`Authentication failed: ${errorMessage}`);
    }
  });

  // Get current operator session (validates role from database)
  app.get("/api/auth/session", async (req, res) => {
    console.log("[AUTH DEBUG] Session check - All cookies:", Object.keys(req.cookies || {}));
    console.log("[AUTH DEBUG] Session check - Has operatorToken:", !!req.cookies?.operatorToken);

    const token = req.cookies?.operatorToken;

    if (!token) {
      console.log("[AUTH DEBUG] No operatorToken cookie found. Cookies received:", req.cookies);
      return res.status(401).json({ error: "Not authenticated" });
    }

    console.log("[AUTH DEBUG] Token found, verifying JWT...");

    const session = verifyJWT(token);
    if (!session) {
      console.log("[AUTH DEBUG] JWT verification failed");
      // Clear invalid cookie
      res.clearCookie("operatorToken");
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    console.log("[AUTH DEBUG] JWT verified. User ID:", session.id, "Email:", session.email);

    // Verify the user's role from the database matches the JWT
    // This prevents privilege escalation via stale or modified JWTs
    const operatorUser = await storage.getOperatorUser(session.id);
    if (!operatorUser) {
      console.log("[AUTH DEBUG] User not found in database. User ID:", session.id);
      // User not found in database - clear cookie
      res.clearCookie("operatorToken");
      return res.status(401).json({ error: "User not found" });
    }

    console.log("[AUTH DEBUG] User found in database. Active:", operatorUser.isActive, "Role:", operatorUser.role);

    if (!operatorUser.isActive) {
      console.log("[AUTH DEBUG] User is inactive");
      // User has been deactivated - clear cookie
      res.clearCookie("operatorToken");
      return res.status(403).json({ error: "Account deactivated" });
    }

    console.log("[AUTH DEBUG] Session validated successfully. Returning session for:", session.email);

    // Return session with current role from database (not JWT)
    res.json({
      ...session,
      role: operatorUser.role, // Use database role, not JWT role
    });
  });

  // Test endpoint to debug routing
  app.get("/api/test-debug", (req, res) => {
    console.log("DEBUG ENDPOINT HIT - This means routes are working!");
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Content-Type', 'application/json');
    res.json({
      message: "Debug endpoint working",
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method
    });
  });

  // Generate WebSocket JWT token for authenticated users
  app.get("/api/auth/ws-token", async (req, res) => {
    const token = req.cookies?.operatorToken;

    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const session = verifyJWT(token);
    if (!session) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    // Generate a short-lived JWT token for WebSocket authentication
    const wsToken = createJWT({
      email: session.email,
      id: session.id,
      role: session.role,
    });

    // Prevent caching of JWT tokens
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json({ token: wsToken });
  });

  // Operator logout
  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("operatorToken");
    res.json({ success: true });
  });

  // ===== ADMIN AUTHENTICATION ROUTES =====

  // Admin login
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      const admin = await storage.getAdminUserByUsername(username);

      if (!admin) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isValid = await comparePassword(password, admin.password);

      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = createJWT({
        id: admin.id,
        username: admin.username,
        role: "admin",
        isLocalAdmin: true,
      });

      res.cookie("adminToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: "lax",
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Get current admin session (validates JWT signature server-side)
  app.get("/api/admin/session", (req, res) => {
    const adminToken = req.cookies?.adminToken;

    if (!adminToken) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // verifyJWT validates the JWT signature using SESSION_SECRET
    // Forged or tampered tokens will fail this verification
    const session = verifyJWT(adminToken);
    if (!session || session.role !== "admin" || !session.isLocalAdmin) {
      // Clear invalid or forged cookie
      res.clearCookie("adminToken");
      return res.status(401).json({ error: "Invalid or expired admin session" });
    }

    res.json(session);
  });

  // Admin logout
  app.post("/api/admin/logout", (req, res) => {
    res.clearCookie("adminToken");
    res.json({ success: true });
  });

  // Change admin password
  app.post("/api/admin/change-password", requireAdminAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current password and new password are required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters long" });
      }

      // Get current admin user (from JWT token)
      const adminSession = req.user as { username: string };
      const admin = await storage.getAdminUserByUsername(adminSession.username);

      if (!admin) {
        return res.status(404).json({ error: "Admin user not found" });
      }

      // Verify current password
      const isValid = await comparePassword(currentPassword, admin.password);
      if (!isValid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update password
      await storage.updateAdminPassword(admin.id, hashedPassword);

      res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing admin password:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // Get operator configuration (admin only)
  app.get("/api/admin/operator-config", requireAdminAuth, async (req, res) => {
    try {
      const config = await storage.getOperatorConfig();
      
      if (!config) {
        return res.status(404).json({ error: "Operator configuration not found" });
      }

      // Never return the actual client secret - mask it
      res.json({
        id: config.id,
        azureTenantId: config.azureTenantId,
        azureClientId: config.azureClientId,
        azureClientSecret: "****************", // Always masked for security
        redirectUri: config.redirectUri,
        updatedAt: config.updatedAt,
      });
    } catch (error) {
      console.error("Error fetching operator config:", error);
      res.status(500).json({ error: "Failed to fetch operator configuration" });
    }
  });

  // Update operator configuration (admin only)
  app.put("/api/admin/operator-config", requireAdminAuth, async (req, res) => {
    try {
      const { azureTenantId, azureClientId, azureClientSecret, redirectUri } = req.body;

      if (!azureTenantId || !azureClientId || !redirectUri) {
        return res.status(400).json({ error: "Azure Tenant ID, Client ID, and Redirect URI are required" });
      }

      // Validate that client secret is not empty if provided
      if (azureClientSecret && azureClientSecret.trim() === "") {
        return res.status(400).json({ error: "Client secret cannot be empty" });
      }

      const updates: Partial<InsertOperatorConfig> = {
        azureTenantId,
        azureClientId,
        redirectUri,
      };

      // Only update client secret if provided and not the masked value
      if (azureClientSecret && azureClientSecret !== "****************") {
        // Encrypt the new client secret
        updates.azureClientSecret = encrypt(azureClientSecret);
      }

      const updatedConfig = await storage.updateOperatorConfig(updates);

      if (!updatedConfig) {
        return res.status(404).json({ error: "Operator configuration not found" });
      }

      // Invalidate cached MSAL client so new config is used
      invalidateMsalClientCache();

      // Return masked secret
      res.json({
        success: true,
        config: {
          id: updatedConfig.id,
          azureTenantId: updatedConfig.azureTenantId,
          azureClientId: updatedConfig.azureClientId,
          azureClientSecret: "****************",
          redirectUri: updatedConfig.redirectUri,
          updatedAt: updatedConfig.updatedAt,
        },
      });
    } catch (error) {
      console.error("Error updating operator config:", error);
      res.status(500).json({ error: "Failed to update operator configuration" });
    }
  });

  // ===== TENANT POWERSHELL CREDENTIALS MANAGEMENT ROUTES (ADMIN ONLY) =====

  // Get tenant PowerShell credentials (admin only)
  app.get("/api/admin/tenants/:tenantId/powershell-credentials", requireAdminAuth, async (req, res) => {
    try {
      const { tenantId } = req.params;
      const credentialsArray = await storage.getTenantPowershellCredentials(tenantId);

      if (!credentialsArray || credentialsArray.length === 0) {
        return res.json({ exists: false, credentials: [] });
      }

      // Return all credentials with certificate info (thumbprint is public, safe to return)
      const credentialsResponse = credentialsArray.map(cred => ({
        id: cred.id,
        appId: cred.appId,
        certificateThumbprint: cred.certificateThumbprint,
        description: cred.description,
        isActive: cred.isActive,
        createdAt: cred.createdAt,
        updatedAt: cred.updatedAt,
      }));

      res.json({
        exists: true,
        credentials: credentialsResponse,
      });
    } catch (error) {
      console.error("Error fetching tenant PowerShell credentials:", error);
      res.status(500).json({ error: "Failed to fetch PowerShell credentials" });
    }
  });

  // Test tenant PowerShell certificate authentication (admin only)
  app.post("/api/admin/tenants/:tenantId/powershell/test-connection", requireAdminAuth, async (req, res) => {
    try {
      const { tenantId } = req.params;

      // Get customer tenant info for tenant ID
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Customer tenant not found" });
      }

      // Get PowerShell credentials
      const credentialsArray = await storage.getTenantPowershellCredentials(tenantId);
      const credentials = credentialsArray.find(cred => cred.isActive);

      if (!credentials) {
        return res.status(404).json({ error: "No active PowerShell credentials configured for this tenant" });
      }

      // Build certificate credentials
      const certCredentials: PowerShellCertificateCredentials = {
        tenantId: tenant.tenantId, // Azure AD tenant ID
        appId: credentials.appId,
        certificateThumbprint: credentials.certificateThumbprint,
      };

      // Test the connection
      const result = await testCertificateConnection(certCredentials);

      res.json({
        success: result.success,
        output: result.output,
        error: result.error,
        exitCode: result.exitCode,
      });
    } catch (error) {
      console.error("Error testing tenant PowerShell connection:", error);
      res.status(500).json({ error: "Failed to test PowerShell connection" });
    }
  });

  // Test basic PowerShell functionality (admin only)
  app.post("/api/admin/powershell/test-basic", requireAdminAuth, async (req, res) => {
    try {
      const result = await testPowerShellConnectivity();

      res.json({
        success: result.success,
        output: result.output,
        error: result.error,
        exitCode: result.exitCode,
      });
    } catch (error) {
      console.error("Error testing PowerShell:", error);
      res.status(500).json({ error: "Failed to test PowerShell" });
    }
  });

  // Test MicrosoftTeams module installation (admin only)
  app.post("/api/admin/powershell/test-teams-module", requireAdminAuth, async (req, res) => {
    try {
      const result = await testTeamsModuleInstallation();

      res.json({
        success: result.success,
        output: result.output,
        error: result.error,
        exitCode: result.exitCode,
      });
    } catch (error) {
      console.error("Error testing Teams module:", error);
      res.status(500).json({ error: "Failed to test Teams module" });
    }
  });

  // Generate PowerShell certificate (admin only)
  app.post("/api/admin/powershell/generate-certificate", requireAdminAuth, async (req, res) => {
    try {
      const { tenantName, validityYears } = req.body;

      if (!tenantName) {
        return res.status(400).json({ error: "tenantName is required" });
      }

      const result = await generateTeamsCertificate(
        tenantName,
        validityYears || 2
      );

      res.json({
        success: result.success,
        certificateThumbprint: result.certificateThumbprint,
        certificatePath: result.certificatePath,
        certificateSubject: result.certificateSubject,
        expirationDate: result.expirationDate,
        output: result.output,
        error: result.error,
      });
    } catch (error) {
      console.error("Error generating certificate:", error);
      res.status(500).json({ error: "Failed to generate certificate" });
    }
  });

  // Download certificate file (admin only)
  app.get("/api/admin/powershell/download-certificate/:filename", requireAdminAuth, async (req, res) => {
    try {
      const { filename } = req.params;

      // Security: Only allow downloading .cer files with TeamsPowerShell prefix
      if (!filename.startsWith("TeamsPowerShell-") || !filename.endsWith(".cer")) {
        return res.status(400).json({ error: "Invalid certificate filename" });
      }

      const filePath = `C:\\inetpub\\wwwroot\\UCRManager\\temp\\${filename}`;

      // Send file for download
      res.download(filePath, filename, (err) => {
        if (err) {
          console.error("Error downloading certificate:", err);
          if (!res.headersSent) {
            res.status(404).json({ error: "Certificate file not found" });
          }
        }
      });
    } catch (error) {
      console.error("Error serving certificate file:", error);
      res.status(500).json({ error: "Failed to download certificate" });
    }
  });

  // Change admin username (local admin only)
  app.put("/api/admin/username", async (req, res) => {
    try {
      // Check for adminToken specifically (not operatorToken)
      const adminToken = req.cookies?.adminToken;
      
      if (!adminToken) {
        return res.status(401).json({ error: "Unauthorized - Local admin authentication required" });
      }

      const payload = verifyJWT(adminToken);
      if (!payload || payload.role !== "admin" || !payload.isLocalAdmin) {
        return res.status(401).json({ error: "Unauthorized - Local admin authentication required" });
      }

      req.user = payload;

      const { newUsername } = req.body;

      if (!newUsername || newUsername.trim() === "") {
        return res.status(400).json({ error: "New username is required" });
      }

      // Check if username already exists
      const existingUser = await storage.getAdminUserByUsername(newUsername);
      if (existingUser && existingUser.id !== req.user.id) {
        return res.status(400).json({ error: "Username already exists" });
      }

      // Update username
      await storage.updateAdminUsername(req.user.id, newUsername);

      // Create new token with updated username
      const newToken = createJWT({
        id: req.user.id,
        username: newUsername,
        role: "admin",
        isLocalAdmin: true,
      });

      res.cookie("adminToken", newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: "lax",
      });

      res.json({ success: true, message: "Username updated successfully", username: newUsername });
    } catch (error) {
      console.error("Error updating admin username:", error);
      res.status(500).json({ error: "Failed to update username" });
    }
  });

  // ===== OPERATOR USER MANAGEMENT ROUTES (RBAC) =====

  // Get all operator users (admin only)
  app.get("/api/admin/operator-users", requireAdminAuth, async (req, res) => {
    try {
      const users = await storage.getAllOperatorUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching operator users:", error);
      res.status(500).json({ error: "Failed to fetch operator users" });
    }
  });

  // Update operator user role (admin only)
  app.put("/api/admin/operator-users/:id", requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { role, isActive } = req.body;

      if (!role || (role !== "admin" && role !== "user")) {
        return res.status(400).json({ error: "Invalid role. Must be 'admin' or 'user'" });
      }

      const updates: any = { role };
      if (typeof isActive === "boolean") {
        updates.isActive = isActive;
      }

      const updatedUser = await storage.updateOperatorUser(id, updates);

      if (!updatedUser) {
        return res.status(404).json({ error: "Operator user not found" });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating operator user:", error);
      res.status(500).json({ error: "Failed to update operator user" });
    }
  });

  // Delete operator user (admin only)
  app.delete("/api/admin/operator-users/:id", requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteOperatorUser(id);

      if (!success) {
        return res.status(404).json({ error: "Operator user not found" });
      }

      res.json({ success: true, message: "Operator user deleted successfully" });
    } catch (error) {
      console.error("Error deleting operator user:", error);
      res.status(500).json({ error: "Failed to delete operator user" });
    }
  });

  // ===== ADMIN CUSTOMER TENANT MANAGEMENT =====

  // Get all customer tenants including inactive ones (admin only)
  app.get("/api/admin/customer-tenants", requireAdminAuth, async (req, res) => {
    try {
      const tenants = await storage.getAllTenantsIncludingInactive();
      
      // Mask client secrets
      const tenantsWithMaskedSecrets = tenants.map(tenant => ({
        ...tenant,
        appRegistrationSecret: tenant.appRegistrationSecret ? "****************" : null,
      }));
      
      res.json(tenantsWithMaskedSecrets);
    } catch (error) {
      console.error("Error fetching customer tenants:", error);
      res.status(500).json({ error: "Failed to fetch customer tenants" });
    }
  });

  // Create new customer tenant (admin only)
  app.post("/api/admin/customer-tenants", requireAdminAuth, async (req, res) => {
    try {
      const { tenantId, tenantName, appRegistrationId, appRegistrationSecret, isActive } = req.body;

      if (!tenantId || !tenantName) {
        return res.status(400).json({ error: "Tenant ID and name are required" });
      }

      // Check if tenant already exists
      const existingTenant = await storage.getTenantByTenantId(tenantId);
      if (existingTenant) {
        return res.status(409).json({ error: "Tenant with this ID already exists" });
      }

      const tenantData: InsertCustomerTenant = {
        tenantId,
        tenantName,
        appRegistrationId: appRegistrationId || null,
        appRegistrationSecret: appRegistrationSecret ? encrypt(appRegistrationSecret) : null,
        isActive: isActive !== undefined ? isActive : true,
      };

      const newTenant = await storage.createTenant(tenantData);

      // Return with masked secret
      res.json({
        ...newTenant,
        appRegistrationSecret: newTenant.appRegistrationSecret ? "****************" : null,
      });
    } catch (error) {
      console.error("Error creating customer tenant:", error);
      res.status(500).json({ error: "Failed to create customer tenant" });
    }
  });

  // Update customer tenant (admin only)
  app.put("/api/admin/customer-tenants/:id", requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { tenantId, tenantName, appRegistrationId, appRegistrationSecret, isActive } = req.body;

      if (!tenantName) {
        return res.status(400).json({ error: "Tenant name is required" });
      }

      // Validate that client secret is not empty if provided
      if (appRegistrationSecret && appRegistrationSecret.trim() === "") {
        return res.status(400).json({ error: "App registration secret cannot be empty" });
      }

      const updates: Partial<InsertCustomerTenant> = {
        tenantName,
        appRegistrationId: appRegistrationId || null,
        isActive: isActive !== undefined ? isActive : true,
      };

      // Only update tenantId if provided and changed
      if (tenantId) {
        updates.tenantId = tenantId;
      }

      // Only update secret if provided and not the masked value
      if (appRegistrationSecret && appRegistrationSecret !== "****************") {
        updates.appRegistrationSecret = encrypt(appRegistrationSecret);
      }

      const updatedTenant = await storage.updateTenant(id, updates);

      if (!updatedTenant) {
        return res.status(404).json({ error: "Customer tenant not found" });
      }

      // Return with masked secret
      res.json({
        ...updatedTenant,
        appRegistrationSecret: updatedTenant.appRegistrationSecret ? "****************" : null,
      });
    } catch (error) {
      console.error("Error updating customer tenant:", error);
      res.status(500).json({ error: "Failed to update customer tenant" });
    }
  });

  // Delete customer tenant (admin only)
  app.delete("/api/admin/customer-tenants/:id", requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;

      const success = await storage.deleteTenant(id);

      if (success) {
        res.json({ success: true, message: "Customer tenant deleted successfully" });
      } else {
        res.status(404).json({ error: "Customer tenant not found" });
      }
    } catch (error) {
      console.error("Error deleting customer tenant:", error);
      res.status(500).json({ error: "Failed to delete customer tenant" });
    }
  });

  // Validate customer tenant permissions (admin only)
  app.post("/api/admin/customer-tenants/:id/validate", requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;

      const tenant = await storage.getTenant(id);
      if (!tenant) {
        return res.status(404).json({ error: "Customer tenant not found" });
      }

      if (!tenant.appRegistrationId || !tenant.appRegistrationSecret) {
        return res.status(400).json({ 
          error: "Tenant app registration not configured",
          results: [
            {
              permission: "Configuration",
              status: "error",
              message: "App registration ID or secret is missing",
            }
          ]
        });
      }

      // Decrypt the app registration secret
      const decryptedSecret = decrypt(tenant.appRegistrationSecret);

      // Get Graph client
      let graphClient;
      try {
        graphClient = await getGraphClient(
          tenant.tenantId,
          tenant.appRegistrationId,
          decryptedSecret
        );
      } catch (error: any) {
        return res.status(400).json({
          error: "Failed to authenticate with Microsoft Graph",
          results: [
            {
              permission: "Authentication",
              status: "error",
              message: error.message || "Could not acquire access token",
            }
          ]
        });
      }

      // Validate permissions
      const results = await validateTenantPermissions(graphClient);
      
      res.json({ results });
    } catch (error: any) {
      console.error("Error validating customer tenant:", error);
      res.status(500).json({ error: "Failed to validate customer tenant" });
    }
  });

  // ===== ADMIN AUDIT LOG ROUTES =====

  // Get all audit logs (admin only)
  app.get("/api/admin/audit-logs", requireAdminAuth, async (req, res) => {
    try {
      const logs = await storage.getAllAuditLogs();
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // ===== TENANT MANAGEMENT ROUTES =====

  // Get all customer tenants
  app.get("/api/tenants", requireOperatorAuth, async (req, res) => {
    try {
      const tenants = await storage.getAllTenants();
      res.json(tenants);
    } catch (error) {
      console.error("Error fetching tenants:", error);
      res.status(500).json({ error: "Failed to fetch tenants" });
    }
  });

  // Create new customer tenant
  app.post("/api/tenants", requireOperatorAuth, async (req, res) => {
    try {
      const result = insertCustomerTenantSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({ error: "Invalid tenant data", details: result.error });
      }

      // Check if tenant already exists
      const existing = await storage.getTenantByTenantId(result.data.tenantId);
      if (existing) {
        return res.status(409).json({ error: "Tenant already exists" });
      }

      // Encrypt app registration secret if provided
      const tenantData = {
        ...result.data,
        appRegistrationSecret: result.data.appRegistrationSecret
          ? encrypt(result.data.appRegistrationSecret)
          : undefined,
      };

      const tenant = await storage.createTenant(tenantData);
      res.status(201).json(tenant);
    } catch (error) {
      console.error("Error creating tenant:", error);
      res.status(500).json({ error: "Failed to create tenant" });
    }
  });

  // ===== CONFIGURATION PROFILE ROUTES =====

  // Get all profiles for a tenant
  app.get("/api/profiles", requireOperatorAuth, async (req, res) => {
    try {
      const { tenantId } = req.query;

      if (!tenantId || typeof tenantId !== "string") {
        return res.status(400).json({ error: "Tenant ID is required" });
      }

      const profiles = await storage.getProfilesByTenant(tenantId);
      res.json(profiles);
    } catch (error) {
      console.error("Error fetching profiles:", error);
      res.status(500).json({ error: "Failed to fetch profiles" });
    }
  });

  // Create new configuration profile
  app.post("/api/profiles", requireOperatorAuth, async (req, res) => {
    try {
      const result = insertConfigurationProfileSchema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({ error: "Invalid profile data", details: result.error });
      }

      // Verify tenant exists
      const tenant = await storage.getTenant(result.data.tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      const profile = await storage.createProfile(result.data);
      res.status(201).json(profile);
    } catch (error) {
      console.error("Error creating profile:", error);
      res.status(500).json({ error: "Failed to create profile" });
    }
  });

  // Update configuration profile
  app.patch("/api/profiles/:id", requireOperatorAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Get existing profile to verify ownership
      const existingProfile = await storage.getProfile(id);
      if (!existingProfile) {
        return res.status(404).json({ error: "Profile not found" });
      }

      // Prevent tenant reassignment
      if (updates.tenantId && updates.tenantId !== existingProfile.tenantId) {
        return res.status(403).json({ error: "Cannot change tenant for existing profile" });
      }

      // Validate allowed updates
      const allowedFields = ['profileName', 'phoneNumberPrefix', 'defaultRoutingPolicy', 'description'];
      const sanitizedUpdates: any = {};
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          sanitizedUpdates[field] = updates[field];
        }
      }

      // Validate phone prefix if provided
      if (sanitizedUpdates.phoneNumberPrefix && !sanitizedUpdates.phoneNumberPrefix.startsWith("tel:+")) {
        return res.status(400).json({ error: "Phone number prefix must start with 'tel:+'" });
      }

      // Validate required fields are not empty
      if (sanitizedUpdates.profileName !== undefined && !sanitizedUpdates.profileName) {
        return res.status(400).json({ error: "Profile name is required" });
      }
      if (sanitizedUpdates.phoneNumberPrefix !== undefined && !sanitizedUpdates.phoneNumberPrefix) {
        return res.status(400).json({ error: "Phone number prefix is required" });
      }
      if (sanitizedUpdates.defaultRoutingPolicy !== undefined && !sanitizedUpdates.defaultRoutingPolicy) {
        return res.status(400).json({ error: "Default routing policy is required" });
      }

      const profile = await storage.updateProfile(id, sanitizedUpdates);
      res.json(profile);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Delete configuration profile
  app.delete("/api/profiles/:id", requireOperatorAuth, async (req, res) => {
    try {
      const { id } = req.params;

      // Verify profile exists before deleting
      const existingProfile = await storage.getProfile(id);
      if (!existingProfile) {
        return res.status(404).json({ error: "Profile not found" });
      }

      const success = await storage.deleteProfile(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting profile:", error);
      res.status(500).json({ error: "Failed to delete profile" });
    }
  });

  // ===== TEAMS VOICE MANAGEMENT ROUTES =====

  // Get Teams voice-enabled users for a tenant
  app.get("/api/teams/users", requireOperatorAuth, async (req, res) => {
    try {
      const { tenantId } = req.query;

      if (!tenantId || typeof tenantId !== "string") {
        return res.status(400).json({ error: "Tenant ID is required" });
      }

      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      if (!tenant.appRegistrationId || !tenant.appRegistrationSecret) {
        return res.status(400).json({ error: "Tenant app registration not configured" });
      }

      // Decrypt the app registration secret
      const decryptedSecret = decrypt(tenant.appRegistrationSecret);

      const graphClient = await getGraphClient(
        tenant.tenantId,
        tenant.appRegistrationId,
        decryptedSecret
      );

      const users = await getTeamsVoiceUsers(graphClient);
      res.json(users);
    } catch (error) {
      console.error("Error fetching Teams users:", error);
      res.status(500).json({ error: "Failed to fetch Teams users" });
    }
  });

  // Get voice routing policies for a tenant
  app.get("/api/teams/routing-policies", requireOperatorAuth, async (req, res) => {
    try {
      const { tenantId } = req.query;

      if (!tenantId || typeof tenantId !== "string") {
        return res.status(400).json({ error: "Tenant ID is required" });
      }

      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      if (!tenant.appRegistrationId || !tenant.appRegistrationSecret) {
        return res.status(400).json({ error: "Tenant app registration not configured" });
      }

      // Decrypt the app registration secret
      const decryptedSecret = decrypt(tenant.appRegistrationSecret);

      const graphClient = await getGraphClient(
        tenant.tenantId,
        tenant.appRegistrationId,
        decryptedSecret
      );

      const policies = await getVoiceRoutingPolicies(graphClient);
      res.json(policies);
    } catch (error) {
      console.error("Error fetching routing policies:", error);
      res.status(500).json({ error: "Failed to fetch routing policies" });
    }
  });

  // Helper function to validate phone number format
  function validatePhoneNumber(number: string): { isValid: boolean; message: string } {
    if (!number) {
      return { isValid: false, message: "Phone number is required" };
    }

    // Check if it starts with tel:
    if (!number.startsWith("tel:")) {
      return { isValid: false, message: "Must start with 'tel:'" };
    }

    // Extract the number part after tel:
    const numberPart = number.substring(4);

    // Check if it starts with +
    if (!numberPart.startsWith("+")) {
      return { isValid: false, message: "Number must start with + after tel:" };
    }

    // Check if the rest contains only digits (E.164 allows 1-15 digits after +)
    const digitsOnly = numberPart.substring(1);
    if (!/^\d{1,15}$/.test(digitsOnly)) {
      return { isValid: false, message: "Must contain 1-15 digits (E.164 format)" };
    }

    // Typically need at least 7 digits for a valid phone number
    if (digitsOnly.length < 7) {
      return { isValid: false, message: "Must contain at least 7 digits" };
    }

    return { isValid: true, message: "Valid" };
  }

  // Bulk assign phone numbers and routing policies
  app.post("/api/teams/bulk-assign-voice", requireOperatorAuth, async (req, res) => {
    try {
      const { tenantId, assignments } = req.body;

      if (!tenantId || !assignments || !Array.isArray(assignments)) {
        return res.status(400).json({ error: "Tenant ID and assignments array are required" });
      }

      // Validate all phone numbers upfront
      const validationResults = assignments.map(a => ({
        userId: a.userId,
        userName: a.userName,
        validation: validatePhoneNumber(a.phoneNumber),
      }));

      const invalidAssignments = validationResults.filter(r => !r.validation.isValid);
      if (invalidAssignments.length > 0) {
        // Return validation errors for invalid assignments
        const results = validationResults.map(r => ({
          userId: r.userId,
          userName: r.userName,
          success: r.validation.isValid,
          error: r.validation.isValid ? undefined : r.validation.message,
        }));
        return res.json({ results });
      }

      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      if (!tenant.appRegistrationId || !tenant.appRegistrationSecret) {
        return res.status(400).json({ error: "Tenant app registration not configured" });
      }

      // Decrypt the app registration secret
      const decryptedSecret = decrypt(tenant.appRegistrationSecret);

      const graphClient = await getGraphClient(
        tenant.tenantId,
        tenant.appRegistrationId,
        decryptedSecret
      );

      // Fetch all user details upfront to avoid repeated API calls
      const userDetailsMap = new Map();
      for (const assignment of assignments) {
        try {
          const user = await graphClient.api(`/users/${assignment.userId}`).get();
          userDetailsMap.set(assignment.userId, user);
        } catch (error) {
          console.error(`Failed to fetch user ${assignment.userId}:`, error);
          // Continue - we'll use fallback data from assignment
        }
      }

      // Process each assignment
      const results = [];
      for (const assignment of assignments) {
        const user = userDetailsMap.get(assignment.userId);
        const userUpn = user?.userPrincipalName || assignment.userId;
        const userName = user?.displayName || assignment.userName;

        try {
          if (!user) {
            throw new Error("User not found or inaccessible");
          }

          // Capture previous values
          const previousPhoneNumber = user.businessPhones?.[0] || user.mobilePhone || null;
          let previousRoutingPolicy = null;
          try {
            const voicePolicy = await graphClient.api(`/users/${assignment.userId}/onlinevoiceroutingpolicy`).get();
            previousRoutingPolicy = voicePolicy?.name || null;
          } catch {
            // Voice policy may not be available
          }

          // Assign phone number and policy
          await assignPhoneNumberAndPolicy(
            graphClient,
            assignment.userId,
            assignment.phoneNumber,
            assignment.routingPolicy
          );

          // Create success audit log with previous values for rollback
          await storage.createAuditLog({
            operatorEmail: req.user.email,
            operatorName: req.user.displayName,
            tenantId: tenant.tenantId,
            tenantName: tenant.tenantName,
            targetUserUpn: userUpn,
            targetUserName: userName,
            targetUserId: assignment.userId,
            changeType: "bulk_voice_assignment",
            changeDescription: `Bulk assigned phone number ${assignment.phoneNumber} and routing policy ${assignment.routingPolicy}`,
            phoneNumber: assignment.phoneNumber,
            routingPolicy: assignment.routingPolicy,
            previousPhoneNumber,
            previousRoutingPolicy,
            status: "success",
          });

          results.push({
            userId: assignment.userId,
            userName: assignment.userName,
            success: true,
          });
        } catch (error: any) {
          console.error(`Error assigning voice config for user ${assignment.userId}:`, error);

          // Create failure audit log
          try {
            await storage.createAuditLog({
              operatorEmail: req.user.email,
              operatorName: req.user.displayName,
              tenantId: tenant.tenantId,
              tenantName: tenant.tenantName,
              targetUserUpn: userUpn,
              targetUserName: userName,
              changeType: "bulk_voice_assignment",
              changeDescription: `Failed to assign phone number ${assignment.phoneNumber} and routing policy ${assignment.routingPolicy}`,
              phoneNumber: assignment.phoneNumber,
              routingPolicy: assignment.routingPolicy,
              status: "failed",
              errorMessage: error.message,
            });
          } catch (auditError) {
            console.error("Error creating failure audit log:", auditError);
          }

          results.push({
            userId: assignment.userId,
            userName: assignment.userName,
            success: false,
            error: error.message || "Assignment failed",
          });
        }
      }

      res.json({ results });
    } catch (error) {
      console.error("Error in bulk voice assignment:", error);
      res.status(500).json({ error: "Bulk assignment failed" });
    }
  });

  // Assign phone number and routing policy via PowerShell
  app.post("/api/teams/assign-voice", requireOperatorAuth, async (req, res) => {
    let sessionId: string | null = null;

    try {
      const { tenantId, userId, phoneNumber, routingPolicy } = req.body;

      if (!tenantId || !userId || !phoneNumber || !routingPolicy) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      // Check for PowerShell credentials (certificate-based auth)
      const psCredentialsList = await storage.getTenantPowershellCredentials(tenantId);
      if (!psCredentialsList || psCredentialsList.length === 0) {
        return res.status(400).json({
          error: "PowerShell credentials not configured for this tenant. Phone number assignment requires PowerShell."
        });
      }

      // Use the first (primary) credential
      const psCredentials = psCredentialsList[0];
      console.log(`[Assignment] Using PowerShell credentials ID: ${psCredentials.id}`);

      // Decrypt the app registration secret for Graph API (used for getting user info)
      if (!tenant.appRegistrationId || !tenant.appRegistrationSecret) {
        return res.status(400).json({ error: "Tenant app registration not configured" });
      }

      const decryptedSecret = decrypt(tenant.appRegistrationSecret);
      const graphClient = await getGraphClient(
        tenant.tenantId,
        tenant.appRegistrationId,
        decryptedSecret
      );

      // Get user details for audit log
      const user = await graphClient.api(`/users/${userId}`).get();
      const userPrincipalName = user.userPrincipalName;

      console.log(`[Assignment] Creating PowerShell session for ${userPrincipalName}`);

      // Create a PowerShell session for this assignment
      // Note: tenant.tenantId is the Azure AD tenant ID, tenantId (param) is our internal ID
      sessionId = await powershellSessionManager.createSessionWithCertificate(
        tenantId,
        req.user.email,
        {
          tenantId: tenant.tenantId, // Azure AD tenant ID from customer_tenants table
          appId: psCredentials.appId,
          certificateThumbprint: psCredentials.certificateThumbprint
        }
      );

      console.log(`[Assignment] PowerShell session created: ${sessionId}`);

      // Wait for connection (max 30 seconds)
      const session = powershellSessionManager.getSession(sessionId);
      if (!session) {
        throw new Error("Failed to create PowerShell session");
      }

      console.log(`[Assignment] Waiting for PowerShell to connect. Current state: ${session.state}`);

      // Wait for the session to connect
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.log(`[Assignment] PowerShell connection timeout. Final state: ${session.state}`);
          reject(new Error("PowerShell connection timeout (30 seconds)"));
        }, 30000);

        let checkCount = 0;
        const checkConnection = () => {
          checkCount++;
          if (checkCount % 10 === 0) {
            console.log(`[Assignment] Still waiting for connection... State: ${session.state} (${checkCount * 0.5}s elapsed)`);
          }

          if (session.state === "connected") {
            console.log(`[Assignment] PowerShell connected after ${checkCount * 0.5}s`);
            clearTimeout(timeout);
            resolve();
          } else if (session.state === "error") {
            console.log(`[Assignment] PowerShell connection error after ${checkCount * 0.5}s`);
            clearTimeout(timeout);
            reject(new Error("PowerShell connection failed"));
          } else {
            setTimeout(checkConnection, 500);
          }
        };

        checkConnection();
      });

      console.log(`[Assignment] PowerShell connected successfully, sending assignment command for ${userPrincipalName}`);
      console.log(`[Assignment] Phone: ${phoneNumber}, Policy: ${routingPolicy}`);

      // Capture output from the assignment - aggregate into lines
      let assignmentOutput: string[] = [];
      let assignmentError: string | null = null;
      let outputBuffer = "";

      const outputHandler = ({ output }: { output: string }) => {
        outputBuffer += output;

        // Check for complete lines (ending with newline)
        const lines = outputBuffer.split(/\r?\n/);

        // Keep the last incomplete line in the buffer
        outputBuffer = lines.pop() || "";

        // Process complete lines
        for (const line of lines) {
          if (line.trim()) {
            console.log(`[Assignment] PS: ${line}`);
            assignmentOutput.push(line);
          }
        }
      };

      const errorHandler = ({ error }: { error: string }) => {
        console.log(`[Assignment] PS Error: ${error}`);
        assignmentError = error;
      };

      session.emitter.on("output", outputHandler);
      session.emitter.on("error", errorHandler);

      // Assign phone number and policy using PowerShell
      console.log(`[Assignment] Sending assignment command to PowerShell...`);
      const success = powershellSessionManager.assignPhoneNumberAndPolicy(
        sessionId,
        userPrincipalName,
        phoneNumber,
        routingPolicy
      );

      if (!success) {
        throw new Error("Failed to send assignment command to PowerShell");
      }

      console.log(`[Assignment] Command sent, waiting for PowerShell to complete...`);

      // Wait for the command to complete (increased to 10 seconds)
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Remove event listeners
      session.emitter.off("output", outputHandler);
      session.emitter.off("error", errorHandler);

      // Flush any remaining buffer
      if (outputBuffer.trim()) {
        console.log(`[Assignment] PS: ${outputBuffer}`);
        assignmentOutput.push(outputBuffer);
      }

      console.log(`[Assignment] Assignment process completed for ${userPrincipalName}`);
      console.log(`[Assignment] Captured ${assignmentOutput.length} output lines`);

      // Check output for success/failure
      const hasPhoneSuccess = assignmentOutput.some(line => line.includes("SUCCESS: Phone number assigned"));
      const hasPolicySuccess = assignmentOutput.some(line => line.includes("SUCCESS: Voice routing policy assigned"));
      const hasError = assignmentError || assignmentOutput.some(line => line.includes("ERROR:"));

      if (hasError) {
        const errorLine = assignmentOutput.find(line => line.includes("ERROR:"));
        const errorMsg = errorLine || assignmentError || "Assignment failed";
        console.log(`[Assignment] FAILED: ${errorMsg}`);
        throw new Error(`PowerShell assignment failed: ${errorMsg}`);
      }

      if (!hasPhoneSuccess || !hasPolicySuccess) {
        console.log(`[Assignment] INCOMPLETE: Phone success: ${hasPhoneSuccess}, Policy success: ${hasPolicySuccess}`);
        throw new Error(`Assignment incomplete - Phone: ${hasPhoneSuccess}, Policy: ${hasPolicySuccess}`);
      }

      console.log(`[Assignment] SUCCESS: Both phone and policy assigned successfully`);

      // Close the temporary PowerShell session
      if (sessionId) {
        powershellSessionManager.closeSession(sessionId);
        sessionId = null;
      }

      // Create audit log
      const auditLog = await storage.createAuditLog({
        operatorEmail: req.user.email,
        operatorName: req.user.displayName,
        tenantId: tenant.tenantId,
        tenantName: tenant.tenantName,
        targetUserUpn: user.userPrincipalName,
        targetUserName: user.displayName,
        targetUserId: userId,
        changeType: "voice_configuration_updated",
        changeDescription: `Assigned phone number ${phoneNumber} and routing policy ${routingPolicy} via PowerShell`,
        phoneNumber,
        routingPolicy,
        status: "success",
      });

      res.json({ success: true, auditLog });
    } catch (error) {
      console.error("Error assigning voice configuration:", error);

      // Clean up PowerShell session on error
      if (sessionId) {
        try {
          powershellSessionManager.closeSession(sessionId);
        } catch (cleanupError) {
          console.error("Error cleaning up PowerShell session:", cleanupError);
        }
      }

      // Create failure audit log
      try {
        const { tenantId, userId, phoneNumber, routingPolicy } = req.body;
        const tenant = await storage.getTenant(tenantId);

        if (tenant) {
          await storage.createAuditLog({
            operatorEmail: req.user.email,
            operatorName: req.user.displayName,
            tenantId: tenant.tenantId,
            tenantName: tenant.tenantName,
            targetUserUpn: userId,
            targetUserName: "Unknown",
            changeType: "voice_configuration_failed",
            changeDescription: `Failed to assign phone number ${phoneNumber} and routing policy ${routingPolicy}`,
            phoneNumber,
            routingPolicy,
            status: "failed",
            errorMessage: error instanceof Error ? error.message : "Unknown error",
          });
        }
      } catch (auditError) {
        console.error("Error creating failure audit log:", auditError);
      }

      res.status(500).json({ error: "Failed to assign voice configuration" });
    }
  });

  // ===== POWERSHELL-BASED TEAMS OPERATIONS =====

  // Assign phone number using PowerShell certificate auth (operator auth required)
  app.post("/api/powershell/assign-phone", requireOperatorAuth, async (req, res) => {
    try {
      const { tenantId, userPrincipalName, phoneNumber, locationId } = req.body;

      if (!tenantId || !userPrincipalName || !phoneNumber) {
        return res.status(400).json({ error: "Missing required fields: tenantId, userPrincipalName, phoneNumber" });
      }

      // Get customer tenant
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      // Get tenant-specific PowerShell certificate credentials
      const credentialsArray = await storage.getTenantPowershellCredentials(tenantId);
      const psCredentials = credentialsArray.find(cred => cred.isActive);

      if (!psCredentials) {
        return res.status(404).json({ error: "PowerShell credentials not configured for this tenant. Please contact administrator." });
      }

      // Build certificate credentials
      const certCredentials: PowerShellCertificateCredentials = {
        tenantId: tenant.tenantId, // Azure AD tenant ID
        appId: psCredentials.appId,
        certificateThumbprint: psCredentials.certificateThumbprint,
      };

      // Execute PowerShell command to assign phone number
      const result = await assignPhoneNumberCert(certCredentials, userPrincipalName, phoneNumber, locationId);

      if (result.success) {
        // Create success audit log
        await storage.createAuditLog({
          operatorEmail: req.user.email,
          operatorName: req.user.displayName,
          tenantId: tenant.tenantId,
          tenantName: tenant.tenantName,
          targetUserUpn: userPrincipalName,
          targetUserName: userPrincipalName, // We don't have display name in this context
          changeType: "phone_number_assigned_powershell",
          changeDescription: `Assigned phone number ${phoneNumber} using PowerShell`,
          phoneNumber,
          status: "success",
        });

        res.json({
          success: true,
          message: `Phone number ${phoneNumber} successfully assigned to ${userPrincipalName}`,
          output: result.output,
        });
      } else {
        // Create failure audit log
        await storage.createAuditLog({
          operatorEmail: req.user.email,
          operatorName: req.user.displayName,
          tenantId: tenant.tenantId,
          tenantName: tenant.tenantName,
          targetUserUpn: userPrincipalName,
          targetUserName: userPrincipalName,
          changeType: "phone_number_assignment_failed_powershell",
          changeDescription: `Failed to assign phone number ${phoneNumber} using PowerShell`,
          phoneNumber,
          status: "failed",
          errorMessage: result.error,
        });

        res.status(500).json({
          success: false,
          error: result.error || "Failed to assign phone number via PowerShell",
          output: result.output,
        });
      }
    } catch (error) {
      console.error("Error in PowerShell phone assignment:", error);
      res.status(500).json({ error: "Failed to assign phone number via PowerShell" });
    }
  });

  // Get voice routing policies using PowerShell certificate auth (operator auth required)
  app.post("/api/powershell/get-policies", requireOperatorAuth, async (req, res) => {
    try {
      const { tenantId } = req.body;

      if (!tenantId) {
        return res.status(400).json({ error: "Missing required field: tenantId" });
      }

      // Get customer tenant
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      // Get tenant-specific PowerShell certificate credentials
      const credentialsArray = await storage.getTenantPowershellCredentials(tenantId);
      const psCredentials = credentialsArray.find(cred => cred.isActive);

      if (!psCredentials) {
        return res.status(404).json({ error: "PowerShell credentials not configured for this tenant. Please contact administrator." });
      }

      // Build certificate credentials
      const certCredentials: PowerShellCertificateCredentials = {
        tenantId: tenant.tenantId, // Azure AD tenant ID
        appId: psCredentials.appId,
        certificateThumbprint: psCredentials.certificateThumbprint,
      };

      // Execute PowerShell command to get policies
      const result = await getVoiceRoutingPoliciesCert(certCredentials);

      if (result.success) {
        try {
          // Try to parse JSON output from PowerShell
          const policies = JSON.parse(result.output);
          res.json({
            success: true,
            policies,
          });
        } catch (parseError) {
          // If JSON parsing fails, return raw output
          res.json({
            success: true,
            rawOutput: result.output,
          });
        }
      } else {
        res.status(500).json({
          success: false,
          error: result.error || "Failed to get voice routing policies via PowerShell",
          output: result.output,
        });
      }
    } catch (error) {
      console.error("Error getting policies via PowerShell:", error);
      res.status(500).json({ error: "Failed to get voice routing policies via PowerShell" });
    }
  });

  // Assign voice routing policy using PowerShell certificate auth (operator auth required)
  app.post("/api/powershell/assign-policy", requireOperatorAuth, async (req, res) => {
    try {
      const { tenantId, userPrincipalName, policyName } = req.body;

      if (!tenantId || !userPrincipalName || !policyName) {
        return res.status(400).json({ error: "Missing required fields: tenantId, userPrincipalName, policyName" });
      }

      // Get customer tenant
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      // Get tenant-specific PowerShell certificate credentials
      const credentialsArray = await storage.getTenantPowershellCredentials(tenantId);
      const psCredentials = credentialsArray.find(cred => cred.isActive);

      if (!psCredentials) {
        return res.status(404).json({ error: "PowerShell credentials not configured for this tenant. Please contact administrator." });
      }

      // Build certificate credentials
      const certCredentials: PowerShellCertificateCredentials = {
        tenantId: tenant.tenantId, // Azure AD tenant ID
        appId: psCredentials.appId,
        certificateThumbprint: psCredentials.certificateThumbprint,
      };

      // Execute PowerShell command to assign policy
      const result = await grantVoiceRoutingPolicyCert(certCredentials, userPrincipalName, policyName);

      if (result.success) {
        // Create success audit log
        await storage.createAuditLog({
          operatorEmail: req.user.email,
          operatorName: req.user.displayName,
          tenantId: tenant.tenantId,
          tenantName: tenant.tenantName,
          targetUserUpn: userPrincipalName,
          targetUserName: userPrincipalName,
          changeType: "routing_policy_assigned_powershell",
          changeDescription: `Assigned voice routing policy ${policyName} using PowerShell`,
          routingPolicy: policyName,
          status: "success",
        });

        res.json({
          success: true,
          message: `Voice routing policy ${policyName} successfully assigned to ${userPrincipalName}`,
          output: result.output,
        });
      } else {
        // Create failure audit log
        await storage.createAuditLog({
          operatorEmail: req.user.email,
          operatorName: req.user.displayName,
          tenantId: tenant.tenantId,
          tenantName: tenant.tenantName,
          targetUserUpn: userPrincipalName,
          targetUserName: userPrincipalName,
          changeType: "routing_policy_assignment_failed_powershell",
          changeDescription: `Failed to assign voice routing policy ${policyName} using PowerShell`,
          routingPolicy: policyName,
          status: "failed",
          errorMessage: result.error,
        });

        res.status(500).json({
          success: false,
          error: result.error || "Failed to assign voice routing policy via PowerShell",
          output: result.output,
        });
      }
    } catch (error) {
      console.error("Error in PowerShell policy assignment:", error);
      res.status(500).json({ error: "Failed to assign voice routing policy via PowerShell" });
    }
  });

  // Assign phone number AND voice routing policy (combined operation) using PowerShell certificate auth
  app.post("/api/powershell/assign-phone-and-policy", requireOperatorAuth, async (req, res) => {
    try {
      const { tenantId, userPrincipalName, phoneNumber, policyName, locationId } = req.body;

      if (!tenantId || !userPrincipalName || !phoneNumber || !policyName) {
        return res.status(400).json({ error: "Missing required fields: tenantId, userPrincipalName, phoneNumber, policyName" });
      }

      // Get customer tenant
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      // Get tenant-specific PowerShell certificate credentials
      const credentialsArray = await storage.getTenantPowershellCredentials(tenantId);
      const psCredentials = credentialsArray.find(cred => cred.isActive);

      if (!psCredentials) {
        return res.status(404).json({ error: "PowerShell credentials not configured for this tenant. Please contact administrator." });
      }

      // Build certificate credentials
      const certCredentials: PowerShellCertificateCredentials = {
        tenantId: tenant.tenantId, // Azure AD tenant ID
        appId: psCredentials.appId,
        certificateThumbprint: psCredentials.certificateThumbprint,
      };

      // Execute combined PowerShell command (assigns both phone and policy in one operation)
      const result = await assignPhoneAndPolicyCert(certCredentials, userPrincipalName, phoneNumber, policyName, locationId);

      if (result.success) {
        // Create success audit log
        await storage.createAuditLog({
          operatorEmail: req.user.email,
          operatorName: req.user.displayName,
          tenantId: tenant.tenantId,
          tenantName: tenant.tenantName,
          targetUserUpn: userPrincipalName,
          targetUserName: userPrincipalName,
          changeType: "voice_configuration_powershell",
          changeDescription: `Assigned phone number ${phoneNumber} and voice routing policy ${policyName} using PowerShell`,
          phoneNumber,
          routingPolicy: policyName,
          status: "success",
        });

        res.json({
          success: true,
          message: `Successfully assigned phone number ${phoneNumber} and policy ${policyName} to ${userPrincipalName}`,
          output: result.output,
        });
      } else {
        // Create failure audit log
        await storage.createAuditLog({
          operatorEmail: req.user.email,
          operatorName: req.user.displayName,
          tenantId: tenant.tenantId,
          tenantName: tenant.tenantName,
          targetUserUpn: userPrincipalName,
          targetUserName: userPrincipalName,
          changeType: "voice_configuration_failed_powershell",
          changeDescription: `Failed to assign phone number ${phoneNumber} and voice routing policy ${policyName} using PowerShell`,
          phoneNumber,
          routingPolicy: policyName,
          status: "failed",
          errorMessage: result.error,
        });

        res.status(500).json({
          success: false,
          error: result.error || "Failed to assign phone and policy via PowerShell",
          output: result.output,
        });
      }
    } catch (error) {
      console.error("Error in PowerShell combined assignment:", error);
      res.status(500).json({ error: "Failed to assign phone and policy via PowerShell" });
    }
  });

  // Rollback a voice configuration change (admin only)
  app.post("/api/teams/rollback/:auditLogId", requireAdminAuth, async (req, res) => {
    try {
      const { auditLogId } = req.params;

      // Get the audit log entry by ID (efficient)
      const logEntry = await storage.getAuditLog(auditLogId);

      if (!logEntry) {
        return res.status(404).json({ error: "Audit log entry not found" });
      }

      // Check if this entry has previous values for rollback
      if (!logEntry.targetUserId) {
        return res.status(400).json({ error: "This change cannot be rolled back (missing user ID)" });
      }

      // Check if this is a rollback entry itself
      if (logEntry.changeType === "rollback") {
        return res.status(400).json({ error: "Cannot rollback a rollback entry" });
      }

      // Check if not successful or already rolled back
      if (logEntry.status !== "success") {
        return res.status(400).json({ error: "Can only rollback successful changes" });
      }

      // Get tenant information
      const tenant = await storage.getTenantByTenantId(logEntry.tenantId);
      if (!tenant || !tenant.appRegistrationId || !tenant.appRegistrationSecret) {
        return res.status(400).json({ error: "Tenant not found or not configured" });
      }

      // Decrypt the app registration secret
      const decryptedSecret = decrypt(tenant.appRegistrationSecret);

      const graphClient = await getGraphClient(
        tenant.tenantId,
        tenant.appRegistrationId,
        decryptedSecret
      );

      // Revert to previous values
      const rollbackPhoneNumber = logEntry.previousPhoneNumber || "";
      const rollbackRoutingPolicy = logEntry.previousRoutingPolicy || "";

      if (!rollbackPhoneNumber && !rollbackRoutingPolicy) {
        return res.status(400).json({ error: "No previous values available for rollback" });
      }

      // Perform the rollback
      await assignPhoneNumberAndPolicy(
        graphClient,
        logEntry.targetUserId,
        rollbackPhoneNumber,
        rollbackRoutingPolicy
      );

      // Mark the original log entry as rolled back
      await storage.updateAuditLog(logEntry.id, {
        status: "rolled_back",
      });

      // Create audit log for the rollback (using admin context)
      await storage.createAuditLog({
        operatorEmail: "admin",
        operatorName: "Admin",
        tenantId: logEntry.tenantId,
        tenantName: logEntry.tenantName,
        targetUserUpn: logEntry.targetUserUpn,
        targetUserName: logEntry.targetUserName,
        targetUserId: logEntry.targetUserId,
        changeType: "rollback",
        changeDescription: `Rolled back change from ${logEntry.timestamp.toISOString()}: restored phone number ${rollbackPhoneNumber || "(none)"} and policy ${rollbackRoutingPolicy || "(none)"}`,
        phoneNumber: rollbackPhoneNumber,
        routingPolicy: rollbackRoutingPolicy,
        previousPhoneNumber: logEntry.phoneNumber,
        previousRoutingPolicy: logEntry.routingPolicy,
        status: "success",
      });

      res.json({ success: true, message: "Change rolled back successfully" });
    } catch (error) {
      console.error("Error rolling back change:", error);
      res.status(500).json({ error: "Failed to rollback change" });
    }
  });

  // ===== TENANT POWERSHELL CREDENTIALS API (ADMIN ONLY) =====

  // Get all PowerShell credentials for a tenant (without passwords)
  app.get("/api/admin/tenant/:tenantId/powershell-credentials", requireAdminAuth, async (req, res) => {
    try {
      const { tenantId } = req.params;
      const credentials = await storage.getTenantPowershellCredentials(tenantId);

      // Remove encrypted passwords from response for security
      const sanitized = credentials.map(cred => ({
        id: cred.id,
        tenantId: cred.tenantId,
        appId: cred.appId,
        certificateThumbprint: cred.certificateThumbprint,
        description: cred.description,
        isActive: cred.isActive,
        createdAt: cred.createdAt,
        updatedAt: cred.updatedAt,
      }));

      res.json(sanitized);
    } catch (error) {
      console.error("Error fetching PowerShell credentials:", error);
      res.status(500).json({ error: "Failed to fetch PowerShell credentials" });
    }
  });

  // Create new PowerShell credentials for a tenant
  app.post("/api/admin/tenant/:tenantId/powershell-credentials", requireAdminAuth, async (req, res) => {
    try {
      const { tenantId } = req.params;
      const { appId, certificateThumbprint, username, password, description } = req.body;

      // Support both certificate-based and legacy user account authentication
      const isCertificateBased = appId && certificateThumbprint;
      const isUserAccount = username && password;

      if (!isCertificateBased && !isUserAccount) {
        return res.status(400).json({
          error: "Either (appId + certificateThumbprint) or (username + password) are required"
        });
      }

      // Prepare credential data
      const credentialData: any = {
        tenantId,
        description,
        isActive: true,
      };

      if (isCertificateBased) {
        // Certificate-based authentication (recommended)
        credentialData.appId = appId;
        credentialData.certificateThumbprint = certificateThumbprint;
        credentialData.usernameDeprecated = "";
        credentialData.encryptedPasswordDeprecated = "";
      } else {
        // Legacy user account authentication
        credentialData.appId = null;
        credentialData.certificateThumbprint = null;
        credentialData.usernameDeprecated = username;
        credentialData.encryptedPasswordDeprecated = encrypt(password);
      }

      const credential = await storage.createTenantPowershellCredentials(credentialData);

      // Return credential details (without sensitive data)
      res.json({
        id: credential.id,
        tenantId: credential.tenantId,
        appId: credential.appId,
        certificateThumbprint: credential.certificateThumbprint,
        description: credential.description,
        isActive: credential.isActive,
        createdAt: credential.createdAt,
      });
    } catch (error) {
      console.error("Error creating PowerShell credentials:", error);
      res.status(500).json({ error: "Failed to create PowerShell credentials" });
    }
  });

  // Update PowerShell credentials for a tenant
  app.put("/api/admin/tenant/:tenantId/powershell-credentials/:credId", requireAdminAuth, async (req, res) => {
    try {
      const { tenantId, credId } = req.params;
      const { appId, certificateThumbprint, username, password, description, isActive } = req.body;

      const updates: any = {};

      // Support both certificate-based and legacy user account authentication
      const isCertificateBased = appId !== undefined || certificateThumbprint !== undefined;
      const isUserAccount = username !== undefined || password !== undefined;

      if (isCertificateBased) {
        // Certificate-based authentication (recommended)
        if (appId !== undefined) updates.appId = appId;
        if (certificateThumbprint !== undefined) updates.certificateThumbprint = certificateThumbprint;
        // Clear deprecated fields when switching to certificate-based
        if (appId !== undefined && certificateThumbprint !== undefined) {
          updates.usernameDeprecated = "";
          updates.encryptedPasswordDeprecated = "";
        }
      } else if (isUserAccount) {
        // Legacy user account authentication
        if (username !== undefined) updates.usernameDeprecated = username;
        if (password !== undefined) updates.encryptedPasswordDeprecated = encrypt(password);
        // Clear certificate fields when switching to user account
        if (username !== undefined && password !== undefined) {
          updates.appId = null;
          updates.certificateThumbprint = null;
        }
      }

      if (description !== undefined) updates.description = description;
      if (isActive !== undefined) updates.isActive = isActive;

      const credential = await storage.updateTenantPowershellCredentials(credId, updates);

      // Return credential details (without sensitive data)
      res.json({
        id: credential.id,
        tenantId: credential.tenantId,
        appId: credential.appId,
        certificateThumbprint: credential.certificateThumbprint,
        description: credential.description,
        isActive: credential.isActive,
        updatedAt: credential.updatedAt,
      });
    } catch (error) {
      console.error("Error updating PowerShell credentials:", error);
      res.status(500).json({ error: "Failed to update PowerShell credentials" });
    }
  });

  // Delete PowerShell credentials for a tenant
  app.delete("/api/admin/tenant/:tenantId/powershell-credentials/:credId", requireAdminAuth, async (req, res) => {
    try {
      const { credId } = req.params;
      await storage.deleteTenantPowershellCredentials(credId);
      res.json({ success: true, message: "PowerShell credentials deleted" });
    } catch (error) {
      console.error("Error deleting PowerShell credentials:", error);
      res.status(500).json({ error: "Failed to delete PowerShell credentials" });
    }
  });

  // ===== OPERATOR POWERSHELL SESSION API =====

  // Get PowerShell credentials for operator use (for WebSocket)
  app.get("/api/tenant/:tenantId/powershell-credentials", requireOperatorAuth, async (req, res) => {
    try {
      const { tenantId } = req.params;

      // Get customer tenant for Azure AD tenant ID
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Customer tenant not found" });
      }

      const credentials = await storage.getTenantPowershellCredentials(tenantId);

      // Find active credentials
      const active = credentials.find(cred => cred.isActive);
      if (!active) {
        return res.status(404).json({ error: "No active PowerShell credentials found for this tenant" });
      }

      // Return certificate credentials (for WebSocket authentication)
      res.json({
        authType: "certificate",
        tenantId: tenant.tenantId, // Azure AD tenant ID
        appId: active.appId,
        certificateThumbprint: active.certificateThumbprint,
      });
    } catch (error) {
      console.error("Error fetching PowerShell credentials:", error);
      res.status(500).json({ error: "Failed to fetch PowerShell credentials" });
    }
  });

  // Serve documentation files as raw markdown (admin only)
  app.get("/api/admin/documentation/:filename", requireAdminAuth, async (req, res) => {
    try {
      const { filename } = req.params;

      // Security: Only allow specific documentation files
      const allowedFiles = [
        "SERVER_CERTIFICATE_SETUP.md",
        "CUSTOMER_TENANT_POWERSHELL_SETUP.md",
        "POWERSHELL_QUICKSTART.md",
        "CERTIFICATE_AUTH_MIGRATION_SUMMARY.md",
        "POWERSHELL_CERT_IMPLEMENTATION_STATUS.md",
      ];

      if (!allowedFiles.includes(filename)) {
        return res.status(400).json({ error: "Invalid documentation file" });
      }

      const fs = await import("fs/promises");
      const path = await import("path");
      const filePath = path.join("C:\\inetpub\\wwwroot\\UCRManager", filename);

      try {
        const content = await fs.readFile(filePath, "utf-8");
        res.json({ filename, content });
      } catch (readError) {
        res.status(404).json({ error: "Documentation file not found" });
      }
    } catch (error) {
      console.error("Error serving documentation:", error);
      res.status(500).json({ error: "Failed to load documentation" });
    }
  });

  // Setup debug routes (if DEBUG_MODE is enabled)
  const { setupDebugRoutes } = await import("./debug-routes");
  setupDebugRoutes(app);

  const httpServer = createServer(app);

  return httpServer;
}
