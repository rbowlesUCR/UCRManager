/**
 * Phone Number Lifecycle Manager
 *
 * Handles automatic status transitions for phone numbers:
 * - Reserved → Aging (when reservation expires)
 * - Aging → Available (when aging period completes)
 *
 * This service runs periodically to check and update number statuses.
 */

import { db } from "./db";
import { phoneNumberInventory } from "@shared/schema";
import { eq, lt, and } from "drizzle-orm";
import { storage } from "./storage";

export interface LifecycleConfig {
  // How long a number can be reserved before it enters aging (in days)
  reservationPeriodDays: number;
  // How long a number stays in aging before becoming available (in days)
  agingPeriodDays: number;
  // How often to run the lifecycle check (in milliseconds)
  checkIntervalMs: number;
}

const DEFAULT_CONFIG: LifecycleConfig = {
  reservationPeriodDays: 30, // Reserved numbers age after 30 days
  agingPeriodDays: 90, // Aging numbers become available after 90 days
  checkIntervalMs: 3600000, // Check every hour (3600000ms = 1 hour)
};

export class PhoneNumberLifecycleManager {
  private config: LifecycleConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(config?: Partial<LifecycleConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the lifecycle manager
   */
  start() {
    if (this.isRunning) {
      console.log("⏳ Lifecycle manager is already running");
      return;
    }

    console.log("🔄 Starting phone number lifecycle manager...");
    console.log(`   - Reservation period: ${this.config.reservationPeriodDays} days`);
    console.log(`   - Aging period: ${this.config.agingPeriodDays} days`);
    console.log(`   - Check interval: ${this.config.checkIntervalMs / 1000}s`);

    // Run immediately on start
    this.runLifecycleCheck();

    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.runLifecycleCheck();
    }, this.config.checkIntervalMs);

    this.isRunning = true;
  }

  /**
   * Stop the lifecycle manager
   */
  stop() {
    if (!this.isRunning) {
      console.log("⏳ Lifecycle manager is not running");
      return;
    }

    console.log("🛑 Stopping phone number lifecycle manager...");
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  /**
   * Run a single lifecycle check
   * Can be called manually or by the scheduler
   */
  async runLifecycleCheck() {
    try {
      console.log(`🔍 Running lifecycle check at ${new Date().toISOString()}`);

      const agingResults = await this.transitionExpiredAgingToAvailable();
      const reservedResults = await this.transitionExpiredReservedToAging();

      console.log(`✅ Lifecycle check complete:`);
      console.log(`   - ${agingResults} numbers transitioned from aging → available`);
      console.log(`   - ${reservedResults} numbers transitioned from reserved → aging`);

      return {
        agingToAvailable: agingResults,
        reservedToAging: reservedResults,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("❌ Error during lifecycle check:", error);
      throw error;
    }
  }

  /**
   * Transition aging numbers to available when aging period expires
   */
  private async transitionExpiredAgingToAvailable(): Promise<number> {
    const now = new Date();

    // Find all numbers in "aging" status where agingUntil has passed
    const expiredAgingNumbers = await db
      .select()
      .from(phoneNumberInventory)
      .where(
        and(
          eq(phoneNumberInventory.status, "aging"),
          lt(phoneNumberInventory.agingUntil, now)
        )
      );

    if (expiredAgingNumbers.length === 0) {
      return 0;
    }

    console.log(`   🔄 Transitioning ${expiredAgingNumbers.length} aging numbers to available`);

    // Update each number to available status
    for (const number of expiredAgingNumbers) {
      await db
        .update(phoneNumberInventory)
        .set({
          status: "available",
          reservedBy: null,
          reservedAt: null,
          agingUntil: null,
          lastModifiedBy: "lifecycle-manager",
          updatedAt: now,
        })
        .where(eq(phoneNumberInventory.id, number.id));

      console.log(`      ↳ ${number.lineUri} → available`);
    }

    return expiredAgingNumbers.length;
  }

  /**
   * Transition reserved numbers to aging when reservation expires
   * Reserved numbers don't automatically go to aging - this would be a manual process
   * or triggered by specific business logic. This method is here for completeness.
   */
  private async transitionExpiredReservedToAging(): Promise<number> {
    // For now, this is a placeholder. Reserved numbers typically need manual intervention
    // to move to aging status. The business logic might be:
    // 1. Admin manually releases a reserved number
    // 2. Reserved number is returned by a user
    // 3. Project/order is cancelled

    // If automatic aging is needed, you could check reservedAt timestamps:
    // const cutoffDate = new Date();
    // cutoffDate.setDate(cutoffDate.getDate() - this.config.reservationPeriodDays);

    return 0;
  }

  /**
   * Manually transition a number to aging status
   * Sets the agingUntil timestamp based on configured aging period
   */
  async transitionToAging(numberId: string, initiatedBy: string): Promise<boolean> {
    try {
      const number = await storage.getPhoneNumber(numberId);
      if (!number) {
        console.error(`Number ${numberId} not found`);
        return false;
      }

      // Calculate aging expiration date
      const agingUntil = new Date();
      agingUntil.setDate(agingUntil.getDate() + this.config.agingPeriodDays);

      await storage.updatePhoneNumber(numberId, {
        status: "aging",
        agingUntil,
        lastModifiedBy: initiatedBy,
      });

      console.log(`📆 ${number.lineUri} → aging (until ${agingUntil.toISOString()})`);
      return true;
    } catch (error) {
      console.error(`Error transitioning number ${numberId} to aging:`, error);
      return false;
    }
  }

  /**
   * Reserve a number for a specific user/purpose
   */
  async reserveNumber(numberId: string, reservedBy: string, initiatedBy: string): Promise<boolean> {
    try {
      const number = await storage.getPhoneNumber(numberId);
      if (!number) {
        console.error(`Number ${numberId} not found`);
        return false;
      }

      if (number.status !== "available") {
        console.error(`Number ${numberId} is not available (current status: ${number.status})`);
        return false;
      }

      await storage.updatePhoneNumber(numberId, {
        status: "reserved",
        reservedBy,
        reservedAt: new Date(),
        lastModifiedBy: initiatedBy,
      });

      console.log(`🔒 ${number.lineUri} → reserved by ${reservedBy}`);
      return true;
    } catch (error) {
      console.error(`Error reserving number ${numberId}:`, error);
      return false;
    }
  }

  /**
   * Release a reserved number to aging status
   */
  async releaseReservedNumber(numberId: string, initiatedBy: string): Promise<boolean> {
    try {
      const number = await storage.getPhoneNumber(numberId);
      if (!number) {
        console.error(`Number ${numberId} not found`);
        return false;
      }

      if (number.status !== "reserved") {
        console.error(`Number ${numberId} is not reserved (current status: ${number.status})`);
        return false;
      }

      // Move to aging when released
      return await this.transitionToAging(numberId, initiatedBy);
    } catch (error) {
      console.error(`Error releasing reserved number ${numberId}:`, error);
      return false;
    }
  }

  /**
   * Get lifecycle statistics
   */
  async getLifecycleStats() {
    const now = new Date();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + 7); // Numbers expiring in next 7 days

    const allNumbers = await db.select().from(phoneNumberInventory);

    const agingSoon = allNumbers.filter(
      n => n.status === "aging" && n.agingUntil && n.agingUntil <= cutoffDate
    );

    const reserved = allNumbers.filter(n => n.status === "reserved");

    return {
      total: allNumbers.length,
      aging: allNumbers.filter(n => n.status === "aging").length,
      agingExpiringSoon: agingSoon.length,
      reserved: reserved.length,
      available: allNumbers.filter(n => n.status === "available").length,
      used: allNumbers.filter(n => n.status === "used").length,
    };
  }
}

// Singleton instance
export const lifecycleManager = new PhoneNumberLifecycleManager();
