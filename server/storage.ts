// Referenced from javascript_database blueprint
import {
  adminUsers,
  customerTenants,
  auditLogs,
  configurationProfiles,
  operatorConfig,
  operatorUsers,
  tenantPowershellCredentials,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

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

  // Tenant PowerShell credentials (per-tenant, optional)
  getTenantPowershellCredentials(tenantId: string): Promise<TenantPowershellCredentials | undefined>;
  createOrUpdateTenantPowershellCredentials(credentials: InsertTenantPowershellCredentials): Promise<TenantPowershellCredentials>;
  deleteTenantPowershellCredentials(tenantId: string): Promise<boolean>;
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
  async getTenantPowershellCredentials(tenantId: string): Promise<TenantPowershellCredentials | undefined> {
    const [credentials] = await db
      .select()
      .from(tenantPowershellCredentials)
      .where(eq(tenantPowershellCredentials.tenantId, tenantId))
      .limit(1);
    return credentials || undefined;
  }

  async createOrUpdateTenantPowershellCredentials(insertCredentials: InsertTenantPowershellCredentials): Promise<TenantPowershellCredentials> {
    // Check if credentials already exist for this tenant
    const existing = await this.getTenantPowershellCredentials(insertCredentials.tenantId);
    
    if (existing) {
      // Update existing credentials
      const [updated] = await db
        .update(tenantPowershellCredentials)
        .set({ ...insertCredentials, updatedAt: new Date() })
        .where(eq(tenantPowershellCredentials.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new credentials
      const [created] = await db
        .insert(tenantPowershellCredentials)
        .values(insertCredentials)
        .returning();
      return created;
    }
  }

  async deleteTenantPowershellCredentials(tenantId: string): Promise<boolean> {
    const existing = await this.getTenantPowershellCredentials(tenantId);
    
    if (!existing) {
      return false;
    }

    // Hard delete the credentials
    const result = await db
      .delete(tenantPowershellCredentials)
      .where(eq(tenantPowershellCredentials.id, existing.id))
      .returning();
    
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
