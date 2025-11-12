// Referenced from javascript_database blueprint
import {
  adminUsers,
  customerTenants,
  auditLogs,
  configurationProfiles,
  operatorConfig,
  operatorUsers,
  tenantPowershellCredentials,
  phoneNumberInventory,
  countryCodes,
  featureFlags,
  type AdminUser,
  type InsertAdminUser,
  type CustomerTenant,
  type InsertCustomerTenant,
  type AuditLog,
  type InsertAuditLog,
  type ConfigurationProfile,
  type InsertConfigurationProfile,
  type OperatorConfig,
  type InsertOperatorConfig,
  type OperatorUser,
  type InsertOperatorUser,
  type TenantPowershellCredentials,
  type InsertTenantPowershellCredentials,
  type PhoneNumberInventory,
  type InsertPhoneNumberInventory,
  type CountryCode,
  type InsertCountryCode,
  type FeatureFlag,
  type InsertFeatureFlag,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, inArray, sql } from "drizzle-orm";

export interface IStorage {
  // Admin users
  getAdminUser(id: string): Promise<AdminUser | undefined>;
  getAdminUserByUsername(username: string): Promise<AdminUser | undefined>;
  createAdminUser(user: InsertAdminUser): Promise<AdminUser>;
  updateAdminPassword(id: string, hashedPassword: string): Promise<void>;
  updateAdminUsername(id: string, username: string): Promise<void>;

  // Operator users (RBAC)
  getOperatorUser(azureUserId: string): Promise<OperatorUser | undefined>;
  getAllOperatorUsers(): Promise<OperatorUser[]>;
  createOperatorUser(user: InsertOperatorUser): Promise<OperatorUser>;
  updateOperatorUser(id: string, updates: Partial<InsertOperatorUser>): Promise<OperatorUser | undefined>;
  deleteOperatorUser(id: string): Promise<boolean>;

  // Customer tenants
  getTenant(id: string): Promise<CustomerTenant | undefined>;
  getTenantByTenantId(tenantId: string): Promise<CustomerTenant | undefined>;
  getAllTenants(): Promise<CustomerTenant[]>;
  getAllTenantsIncludingInactive(): Promise<CustomerTenant[]>;
  createTenant(tenant: InsertCustomerTenant): Promise<CustomerTenant>;
  updateTenant(id: string, tenant: Partial<InsertCustomerTenant>): Promise<CustomerTenant | undefined>;
  deleteTenant(id: string): Promise<boolean>;

  // Audit logs
  getAuditLog(id: string): Promise<AuditLog | undefined>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAllAuditLogs(): Promise<AuditLog[]>;
  updateAuditLog(id: string, updates: Partial<AuditLog>): Promise<AuditLog | undefined>;

  // Configuration profiles
  getProfile(id: string): Promise<ConfigurationProfile | undefined>;
  getProfilesByTenant(tenantId: string): Promise<ConfigurationProfile[]>;
  createProfile(profile: InsertConfigurationProfile): Promise<ConfigurationProfile>;
  updateProfile(id: string, profile: Partial<InsertConfigurationProfile>): Promise<ConfigurationProfile | undefined>;
  deleteProfile(id: string): Promise<boolean>;

  // Operator configuration (singleton)
  getOperatorConfig(): Promise<OperatorConfig | undefined>;
  updateOperatorConfig(updates: Partial<InsertOperatorConfig>): Promise<OperatorConfig | undefined>;

  // Tenant PowerShell credentials (per-tenant, multiple credentials supported)
  getTenantPowershellCredentials(tenantId: string): Promise<TenantPowershellCredentials[]>;
  getTenantPowershellCredentialById(id: string): Promise<TenantPowershellCredentials | undefined>;
  createTenantPowershellCredentials(credentials: InsertTenantPowershellCredentials): Promise<TenantPowershellCredentials>;
  updateTenantPowershellCredentials(id: string, updates: Partial<InsertTenantPowershellCredentials>): Promise<TenantPowershellCredentials>;
  deleteTenantPowershellCredentials(id: string): Promise<boolean>;

  // Feature flags
  getAllFeatureFlags(): Promise<FeatureFlag[]>;
  getFeatureFlagByKey(featureKey: string): Promise<FeatureFlag | undefined>;
  updateFeatureFlag(featureKey: string, isEnabled: boolean): Promise<FeatureFlag>;
}

export class DatabaseStorage implements IStorage {
  // Admin users
  async getAdminUser(id: string): Promise<AdminUser | undefined> {
    const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
    return user || undefined;
  }

  async getAdminUserByUsername(username: string): Promise<AdminUser | undefined> {
    const [user] = await db.select().from(adminUsers).where(eq(adminUsers.username, username));
    return user || undefined;
  }

  async createAdminUser(insertUser: InsertAdminUser): Promise<AdminUser> {
    const [user] = await db
      .insert(adminUsers)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateAdminPassword(id: string, hashedPassword: string): Promise<void> {
    await db
      .update(adminUsers)
      .set({ password: hashedPassword })
      .where(eq(adminUsers.id, id));
  }

  async updateAdminUsername(id: string, username: string): Promise<void> {
    await db
      .update(adminUsers)
      .set({ username })
      .where(eq(adminUsers.id, id));
  }

  // Operator users (RBAC)
  async getOperatorUser(azureUserId: string): Promise<OperatorUser | undefined> {
    const [user] = await db.select().from(operatorUsers).where(eq(operatorUsers.azureUserId, azureUserId));
    return user || undefined;
  }

  async getAllOperatorUsers(): Promise<OperatorUser[]> {
    return await db.select().from(operatorUsers).orderBy(desc(operatorUsers.createdAt));
  }

  async createOperatorUser(insertUser: InsertOperatorUser): Promise<OperatorUser> {
    const [user] = await db
      .insert(operatorUsers)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateOperatorUser(id: string, updates: Partial<InsertOperatorUser>): Promise<OperatorUser | undefined> {
    const [user] = await db
      .update(operatorUsers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(operatorUsers.id, id))
      .returning();
    return user || undefined;
  }

  async deleteOperatorUser(id: string): Promise<boolean> {
    await db
      .delete(operatorUsers)
      .where(eq(operatorUsers.id, id));
    return true;
  }

  // Customer tenants
  async getTenant(id: string): Promise<CustomerTenant | undefined> {
    const [tenant] = await db.select().from(customerTenants).where(eq(customerTenants.id, id));
    return tenant || undefined;
  }

  async getTenantByTenantId(tenantId: string): Promise<CustomerTenant | undefined> {
    const [tenant] = await db.select().from(customerTenants).where(eq(customerTenants.tenantId, tenantId));
    return tenant || undefined;
  }

  async getAllTenants(): Promise<CustomerTenant[]> {
    return await db.select().from(customerTenants).where(eq(customerTenants.isActive, true));
  }

  async getAllTenantsIncludingInactive(): Promise<CustomerTenant[]> {
    return await db.select().from(customerTenants);
  }

  async createTenant(insertTenant: InsertCustomerTenant): Promise<CustomerTenant> {
    const [tenant] = await db
      .insert(customerTenants)
      .values(insertTenant)
      .returning();
    return tenant;
  }

  async updateTenant(id: string, updates: Partial<InsertCustomerTenant>): Promise<CustomerTenant | undefined> {
    const [tenant] = await db
      .update(customerTenants)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(customerTenants.id, id))
      .returning();
    return tenant || undefined;
  }

  async deleteTenant(id: string): Promise<boolean> {
    const result = await db
      .delete(customerTenants)
      .where(eq(customerTenants.id, id));
    return true;
  }

  // Audit logs
  async getAuditLog(id: string): Promise<AuditLog | undefined> {
    const [log] = await db.select().from(auditLogs).where(eq(auditLogs.id, id));
    return log || undefined;
  }

  async createAuditLog(insertLog: InsertAuditLog): Promise<AuditLog> {
    const [log] = await db
      .insert(auditLogs)
      .values(insertLog)
      .returning();
    return log;
  }

  async getAllAuditLogs(): Promise<AuditLog[]> {
    return await db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp));
  }

  async updateAuditLog(id: string, updates: Partial<AuditLog>): Promise<AuditLog | undefined> {
    const [log] = await db
      .update(auditLogs)
      .set(updates)
      .where(eq(auditLogs.id, id))
      .returning();
    return log || undefined;
  }

  // Configuration profiles
  async getProfile(id: string): Promise<ConfigurationProfile | undefined> {
    const [profile] = await db.select().from(configurationProfiles).where(eq(configurationProfiles.id, id));
    return profile || undefined;
  }

  async getProfilesByTenant(tenantId: string): Promise<ConfigurationProfile[]> {
    return await db.select().from(configurationProfiles).where(eq(configurationProfiles.tenantId, tenantId));
  }

  async createProfile(insertProfile: InsertConfigurationProfile): Promise<ConfigurationProfile> {
    const [profile] = await db
      .insert(configurationProfiles)
      .values(insertProfile)
      .returning();
    return profile;
  }

  async updateProfile(id: string, updates: Partial<InsertConfigurationProfile>): Promise<ConfigurationProfile | undefined> {
    const [profile] = await db
      .update(configurationProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(configurationProfiles.id, id))
      .returning();
    return profile || undefined;
  }

  async deleteProfile(id: string): Promise<boolean> {
    const result = await db
      .delete(configurationProfiles)
      .where(eq(configurationProfiles.id, id))
      .returning();
    return result.length > 0;
  }

  // Operator configuration
  async getOperatorConfig(): Promise<OperatorConfig | undefined> {
    const [config] = await db.select().from(operatorConfig).limit(1);
    return config || undefined;
  }

  async updateOperatorConfig(updates: Partial<InsertOperatorConfig>): Promise<OperatorConfig | undefined> {
    // Get existing config (should only be one row)
    const existing = await this.getOperatorConfig();
    
    if (!existing) {
      // No config exists yet, this shouldn't happen after migration but handle it
      return undefined;
    }

    const [updated] = await db
      .update(operatorConfig)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(operatorConfig.id, existing.id))
      .returning();
    
    return updated || undefined;
  }

  // Tenant PowerShell credentials
  // Get all PowerShell credentials for a tenant
  async getTenantPowershellCredentials(tenantId: string): Promise<TenantPowershellCredentials[]> {
    const credentials = await db
      .select()
      .from(tenantPowershellCredentials)
      .where(eq(tenantPowershellCredentials.tenantId, tenantId))
      .orderBy(desc(tenantPowershellCredentials.createdAt));
    return credentials;
  }

  // Get a specific PowerShell credential by ID
  async getTenantPowershellCredentialById(id: string): Promise<TenantPowershellCredentials | undefined> {
    const [credential] = await db
      .select()
      .from(tenantPowershellCredentials)
      .where(eq(tenantPowershellCredentials.id, id))
      .limit(1);
    return credential || undefined;
  }

  // Create new PowerShell credentials
  async createTenantPowershellCredentials(insertCredentials: InsertTenantPowershellCredentials): Promise<TenantPowershellCredentials> {
    const [created] = await db
      .insert(tenantPowershellCredentials)
      .values(insertCredentials)
      .returning();
    return created;
  }

  // Update PowerShell credentials
  async updateTenantPowershellCredentials(id: string, updates: Partial<InsertTenantPowershellCredentials>): Promise<TenantPowershellCredentials> {
    const [updated] = await db
      .update(tenantPowershellCredentials)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tenantPowershellCredentials.id, id))
      .returning();
    return updated;
  }

  // Delete PowerShell credentials by ID
  async deleteTenantPowershellCredentials(id: string): Promise<boolean> {
    const result = await db
      .delete(tenantPowershellCredentials)
      .where(eq(tenantPowershellCredentials.id, id))
      .returning();
    return result.length > 0;
  }

  // ===== PHONE NUMBER INVENTORY METHODS =====

  // Get phone numbers with optional filtering
  async getPhoneNumbers(filters: {
    tenantId: string;
    status?: string;
    numberType?: string;
    countryCode?: string;
  }): Promise<PhoneNumberInventory[]> {
    const conditions = [eq(phoneNumberInventory.tenantId, filters.tenantId)];

    if (filters.status) {
      conditions.push(eq(phoneNumberInventory.status, filters.status));
    }
    if (filters.numberType) {
      conditions.push(eq(phoneNumberInventory.numberType, filters.numberType));
    }
    if (filters.countryCode) {
      conditions.push(eq(phoneNumberInventory.countryCode, filters.countryCode));
    }

    const numbers = await db
      .select()
      .from(phoneNumberInventory)
      .where(and(...conditions))
      .orderBy(desc(phoneNumberInventory.createdAt));

    return numbers;
  }

  // Get available country codes for a tenant (only countries with numbers in inventory)
  async getAvailableCountryCodes(tenantId: string): Promise<CountryCode[]> {
    // Get distinct country codes from phone number inventory for this tenant
    const distinctCodes = await db
      .selectDistinct({ countryCode: phoneNumberInventory.countryCode })
      .from(phoneNumberInventory)
      .where(and(
        eq(phoneNumberInventory.tenantId, tenantId),
        sql`${phoneNumberInventory.countryCode} IS NOT NULL`
      ));

    // Get full country code details for each code
    const codes = distinctCodes.map(d => d.countryCode).filter((code): code is string => code !== null);
    if (codes.length === 0) return [];

    const countries = await db
      .select()
      .from(countryCodes)
      .where(inArray(countryCodes.countryCode, codes))
      .orderBy(countryCodes.countryName);

    return countries;
  }

  // Get single phone number by ID
  async getPhoneNumber(id: string): Promise<PhoneNumberInventory | undefined> {
    const [number] = await db
      .select()
      .from(phoneNumberInventory)
      .where(eq(phoneNumberInventory.id, id))
      .limit(1);
    return number;
  }

  // Get phone number by line URI within a tenant (for duplicate checking)
  async getPhoneNumberByLineUri(tenantId: string, lineUri: string): Promise<PhoneNumberInventory | undefined> {
    const [number] = await db
      .select()
      .from(phoneNumberInventory)
      .where(and(
        eq(phoneNumberInventory.tenantId, tenantId),
        eq(phoneNumberInventory.lineUri, lineUri)
      ))
      .limit(1);
    return number;
  }

  // Create new phone number
  async createPhoneNumber(insertNumber: InsertPhoneNumberInventory): Promise<PhoneNumberInventory> {
    const [created] = await db
      .insert(phoneNumberInventory)
      .values(insertNumber)
      .returning();
    return created;
  }

  // Update phone number
  async updatePhoneNumber(id: string, updates: Partial<InsertPhoneNumberInventory>): Promise<PhoneNumberInventory> {
    const [updated] = await db
      .update(phoneNumberInventory)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(phoneNumberInventory.id, id))
      .returning();
    return updated;
  }

  // Delete phone number
  async deletePhoneNumber(id: string): Promise<boolean> {
    const result = await db
      .delete(phoneNumberInventory)
      .where(eq(phoneNumberInventory.id, id))
      .returning();
    return result.length > 0;
  }

  // Bulk delete phone numbers by tenant
  async bulkDeletePhoneNumbers(tenantId: string): Promise<number> {
    const result = await db
      .delete(phoneNumberInventory)
      .where(eq(phoneNumberInventory.tenantId, tenantId))
      .returning();
    return result.length;
  }

  // Get phone numbers by range
  async getPhoneNumbersByRange(tenantId: string, numberRange: string): Promise<PhoneNumberInventory[]> {
    const numbers = await db
      .select()
      .from(phoneNumberInventory)
      .where(eq(phoneNumberInventory.tenantId, tenantId))
      .where(eq(phoneNumberInventory.numberRange, numberRange))
      .orderBy(phoneNumberInventory.lineUri);
    return numbers;
  }

  // Get phone number statistics for a tenant
  async getPhoneNumberStatistics(tenantId: string): Promise<any> {
    const numbers = await db
      .select()
      .from(phoneNumberInventory)
      .where(eq(phoneNumberInventory.tenantId, tenantId));

    const stats = {
      total: numbers.length,
      byStatus: {
        available: numbers.filter(n => n.status === 'available').length,
        used: numbers.filter(n => n.status === 'used').length,
        reserved: numbers.filter(n => n.status === 'reserved').length,
        aging: numbers.filter(n => n.status === 'aging').length,
      },
      byType: {
        did: numbers.filter(n => n.numberType === 'did').length,
        extension: numbers.filter(n => n.numberType === 'extension').length,
        tollFree: numbers.filter(n => n.numberType === 'toll-free').length,
        mailbox: numbers.filter(n => n.numberType === 'mailbox').length,
      },
    };

    return stats;
  }

  // ===== FEATURE FLAGS METHODS =====

  // Get all feature flags
  async getAllFeatureFlags(): Promise<FeatureFlag[]> {
    return await db.select().from(featureFlags);
  }

  // Get a specific feature flag by key
  async getFeatureFlagByKey(featureKey: string): Promise<FeatureFlag | undefined> {
    const [flag] = await db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.featureKey, featureKey))
      .limit(1);
    return flag || undefined;
  }

  // Update a feature flag's enabled status
  async updateFeatureFlag(featureKey: string, isEnabled: boolean): Promise<FeatureFlag> {
    const [updated] = await db
      .update(featureFlags)
      .set({ isEnabled, updatedAt: new Date() })
      .where(eq(featureFlags.featureKey, featureKey))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
