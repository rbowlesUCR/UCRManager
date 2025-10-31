import { db } from "../db";
import { operatorConfig } from "@shared/schema";
import { encrypt } from "../encryption";
import { sql } from "drizzle-orm";

async function runMigration() {
  try {
    console.log("Creating operator_config table...");

    // Create table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS operator_config (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        azure_tenant_id TEXT NOT NULL,
        azure_client_id TEXT NOT NULL,
        azure_client_secret TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    console.log("Operator config table created successfully");

    // Check if operator config already exists
    const existing = await db.select().from(operatorConfig).limit(1);

    if (existing.length === 0) {
      // Initialize with environment variables if they exist
      const azureTenantId = process.env.AZURE_TENANT_ID;
      const azureClientId = process.env.AZURE_CLIENT_ID;
      const azureClientSecret = process.env.AZURE_CLIENT_SECRET;

      if (azureTenantId && azureClientId && azureClientSecret) {
        console.log("Initializing operator config with environment variables...");

        // Encrypt the client secret before storing
        const encryptedSecret = encrypt(azureClientSecret);

        await db.insert(operatorConfig).values({
          azureTenantId,
          azureClientId,
          azureClientSecret: encryptedSecret,
        });

        console.log("Operator config initialized successfully");
      } else {
        console.log(
          "Warning: AZURE_TENANT_ID, AZURE_CLIENT_ID, or AZURE_CLIENT_SECRET environment variables not set. Operator config not initialized."
        );
      }
    } else {
      console.log("Operator config already exists, skipping initialization");
    }
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

runMigration()
  .then(() => {
    console.log("Migration completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
