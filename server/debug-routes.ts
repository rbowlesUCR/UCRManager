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

  // ===== NUMBER MANAGEMENT DEBUG ENDPOINTS =====

  // Seed test phone numbers for a tenant
  app.post("/api/debug/numbers/seed/:tenantId", checkDebugEnabled, async (req, res) => {
    try {
      const { tenantId } = req.params;
      const { count = 10 } = req.body;

      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      const createdNumbers = [];
      const carriers = ["AT&T", "Verizon", "T-Mobile", "Sprint", "Bandwidth"];
      const locations = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix"];
      const policies = ["Default", "US-Policy", "International", "Emergency-Only"];
      const statuses = ["available", "used", "reserved", "aging"];
      const types = ["did", "extension", "toll-free", "mailbox"];

      for (let i = 0; i < count; i++) {
        const phoneNumber = await storage.createPhoneNumber({
          tenantId,
          lineUri: `tel:+1555${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`,
          displayName: `Test User ${i + 1}`,
          userPrincipalName: `testuser${i + 1}@${tenant.tenantName.toLowerCase().replace(/\s/g, '')}.com`,
          carrier: carriers[Math.floor(Math.random() * carriers.length)],
          location: locations[Math.floor(Math.random() * locations.length)],
          usageLocation: "US",
          onlineVoiceRoutingPolicy: policies[Math.floor(Math.random() * policies.length)],
          numberType: types[Math.floor(Math.random() * types.length)] as any,
          status: statuses[Math.floor(Math.random() * statuses.length)] as any,
          notes: `Test number ${i + 1} - Auto-generated for testing`,
          tags: `test,debug,seed-${Date.now()}`,
          numberRange: "+1555123xxxx",
          createdBy: "debug-system",
          lastModifiedBy: "debug-system",
        });
        createdNumbers.push(phoneNumber);
      }

      res.json({
        success: true,
        count: createdNumbers.length,
        numbers: createdNumbers,
        message: `Successfully seeded ${createdNumbers.length} test phone numbers`
      });
    } catch (error) {
      console.error("Debug seed numbers error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });

  // Get all numbers for a tenant with detailed stats
  app.get("/api/debug/numbers/list/:tenantId", checkDebugEnabled, async (req, res) => {
    try {
      const { tenantId } = req.params;
      const { status, numberType } = req.query;

      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      const filters: any = { tenantId };
      if (status) filters.status = status;
      if (numberType) filters.numberType = numberType;

      const numbers = await storage.getPhoneNumbers(filters);
      const statistics = await storage.getPhoneNumberStatistics(tenantId);

      res.json({
        success: true,
        tenant: tenant.tenantName,
        filters,
        count: numbers.length,
        statistics,
        numbers: numbers.slice(0, 50), // Limit to first 50 for debug display
        hasMore: numbers.length > 50
      });
    } catch (error) {
      console.error("Debug list numbers error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Test CSV parsing
  app.post("/api/debug/numbers/test-csv-parse", checkDebugEnabled, async (req, res) => {
    try {
      const { csvData } = req.body;

      if (!csvData) {
        return res.status(400).json({ error: "csvData is required in request body" });
      }

      // Simple CSV parser for testing
      const lines = csvData.split('\n').map((line: string) => line.trim()).filter((line: string) => line.length > 0);
      if (lines.length < 2) {
        return res.status(400).json({ error: "CSV must have at least a header row and one data row" });
      }

      const headers = lines[0].split(',').map((h: string) => h.trim().replace(/^"|"$/g, ''));
      const parsedRows = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map((v: string) => v.trim().replace(/^"|"$/g, ''));
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        parsedRows.push(row);
      }

      res.json({
        success: true,
        rowCount: parsedRows.length,
        headers,
        parsedRows,
        sample: parsedRows.slice(0, 5)
      });
    } catch (error) {
      console.error("Debug CSV parse error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Test bulk update
  app.post("/api/debug/numbers/test-bulk-update/:tenantId", checkDebugEnabled, async (req, res) => {
    try {
      const { tenantId } = req.params;
      const { count = 5, updates } = req.body;

      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      // Get some numbers to update
      const numbers = await storage.getPhoneNumbers({ tenantId });
      const numbersToUpdate = numbers.slice(0, Math.min(count, numbers.length));

      if (numbersToUpdate.length === 0) {
        return res.status(400).json({ error: "No numbers found to update. Seed some numbers first." });
      }

      const results = [];
      for (const number of numbersToUpdate) {
        const updated = await storage.updatePhoneNumber(number.id, {
          ...updates,
          lastModifiedBy: "debug-system"
        });
        results.push(updated);
      }

      res.json({
        success: true,
        updatedCount: results.length,
        updates,
        numbers: results
      });
    } catch (error) {
      console.error("Debug bulk update error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Test next available number finder
  app.get("/api/debug/numbers/next-available/:tenantId", checkDebugEnabled, async (req, res) => {
    try {
      const { tenantId } = req.params;
      const { numberRange } = req.query;

      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      if (!numberRange || typeof numberRange !== 'string') {
        return res.status(400).json({ error: "numberRange query parameter is required (e.g., +1555123xxxx)" });
      }

      // Get all numbers in this range
      const numbersInRange = await storage.getPhoneNumbersByRange(tenantId, numberRange);

      // Extract the pattern (replace x's with actual range)
      const pattern = numberRange.replace(/x/g, '\\d');
      const regex = new RegExp(pattern);

      // Find all used numbers matching the pattern
      const usedNumbers = numbersInRange
        .filter(n => regex.test(n.lineUri))
        .map(n => n.lineUri);

      res.json({
        success: true,
        tenant: tenant.tenantName,
        numberRange,
        pattern,
        usedCount: usedNumbers.length,
        usedNumbers: usedNumbers.slice(0, 20),
        message: "Use this data to implement smart next-available logic"
      });
    } catch (error) {
      console.error("Debug next available error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Clean up test numbers (remove all numbers with debug tag)
  app.delete("/api/debug/numbers/cleanup/:tenantId", checkDebugEnabled, async (req, res) => {
    try {
      const { tenantId } = req.params;

      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      const numbers = await storage.getPhoneNumbers({ tenantId });
      const debugNumbers = numbers.filter((n: any) =>
        n.tags && (n.tags.includes('test') || n.tags.includes('debug'))
      );

      let deletedCount = 0;
      for (const number of debugNumbers) {
        await storage.deletePhoneNumber(number.id);
        deletedCount++;
      }

      res.json({
        success: true,
        deletedCount,
        message: `Cleaned up ${deletedCount} test/debug numbers`
      });
    } catch (error) {
      console.error("Debug cleanup error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Test statistics endpoint
  app.get("/api/debug/numbers/statistics/:tenantId", checkDebugEnabled, async (req, res) => {
    try {
      const { tenantId } = req.params;

      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      const stats = await storage.getPhoneNumberStatistics(tenantId);

      res.json({
        success: true,
        tenant: tenant.tenantName,
        statistics: stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Debug statistics error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // ===== LIFECYCLE DEBUGGING ENDPOINTS =====

  // Manually trigger a lifecycle check
  app.post("/api/debug/lifecycle/run-check", checkDebugEnabled, async (req, res) => {
    try {
      const { lifecycleManager } = await import("./lifecycle-manager");
      const result = await lifecycleManager.runLifecycleCheck();
      res.json({
        success: true,
        result,
        message: "Lifecycle check completed successfully"
      });
    } catch (error) {
      console.error("Debug lifecycle check error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });

  // Get lifecycle statistics
  app.get("/api/debug/lifecycle/stats", checkDebugEnabled, async (req, res) => {
    try {
      const { lifecycleManager } = await import("./lifecycle-manager");
      const stats = await lifecycleManager.getLifecycleStats();
      res.json({
        success: true,
        stats,
        message: "Lifecycle statistics retrieved successfully"
      });
    } catch (error) {
      console.error("Debug lifecycle stats error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });

  // Create test aging scenario
  app.post("/api/debug/lifecycle/test-aging/:tenantId", checkDebugEnabled, async (req, res) => {
    try {
      const { tenantId } = req.params;
      const { count = 5 } = req.body;

      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      // Create numbers with different aging scenarios
      const testNumbers = [];
      const now = new Date();

      for (let i = 0; i < count; i++) {
        const agingUntil = new Date(now);

        // Create numbers with different expiration dates
        if (i === 0) {
          // Already expired (should transition immediately)
          agingUntil.setDate(agingUntil.getDate() - 1);
        } else if (i === 1) {
          // Expires in 1 day
          agingUntil.setDate(agingUntil.getDate() + 1);
        } else if (i === 2) {
          // Expires in 7 days
          agingUntil.setDate(agingUntil.getDate() + 7);
        } else {
          // Expires in 30+ days
          agingUntil.setDate(agingUntil.getDate() + 30 + i);
        }

        const number = await storage.createPhoneNumber({
          tenantId,
          lineUri: `tel:+1555999${String(8000 + i).padStart(4, '0')}`,
          displayName: `Test Aging Number ${i + 1}`,
          userPrincipalName: `test.aging${i + 1}@test.com`,
          numberType: "did",
          status: "aging",
          agingUntil,
          notes: `Test aging number - expires ${agingUntil.toISOString()}`,
          tags: `test,debug,aging,lifecycle-test-${Date.now()}`,
          numberRange: "+1555999xxxx",
          createdBy: "debug-system",
          lastModifiedBy: "debug-system",
        });

        testNumbers.push({
          id: number.id,
          lineUri: number.lineUri,
          status: number.status,
          agingUntil: number.agingUntil,
          daysUntilExpiry: Math.ceil((agingUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        });
      }

      res.json({
        success: true,
        count: testNumbers.length,
        numbers: testNumbers,
        message: `Created ${testNumbers.length} test aging numbers with various expiration dates`,
        nextAction: "Run POST /api/debug/lifecycle/run-check to test aging transitions"
      });
    } catch (error) {
      console.error("Debug test aging error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });

  // ===== CONNECTWISE DEBUGGING =====

  // Test ConnectWise API connection
  app.post("/api/debug/connectwise/test-connection/:tenantId", checkDebugEnabled, async (req, res) => {
    try {
      const { tenantId } = req.params;
      const { testConnection } = await import("./connectwise");
      const result = await testConnection(tenantId);
      res.json(result);
    } catch (error) {
      console.error("Debug ConnectWise connection test error:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });

  // Search ConnectWise tickets
  app.get("/api/debug/connectwise/tickets/search/:tenantId", checkDebugEnabled, async (req, res) => {
    try {
      const { tenantId } = req.params;
      const { q = "", limit = "10" } = req.query;
      const { searchTickets } = await import("./connectwise");
      const tickets = await searchTickets(tenantId, q as string, parseInt(limit as string));
      res.json({
        success: true,
        count: tickets.length,
        query: q,
        tickets
      });
    } catch (error) {
      console.error("Debug ConnectWise search error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get ConnectWise ticket details
  app.get("/api/debug/connectwise/tickets/:tenantId/:ticketId", checkDebugEnabled, async (req, res) => {
    try {
      const { tenantId, ticketId } = req.params;
      const { getTicket } = await import("./connectwise");
      const ticket = await getTicket(tenantId, parseInt(ticketId));
      res.json({
        success: true,
        ticket
      });
    } catch (error) {
      console.error("Debug ConnectWise get ticket error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Add note to ConnectWise ticket
  app.post("/api/debug/connectwise/tickets/:tenantId/:ticketId/notes", checkDebugEnabled, async (req, res) => {
    try {
      const { tenantId, ticketId } = req.params;
      const { noteText, memberIdentifier, isInternal = false } = req.body;
      const { addTicketNote } = await import("./connectwise");
      await addTicketNote(tenantId, parseInt(ticketId), noteText, memberIdentifier, isInternal);
      res.json({
        success: true,
        message: `Note added to ticket ${ticketId}`
      });
    } catch (error) {
      console.error("Debug ConnectWise add note error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Add time entry to ConnectWise ticket
  app.post("/api/debug/connectwise/tickets/:tenantId/:ticketId/time", checkDebugEnabled, async (req, res) => {
    try {
      const { tenantId, ticketId } = req.params;
      const { memberIdentifier, hours, notes, workTypeId } = req.body;
      const { addTimeEntry } = await import("./connectwise");
      await addTimeEntry(tenantId, parseInt(ticketId), memberIdentifier, hours, notes, workTypeId);
      res.json({
        success: true,
        message: `Time entry (${hours}h) added to ticket ${ticketId}`
      });
    } catch (error) {
      console.error("Debug ConnectWise add time error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Update ConnectWise ticket status
  app.patch("/api/debug/connectwise/tickets/:tenantId/:ticketId/status", checkDebugEnabled, async (req, res) => {
    try {
      const { tenantId, ticketId } = req.params;
      const { statusId } = req.body;
      const { updateTicketStatus } = await import("./connectwise");
      await updateTicketStatus(tenantId, parseInt(ticketId), statusId);
      res.json({
        success: true,
        message: `Ticket ${ticketId} status updated to ${statusId}`
      });
    } catch (error) {
      console.error("Debug ConnectWise update status error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Get available statuses
  app.get("/api/debug/connectwise/statuses/:tenantId", checkDebugEnabled, async (req, res) => {
    try {
      const { tenantId } = req.params;
      const { boardId } = req.query;
      const { getTicketStatuses } = await import("./connectwise");
      const statuses = await getTicketStatuses(tenantId, boardId ? parseInt(boardId as string) : undefined);
      res.json({
        success: true,
        count: statuses.length,
        statuses
      });
    } catch (error) {
      console.error("Debug ConnectWise get statuses error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Comprehensive ConnectWise test
  app.post("/api/debug/connectwise/comprehensive-test/:tenantId", checkDebugEnabled, async (req, res) => {
    try {
      const { tenantId } = req.params;
      const { ticketId, memberIdentifier } = req.body;

      const results: any = {
        timestamp: new Date().toISOString(),
        tenantId,
        tests: {}
      };

      // Test 1: Connection
      console.log("[ConnectWise Debug] Testing connection...");
      const { testConnection } = await import("./connectwise");
      results.tests.connection = await testConnection(tenantId);

      // Test 2: Search tickets
      console.log("[ConnectWise Debug] Searching tickets...");
      const { searchTickets } = await import("./connectwise");
      const searchResults = await searchTickets(tenantId, ticketId ? ticketId.toString() : "", 5);
      results.tests.search = {
        success: true,
        ticketsFound: searchResults.length,
        tickets: searchResults
      };

      // Test 3: Get ticket details (if ticketId provided)
      if (ticketId) {
        console.log(`[ConnectWise Debug] Getting ticket ${ticketId}...`);
        const { getTicket } = await import("./connectwise");
        const ticket = await getTicket(tenantId, parseInt(ticketId));
        results.tests.getTicket = {
          success: ticket !== null,
          ticket
        };

        // Test 4: Add note (if memberIdentifier provided)
        if (memberIdentifier) {
          console.log(`[ConnectWise Debug] Adding test note to ticket ${ticketId}...`);
          const { addTicketNote } = await import("./connectwise");
          await addTicketNote(
            tenantId,
            parseInt(ticketId),
            `[DEBUG TEST] ConnectWise integration test - ${new Date().toISOString()}`,
            memberIdentifier,
            true
          );
          results.tests.addNote = {
            success: true,
            message: "Test note added successfully"
          };

          // Test 5: Add time entry
          console.log(`[ConnectWise Debug] Adding test time entry to ticket ${ticketId}...`);
          const { addTimeEntry } = await import("./connectwise");
          await addTimeEntry(
            tenantId,
            parseInt(ticketId),
            memberIdentifier,
            0.25,
            "[DEBUG TEST] ConnectWise integration test time entry"
          );
          results.tests.addTime = {
            success: true,
            message: "Test time entry (15 min) added successfully"
          };
        }
      }

      // Test 6: Get statuses
      console.log("[ConnectWise Debug] Fetching available statuses...");
      const { getTicketStatuses } = await import("./connectwise");
      const statuses = await getTicketStatuses(tenantId);
      results.tests.statuses = {
        success: true,
        count: statuses.length,
        statuses: statuses.slice(0, 10) // Return first 10 only
      };

      res.json({
        success: true,
        results
      });
    } catch (error) {
      console.error("Debug ConnectWise comprehensive test error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });

  console.log(`
  ┌─────────────────────────────────────────────────────┐
  │  🔧 DEBUG ENDPOINTS AVAILABLE                       │
  ├─────────────────────────────────────────────────────┤
  │  PowerShell Debugging:                              │
  │  GET  /api/debug/status                             │
  │  GET  /api/debug/powershell/credentials/:tenantId   │
  │  POST /api/debug/powershell/test-cert-connection/:tenantId │
  │  POST /api/debug/powershell/get-policies/:tenantId  │
  │  POST /api/debug/powershell/execute/:tenantId       │
  │  POST /api/debug/powershell/check-certificate/:tenantId │
  │  GET  /api/debug/powershell/list-certificates       │
  ├─────────────────────────────────────────────────────┤
  │  Number Management Debugging:                       │
  │  POST /api/debug/numbers/seed/:tenantId             │
  │  GET  /api/debug/numbers/list/:tenantId             │
  │  POST /api/debug/numbers/test-csv-parse             │
  │  POST /api/debug/numbers/test-bulk-update/:tenantId │
  │  GET  /api/debug/numbers/next-available/:tenantId   │
  │  DELETE /api/debug/numbers/cleanup/:tenantId        │
  │  GET  /api/debug/numbers/statistics/:tenantId       │
  ├─────────────────────────────────────────────────────┤
  │  Number Lifecycle Debugging:                        │
  │  POST /api/debug/lifecycle/run-check                │
  │  GET  /api/debug/lifecycle/stats                    │
  │  POST /api/debug/lifecycle/test-aging/:tenantId     │
  ├─────────────────────────────────────────────────────┤
  │  ConnectWise Integration Debugging:                 │
  │  POST /api/debug/connectwise/test-connection/:tenantId │
  │  GET  /api/debug/connectwise/tickets/search/:tenantId │
  │  GET  /api/debug/connectwise/tickets/:tenantId/:ticketId │
  │  POST /api/debug/connectwise/tickets/:tenantId/:ticketId/notes │
  │  POST /api/debug/connectwise/tickets/:tenantId/:ticketId/time │
  │  PATCH /api/debug/connectwise/tickets/:tenantId/:ticketId/status │
  │  GET  /api/debug/connectwise/statuses/:tenantId     │
  │  POST /api/debug/connectwise/comprehensive-test/:tenantId │
  ├─────────────────────────────────────────────────────┤
  │  To disable: Set DEBUG_MODE=false                   │
  └─────────────────────────────────────────────────────┘
  `);
}
