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
import { insertCustomerTenantSchema, insertAuditLogSchema, insertConfigurationProfileSchema, insertTenantPowershellCredentialsSchema, insertPhoneNumberInventorySchema, type InsertOperatorConfig, type InsertCustomerTenant } from "@shared/schema";
import { encrypt, decrypt } from "./encryption";
import {
  testPowerShellConnectivity,
  testTeamsModuleInstallation,
  testCertificateConnection,
  getVoiceRoutingPoliciesCert,
  assignPhoneNumberCert,
  grantVoiceRoutingPolicyCert,
  assignPhoneAndPolicyCert,
  getTeamsUserCert,
  generateTeamsCertificate,
  getTeamsPoliciesCert,
  grantTeamsPolicyCert,
  type PowerShellCertificateCredentials,
  type PowerShellCredentials,
} from "./powershell";
import { powershellSessionManager } from "./powershell-session";
import { PolicyType, policyTypeConfig } from "@shared/schema";
import { format } from "date-fns";

// Helper function to query current user state for audit logging
async function queryUserState(credentials: PowerShellCertificateCredentials, userPrincipalName: string): Promise<any | null> {
  try {
    const result = await getTeamsUserCert(credentials, userPrincipalName);
    if (result.success && result.output) {
      // Parse the JSON output from PowerShell
      const jsonMatch = result.output.match(/{[\s\S]*}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
    return null;
  } catch (error) {
    console.error("Error querying user state for audit:", error);
    return null;
  }
}

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

  // ===== FEATURE FLAGS ROUTES =====

  // Get all feature flags
  app.get("/api/feature-flags", requireOperatorAuth, async (req, res) => {
    try {
      const flags = await storage.getAllFeatureFlags();
      res.json(flags);
    } catch (error) {
      console.error("Error fetching feature flags:", error);
      res.status(500).json({ error: "Failed to fetch feature flags" });
    }
  });

  // Get a specific feature flag by key
  app.get("/api/feature-flags/:featureKey", requireOperatorAuth, async (req, res) => {
    try {
      const flag = await storage.getFeatureFlagByKey(req.params.featureKey);
      if (!flag) {
        return res.status(404).json({ error: "Feature flag not found" });
      }
      res.json(flag);
    } catch (error) {
      console.error("Error fetching feature flag:", error);
      res.status(500).json({ error: "Failed to fetch feature flag" });
    }
  });

  // Update a feature flag (admin only)
  app.put("/api/admin/feature-flags/:featureKey", requireAdminAuth, async (req, res) => {
    try {
      const { featureKey } = req.params;
      const { isEnabled } = req.body;

      if (typeof isEnabled !== "boolean") {
        return res.status(400).json({ error: "isEnabled must be a boolean" });
      }

      const updated = await storage.updateFeatureFlag(featureKey, isEnabled);
      res.json(updated);
    } catch (error) {
      console.error("Error updating feature flag:", error);
      res.status(500).json({ error: "Failed to update feature flag" });
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

  // ===== PHONE NUMBER INVENTORY ROUTES =====

  // Get all phone numbers for a tenant
  app.get("/api/numbers", requireOperatorAuth, async (req, res) => {
    try {
      const { tenantId, status, numberType, countryCode } = req.query;

      if (!tenantId || typeof tenantId !== "string") {
        return res.status(400).json({ error: "Tenant ID is required" });
      }

      const filters: any = { tenantId };
      if (status && typeof status === "string") filters.status = status;
      if (numberType && typeof numberType === "string") filters.numberType = numberType;
      if (countryCode && typeof countryCode === "string") filters.countryCode = countryCode;

      const numbers = await storage.getPhoneNumbers(filters);
      res.json(numbers);
    } catch (error) {
      console.error("Error fetching phone numbers:", error);
      res.status(500).json({ error: "Failed to fetch phone numbers" });
    }
  });

  // Get available country codes for a tenant (only countries with numbers in inventory)
  app.get("/api/numbers/available-countries", requireOperatorAuth, async (req, res) => {
    try {
      const { tenantId } = req.query;

      if (!tenantId || typeof tenantId !== "string") {
        return res.status(400).json({ error: "Tenant ID is required" });
      }

      const countries = await storage.getAvailableCountryCodes(tenantId);
      res.json(countries);
    } catch (error) {
      console.error("Error fetching available countries:", error);
      res.status(500).json({ error: "Failed to fetch available countries" });
    }
  });

  // Create new phone number
  app.post("/api/numbers", requireOperatorAuth, async (req, res) => {
    try {
      const operatorEmail = req.user?.email || "unknown";

      const result = insertPhoneNumberInventorySchema.safeParse({
        ...req.body,
        createdBy: operatorEmail,
        lastModifiedBy: operatorEmail,
      });

      if (!result.success) {
        return res.status(400).json({ error: "Invalid phone number data", details: result.error });
      }

      // Verify tenant exists
      const tenant = await storage.getTenant(result.data.tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      // Check for duplicate line URI within tenant
      const existing = await storage.getPhoneNumberByLineUri(result.data.tenantId, result.data.lineUri);
      if (existing) {
        return res.status(409).json({ error: "Phone number already exists for this tenant" });
      }

      const phoneNumber = await storage.createPhoneNumber(result.data);
      res.status(201).json(phoneNumber);
    } catch (error) {
      console.error("Error creating phone number:", error);
      res.status(500).json({ error: "Failed to create phone number" });
    }
  });

  // Bulk import phone numbers
  app.post("/api/numbers/bulk-import", requireOperatorAuth, async (req, res) => {
    try {
      const operatorEmail = req.user?.email || "unknown";
      const { tenantId, numbers } = req.body;

      if (!tenantId || !Array.isArray(numbers)) {
        return res.status(400).json({ error: "tenantId and numbers array are required" });
      }

      // Verify tenant exists
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      const results = {
        success: [] as any[],
        errors: [] as any[],
      };

      for (const num of numbers) {
        try {
          const result = insertPhoneNumberInventorySchema.safeParse({
            ...num,
            tenantId,
            createdBy: operatorEmail,
            lastModifiedBy: operatorEmail,
          });

          if (!result.success) {
            results.errors.push({ lineUri: num.lineUri, error: "Validation failed", details: result.error });
            continue;
          }

          // Check for duplicate
          const existing = await storage.getPhoneNumberByLineUri(tenantId, result.data.lineUri);
          if (existing) {
            results.errors.push({ lineUri: result.data.lineUri, error: "Number already exists" });
            continue;
          }

          const phoneNumber = await storage.createPhoneNumber(result.data);
          results.success.push(phoneNumber);
        } catch (error) {
          results.errors.push({ lineUri: num.lineUri, error: "Failed to create" });
        }
      }

      res.json(results);
    } catch (error) {
      console.error("Error bulk importing phone numbers:", error);
      res.status(500).json({ error: "Failed to bulk import phone numbers" });
    }
  });

  // Update phone number
  app.patch("/api/numbers/:id", requireOperatorAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const operatorEmail = req.user?.email || "unknown";

      // Verify number exists
      const existingNumber = await storage.getPhoneNumber(id);
      if (!existingNumber) {
        return res.status(404).json({ error: "Phone number not found" });
      }

      // Add lastModifiedBy to updates
      const updatesWithAudit = {
        ...updates,
        lastModifiedBy: operatorEmail,
      };

      const phoneNumber = await storage.updatePhoneNumber(id, updatesWithAudit);
      res.json(phoneNumber);
    } catch (error) {
      console.error("Error updating phone number:", error);
      res.status(500).json({ error: "Failed to update phone number" });
    }
  });

  // Bulk update phone numbers
  app.patch("/api/numbers/bulk-update", requireOperatorAuth, async (req, res) => {
    try {
      const { ids, updates } = req.body;
      const operatorEmail = req.user?.email || "unknown";

      if (!Array.isArray(ids) || !updates) {
        return res.status(400).json({ error: "ids array and updates object are required" });
      }

      const updatesWithAudit = {
        ...updates,
        lastModifiedBy: operatorEmail,
      };

      const results = {
        success: [] as any[],
        errors: [] as any[],
      };

      for (const id of ids) {
        try {
          const phoneNumber = await storage.updatePhoneNumber(id, updatesWithAudit);
          results.success.push(phoneNumber);
        } catch (error) {
          results.errors.push({ id, error: "Failed to update" });
        }
      }

      res.json(results);
    } catch (error) {
      console.error("Error bulk updating phone numbers:", error);
      res.status(500).json({ error: "Failed to bulk update phone numbers" });
    }
  });

  // Delete phone number
  app.delete("/api/numbers/:id", requireOperatorAuth, async (req, res) => {
    try {
      const { id } = req.params;

      // Verify number exists
      const existingNumber = await storage.getPhoneNumber(id);
      if (!existingNumber) {
        return res.status(404).json({ error: "Phone number not found" });
      }

      await storage.deletePhoneNumber(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting phone number:", error);
      res.status(500).json({ error: "Failed to delete phone number" });
    }
  });

  // Bulk delete all phone numbers for a tenant
  app.delete("/api/numbers/bulk-delete/:tenantId", requireAdminAuth, async (req, res) => {
    try {
      const { tenantId } = req.params;

      // Verify tenant exists
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      const deletedCount = await storage.bulkDeletePhoneNumbers(tenantId);
      res.json({
        success: true,
        deletedCount,
        message: `Deleted ${deletedCount} phone number(s) for tenant ${tenant.tenantName}`
      });
    } catch (error) {
      console.error("Error bulk deleting phone numbers:", error);
      res.status(500).json({ error: "Failed to bulk delete phone numbers" });
    }
  });

  // Find next available number in a range
  app.post("/api/numbers/next-available", requireOperatorAuth, async (req, res) => {
    try {
      const { tenantId, numberRange, status = "available" } = req.body;

      if (!tenantId || !numberRange) {
        return res.status(400).json({ error: "tenantId and numberRange are required" });
      }

      // Get all numbers in the range
      const numbers = await storage.getPhoneNumbersByRange(tenantId, numberRange);

      // Parse the number range pattern
      // Examples: "+1555123xxxx", "tel:+1555123xxxx", "1234xxx" (extensions)
      const pattern = numberRange.toLowerCase();

      // Check if pattern contains 'x' characters
      if (!pattern.includes('x')) {
        return res.status(400).json({
          error: "Number range must contain 'x' characters to represent variable digits",
          example: "+1555123xxxx or 1234xxx"
        });
      }

      // Extract prefix and determine the variable portion
      const xIndex = pattern.indexOf('x');
      const prefix = numberRange.substring(0, xIndex);
      const variableLength = (numberRange.match(/x/gi) || []).length;

      // Calculate the maximum possible number for this range
      const maxNumber = Math.pow(10, variableLength) - 1;

      // Extract used numbers and parse their variable portions
      const usedVariableNumbers = new Set<number>();
      for (const num of numbers) {
        const lineUri = num.lineUri.toLowerCase();

        // Handle both "tel:+1..." and "+1..." formats
        const normalizedUri = lineUri.startsWith('tel:') ? lineUri.substring(4) : lineUri;
        const normalizedPrefix = prefix.toLowerCase().startsWith('tel:')
          ? prefix.substring(4).toLowerCase()
          : prefix.toLowerCase();

        // Check if this number matches our prefix
        if (normalizedUri.startsWith(normalizedPrefix)) {
          const variablePart = normalizedUri.substring(normalizedPrefix.length);
          // Extract only digits from the variable part
          const digits = variablePart.match(/\d+/);
          if (digits && digits[0].length === variableLength) {
            usedVariableNumbers.add(parseInt(digits[0], 10));
          }
        }
      }

      // Find the next available number by checking sequential numbers
      let nextAvailable: number | null = null;
      for (let i = 0; i <= maxNumber; i++) {
        if (!usedVariableNumbers.has(i)) {
          nextAvailable = i;
          break;
        }
      }

      if (nextAvailable === null) {
        return res.json({
          numberRange,
          available: false,
          message: "All numbers in this range are used",
          totalCapacity: maxNumber + 1,
          usedCount: usedVariableNumbers.size,
        });
      }

      // Format the next available number with proper padding
      const nextVariableDigits = String(nextAvailable).padStart(variableLength, '0');

      // Construct the full line URI based on the prefix format
      let nextLineUri: string;
      if (prefix.toLowerCase().startsWith('tel:')) {
        nextLineUri = prefix + nextVariableDigits;
      } else if (prefix.startsWith('+') || prefix.startsWith('1')) {
        // DID format - add tel: prefix
        nextLineUri = 'tel:' + prefix + nextVariableDigits;
      } else {
        // Extension format - no tel: prefix
        nextLineUri = prefix + nextVariableDigits;
      }

      res.json({
        numberRange,
        available: true,
        nextAvailable: nextLineUri,
        nextVariableDigits,
        totalCapacity: maxNumber + 1,
        usedCount: usedVariableNumbers.size,
        remainingCapacity: (maxNumber + 1) - usedVariableNumbers.size,
        utilizationPercent: Math.round((usedVariableNumbers.size / (maxNumber + 1)) * 100),
      });
    } catch (error) {
      console.error("Error finding next available number:", error);
      res.status(500).json({ error: "Failed to find next available number" });
    }
  });

  // Get number statistics for a tenant
  app.get("/api/numbers/statistics", requireOperatorAuth, async (req, res) => {
    try {
      const { tenantId } = req.query;

      if (!tenantId || typeof tenantId !== "string") {
        return res.status(400).json({ error: "Tenant ID is required" });
      }

      const stats = await storage.getPhoneNumberStatistics(tenantId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching phone number statistics:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  // ===== PHONE NUMBER LIFECYCLE MANAGEMENT ROUTES =====

  // Reserve a phone number
  app.post("/api/numbers/:id/reserve", requireOperatorAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { reservedBy } = req.body;
      const operatorEmail = req.user?.email || "unknown";

      if (!reservedBy) {
        return res.status(400).json({ error: "reservedBy field is required" });
      }

      const { lifecycleManager } = await import("./lifecycle-manager");
      const success = await lifecycleManager.reserveNumber(id, reservedBy, operatorEmail);

      if (success) {
        res.json({ success: true, message: "Number reserved successfully" });
      } else {
        res.status(400).json({ error: "Failed to reserve number" });
      }
    } catch (error) {
      console.error("Error reserving number:", error);
      res.status(500).json({ error: "Failed to reserve number" });
    }
  });

  // Release a reserved number (moves to aging)
  app.post("/api/numbers/:id/release", requireOperatorAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const operatorEmail = req.user?.email || "unknown";

      const { lifecycleManager } = await import("./lifecycle-manager");
      const success = await lifecycleManager.releaseReservedNumber(id, operatorEmail);

      if (success) {
        res.json({ success: true, message: "Number released to aging status" });
      } else {
        res.status(400).json({ error: "Failed to release number" });
      }
    } catch (error) {
      console.error("Error releasing number:", error);
      res.status(500).json({ error: "Failed to release number" });
    }
  });

  // Manually trigger lifecycle check
  app.post("/api/numbers/lifecycle/run", requireOperatorAuth, async (req, res) => {
    try {
      const { lifecycleManager } = await import("./lifecycle-manager");
      const result = await lifecycleManager.runLifecycleCheck();
      res.json(result);
    } catch (error) {
      console.error("Error running lifecycle check:", error);
      res.status(500).json({ error: "Failed to run lifecycle check" });
    }
  });

  // Get lifecycle statistics
  app.get("/api/numbers/lifecycle/stats", requireOperatorAuth, async (req, res) => {
    try {
      const { lifecycleManager } = await import("./lifecycle-manager");
      const stats = await lifecycleManager.getLifecycleStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching lifecycle stats:", error);
      res.status(500).json({ error: "Failed to fetch lifecycle stats" });
    }
  });

  // ===== TEAMS SYNC ROUTES =====

  // Sync phone numbers from Teams and compare with local database
  app.post("/api/numbers/sync-from-teams/:tenantId", requireOperatorAuth, async (req, res) => {
    try {
      const { tenantId } = req.params;

      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      // Fetch phone numbers from local database
      const localNumbers = await storage.getPhoneNumbers({ tenantId });
      const localMap = new Map(localNumbers.map(n => [n.lineUri, n]));

      // Fetch phone numbers from Teams using PowerShell
      const { getTeamsPhoneNumbers } = await import("./teams-sync");
      const teamsNumbers = await getTeamsPhoneNumbers(tenant);

      // Compare and create diff
      const toAdd: any[] = [];
      const toUpdate: any[] = [];
      const unchanged: any[] = [];

      for (const teamsNum of teamsNumbers) {
        const local = localMap.get(teamsNum.lineUri);

        if (!local) {
          // New number from Teams
          toAdd.push({
            action: "add",
            lineUri: teamsNum.lineUri,
            displayName: teamsNum.displayName,
            userPrincipalName: teamsNum.userPrincipalName,
            onlineVoiceRoutingPolicy: teamsNum.onlineVoiceRoutingPolicy,
            status: teamsNum.lineUri ? "used" : "available",
            numberType: "did",
          });
        } else {
          // Check if needs update (including status derived from user assignment)
          const teamsHasUser = teamsNum.userPrincipalName && teamsNum.userPrincipalName.trim() !== "";
          const expectedStatus = teamsHasUser ? "used" : "available";

          const needsUpdate =
            local.displayName !== teamsNum.displayName ||
            local.userPrincipalName !== teamsNum.userPrincipalName ||
            local.onlineVoiceRoutingPolicy !== teamsNum.onlineVoiceRoutingPolicy ||
            local.status !== expectedStatus;

          if (needsUpdate) {
            toUpdate.push({
              action: "update",
              id: local.id,
              lineUri: teamsNum.lineUri,
              local: {
                displayName: local.displayName,
                userPrincipalName: local.userPrincipalName,
                onlineVoiceRoutingPolicy: local.onlineVoiceRoutingPolicy,
                status: local.status,
              },
              teams: {
                displayName: teamsNum.displayName,
                userPrincipalName: teamsNum.userPrincipalName,
                onlineVoiceRoutingPolicy: teamsNum.onlineVoiceRoutingPolicy,
                status: expectedStatus,
              },
            });
          } else {
            unchanged.push({
              action: "unchanged",
              lineUri: teamsNum.lineUri,
              displayName: teamsNum.displayName,
            });
          }
        }
      }

      res.json({
        summary: {
          teamsTotal: teamsNumbers.length,
          localTotal: localNumbers.length,
          toAdd: toAdd.length,
          toUpdate: toUpdate.length,
          unchanged: unchanged.length,
        },
        changes: {
          toAdd,
          toUpdate,
          unchanged,
        },
      });
    } catch (error) {
      console.error("Error syncing from Teams:", error);
      res.status(500).json({
        error: "Failed to sync from Teams",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Apply selected sync changes
  app.post("/api/numbers/apply-sync", requireOperatorAuth, async (req, res) => {
    try {
      const { tenantId, selectedChanges } = req.body;
      const operatorEmail = req.user?.email || "unknown";

      if (!tenantId || !selectedChanges || !Array.isArray(selectedChanges)) {
        return res.status(400).json({ error: "tenantId and selectedChanges array are required" });
      }

      const results = {
        added: 0,
        updated: 0,
        errors: [] as any[],
      };

      for (const change of selectedChanges) {
        try {
          if (change.action === "add") {
            // Determine status based on whether number is assigned to a user
            const hasUser = change.userPrincipalName && change.userPrincipalName.trim() !== "";
            await storage.createPhoneNumber({
              tenantId,
              lineUri: change.lineUri,
              displayName: change.displayName || null,
              userPrincipalName: change.userPrincipalName || null,
              onlineVoiceRoutingPolicy: change.onlineVoiceRoutingPolicy || null,
              numberType: change.numberType || "did",
              status: hasUser ? "used" : "available",
              createdBy: operatorEmail,
              lastModifiedBy: operatorEmail,
            });
            results.added++;
          } else if (change.action === "update" && change.id) {
            // Use status from sync if provided, otherwise derive from user assignment
            let status: string;
            if (change.teams.status) {
              status = change.teams.status;
            } else {
              const hasUser = change.teams.userPrincipalName && change.teams.userPrincipalName.trim() !== "";
              status = hasUser ? "used" : "available";
            }

            await storage.updatePhoneNumber(change.id, {
              displayName: change.teams.displayName || null,
              userPrincipalName: change.teams.userPrincipalName || null,
              onlineVoiceRoutingPolicy: change.teams.onlineVoiceRoutingPolicy || null,
              status: status,
              lastModifiedBy: operatorEmail,
            });
            results.updated++;
          }
        } catch (error) {
          results.errors.push({
            lineUri: change.lineUri,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      res.json(results);
    } catch (error) {
      console.error("Error applying sync changes:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
      console.error("Error details:", JSON.stringify(error, null, 2));
      res.status(500).json({
        error: "Failed to apply sync changes",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Remove phone number assignment from a user in Teams
  app.post("/api/numbers/remove-assignment", requireOperatorAuth, async (req, res) => {
    try {
      const { tenantId, userPrincipalName, phoneNumber, phoneNumberType } = req.body;

      if (!tenantId || !userPrincipalName || !phoneNumber) {
        return res.status(400).json({ error: "Tenant ID, user principal name, and phone number are required" });
      }

      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      const { removePhoneNumberAssignment } = await import("./teams-sync");
      const result = await removePhoneNumberAssignment(
        tenant,
        userPrincipalName,
        phoneNumber,
        phoneNumberType || "DirectRouting"
      );

      // Update local database to mark number as available
      const operatorEmail = req.user?.email || "unknown";
      const localNumber = await storage.getPhoneNumberByLineUri(tenantId, phoneNumber);
      if (localNumber) {
        await storage.updatePhoneNumber(localNumber.id, {
          status: "available",
          displayName: null,
          userPrincipalName: null,
          onlineVoiceRoutingPolicy: null,
          lastModifiedBy: operatorEmail,
        });
        console.log(`Updated phone number ${phoneNumber} to available in local database`);
      } else {
        console.log(`Phone number ${phoneNumber} not found in local database - skipping update`);
      }

      res.json(result);
    } catch (error) {
      console.error("Error removing phone number assignment:", error);
      res.status(500).json({
        error: "Failed to remove phone number assignment",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Reset voice routing policy to Global (default) for a user in Teams
  app.post("/api/numbers/reset-policy", requireOperatorAuth, async (req, res) => {
    try {
      const { tenantId, userPrincipalName } = req.body;

      if (!tenantId || !userPrincipalName) {
        return res.status(400).json({ error: "Tenant ID and user principal name are required" });
      }

      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      const { resetVoiceRoutingPolicy } = await import("./teams-sync");
      const result = await resetVoiceRoutingPolicy(tenant, userPrincipalName);

      res.json(result);
    } catch (error) {
      console.error("Error resetting voice routing policy:", error);
      res.status(500).json({
        error: "Failed to reset voice routing policy",
        message: error instanceof Error ? error.message : String(error)
      });
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

  // Get current voice configuration for a specific user via PowerShell
  app.get("/api/teams/user-voice-config", requireOperatorAuth, async (req, res) => {
    try {
      const { tenantId, userPrincipalName } = req.query;

      if (!tenantId || typeof tenantId !== "string") {
        return res.status(400).json({ error: "Tenant ID is required" });
      }

      if (!userPrincipalName || typeof userPrincipalName !== "string") {
        return res.status(400).json({ error: "User Principal Name is required" });
      }

      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      // Get PowerShell credentials for certificate auth
      const credentials = await storage.getTenantPowershellCredentials(tenantId);
      const activeCred = credentials.find(c => c.isActive);

      if (!activeCred || !activeCred.appId || !activeCred.certificateThumbprint) {
        return res.status(400).json({
          error: "PowerShell certificate credentials not configured for this tenant"
        });
      }

      const certCredentials: PowerShellCertificateCredentials = {
        tenantId: tenant.tenantId,
        appId: activeCred.appId,
        certificateThumbprint: activeCred.certificateThumbprint,
      };

      console.log(`[Voice Config] Querying voice config for ${userPrincipalName}`);

      // Get user details via PowerShell
      const result = await getTeamsUserCert(certCredentials, userPrincipalName);

      if (!result.success) {
        console.error(`[Voice Config] Failed to get user config:`, result.error);
        return res.status(500).json({
          error: result.error || "Failed to get user voice configuration"
        });
      }

      // Parse the JSON output
      let userConfig;
      try {
        userConfig = JSON.parse(result.output.trim());
      } catch (parseError) {
        console.error(`[Voice Config] Failed to parse PowerShell output:`, result.output);
        return res.status(500).json({
          error: "Failed to parse user configuration"
        });
      }

      console.log(`[Voice Config] Retrieved config for ${userPrincipalName}:`, {
        hasLineURI: !!userConfig.LineURI,
        hasPolicy: !!userConfig.OnlineVoiceRoutingPolicy,
      });

      // Extract policy name from object if it's an object
      let policyName = null;
      if (userConfig.OnlineVoiceRoutingPolicy) {
        if (typeof userConfig.OnlineVoiceRoutingPolicy === 'object' && userConfig.OnlineVoiceRoutingPolicy.Name) {
          policyName = userConfig.OnlineVoiceRoutingPolicy.Name;
        } else if (typeof userConfig.OnlineVoiceRoutingPolicy === 'string') {
          policyName = userConfig.OnlineVoiceRoutingPolicy;
        }
      }

      res.json({
        displayName: userConfig.DisplayName,
        userPrincipalName: userConfig.UserPrincipalName,
        lineUri: userConfig.LineURI || null,
        voiceRoutingPolicy: policyName,
        enterpriseVoiceEnabled: userConfig.EnterpriseVoiceEnabled || false,
        hostedVoiceMail: userConfig.HostedVoiceMail || false,
      });
    } catch (error) {
      console.error("Error fetching user voice config:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch user voice configuration"
      });
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

  // Bulk assign phone numbers and routing policies via PowerShell
  app.post("/api/teams/bulk-assign-voice", requireOperatorAuth, async (req, res) => {
    let sessionId: string | null = null;

    try {
      const { tenantId, assignments } = req.body;

      console.log(`[BulkAssignment] Starting bulk assignment for ${assignments?.length || 0} users`);

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
        console.log(`[BulkAssignment] ${invalidAssignments.length} invalid phone numbers`);
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

      // Check for PowerShell credentials (certificate-based auth)
      const psCredentialsList = await storage.getTenantPowershellCredentials(tenantId);
      if (!psCredentialsList || psCredentialsList.length === 0) {
        return res.status(400).json({
          error: "PowerShell credentials not configured for this tenant. Bulk phone number assignment requires PowerShell."
        });
      }

      // Use the first (primary) credential
      const psCredentials = psCredentialsList[0];
      console.log(`[BulkAssignment] Using PowerShell credentials ID: ${psCredentials.id}`);

      // Get Graph client for user details
      if (!tenant.appRegistrationId || !tenant.appRegistrationSecret) {
        return res.status(400).json({ error: "Tenant app registration not configured" });
      }

      const decryptedSecret = decrypt(tenant.appRegistrationSecret);
      const graphClient = await getGraphClient(
        tenant.tenantId,
        tenant.appRegistrationId,
        decryptedSecret
      );

      // Fetch all user details upfront
      console.log(`[BulkAssignment] Fetching user details for ${assignments.length} users`);
      const userDetailsMap = new Map();
      for (const assignment of assignments) {
        try {
          const user = await graphClient.api(`/users/${assignment.userId}`).get();
          userDetailsMap.set(assignment.userId, user);
        } catch (error) {
          console.error(`[BulkAssignment] Failed to fetch user ${assignment.userId}:`, error);
        }
      }

      // Create PowerShell session (reuse for all assignments)
      console.log(`[BulkAssignment] Creating PowerShell session`);
      sessionId = await powershellSessionManager.createSessionWithCertificate(
        tenantId,
        req.user.email,
        {
          tenantId: tenant.tenantId,
          appId: psCredentials.appId,
          certificateThumbprint: psCredentials.certificateThumbprint
        }
      );

      console.log(`[BulkAssignment] PowerShell session created: ${sessionId}`);

      // Wait for connection
      const session = powershellSessionManager.getSession(sessionId);
      if (!session) {
        throw new Error("Failed to create PowerShell session");
      }

      console.log(`[BulkAssignment] Waiting for PowerShell to connect`);

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.log(`[BulkAssignment] PowerShell connection timeout`);
          reject(new Error("PowerShell connection timeout (30 seconds)"));
        }, 30000);

        const checkConnection = () => {
          if (session.state === "connected") {
            console.log(`[BulkAssignment] PowerShell connected successfully`);
            clearTimeout(timeout);
            resolve();
          } else if (session.state === "error") {
            console.log(`[BulkAssignment] PowerShell connection error`);
            clearTimeout(timeout);
            reject(new Error("PowerShell connection failed"));
          } else {
            setTimeout(checkConnection, 500);
          }
        };

        checkConnection();
      });

      // Process each assignment using the same PowerShell session
      const results = [];
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < assignments.length; i++) {
        const assignment = assignments[i];
        const user = userDetailsMap.get(assignment.userId);
        const userUpn = user?.userPrincipalName || assignment.userId;
        const userName = user?.displayName || assignment.userName;

        console.log(`[BulkAssignment] Processing ${i + 1}/${assignments.length}: ${userName} (${userUpn})`);

        try {
          if (!user) {
            throw new Error("User not found or inaccessible");
          }

          // Small delay between assignments to let previous output settle
          if (i > 0) {
            console.log(`[BulkAssignment] Waiting 2s before next assignment...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

          // Build certificate credentials for state queries
          const certCredentials: PowerShellCertificateCredentials = {
            tenantId: tenant.tenantId,
            appId: psCredentials.appId,
            certificateThumbprint: psCredentials.certificateThumbprint,
          };

          // Query before state for audit log
          const beforeState = await queryUserState(certCredentials, userUpn);

          // Generate unique marker for this specific assignment
          const uniqueMarker = `BULK_${assignment.userId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          console.log(`[BulkAssignment][${userName}] Using unique marker: ${uniqueMarker}`);

          // Capture output - ONLY for this assignment
          let assignmentOutput: string[] = [];
          let outputBuffer = "";
          const assignmentStartTime = Date.now();

          const outputHandler = ({ output }: { output: string }) => {
            outputBuffer += output;
            const lines = outputBuffer.split(/\r?\n/);
            outputBuffer = lines.pop() || "";
            for (const line of lines) {
              if (line.trim()) {
                console.log(`[BulkAssignment][${userName}] PS Output: ${line}`);
                assignmentOutput.push(line);
              }
            }
          };

          session.emitter.on("output", outputHandler);

          console.log(`[BulkAssignment] Sending command for ${userName}: Phone=${assignment.phoneNumber}, Policy=${assignment.routingPolicy}`);

          // Send assignment command with unique marker
          const success = powershellSessionManager.assignPhoneNumberAndPolicy(
            sessionId!,
            userUpn,
            assignment.phoneNumber,
            assignment.routingPolicy,
            undefined, // locationId
            uniqueMarker // unique marker for this assignment
          );

          if (!success) {
            throw new Error("Failed to send assignment command to PowerShell");
          }

          // Wait for completion - looking for THIS assignment's unique markers only
          await new Promise<void>((resolve, reject) => {
            const maxWaitTime = 60000;
            const startTime = Date.now();

            const checkInterval = setInterval(() => {
              const elapsed = Date.now() - startTime;
              const actualOutput = assignmentOutput.filter(line => !line.includes(">>") && !line.includes("PS C:\\"));

              // Look for markers with THIS assignment's unique ID
              const hasSuccess = actualOutput.some(line => line.includes(`RESULT_SUCCESS:${uniqueMarker}`));
              const hasFailed = actualOutput.some(line => line.includes(`RESULT_FAILED:${uniqueMarker}`));
              const hasPhoneSuccess = actualOutput.some(line => line.includes(`SUCCESS_PHONE:${uniqueMarker}`));
              const hasPolicySuccess = actualOutput.some(line => line.includes(`SUCCESS_POLICY:${uniqueMarker}`));
              const hasPhoneError = actualOutput.some(line => line.includes(`ERROR_PHONE:${uniqueMarker}`));
              const hasPolicyError = actualOutput.some(line => line.includes(`ERROR_POLICY:${uniqueMarker}`));
              const hasMarkerEnd = actualOutput.some(line => line.includes(`MARKER_END:${uniqueMarker}`));

              // Log status every 5 seconds
              if (elapsed > 0 && elapsed % 5000 < 500) {
                console.log(`[BulkAssignment][${userName}] Waiting ${elapsed}ms: Phone=${hasPhoneSuccess}, Policy=${hasPolicySuccess}, Success=${hasSuccess}, Failed=${hasFailed}, End=${hasMarkerEnd}`);
              }

              if (hasSuccess || (hasPhoneSuccess && hasPolicySuccess)) {
                console.log(`[BulkAssignment][${userName}] ✓ Detected success after ${elapsed}ms - Phone=${hasPhoneSuccess}, Policy=${hasPolicySuccess}`);
                clearInterval(checkInterval);
                resolve();
                return;
              }

              if (hasFailed || hasPhoneError || hasPolicyError) {
                clearInterval(checkInterval);
                const errorLine = actualOutput.find(line => line.includes(`ERROR`) && line.includes(uniqueMarker));
                console.log(`[BulkAssignment][${userName}] ✗ Detected failure after ${elapsed}ms: ${errorLine}`);
                reject(new Error(errorLine || "PowerShell assignment failed"));
                return;
              }

              if (elapsed > maxWaitTime) {
                console.log(`[BulkAssignment][${userName}] ✗ Timeout after ${maxWaitTime}ms`);
                console.log(`[BulkAssignment][${userName}] Final output lines: ${actualOutput.length}`);
                clearInterval(checkInterval);
                reject(new Error("PowerShell command timeout (60 seconds)"));
                return;
              }
            }, 500);
          });

          // Clean up listener
          session.emitter.removeListener("output", outputHandler);

          console.log(`[BulkAssignment][${userName}] Assignment completed, listener removed`);

          // Update local database to mark number as used
          const operatorEmail = req.user?.email || "unknown";
          const localNumber = await storage.getPhoneNumberByLineUri(tenantId, assignment.phoneNumber);
          if (localNumber) {
            await storage.updatePhoneNumber(localNumber.id, {
              status: "used",
              displayName: user.displayName,
              userPrincipalName: user.userPrincipalName,
              onlineVoiceRoutingPolicy: assignment.routingPolicy,
              lastModifiedBy: operatorEmail,
            });
            console.log(`[BulkAssignment][${userName}] Updated phone number ${assignment.phoneNumber} to used in local database`);
          } else {
            console.log(`[BulkAssignment][${userName}] Phone number ${assignment.phoneNumber} not found in local database - skipping update`);
          }

          // Query after state for audit log
          const afterState = await queryUserState(certCredentials, userUpn);

          // Create success audit log
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
            status: "success",
            beforeState: beforeState,
            afterState: afterState,
          });

          results.push({
            userId: assignment.userId,
            userName: assignment.userName,
            success: true,
          });

          successCount++;
          console.log(`[BulkAssignment] ✓ Success for ${userName} (${successCount}/${assignments.length})`);

        } catch (error: any) {
          console.error(`[BulkAssignment] ✗ Error for ${userName}:`, error.message);
          failCount++;

          // Create failure audit log
          try {
            // Build certificate credentials for state queries (if not already built)
            const certCredentials: PowerShellCertificateCredentials = {
              tenantId: tenant.tenantId,
              appId: psCredentials.appId,
              certificateThumbprint: psCredentials.certificateThumbprint,
            };

            // Query before state for failure audit log
            const beforeState = await queryUserState(certCredentials, userUpn);

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
              beforeState: beforeState,
            });
          } catch (auditError) {
            console.error("[BulkAssignment] Error creating failure audit log:", auditError);
          }

          results.push({
            userId: assignment.userId,
            userName: assignment.userName,
            success: false,
            error: error.message || "Assignment failed",
          });
        }
      }

      console.log(`[BulkAssignment] Bulk assignment complete: ${successCount} success, ${failCount} failed`);
      res.json({ results });

    } catch (error) {
      console.error("[BulkAssignment] Error in bulk voice assignment:", error);
      res.status(500).json({ error: "Bulk assignment failed" });
    } finally {
      // Clean up PowerShell session
      if (sessionId) {
        console.log(`[BulkAssignment] Cleaning up PowerShell session: ${sessionId}`);
        powershellSessionManager.closeSession(sessionId);
      }
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

      // Build certificate credentials for state queries
      const certCredentials: PowerShellCertificateCredentials = {
        tenantId: tenant.tenantId,
        appId: psCredentials.appId,
        certificateThumbprint: psCredentials.certificateThumbprint,
      };

      // Query before state for audit log
      const beforeState = await queryUserState(certCredentials, userPrincipalName);

      // Generate unique marker for this assignment
      const uniqueMarker = `ASSIGN_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      console.log(`[Assignment] Using unique marker: ${uniqueMarker}`);

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
        routingPolicy,
        undefined, // locationId
        uniqueMarker // unique marker for this assignment
      );

      if (!success) {
        throw new Error("Failed to send assignment command to PowerShell");
      }

      console.log(`[Assignment] Command sent, waiting for PowerShell to complete...`);

      // Wait for the command to complete - looking for THIS assignment's unique markers only
      await new Promise<void>((resolve, reject) => {
        const maxWaitTime = 60000; // 60 seconds max
        const startTime = Date.now();

        const checkInterval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const actualOutput = assignmentOutput.filter(line => !line.includes(">>") && !line.includes("PS C:\\"));

          // Look for markers with THIS assignment's unique ID
          const hasSuccess = actualOutput.some(line => line.includes(`RESULT_SUCCESS:${uniqueMarker}`));
          const hasFailed = actualOutput.some(line => line.includes(`RESULT_FAILED:${uniqueMarker}`));
          const hasPhoneSuccess = actualOutput.some(line => line.includes(`SUCCESS_PHONE:${uniqueMarker}`));
          const hasPolicySuccess = actualOutput.some(line => line.includes(`SUCCESS_POLICY:${uniqueMarker}`));
          const hasPhoneError = actualOutput.some(line => line.includes(`ERROR_PHONE:${uniqueMarker}`));
          const hasPolicyError = actualOutput.some(line => line.includes(`ERROR_POLICY:${uniqueMarker}`));
          const hasMarkerEnd = actualOutput.some(line => line.includes(`MARKER_END:${uniqueMarker}`));

          // Log wait status every 5 seconds
          if (elapsed > 0 && elapsed % 5000 < 500) {
            console.log(`[Assignment] Wait check (${elapsed}ms): Phone=${hasPhoneSuccess}, Policy=${hasPolicySuccess}, Success=${hasSuccess}, Failed=${hasFailed}, End=${hasMarkerEnd}`);
          }

          // Success condition
          if (hasSuccess || (hasPhoneSuccess && hasPolicySuccess)) {
            clearInterval(checkInterval);
            console.log(`[Assignment] ✓ Detected success after ${elapsed}ms - Phone=${hasPhoneSuccess}, Policy=${hasPolicySuccess}`);
            resolve();
            return;
          }

          // Failure conditions
          if (hasFailed || hasPhoneError || hasPolicyError) {
            clearInterval(checkInterval);
            const errorLine = actualOutput.find(line => line.includes(`ERROR`) && line.includes(uniqueMarker));
            console.log(`[Assignment] ✗ Detected failure after ${elapsed}ms: ${errorLine}`);
            resolve(); // Resolve anyway to proceed with error handling
            return;
          }

          // Timeout
          if (elapsed > maxWaitTime) {
            clearInterval(checkInterval);
            console.log(`[Assignment] ✗ Timeout after ${maxWaitTime}ms`);
            resolve(); // Resolve to proceed with timeout error
            return;
          }
        }, 500); // Check every 500ms
      });

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

      // Filter to actual output (not script echo)
      const actualOutput = assignmentOutput.filter(line => !line.includes(">>") && !line.includes("PS C:\\"));

      // Check output for success/failure using unique marker
      const hasPhoneSuccess = actualOutput.some(line => line.includes(`SUCCESS_PHONE:${uniqueMarker}`));
      const hasPolicySuccess = actualOutput.some(line => line.includes(`SUCCESS_POLICY:${uniqueMarker}`));
      const hasFailed = actualOutput.some(line => line.includes(`RESULT_FAILED:${uniqueMarker}`));
      const hasSuccess = actualOutput.some(line => line.includes(`RESULT_SUCCESS:${uniqueMarker}`));

      console.log(`[Assignment] Detection - hasPhoneSuccess: ${hasPhoneSuccess}, hasPolicySuccess: ${hasPolicySuccess}, hasFailed: ${hasFailed}, hasSuccess: ${hasSuccess}`);

      // Extract error messages with unique marker
      const phoneError = actualOutput.find(line => line.includes(`ERROR_PHONE:${uniqueMarker}`));
      const phoneErrorDetails = actualOutput.find(line => line.includes(`ERROR_PHONE_DETAILS:${uniqueMarker}`));
      const policyError = actualOutput.find(line => line.includes(`ERROR_POLICY:${uniqueMarker}`));
      const policyErrorDetails = actualOutput.find(line => line.includes(`ERROR_POLICY_DETAILS:${uniqueMarker}`));
      const failureReason = actualOutput.find(line => line.includes(`FAILURE_REASON:${uniqueMarker}`));

      console.log(`[Assignment] Error detection - phoneError: ${!!phoneError}, policyError: ${!!policyError}, failureReason: ${!!failureReason}`);

      // If we have both success markers, consider it successful regardless of RESULT marker
      // (The RESULT marker may not be captured due to timing)
      if (hasPhoneSuccess && hasPolicySuccess) {
        console.log(`[Assignment] SUCCESS: Both phone and policy assigned successfully`);
        // Success - continue to audit log and response
      } else if (hasFailed || phoneError || policyError) {
        console.log(`[Assignment] FAILED - Error details:`);
        if (phoneError) console.log(`[Assignment]   ${phoneError}`);
        if (phoneErrorDetails) console.log(`[Assignment]   ${phoneErrorDetails}`);
        if (policyError) console.log(`[Assignment]   ${policyError}`);
        if (policyErrorDetails) console.log(`[Assignment]   ${policyErrorDetails}`);
        if (failureReason) console.log(`[Assignment]   ${failureReason}`);

        const errorMsg = [phoneError, phoneErrorDetails, policyError, policyErrorDetails, failureReason]
          .filter(Boolean)
          .join("\n");

        throw new Error(`PowerShell assignment failed:\n${errorMsg || "Unknown error"}`);
      } else {
        console.log(`[Assignment] INCOMPLETE: Phone success: ${hasPhoneSuccess}, Policy success: ${hasPolicySuccess}`);
        throw new Error(`Assignment incomplete - Phone: ${hasPhoneSuccess}, Policy: ${hasPolicySuccess}`);
      }

      console.log(`[Assignment] SUCCESS: Both phone and policy assigned successfully`);

      // Update local database to mark number as used
      const operatorEmail = req.user?.email || "unknown";
      const localNumber = await storage.getPhoneNumberByLineUri(tenantId, phoneNumber);
      if (localNumber) {
        await storage.updatePhoneNumber(localNumber.id, {
          status: "used",
          displayName: user.displayName,
          userPrincipalName: user.userPrincipalName,
          onlineVoiceRoutingPolicy: routingPolicy,
          lastModifiedBy: operatorEmail,
        });
        console.log(`Updated phone number ${phoneNumber} to used in local database`);
      } else {
        console.log(`Phone number ${phoneNumber} not found in local database - skipping update`);
      }

      // Close the temporary PowerShell session
      if (sessionId) {
        powershellSessionManager.closeSession(sessionId);
        sessionId = null;
      }

      // Query after state for audit log
      const afterState = await queryUserState(certCredentials, userPrincipalName);

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
        beforeState: beforeState,
        afterState: afterState,
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
          // Get PowerShell credentials for state query
          const psCredentialsList = await storage.getTenantPowershellCredentials(tenantId);
          if (psCredentialsList && psCredentialsList.length > 0) {
            const psCredentials = psCredentialsList[0];

            // Build certificate credentials for state query
            const certCredentials: PowerShellCertificateCredentials = {
              tenantId: tenant.tenantId,
              appId: psCredentials.appId,
              certificateThumbprint: psCredentials.certificateThumbprint,
            };

            // Query before state for failure audit log
            const beforeState = await queryUserState(certCredentials, userId);

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
              beforeState: beforeState,
            });
          }
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

      // Query before state for audit log
      const beforeState = await queryUserState(certCredentials, userPrincipalName);

      // Execute PowerShell command to assign phone number
      const result = await assignPhoneNumberCert(certCredentials, userPrincipalName, phoneNumber, locationId);

      if (result.success) {
        // Query after state for success audit log
        const afterState = await queryUserState(certCredentials, userPrincipalName);

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
          beforeState: beforeState,
          afterState: afterState,
        });

        res.json({
          success: true,
          message: `Phone number ${phoneNumber} successfully assigned to ${userPrincipalName}`,
          output: result.output,
        });
      } else {
        // Create failure audit log (only beforeState, no afterState since it failed)
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
          beforeState: beforeState,
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
          const rawPolicies = JSON.parse(result.output);

          // Transform PowerShell format to frontend format
          const policies = (Array.isArray(rawPolicies) ? rawPolicies : [rawPolicies]).map((p: any) => ({
            id: p.Identity || "",
            name: p.Identity ? p.Identity.replace(/^Tag:/i, "") : "",
            description: p.Description || "",
            pstnUsages: p.OnlinePstnUsages || []
          }));

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

  // Generic endpoint: Get policies for any policy type (operator auth required)
  app.post("/api/teams/policies/:type", requireOperatorAuth, async (req, res) => {
    try {
      const { type } = req.params;
      const { tenantId } = req.body;

      // Validate policy type
      if (!type || !(type in policyTypeConfig)) {
        return res.status(400).json({
          error: "Invalid policy type",
          validTypes: Object.keys(policyTypeConfig)
        });
      }

      if (!tenantId) {
        return res.status(400).json({ error: "Missing required field: tenantId" });
      }

      const policyType = type as PolicyType;

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
        tenantId: tenant.tenantId,
        appId: psCredentials.appId,
        certificateThumbprint: psCredentials.certificateThumbprint,
      };

      // Execute PowerShell command to get policies
      const result = await getTeamsPoliciesCert(certCredentials, policyType);

      if (result.success) {
        try {
          // Try to parse JSON output from PowerShell
          const rawPolicies = JSON.parse(result.output);

          // Transform PowerShell format to frontend format
          const policies = (Array.isArray(rawPolicies) ? rawPolicies : [rawPolicies]).map((p: any) => ({
            id: p.Identity || "",
            name: p.Identity ? p.Identity.replace(/^Tag:/i, "") : "",
            description: p.Description || "",
            type: policyType
          }));

          res.json({
            success: true,
            policies,
            policyType,
          });
        } catch (parseError) {
          // If JSON parsing fails, return raw output
          res.json({
            success: true,
            rawOutput: result.output,
            policyType,
          });
        }
      } else {
        res.status(500).json({
          success: false,
          error: result.error || `Failed to get ${policyTypeConfig[policyType].displayName} via PowerShell`,
          output: result.output,
        });
      }
    } catch (error) {
      console.error("Error getting policies via PowerShell:", error);
      res.status(500).json({ error: "Failed to get policies via PowerShell" });
    }
  });

  // Generic endpoint: Assign any policy type to a user (operator auth required)
  app.post("/api/teams/assign-policy", requireOperatorAuth, async (req, res) => {
    try {
      const { tenantId, userPrincipalName, policyType, policyName } = req.body;

      // Validate required fields
      if (!tenantId || !userPrincipalName || !policyType || !policyName) {
        return res.status(400).json({
          error: "Missing required fields: tenantId, userPrincipalName, policyType, policyName"
        });
      }

      // Validate policy type
      if (!(policyType in policyTypeConfig)) {
        return res.status(400).json({
          error: "Invalid policy type",
          validTypes: Object.keys(policyTypeConfig)
        });
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
        tenantId: tenant.tenantId,
        appId: psCredentials.appId,
        certificateThumbprint: psCredentials.certificateThumbprint,
      };

      // Execute PowerShell command to grant policy
      console.log(`[Assign Policy] Calling grantTeamsPolicyCert for user ${userPrincipalName}, policyType=${policyType}, policyName=${policyName}`);
      const result = await grantTeamsPolicyCert(certCredentials, userPrincipalName, policyType as PolicyType, policyName);
      console.log(`[Assign Policy] Result: success=${result.success}, error=${result.error}, output length=${result.output?.length || 0}`);

      if (result.success) {
        console.log(`[Assign Policy] ✓ Successfully assigned policy to ${userPrincipalName}`);
        res.json({
          success: true,
          message: `Successfully assigned ${policyTypeConfig[policyType as PolicyType].displayName} '${policyName}' to ${userPrincipalName}`,
          output: result.output,
        });
      } else {
        console.error(`[Assign Policy] ✗ Failed to assign policy. Full error:`, result.error);
        console.error(`[Assign Policy] ✗ PowerShell output:`, result.output);
        res.status(500).json({
          success: false,
          error: result.error || `Failed to assign ${policyTypeConfig[policyType as PolicyType].displayName}`,
          output: result.output,
        });
      }
    } catch (error) {
      console.error("Error assigning policy via PowerShell:", error);
      res.status(500).json({ error: "Failed to assign policy via PowerShell" });
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

      // Query before state for audit log
      const beforeState = await queryUserState(certCredentials, userPrincipalName);

      // Execute PowerShell command to assign policy
      const result = await grantVoiceRoutingPolicyCert(certCredentials, userPrincipalName, policyName);

      if (result.success) {
        // Query after state for success audit log
        const afterState = await queryUserState(certCredentials, userPrincipalName);

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
          beforeState: beforeState,
          afterState: afterState,
        });

        res.json({
          success: true,
          message: `Voice routing policy ${policyName} successfully assigned to ${userPrincipalName}`,
          output: result.output,
        });
      } else {
        // Create failure audit log (only beforeState, no afterState since it failed)
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
          beforeState: beforeState,
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

      // Query before state for audit log
      const beforeState = await queryUserState(certCredentials, userPrincipalName);

      // Execute combined PowerShell command (assigns both phone and policy in one operation)
      const result = await assignPhoneAndPolicyCert(certCredentials, userPrincipalName, phoneNumber, policyName, locationId);

      if (result.success) {
        // Query after state for success audit log
        const afterState = await queryUserState(certCredentials, userPrincipalName);

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
          beforeState: beforeState,
          afterState: afterState,
        });

        res.json({
          success: true,
          message: `Successfully assigned phone number ${phoneNumber} and policy ${policyName} to ${userPrincipalName}`,
          output: result.output,
        });
      } else {
        // Create failure audit log (only beforeState, no afterState since it failed)
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
          beforeState: beforeState,
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

      // Get the audit log entry by ID
      const logEntry = await storage.getAuditLog(auditLogId);

      if (!logEntry) {
        return res.status(404).json({ error: "Audit log entry not found" });
      }

      // Check if this entry has before_state for rollback
      if (!logEntry.beforeState) {
        return res.status(400).json({ error: "Cannot rollback: no before_state captured" });
      }

      if (!logEntry.targetUserUpn) {
        return res.status(400).json({ error: "Cannot rollback: missing user UPN" });
      }

      // Check if this is a rollback entry itself
      if (logEntry.changeType === "rollback") {
        return res.status(400).json({ error: "Cannot rollback a rollback entry" });
      }

      // Check if not successful or already rolled back
      if (logEntry.status !== "success") {
        return res.status(400).json({ error: "Can only rollback successful changes" });
      }

      // Get tenant information (audit logs store Azure tenant ID, not internal ID)
      const tenant = await storage.getTenantByTenantId(logEntry.tenantId);
      if (!tenant) {
        return res.status(400).json({ error: "Tenant not found" });
      }

      // Get PowerShell credentials
      const psCredentialsList = await storage.getTenantPowershellCredentials(tenant.id);
      if (!psCredentialsList || psCredentialsList.length === 0) {
        return res.status(400).json({ error: "No PowerShell credentials configured for this tenant" });
      }

      const psCredentials = psCredentialsList[0];
      const certCredentials: PowerShellCertificateCredentials = {
        tenantId: tenant.tenantId,
        appId: psCredentials.appId,
        certificateThumbprint: psCredentials.certificateThumbprint,
      };

      // Extract phone and policy from before_state
      const rollbackPhoneNumber = (logEntry.beforeState.LineURI || "").replace(/^tel:/i, "");
      const rollbackRoutingPolicy = logEntry.beforeState.OnlineVoiceRoutingPolicy?.Name || logEntry.beforeState.OnlineVoiceRoutingPolicy || "Global";

      // Normalize "Global" policy (PowerShell uses $null for Global) and remove "Tag:" prefix
      const cleanPolicy = (rollbackRoutingPolicy || "").replace(/^Tag:/i, "");
      const normalizedPolicy = cleanPolicy === "Global" || !cleanPolicy ? "Global" : cleanPolicy;

      console.log(`[Rollback] Reverting ${logEntry.targetUserName} to:`);
      console.log(`[Rollback]   Phone: ${rollbackPhoneNumber}`);
      console.log(`[Rollback]   Policy: ${normalizedPolicy}`);

      // Query current state before rollback
      const beforeRollbackState = await queryUserState(certCredentials, logEntry.targetUserUpn);

      // Perform the rollback using PowerShell
      const result = await assignPhoneAndPolicyCert(
        certCredentials,
        logEntry.targetUserUpn,
        rollbackPhoneNumber,
        normalizedPolicy
      );

      if (!result.success) {
        throw new Error(result.error || "Rollback failed");
      }

      // Query state after rollback
      const afterRollbackState = await queryUserState(certCredentials, logEntry.targetUserUpn);

      // Mark the original log entry as rolled back
      await storage.updateAuditLog(logEntry.id, {
        status: "rolled_back",
      });

      // Create audit log for the rollback
      await storage.createAuditLog({
        operatorEmail: req.user.email,
        operatorName: req.user.displayName,
        tenantId: logEntry.tenantId,
        tenantName: logEntry.tenantName,
        targetUserUpn: logEntry.targetUserUpn,
        targetUserName: logEntry.targetUserName,
        targetUserId: logEntry.targetUserId,
        changeType: "rollback",
        changeDescription: `Rolled back change from ${format(logEntry.timestamp, "MMM dd, yyyy HH:mm:ss")}: restored phone ${rollbackPhoneNumber} and policy ${normalizedPolicy}`,
        phoneNumber: rollbackPhoneNumber,
        routingPolicy: normalizedPolicy,
        previousPhoneNumber: logEntry.phoneNumber,
        previousRoutingPolicy: logEntry.routingPolicy,
        status: "success",
        beforeState: beforeRollbackState,
        afterState: afterRollbackState,
      });

      res.json({
        success: true,
        message: "Change rolled back successfully",
        rolledBackTo: {
          phone: rollbackPhoneNumber,
          policy: normalizedPolicy
        }
      });
    } catch (error) {
      console.error("Error rolling back change:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to rollback change" });
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
  // Setup synthetic transactions (for testing audit logs)
  const { setupSyntheticTransactions } = await import("./synthetic-transactions");
  setupSyntheticTransactions(app);
  // Setup comprehensive synthetic tests
  const { setupComprehensiveSyntheticTests } = await import("./comprehensive-synthetic-tests");
  setupComprehensiveSyntheticTests(app);



  const httpServer = createServer(app);

  return httpServer;
}
