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

/**
 * Helper function to get PowerShell credentials for a tenant
 */
async function getTenantCredentials(tenant: CustomerTenant): Promise<PowerShellCertificateCredentials> {
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

  return {
    tenantId: tenant.tenantId,
    appId: creds.appId,
    certificateThumbprint: creds.certificateThumbprint,
  };
}

/**
 * Remove a phone number assignment from a user in Microsoft Teams
 *
 * @param tenant - The customer tenant
 * @param userPrincipalName - The UPN of the user (e.g., user@domain.com)
 * @param phoneNumber - The phone number to remove (E.164 format, e.g., +15551234567)
 * @param phoneNumberType - Type of number (DirectRouting, CallingPlan, or OperatorConnect)
 */
export async function removePhoneNumberAssignment(
  tenant: CustomerTenant,
  userPrincipalName: string,
  phoneNumber: string,
  phoneNumberType: "DirectRouting" | "CallingPlan" | "OperatorConnect" = "DirectRouting"
): Promise<{ success: boolean; message: string }> {
  const certificateCredentials = await getTenantCredentials(tenant);

  // Remove tel: prefix if present
  const cleanPhoneNumber = phoneNumber.replace(/^tel:/i, "");

  const powerShellScript = `
    try {
      Remove-CsPhoneNumberAssignment -Identity "${userPrincipalName}" -PhoneNumber "${cleanPhoneNumber}" -PhoneNumberType ${phoneNumberType}
      Write-Output "SUCCESS: Phone number removed successfully"
    } catch {
      Write-Error $_.Exception.Message
      exit 1
    }
  `;

  try {
    const result = await executePowerShellWithCertificate(
      certificateCredentials,
      powerShellScript,
      60000 // 1 minute timeout
    );

    if (!result.success) {
      throw new Error(result.error || "Failed to remove phone number assignment");
    }

    return {
      success: true,
      message: `Phone number ${phoneNumber} removed from ${userPrincipalName}`,
    };
  } catch (error) {
    console.error("Error removing phone number assignment:", error);
    throw error;
  }
}

/**
 * Reset voice routing policy to Global (default) for a user in Microsoft Teams
 *
 * @param tenant - The customer tenant
 * @param userPrincipalName - The UPN of the user (e.g., user@domain.com)
 */
export async function resetVoiceRoutingPolicy(
  tenant: CustomerTenant,
  userPrincipalName: string
): Promise<{ success: boolean; message: string }> {
  const certificateCredentials = await getTenantCredentials(tenant);

  const powerShellScript = `
    try {
      Grant-CsOnlineVoiceRoutingPolicy -Identity "${userPrincipalName}" -PolicyName $null
      Write-Output "SUCCESS: Voice routing policy reset to Global"
    } catch {
      Write-Error $_.Exception.Message
      exit 1
    }
  `;

  try {
    const result = await executePowerShellWithCertificate(
      certificateCredentials,
      powerShellScript,
      60000 // 1 minute timeout
    );

    if (!result.success) {
      throw new Error(result.error || "Failed to reset voice routing policy");
    }

    return {
      success: true,
      message: `Voice routing policy reset to Global for ${userPrincipalName}`,
    };
  } catch (error) {
    console.error("Error resetting voice routing policy:", error);
    throw error;
  }
}
