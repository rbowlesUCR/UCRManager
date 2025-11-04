import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Admin users table - for admin panel authentication
export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(), // bcrypt hashed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Customer tenants table - stores Azure AD tenant information
export const customerTenants = pgTable("customer_tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().unique(), // Azure AD Tenant ID
  tenantName: text("tenant_name").notNull(),
  appRegistrationId: text("app_registration_id"), // Client ID for this tenant
  appRegistrationSecret: text("app_registration_secret"), // Encrypted client secret
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Audit logs table - tracks all changes made by operators
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  operatorEmail: text("operator_email").notNull(), // Email of the operator who made the change
  operatorName: text("operator_name").notNull(), // Display name of the operator
  tenantId: text("tenant_id").notNull(), // Customer tenant where change was made
  tenantName: text("tenant_name").notNull(),
  targetUserUpn: text("target_user_upn").notNull(), // UPN of the Teams user being modified
  targetUserName: text("target_user_name").notNull(),
  targetUserId: text("target_user_id"), // Graph API user ID for rollback
  changeType: text("change_type").notNull(), // e.g., "phone_number_assigned", "routing_policy_updated"
  changeDescription: text("change_description").notNull(), // Human-readable description
  phoneNumber: text("phone_number"), // New phone number assigned (if applicable)
  routingPolicy: text("routing_policy"), // New routing policy assigned (if applicable)
  previousPhoneNumber: text("previous_phone_number"), // Previous phone number (for rollback)
  previousRoutingPolicy: text("previous_routing_policy"), // Previous routing policy (for rollback)
  status: text("status").notNull().default("success"), // success, failed, partial
  errorMessage: text("error_message"), // Error details if status is failed
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Configuration profiles table - stores saved configuration templates for tenants
export const configurationProfiles = pgTable("configuration_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull(), // References customer tenant
  profileName: text("profile_name").notNull(),
  phoneNumberPrefix: text("phone_number_prefix").notNull(), // e.g., "tel:+1555"
  defaultRoutingPolicy: text("default_routing_policy").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Operator configuration table - stores Azure AD credentials for operator authentication
// This is a singleton table (only one row should exist)
export const operatorConfig = pgTable("operator_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  azureTenantId: text("azure_tenant_id").notNull(),
  azureClientId: text("azure_client_id").notNull(),
  azureClientSecret: text("azure_client_secret").notNull(), // Encrypted using AES-256-GCM
  redirectUri: text("redirect_uri").notNull(), // Base URL for OAuth callback
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Operator users table - stores Azure AD users from operator tenant with assigned roles
export const operatorUsers = pgTable("operator_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  azureUserId: text("azure_user_id").notNull().unique(), // Azure AD object ID
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("user"), // "admin" or "user"
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tenant PowerShell credentials table - stores tenant-specific credentials for Teams PowerShell authentication
// Supports both certificate-based (recommended) and legacy user account authentication
export const tenantPowershellCredentials = pgTable("tenant_powershell_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => customerTenants.id, { onDelete: "cascade" }),
  // Certificate-based authentication (recommended)
  appId: text("app_id"), // Azure AD Application (Client) ID for certificate-based auth
  certificateThumbprint: text("certificate_thumbprint"), // Thumbprint of certificate in Windows cert store
  // Legacy user account authentication (deprecated but kept for backward compatibility)
  usernameDeprecated: text("username_deprecated").notNull().default(''), // Deprecated: old username field
  encryptedPasswordDeprecated: text("encrypted_password_deprecated").notNull().default(''), // Deprecated: old encrypted password field
  description: text("description"), // Optional description
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Phone number inventory table - comprehensive DID/number management system
// Tracks all phone numbers across customer tenants with lifecycle and assignment tracking
export const phoneNumberInventory = pgTable("phone_number_inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => customerTenants.id, { onDelete: "cascade" }),

  // Phone number details
  lineUri: text("line_uri").notNull(), // E.164 format: tel:+15551234567
  displayName: text("display_name"), // Friendly name or current assigned user display name
  userPrincipalName: text("user_principal_name"), // UPN of assigned user (if applicable)

  // Service provider and location information
  carrier: text("carrier"), // Service provider/carrier name
  location: text("location"), // Physical location (e.g., "New York Office")
  usageLocation: text("usage_location"), // ISO country code or usage region

  // Teams/UC configuration
  onlineVoiceRoutingPolicy: text("online_voice_routing_policy"), // Associated voice routing policy

  // Number classification and status
  numberType: text("number_type").notNull().default("did"), // did, extension, toll-free, mailbox
  status: text("status").notNull().default("available"), // available, used, reserved, aging

  // Lifecycle management
  reservedBy: text("reserved_by"), // Operator email who reserved the number
  reservedAt: timestamp("reserved_at"), // When number was reserved
  agingUntil: timestamp("aging_until"), // When reserved/aging number becomes available
  assignedAt: timestamp("assigned_at"), // When number was assigned to user

  // Additional metadata
  notes: text("notes"), // Free-form notes
  tags: text("tags"), // Comma-separated tags for categorization
  numberRange: text("number_range"), // Range identifier (e.g., "+1555123xxxx")

  // External system tracking (for future integrations)
  externalSystemId: text("external_system_id"), // ID in external PBX/UC system
  externalSystemType: text("external_system_type"), // teams, cisco, avaya, 3cx, ribbon, etc.

  // Audit fields
  createdBy: text("created_by").notNull(), // Operator who added the number
  lastModifiedBy: text("last_modified_by").notNull(), // Last operator to modify
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert schemas
export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({
  id: true,
  createdAt: true,
});

export const insertCustomerTenantSchema = createInsertSchema(customerTenants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});

export const insertConfigurationProfileSchema = createInsertSchema(configurationProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOperatorConfigSchema = createInsertSchema(operatorConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOperatorUserSchema = createInsertSchema(operatorUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTenantPowershellCredentialsSchema = createInsertSchema(tenantPowershellCredentials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPhoneNumberInventorySchema = createInsertSchema(phoneNumberInventory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;

export type CustomerTenant = typeof customerTenants.$inferSelect;
export type InsertCustomerTenant = z.infer<typeof insertCustomerTenantSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type ConfigurationProfile = typeof configurationProfiles.$inferSelect;
export type InsertConfigurationProfile = z.infer<typeof insertConfigurationProfileSchema>;

export type OperatorConfig = typeof operatorConfig.$inferSelect;
export type InsertOperatorConfig = z.infer<typeof insertOperatorConfigSchema>;

export type OperatorUser = typeof operatorUsers.$inferSelect;
export type InsertOperatorUser = z.infer<typeof insertOperatorUserSchema>;

export type TenantPowershellCredentials = typeof tenantPowershellCredentials.$inferSelect;
export type InsertTenantPowershellCredentials = z.infer<typeof insertTenantPowershellCredentialsSchema>;

export type PhoneNumberInventory = typeof phoneNumberInventory.$inferSelect;
export type InsertPhoneNumberInventory = z.infer<typeof insertPhoneNumberInventorySchema>;

// Number status and type enums for type safety
export type NumberStatus = "available" | "used" | "reserved" | "aging";
export type NumberType = "did" | "extension" | "toll-free" | "mailbox";

// Frontend-only types for Microsoft Graph API responses
export interface TeamsUser {
  id: string;
  userPrincipalName: string;
  displayName: string;
  mail?: string;
  lineUri?: string; // Current phone number
}

export interface VoiceRoutingPolicy {
  id: string;
  name: string;
  description?: string;
}

export interface OperatorSession {
  id: string;
  email: string;
  displayName: string;
  tenantId: string;
  role?: "admin" | "user"; // Role from operator_users table
  isLocalAdmin?: boolean; // True for admin_users table login
}

// Policy Types - Defines all supported Microsoft Teams policy categories
export type PolicyType =
  | "voiceRouting"
  | "audioConferencing"
  | "callHold"
  | "callerId"
  | "calling"
  | "emergencyCallRouting"
  | "emergencyCalling"
  | "meeting"
  | "voiceApplications"
  | "voicemail";

// Generic Teams Policy interface (backward compatible with VoiceRoutingPolicy)
export interface TeamsPolicy {
  id: string;
  name: string;
  description?: string;
  type?: PolicyType; // Optional for backward compatibility
}

// Policy Configuration - Maps policy types to PowerShell cmdlets
export interface PolicyConfig {
  displayName: string; // User-friendly name for UI
  powerShellCmdGet: string; // PowerShell Get-* cmdlet
  powerShellCmdGrant: string; // PowerShell Grant-* cmdlet
  userPropertyName: string; // Property name on CsOnlineUser object
  supportsDescription: boolean; // Whether this policy type has descriptions
}

export const policyTypeConfig: Record<PolicyType, PolicyConfig> = {
  voiceRouting: {
    displayName: "Voice Routing Policy",
    powerShellCmdGet: "Get-CsOnlineVoiceRoutingPolicy",
    powerShellCmdGrant: "Grant-CsOnlineVoiceRoutingPolicy",
    userPropertyName: "OnlineVoiceRoutingPolicy",
    supportsDescription: true,
  },
  audioConferencing: {
    displayName: "Audio Conferencing Policy",
    powerShellCmdGet: "Get-CsTeamsAudioConferencingPolicy",
    powerShellCmdGrant: "Grant-CsTeamsAudioConferencingPolicy",
    userPropertyName: "TeamsAudioConferencingPolicy",
    supportsDescription: true,
  },
  callHold: {
    displayName: "Call Hold Policy",
    powerShellCmdGet: "Get-CsTeamsCallHoldPolicy",
    powerShellCmdGrant: "Grant-CsTeamsCallHoldPolicy",
    userPropertyName: "TeamsCallHoldPolicy",
    supportsDescription: false,
  },
  callerId: {
    displayName: "Caller ID Policy",
    powerShellCmdGet: "Get-CsCallingLineIdentity",
    powerShellCmdGrant: "Grant-CsCallingLineIdentity",
    userPropertyName: "CallingLineIdentity",
    supportsDescription: true,
  },
  calling: {
    displayName: "Calling Policy",
    powerShellCmdGet: "Get-CsTeamsCallingPolicy",
    powerShellCmdGrant: "Grant-CsTeamsCallingPolicy",
    userPropertyName: "TeamsCallingPolicy",
    supportsDescription: true,
  },
  emergencyCallRouting: {
    displayName: "Emergency Call Routing Policy",
    powerShellCmdGet: "Get-CsTeamsEmergencyCallRoutingPolicy",
    powerShellCmdGrant: "Grant-CsTeamsEmergencyCallRoutingPolicy",
    userPropertyName: "TeamsEmergencyCallRoutingPolicy",
    supportsDescription: true,
  },
  emergencyCalling: {
    displayName: "Emergency Calling Policy",
    powerShellCmdGet: "Get-CsTeamsEmergencyCallingPolicy",
    powerShellCmdGrant: "Grant-CsTeamsEmergencyCallingPolicy",
    userPropertyName: "TeamsEmergencyCallingPolicy",
    supportsDescription: true,
  },
  meeting: {
    displayName: "Meeting Policy",
    powerShellCmdGet: "Get-CsTeamsMeetingPolicy",
    powerShellCmdGrant: "Grant-CsTeamsMeetingPolicy",
    userPropertyName: "TeamsMeetingPolicy",
    supportsDescription: true,
  },
  voiceApplications: {
    displayName: "Voice Applications Policy",
    powerShellCmdGet: "Get-CsTeamsVoiceApplicationsPolicy",
    powerShellCmdGrant: "Grant-CsTeamsVoiceApplicationsPolicy",
    userPropertyName: "TeamsVoiceApplicationsPolicy",
    supportsDescription: false,
  },
  voicemail: {
    displayName: "Voicemail Policy",
    powerShellCmdGet: "Get-CsOnlineVoicemailPolicy",
    powerShellCmdGrant: "Grant-CsOnlineVoicemailPolicy",
    userPropertyName: "OnlineVoicemailPolicy",
    supportsDescription: true,
  }
};
