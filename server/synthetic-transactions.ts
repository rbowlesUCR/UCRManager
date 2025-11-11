import { Express } from "express";
import { storage } from "./storage";
import { requireAdminAuth } from "./auth";

/**
 * SYNTHETIC TRANSACTIONS - FOR TESTING AUDIT LOGS
 *
 * This module runs automated test scenarios to verify audit log functionality
 * Can be toggled on/off via feature flags
 */

export function setupSyntheticTransactions(app: Express) {
  // Run synthetic transaction tests
  app.post("/api/debug/synthetic/run-tests/:tenantId", requireAdminAuth, async (req, res) => {
    try {
      const { tenantId } = req.params;

      // Check if synthetic transactions are enabled
      const syntheticFlag = await storage.getFeatureFlagByKey("synthetic_transactions");
      if (!syntheticFlag || !syntheticFlag.isEnabled) {
        return res.status(403).json({
          error: "Synthetic transactions are disabled. Enable via Admin → Features."
        });
      }

      console.log("[Synthetic] Starting synthetic transaction tests...");

      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      // Get test user (DevUser)
      const testUserUpn = "DevUser@ucrdev.onmicrosoft.com";

      const results = {
        tenantId,
        tenantName: tenant.tenantName,
        testUser: testUserUpn,
        timestamp: new Date().toISOString(),
        scenarios: [] as any[],
        auditLogs: [] as any[]
      };

      console.log(`[Synthetic] Running tests on tenant: ${tenant.tenantName}`);
      console.log(`[Synthetic] Test user: ${testUserUpn}`);

      // Helper function to make authenticated requests
      const makeRequest = async (url: string, body: any) => {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cookie": req.headers.cookie || ""
          },
          body: JSON.stringify(body)
        });
        return { response, data: await response.json() };
      };

      // Test Scenario 1: Change phone number
      console.log("\n[Synthetic] Scenario 1: Change phone number to +15554441217");
      try {
        const { response, data } = await makeRequest(`https://localhost/api/teams/assign-voice`, {
          tenantId,
          userId: testUserUpn,
          phoneNumber: "tel:+15554441217",
          routingPolicy: "Test Policy"
        });

        results.scenarios.push({
          scenario: "Change phone to +15554441217",
          success: response.ok,
          auditLogId: data.auditLog?.id,
          beforeState: data.auditLog?.beforeState,
          afterState: data.auditLog?.afterState,
          status: response.status
        });

        if (data.auditLog) {
          results.auditLogs.push(data.auditLog);
        }

        console.log(`[Synthetic] ✓ Scenario 1 completed: ${response.ok ? 'SUCCESS' : 'FAILED'}`);
      } catch (error) {
        console.error(`[Synthetic] ✗ Scenario 1 error:`, error);
        results.scenarios.push({
          scenario: "Change phone to +15554441217",
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // Wait 3 seconds between scenarios
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Test Scenario 2: Change back to original phone number
      console.log("\n[Synthetic] Scenario 2: Change phone number back to +15551111217");
      try {
        const { response, data } = await makeRequest(`https://localhost/api/teams/assign-voice`, {
          tenantId,
          userId: testUserUpn,
          phoneNumber: "tel:+15551111217",
          routingPolicy: "Global"
        });

        results.scenarios.push({
          scenario: "Change phone back to +15551111217 with Global policy",
          success: response.ok,
          auditLogId: data.auditLog?.id,
          beforeState: data.auditLog?.beforeState,
          afterState: data.auditLog?.afterState,
          status: response.status
        });

        if (data.auditLog) {
          results.auditLogs.push(data.auditLog);
        }

        console.log(`[Synthetic] ✓ Scenario 2 completed: ${response.ok ? 'SUCCESS' : 'FAILED'}`);
      } catch (error) {
        console.error(`[Synthetic] ✗ Scenario 2 error:`, error);
        results.scenarios.push({
          scenario: "Change phone back to +15551111217",
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // Wait 3 seconds
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Test Scenario 3: Change just the policy
      console.log("\n[Synthetic] Scenario 3: Change policy to 'Test Policy'");
      try {
        const { response, data } = await makeRequest(`https://localhost/api/teams/assign-voice`, {
          tenantId,
          userId: testUserUpn,
          phoneNumber: "tel:+15551111217",
          routingPolicy: "Test Policy"
        });

        results.scenarios.push({
          scenario: "Change policy to 'Test Policy'",
          success: response.ok,
          auditLogId: data.auditLog?.id,
          beforeState: data.auditLog?.beforeState,
          afterState: data.auditLog?.afterState,
          status: response.status
        });

        if (data.auditLog) {
          results.auditLogs.push(data.auditLog);
        }

        console.log(`[Synthetic] ✓ Scenario 3 completed: ${response.ok ? 'SUCCESS' : 'FAILED'}`);
      } catch (error) {
        console.error(`[Synthetic] ✗ Scenario 3 error:`, error);
        results.scenarios.push({
          scenario: "Change policy to 'Test Policy'",
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // Get all audit logs created during this test
      const allAuditLogs = await storage.getAllAuditLogs();
      const testAuditLogs = allAuditLogs.filter(log =>
        log.tenantId === tenantId &&
        log.targetUserUpn === testUserUpn &&
        new Date(log.timestamp).getTime() > new Date(results.timestamp).getTime() - 120000 // Last 2 minutes
      );

      console.log(`\n[Synthetic] Test completed!`);
      console.log(`[Synthetic] Total scenarios: ${results.scenarios.length}`);
      console.log(`[Synthetic] Successful: ${results.scenarios.filter(s => s.success).length}`);
      console.log(`[Synthetic] Failed: ${results.scenarios.filter(s => !s.success).length}`);
      console.log(`[Synthetic] Audit logs created: ${testAuditLogs.length}`);

      res.json({
        ...results,
        summary: {
          total: results.scenarios.length,
          successful: results.scenarios.filter(s => s.success).length,
          failed: results.scenarios.filter(s => !s.success).length,
          auditLogsCreated: testAuditLogs.length
        },
        recentAuditLogs: testAuditLogs
      });
    } catch (error) {
      console.error("[Synthetic] Error running synthetic tests:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });

  // Get synthetic transaction status
  app.get("/api/debug/synthetic/status", requireAdminAuth, async (req, res) => {
    try {
      const syntheticFlag = await storage.getFeatureFlagByKey("synthetic_transactions");
      res.json({
        enabled: syntheticFlag?.isEnabled || false,
        featureFlag: syntheticFlag
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}
