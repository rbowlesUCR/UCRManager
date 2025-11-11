import { Express } from "express";
import { storage } from "./storage";
import { requireAdminAuth } from "./auth";
import https from "https";

/**
 * COMPREHENSIVE SYNTHETIC TRANSACTIONS
 * Tests the entire application end-to-end including:
 * - Voice configuration changes
 * - Audit log creation with before/after state
 * - Policy assignments (including Global)
 * - Sequential phone number changes
 * - Error handling and recovery
 */

interface TestScenario {
  name: string;
  phone: string;
  policy: string;
  expectedSuccess: boolean;
  description: string;
}

export function setupComprehensiveSyntheticTests(app: Express) {
  app.post("/api/debug/synthetic/comprehensive-test/:tenantId", requireAdminAuth, async (req, res) => {
    try {
      const { tenantId } = req.params;
      const startTime = new Date();

      // Check if synthetic transactions are enabled
      const syntheticFlag = await storage.getFeatureFlagByKey("synthetic_transactions");
      if (!syntheticFlag || !syntheticFlag.isEnabled) {
        return res.status(403).json({
          error: "Synthetic transactions are disabled. Enable via Admin → Features."
        });
      }

      console.log("\n" + "=".repeat(80));
      console.log("🚀 COMPREHENSIVE SYNTHETIC TRANSACTION TEST SUITE");
      console.log("=".repeat(80));

      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      const testUserUpn = "DevUser@ucrdev.onmicrosoft.com";

      console.log(`\n📋 Test Configuration:`);
      console.log(`   Tenant: ${tenant.tenantName} (${tenantId})`);
      console.log(`   Test User: ${testUserUpn}`);
      console.log(`   Start Time: ${startTime.toISOString()}`);

      // Define comprehensive test scenarios
      const scenarios: TestScenario[] = [
        {
          name: "Scenario 1: Increment Phone + Test Policy",
          phone: "tel:+15551111218",
          policy: "Test Policy",
          expectedSuccess: true,
          description: "Change phone from 217 to 218 and set Test Policy"
        },
        {
          name: "Scenario 2: Increment Phone + Keep Policy",
          phone: "tel:+15551111219",
          policy: "Test Policy",
          expectedSuccess: true,
          description: "Change phone from 218 to 219, keep Test Policy"
        },
        {
          name: "Scenario 3: Keep Phone + Change to Global",
          phone: "tel:+15551111219",
          policy: "Global",
          expectedSuccess: true,
          description: "Keep phone at 219, change policy to Global"
        },
        {
          name: "Scenario 4: Decrement Phone + Keep Global",
          phone: "tel:+15551111218",
          policy: "Global",
          expectedSuccess: true,
          description: "Change phone from 219 to 218, keep Global policy"
        },
        {
          name: "Scenario 5: Reset to Original + Test Policy",
          phone: "tel:+15551111217",
          policy: "Test Policy",
          expectedSuccess: true,
          description: "Reset phone to 217, change to Test Policy"
        },
        {
          name: "Scenario 6: Final State - Original Config",
          phone: "tel:+15551111217",
          policy: "Global",
          expectedSuccess: true,
          description: "Return to original configuration (217 + Global)"
        }
      ];

      const results = {
        testSuiteId: `test-${Date.now()}`,
        tenantId,
        tenantName: tenant.tenantName,
        testUser: testUserUpn,
        startTime: startTime.toISOString(),
        scenarios: [] as any[],
        auditLogIds: [] as string[],
        summary: {
          total: scenarios.length,
          successful: 0,
          failed: 0,
          auditLogsCreated: 0
        }
      };

      // Execute each scenario
      for (let i = 0; i < scenarios.length; i++) {
        const scenario = scenarios[i];

        console.log(`\n${"─".repeat(80)}`);
        console.log(`📍 ${scenario.name}`);
        console.log(`${"─".repeat(80)}`);
        console.log(`   Description: ${scenario.description}`);
        console.log(`   Phone: ${scenario.phone}`);
        console.log(`   Policy: ${scenario.policy}`);
        console.log(`   Expected: ${scenario.expectedSuccess ? 'SUCCESS' : 'FAILURE'}`);

        try {
          // Make the request using internal API via native https module
          const requestBody = JSON.stringify({
            tenantId,
            userId: testUserUpn,
            phoneNumber: scenario.phone,
            routingPolicy: scenario.policy
          });

          const data: any = await new Promise((resolve, reject) => {
            const options = {
              hostname: 'localhost',
              port: 443,
              path: '/api/teams/assign-voice',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestBody),
                'Cookie': req.headers.cookie || ''
              },
              rejectUnauthorized: false
            };

            const httpsReq = https.request(options, (res) => {
              let responseData = '';
              res.on('data', (chunk) => {
                responseData += chunk;
              });
              res.on('end', () => {
                try {
                  const parsed = JSON.parse(responseData);
                  resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                  reject(new Error(`Failed to parse response: ${responseData}`));
                }
              });
            });

            httpsReq.on('error', (error) => {
              reject(error);
            });

            httpsReq.write(requestBody);
            httpsReq.end();
          });

          const success = data.status >= 200 && data.status < 300;
          const responseData = data.data;

          console.log(`   Result: ${success ? '✅ SUCCESS' : '❌ FAILED'} (${data.status})`);

          if (responseData.auditLog) {
            console.log(`   Audit Log ID: ${responseData.auditLog.id}`);
            results.auditLogIds.push(responseData.auditLog.id);
            results.summary.auditLogsCreated++;

            // Show state changes
            if (responseData.auditLog.beforeState && responseData.auditLog.afterState) {
              const before = responseData.auditLog.beforeState;
              const after = responseData.auditLog.afterState;

              console.log(`\n   📊 State Changes:`);
              if (before.LineURI !== after.LineURI) {
                console.log(`      📞 Phone: ${before.LineURI} → ${after.LineURI}`);
              }
              if (before.OnlineVoiceRoutingPolicy !== after.OnlineVoiceRoutingPolicy) {
                console.log(`      🔀 Policy: ${before.OnlineVoiceRoutingPolicy || 'null'} → ${after.OnlineVoiceRoutingPolicy || 'null'}`);
              }
            } else {
              console.log(`   ⚠️  WARNING: No before/after state captured!`);
            }
          }

          results.scenarios.push({
            scenarioNumber: i + 1,
            name: scenario.name,
            phone: scenario.phone,
            policy: scenario.policy,
            success,
            httpStatus: data.status,
            auditLogId: responseData.auditLog?.id,
            hasBeforeState: !!responseData.auditLog?.beforeState,
            hasAfterState: !!responseData.auditLog?.afterState,
            error: responseData.error || null,
            duration: responseData.duration || null
          });

          if (success) {
            results.summary.successful++;
          } else {
            results.summary.failed++;
          }

        } catch (error) {
          console.log(`   ❌ ERROR: ${error instanceof Error ? error.message : String(error)}`);
          results.scenarios.push({
            scenarioNumber: i + 1,
            name: scenario.name,
            phone: scenario.phone,
            policy: scenario.policy,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
          results.summary.failed++;
        }

        // Wait 4 seconds between scenarios to avoid overwhelming the system
        if (i < scenarios.length - 1) {
          console.log(`\n   ⏳ Waiting 4 seconds before next scenario...`);
          await new Promise(resolve => setTimeout(resolve, 4000));
        }
      }

      const endTime = new Date();
      const duration = (endTime.getTime() - startTime.getTime()) / 1000;

      console.log(`\n${"=".repeat(80)}`);
      console.log(`📊 TEST SUITE COMPLETE`);
      console.log(`${"=".repeat(80)}`);
      console.log(`   Duration: ${duration}s`);
      console.log(`   Total Scenarios: ${results.summary.total}`);
      console.log(`   Successful: ${results.summary.successful}`);
      console.log(`   Failed: ${results.summary.failed}`);
      console.log(`   Audit Logs Created: ${results.summary.auditLogsCreated}`);
      console.log(`${"=".repeat(80)}\n`);

      // Fetch the actual audit logs to verify they have before/after state
      const verifiedAuditLogs = [];
      for (const auditLogId of results.auditLogIds) {
        const log = await storage.getAuditLog(auditLogId);
        if (log) {
          verifiedAuditLogs.push({
            id: log.id,
            timestamp: log.timestamp,
            changeType: log.changeType,
            status: log.status,
            hasBeforeState: log.beforeState !== null,
            hasAfterState: log.afterState !== null,
            phoneChanged: log.beforeState && log.afterState &&
              log.beforeState.LineURI !== log.afterState.LineURI,
            policyChanged: log.beforeState && log.afterState &&
              log.beforeState.OnlineVoiceRoutingPolicy !== log.afterState.OnlineVoiceRoutingPolicy
          });
        }
      }

      res.json({
        ...results,
        endTime: endTime.toISOString(),
        durationSeconds: duration,
        verifiedAuditLogs,
        recommendation: results.summary.successful === results.summary.total
          ? "✅ All tests passed! Audit logging system is working correctly."
          : "⚠️ Some tests failed. Review the audit logs and error messages."
      });

    } catch (error) {
      console.error("\n❌ TEST SUITE ERROR:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });

  // Quick health check endpoint
  app.get("/api/debug/synthetic/health", requireAdminAuth, async (req, res) => {
    try {
      const syntheticFlag = await storage.getFeatureFlagByKey("synthetic_transactions");
      const recentLogs = await storage.getAllAuditLogs();
      const devUserLogs = recentLogs.filter(log =>
        log.targetUserUpn === "DevUser@ucrdev.onmicrosoft.com"
      ).slice(0, 5);

      res.json({
        status: "healthy",
        syntheticTransactionsEnabled: syntheticFlag?.isEnabled || false,
        recentAuditLogs: devUserLogs.length,
        lastAuditLog: devUserLogs[0] || null,
        hasBeforeAfterState: devUserLogs[0]?.beforeState !== null && devUserLogs[0]?.afterState !== null
      });
    } catch (error) {
      res.status(500).json({
        status: "unhealthy",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}
