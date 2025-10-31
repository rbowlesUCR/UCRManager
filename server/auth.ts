import { ConfidentialClientApplication, type AuthorizationUrlRequest, type AuthorizationCodeRequest } from "@azure/msal-node";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { decrypt } from "./encryption";

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}

// Cached MSAL client to reuse across requests
let cachedMsalClient: ConfidentialClientApplication | null = null;
let cachedConfigId: string | null = null;

// Get or create MSAL client instance from database configuration
// Reuses existing client unless config has changed
async function getMsalClient(): Promise<ConfidentialClientApplication> {
  const config = await storage.getOperatorConfig();
  
  if (!config) {
    throw new Error("Operator configuration not found. Please configure Azure AD credentials in admin settings.");
  }

  // Return cached client if config hasn't changed
  if (cachedMsalClient && cachedConfigId === config.id) {
    return cachedMsalClient;
  }

  // Decrypt the client secret
  const clientSecret = decrypt(config.azureClientSecret);

  const msalConfig = {
    auth: {
      clientId: config.azureClientId,
      authority: `https://login.microsoftonline.com/${config.azureTenantId}`,
      clientSecret,
    },
  };

  // Create new client and cache it
  cachedMsalClient = new ConfidentialClientApplication(msalConfig);
  cachedConfigId = config.id;

  return cachedMsalClient;
}

// Invalidate cached MSAL client when config is updated
export function invalidateMsalClientCache(): void {
  cachedMsalClient = null;
  cachedConfigId = null;
}

export async function getAuthUrl(): Promise<string> {
  const msalClient = await getMsalClient();
  const config = await storage.getOperatorConfig();
  
  if (!config) {
    throw new Error("Operator configuration not found. Please configure Azure AD credentials in admin settings.");
  }
  
  const authCodeUrlParameters: AuthorizationUrlRequest = {
    scopes: ["User.Read", "offline_access"],
    redirectUri: config.redirectUri,
  };

  return msalClient.getAuthCodeUrl(authCodeUrlParameters) as any;
}

export async function getTokenFromCode(code: string): Promise<any> {
  const msalClient = await getMsalClient();
  const config = await storage.getOperatorConfig();
  
  if (!config) {
    throw new Error("Operator configuration not found. Please configure Azure AD credentials in admin settings.");
  }
  
  const tokenRequest: AuthorizationCodeRequest = {
    code,
    scopes: ["User.Read", "offline_access"],
    redirectUri: config.redirectUri,
  };

  const response = await msalClient.acquireTokenByCode(tokenRequest);
  return response;
}

export function createJWT(payload: any): string {
  return jwt.sign(payload, process.env.SESSION_SECRET!, { expiresIn: "24h" });
}

export function verifyJWT(token: string): any {
  try {
    return jwt.verify(token, process.env.SESSION_SECRET!);
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Middleware to verify operator session (validates against database)
export async function requireOperatorAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.operatorToken;
  
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const payload = verifyJWT(token);
  if (!payload) {
    res.clearCookie("operatorToken");
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // Verify operator user exists and is active in database
  const operatorUser = await storage.getOperatorUser(payload.id);
  if (!operatorUser) {
    res.clearCookie("operatorToken");
    return res.status(401).json({ error: "User not found" });
  }

  if (!operatorUser.isActive) {
    res.clearCookie("operatorToken");
    return res.status(403).json({ error: "Account deactivated" });
  }

  // Update payload with current role from database
  req.user = {
    ...payload,
    role: operatorUser.role,
  };
  next();
}

// Middleware to verify admin session (accepts both local admin and operator users with admin role)
// Validates operator users against database to prevent stale token privilege escalation
export async function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const adminToken = req.cookies?.adminToken;
  const operatorToken = req.cookies?.operatorToken;
  
  // Try admin token first (local admin)
  if (adminToken) {
    const payload = verifyJWT(adminToken);
    if (payload && payload.role === "admin" && payload.isLocalAdmin) {
      req.user = payload;
      return next();
    }
  }
  
  // Try operator token with admin role (verify against database)
  if (operatorToken) {
    const payload = verifyJWT(operatorToken);
    if (payload && !payload.isLocalAdmin) {
      // Verify operator user exists, is active, and has admin role in database
      const operatorUser = await storage.getOperatorUser(payload.id);
      if (operatorUser && operatorUser.isActive && operatorUser.role === "admin") {
        req.user = {
          ...payload,
          role: operatorUser.role, // Use current role from database
        };
        return next();
      }
      
      // Clear invalid/stale operator token
      if (!operatorUser || !operatorUser.isActive || operatorUser.role !== "admin") {
        res.clearCookie("operatorToken");
      }
    }
  }

  return res.status(401).json({ error: "Unauthorized - Admin access required" });
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}
