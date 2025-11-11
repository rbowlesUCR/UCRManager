/**
 * Teams Phone Number Sync Module
 *
 * Fetches phone number assignments from Microsoft Teams
 */

import { executePowerShellWithCertificate, type PowerShellCertificateCredentials } from "./powershell";
import { db } from "./db";
import { tenantPowershellCredentials } from "../shared/schema";
import { eq, and } from "drizzle-orm";
import type { CustomerTenant } from "../shared/schema";

export interface TeamsPhoneNumber {
  lineUri: string;
  displayName: string | null;
  userPrincipalName: string | null;
  onlineVoiceRoutingPolicy: string | null;
}

/**
 * Fetch all phone numbers assigned in Microsoft Teams
 */
export async function getTeamsPhoneNumbers(tenant: CustomerTenant): Promise<TeamsPhoneNumber[]> {
  // Get PowerShell credentials for the tenant
  const credentialsRow = await db
    .select()
    .from(tenantPowershellCredentials)
    .where(
      and(
        eq(tenantPowershellCredentials.tenantId, tenant.id),
        eq(tenantPowershellCredentials.isActive, true)
      )
    )
    .limit(1);

  if (!credentialsRow || credentialsRow.length === 0) {
    throw new Error("No active PowerShell credentials found for this tenant");
  }

  const creds = credentialsRow[0];

  if (!creds.appId || !creds.certificateThumbprint) {
    throw new Error("Certificate-based authentication credentials not configured for this tenant");
  }

  const certificateCredentials: PowerShellCertificateCredentials = {
    tenantId: tenant.tenantId,
    appId: creds.appId,
    certificateThumbprint: creds.certificateThumbprint,
  };

  const powerShellScript = `
    # Get all users with phone numbers assigned
    $users = Get-CsOnlineUser | Where-Object { $_.LineURI -ne $null -and $_.LineURI -ne "" }

    # Format the results
    $results = $users | ForEach-Object {
      [PSCustomObject]@{
        LineURI = $_.LineURI
        DisplayName = $_.DisplayName
        UserPrincipalName = $_.UserPrincipalName
        OnlineVoiceRoutingPolicy = $_.OnlineVoiceRoutingPolicy
      }
    }

    # Output as JSON
    $results | ConvertTo-Json -Depth 10
  `;

  try {
    const result = await executePowerShellWithCertificate(
      certificateCredentials,
      powerShellScript,
      120000 // 2 minute timeout
    );

    if (!result.success || !result.output) {
      throw new Error(result.error || "Failed to fetch Teams phone numbers");
    }

    // Parse the JSON output
    const output = result.output.trim();
    if (!output || output === "") {
      return [];
    }

    let teamsNumbers: any[];
    try {
      const parsed = JSON.parse(output);
      // Handle both single object and array
      teamsNumbers = Array.isArray(parsed) ? parsed : [parsed];
    } catch (parseError) {
      console.error("Failed to parse Teams phone numbers JSON:", output);
      throw new Error("Invalid JSON response from Teams");
    }

    // Map to our interface
    const phoneNumbers: TeamsPhoneNumber[] = teamsNumbers.map((num) => {
      // Handle OnlineVoiceRoutingPolicy which can be a string or an object
      let policyName: string | null = null;
      if (num.OnlineVoiceRoutingPolicy) {
        if (typeof num.OnlineVoiceRoutingPolicy === 'string') {
          policyName = num.OnlineVoiceRoutingPolicy;
        } else if (typeof num.OnlineVoiceRoutingPolicy === 'object' && num.OnlineVoiceRoutingPolicy.Name) {
          policyName = num.OnlineVoiceRoutingPolicy.Name;
        }
      }

      return {
        lineUri: normalizeLineUri(num.LineURI),
        displayName: num.DisplayName || null,
        userPrincipalName: num.UserPrincipalName || null,
        onlineVoiceRoutingPolicy: policyName,
      };
    });

    return phoneNumbers;
  } catch (error) {
    console.error("Error fetching Teams phone numbers:", error);
    throw error;
  }
}

/**
 * Normalize line URI to ensure consistent format
 * Converts various formats to tel:+E.164 format
 */
function normalizeLineUri(lineUri: string | null | undefined): string {
  if (!lineUri) {
    return "";
  }

  let normalized = lineUri.trim();

  // Remove tel: prefix if present
  if (normalized.toLowerCase().startsWith("tel:")) {
    normalized = normalized.substring(4);
  }

  // Ensure it starts with +
  if (!normalized.startsWith("+")) {
    // Assume US number if no country code
    if (normalized.length === 10) {
      normalized = "+1" + normalized;
    } else if (normalized.length === 11 && normalized.startsWith("1")) {
      normalized = "+" + normalized;
    } else {
      normalized = "+" + normalized;
    }
  }

  // Remove any extensions (;ext=)
  const extIndex = normalized.indexOf(";");
  if (extIndex > 0) {
    normalized = normalized.substring(0, extIndex);
  }

  // Add tel: prefix
  return "tel:" + normalized;
}
