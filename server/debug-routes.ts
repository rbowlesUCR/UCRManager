import { Express } from "express";
import { storage } from "./storage";
import { requireAdminAuth } from "./auth";
import {
  testCertificateConnection,
  executePowerShellWithCertificate,
  getVoiceRoutingPoliciesCert
} from "./powershell";
import type { PowerShellCertificateCredentials } from "./powershell";
import { debugState } from "./debug-state";

/**
 * DEBUG ROUTES - FOR DEVELOPMENT/TESTING ONLY
 *
 * These routes help diagnose PowerShell certificate authentication issues
 *
 * Can be toggled on/off via admin UI or environment variable
 */

export function setupDebugRoutes(app: Express) {
  // Add endpoints to manage debug mode state
  app.get("/api/admin/debug/status", requireAdminAuth, (req, res) => {
    res.json({
      enabled: debugState.isEnabled(),
      timestamp: new Date().toISOString(),
    });
  });

  app.post("/api/admin/debug/enable", requireAdminAuth, (req, res) => {
    debugState.enable();
    res.json({
      enabled: true,
      message: "Debug mode enabled"
    });
  });

  app.post("/api/admin/debug/disable", requireAdminAuth, (req, res) => {
    debugState.disable();
    res.json({
      enabled: false,
      message: "Debug mode disabled"
    });
  });

  app.post("/api/admin/debug/toggle", requireAdminAuth, (req, res) => {
    const enabled = debugState.toggle();
    res.json({
      enabled,
      message: `Debug mode ${enabled ? 'enabled' : 'disabled'}`
    });
  });

  if (!debugState.isEnabled()) {
    console.log("Debug routes disabled. Enable via admin panel or set DEBUG_MODE=true");
    return;
  }

  console.log("⚠️  DEBUG MODE ENABLED - Debug routes are active");

  // Middleware to check if debug is enabled for debug routes
  const checkDebugEnabled = (req: any, res: any, next: any) => {
    if (!debugState.isEnabled()) {
      return res.status(403).json({ error: "Debug mode is disabled. Enable it in the admin panel." });
    }
    next();
  };

  // Get debug status
  app.get("/api/debug/status", checkDebugEnabled, (req, res) => {
    res.json({
      debugEnabled: debugState.isEnabled(),
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        DEBUG_MODE: process.env.DEBUG_MODE,
      }
    });
  });

  // Test certificate retrieval from database
  app.get("/api/debug/powershell/credentials/:tenantId", checkDebugEnabled, async (req, res) => {
    try {
      const { tenantId } = req.params;

      // Get tenant
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      // Get credentials
      const credentials = await storage.getTenantPowershellCredentials(tenantId);
      const active = credentials.find(cred => cred.isActive);

      if (!active) {
        return res.status(404).json({ error: "No active credentials found" });
      }

      res.json({
        tenant: {
          id: tenant.id,
          tenantId: tenant.tenantId,
          tenantName: tenant.tenantName,
        },
        credentials: {
          id: active.id,
          hasAppId: !!active.appId,
          appId: active.appId?.substring(0, 8) + "...", // Show partial for security
          hasCertificateThumbprint: !!active.certificateThumbprint,
          certificateThumbprint: active.certificateThumbprint?.substring(0, 8) + "...",
          isActive: active.isActive,
        }
      });
    } catch (error) {
      console.error("Debug credentials error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });

  // Test certificate connection directly
  app.post("/api/debug/powershell/test-cert-connection/:tenantId", checkDebugEnabled, async (req, res) => {
    try {
      const { tenantId } = req.params;

      // Get tenant
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      // Get credentials
      const credentials = await storage.getTenantPowershellCredentials(tenantId);
      const active = credentials.find(cred => cred.isActive);

      if (!active || !active.appId || !active.certificateThumbprint) {
        return res.status(404).json({
          error: "No active certificate credentials found",
          hasAppId: !!active?.appId,
          hasCertThumbprint: !!active?.certificateThumbprint
        });
      }

      const certCredentials: PowerShellCertificateCredentials = {
        tenantId: tenant.tenantId,
        appId: active.appId,
        certificateThumbprint: active.certificateThumbprint,
      };

      console.log("DEBUG: Testing certificate connection with:", {
        azureTenantId: certCredentials.tenantId,
        appId: certCredentials.appId.substring(0, 8) + "...",
        thumbprint: certCredentials.certificateThumbprint.substring(0, 8) + "...",
      });

      const result = await testCertificateConnection(certCredentials);

      res.json({
        success: result.success,
        output: result.output,
        error: result.error,
        exitCode: result.exitCode,
        credentials: {
          azureTenantId: certCredentials.tenantId,
          appIdPartial: certCredentials.appId.substring(0, 8) + "...",
          thumbprintPartial: certCredentials.certificateThumbprint.substring(0, 8) + "...",
        }
      });
    } catch (error) {
      console.error("Debug test connection error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });

  // Test getting voice routing policies via PowerShell
  app.post("/api/debug/powershell/get-policies/:tenantId", checkDebugEnabled, async (req, res) => {
    try {
      const { tenantId } = req.params;

      // Get tenant
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      // Get credentials
      const credentials = await storage.getTenantPowershellCredentials(tenantId);
      const active = credentials.find(cred => cred.isActive);

      if (!active || !active.appId || !active.certificateThumbprint) {
        return res.status(404).json({
          error: "No active certificate credentials found"
        });
      }

      const certCredentials: PowerShellCertificateCredentials = {
        tenantId: tenant.tenantId,
        appId: active.appId,
        certificateThumbprint: active.certificateThumbprint,
      };

      console.log("DEBUG: Getting voice routing policies via PowerShell");

      const result = await getVoiceRoutingPoliciesCert(certCredentials);

      res.json({
        success: result.success,
        policies: result.policies,
        output: result.output,
        error: result.error,
      });
    } catch (error) {
      console.error("Debug get policies error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });

  // Execute arbitrary PowerShell script with certificate auth
  app.post("/api/debug/powershell/execute/:tenantId", checkDebugEnabled, async (req, res) => {
    try {
      const { tenantId } = req.params;
      const { script } = req.body;

      if (!script) {
        return res.status(400).json({ error: "Script is required in request body" });
      }

      // Get tenant
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      // Get credentials
      const credentials = await storage.getTenantPowershellCredentials(tenantId);
      const active = credentials.find(cred => cred.isActive);

      if (!active || !active.appId || !active.certificateThumbprint) {
        return res.status(404).json({
          error: "No active certificate credentials found"
        });
      }

      const certCredentials: PowerShellCertificateCredentials = {
        tenantId: tenant.tenantId,
        appId: active.appId,
        certificateThumbprint: active.certificateThumbprint,
      };

      console.log("DEBUG: Executing PowerShell script:", script.substring(0, 100) + "...");

      const result = await executePowerShellWithCertificate(
        certCredentials,
        script,
        undefined,
        60000 // 60 second timeout
      );

      res.json({
        success: result.success,
        output: result.output,
        error: result.error,
        exitCode: result.exitCode,
      });
    } catch (error) {
      console.error("Debug execute script error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });

  // Check if certificate exists in Windows cert store
  app.post("/api/debug/powershell/check-certificate/:tenantId", checkDebugEnabled, async (req, res) => {
    try {
      const { tenantId } = req.params;

      // Get credentials
      const credentials = await storage.getTenantPowershellCredentials(tenantId);
      const active = credentials.find(cred => cred.isActive);

      if (!active || !active.certificateThumbprint) {
        return res.status(404).json({
          error: "No certificate thumbprint found"
        });
      }

      const script = `
$thumbprint = "${active.certificateThumbprint}"
$cert = Get-ChildItem -Path Cert:\\LocalMachine\\My | Where-Object { $_.Thumbprint -eq $thumbprint }

if ($cert) {
    @{
        Found = $true
        Subject = $cert.Subject
        Thumbprint = $cert.Thumbprint
        NotBefore = $cert.NotBefore.ToString("yyyy-MM-dd HH:mm:ss")
        NotAfter = $cert.NotAfter.ToString("yyyy-MM-dd HH:mm:ss")
        HasPrivateKey = $cert.HasPrivateKey
    } | ConvertTo-Json
} else {
    @{
        Found = $false
        Thumbprint = $thumbprint
    } | ConvertTo-Json
}
`;

      const { executePowerShellScript } = await import("./powershell");
      const result = await executePowerShellScript(script, undefined, 15000);

      let certInfo = null;
      if (result.success && result.output) {
        try {
          certInfo = JSON.parse(result.output);
        } catch (e) {
          // Couldn't parse, return raw
        }
      }

      res.json({
        success: result.success,
        certificateInfo: certInfo,
        rawOutput: result.output,
        error: result.error,
      });
    } catch (error) {
      console.error("Debug check certificate error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });

  // List all certificates in LocalMachine\My store
  app.get("/api/debug/powershell/list-certificates", checkDebugEnabled, async (req, res) => {
    try {
      const script = `
Get-ChildItem -Path Cert:\\LocalMachine\\My | ForEach-Object {
    @{
        Subject = $_.Subject
        Thumbprint = $_.Thumbprint
        NotAfter = $_.NotAfter.ToString("yyyy-MM-dd HH:mm:ss")
        HasPrivateKey = $_.HasPrivateKey
    }
} | ConvertTo-Json
`;

      const { executePowerShellScript } = await import("./powershell");
      const result = await executePowerShellScript(script, undefined, 15000);

      let certificates = null;
      if (result.success && result.output) {
        try {
          certificates = JSON.parse(result.output);
          // Ensure it's an array
          if (!Array.isArray(certificates)) {
            certificates = [certificates];
          }
        } catch (e) {
          // Couldn't parse
        }
      }

      res.json({
        success: result.success,
        certificates,
        rawOutput: result.output,
        error: result.error,
      });
    } catch (error) {
      console.error("Debug list certificates error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });

  console.log(`
  ┌─────────────────────────────────────────────────────┐
  │  🔧 DEBUG ENDPOINTS AVAILABLE                       │
  ├─────────────────────────────────────────────────────┤
  │  GET  /api/debug/status                             │
  │  GET  /api/debug/powershell/credentials/:tenantId   │
  │  POST /api/debug/powershell/test-cert-connection/:tenantId │
  │  POST /api/debug/powershell/get-policies/:tenantId  │
  │  POST /api/debug/powershell/execute/:tenantId       │
  │  POST /api/debug/powershell/check-certificate/:tenantId │
  │  GET  /api/debug/powershell/list-certificates       │
  ├─────────────────────────────────────────────────────┤
  │  To disable: Set DEBUG_MODE=false                   │
  └─────────────────────────────────────────────────────┘
  `);
}
