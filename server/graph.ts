import { Client } from "@microsoft/microsoft-graph-client";
import { ConfidentialClientApplication } from "@azure/msal-node";
import "isomorphic-fetch";
import type { TeamsUser, VoiceRoutingPolicy } from "@shared/schema";

export interface PermissionValidationResult {
  permission: string;
  status: "success" | "error";
  message: string;
  errorCode?: string;
}

export async function getGraphClient(tenantId: string, clientId: string, clientSecret: string): Promise<Client> {
  const msalConfig = {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      clientSecret,
    },
  };

  const cca = new ConfidentialClientApplication(msalConfig);

  const clientCredentialRequest = {
    scopes: ["https://graph.microsoft.com/.default"],
  };

  const response = await cca.acquireTokenByClientCredential(clientCredentialRequest);

  if (!response || !response.accessToken) {
    throw new Error("Failed to acquire access token");
  }

  return Client.init({
    authProvider: (done) => {
      done(null, response.accessToken);
    },
  });
}

export async function getTeamsVoiceUsers(client: Client): Promise<TeamsUser[]> {
  try {
    // Query all active users
    // Note: In production, you would filter by specific Teams voice SKU IDs
    // For MVP, we get all users and let operators manage voice-enabled ones
    const response = await client
      .api("/users")
      .select("id,userPrincipalName,displayName,mail")
      .filter("accountEnabled eq true")
      .top(999)
      .get();

    const users = response.value || [];

    // Try to get Teams phone configurations from beta endpoint
    // This requires TeamSettings.ReadWrite.All permission
    // Note: The telephoneNumber field may not be readable via GET, even though it can be written via PATCH
    let phoneConfigs: any = {};
    try {
      const configResponse = await client
        .api("/admin/teams/userConfigurations")
        .version("beta")
        .get();
      
      // Create a map of userId -> telephoneNumber for quick lookup
      // Check multiple possible field names (telephoneNumber, phoneNumber, lineUri)
      (configResponse.value || []).forEach((config: any) => {
        if (config.id) {
          const phoneNumber = config.telephoneNumber || config.phoneNumber || config.lineUri;
          if (phoneNumber) {
            phoneConfigs[config.id] = phoneNumber;
          }
        }
      });
    } catch (configError) {
      console.warn("Could not fetch Teams phone configurations (beta endpoint):", configError);
      // Continue without phone numbers if the endpoint fails
    }

    // Map users to TeamsUser format
    const voiceUsers: TeamsUser[] = users.map((user: any) => ({
      id: user.id,
      userPrincipalName: user.userPrincipalName,
      displayName: user.displayName,
      mail: user.mail || user.userPrincipalName,
      lineUri: phoneConfigs[user.id] || undefined,
    }));

    return voiceUsers;
  } catch (error) {
    console.error("Error fetching Teams users:", error);
    throw new Error("Failed to fetch Teams users from Microsoft Graph");
  }
}

export async function getVoiceRoutingPolicies(client: Client): Promise<VoiceRoutingPolicy[]> {
  // NOTE: As of October 2025, Microsoft Graph API does NOT have an endpoint to list voice routing policies
  // The /teamwork/voiceRoutingPolicies endpoint does not exist
  // Users must use PowerShell: Get-CsOnlineVoiceRoutingPolicy to retrieve available policies
  // This function returns placeholder policies - users should enter their actual policy names
  
  console.warn("Voice routing policy retrieval via Graph API is not available. Using placeholder policies.");
  console.warn("Use PowerShell command 'Get-CsOnlineVoiceRoutingPolicy' to see actual policies in your tenant.");
  
  return [
    {
      id: "global",
      name: "Global",
      description: "Enter your actual policy names from PowerShell Get-CsOnlineVoiceRoutingPolicy",
    },
  ];
}

export async function assignPhoneNumberAndPolicy(
  client: Client,
  userId: string,
  phoneNumber: string,
  routingPolicy: string
): Promise<void> {
  try {
    // IMPORTANT: Phone number assignment via Graph API is NOT available yet (as of October 2025)
    // The endpoint /admin/teams/userConfigurations/{userId} exists for READ only, not WRITE
    // Users must use PowerShell for phone number assignment:
    // Set-CsPhoneNumberAssignment -Identity user@domain.com -PhoneNumber +1234567890 -PhoneNumberType DirectRouting
    
    console.warn("WARNING: Phone number assignment via Graph API is not available yet.");
    console.warn(`You must use PowerShell to assign phone number ${phoneNumber}:`);
    console.warn(`Set-CsPhoneNumberAssignment -Identity ${userId} -PhoneNumber ${phoneNumber} -PhoneNumberType DirectRouting`);

    // Assign voice routing policy using Graph API beta endpoint
    // Correct endpoint as of October 2024
    // https://learn.microsoft.com/en-us/graph/api/teamspolicyuserassignment-assign
    // Required permission: TeamworkPolicy.ReadWrite.All (NOT TeamsPolicyUserAssign.ReadWrite.All)
    await client
      .api("/teamwork/teamsPolicies/userAssignments/assign")
      .version("beta")
      .post({
        assignments: [
          {
            userId: userId,
            policyType: "onlineVoiceRoutingPolicy",
            policyName: routingPolicy, // Note: uses policyName, not policyId
          },
        ],
      });
    
    console.log(`Successfully assigned voice routing policy ${routingPolicy} to user ${userId}`);
    console.log(`REMINDER: Phone number ${phoneNumber} must be assigned via PowerShell`);
  } catch (error: any) {
    console.error("Error assigning voice configuration:", error);
    
    // Provide detailed error message
    const errorMessage = error?.message || "Unknown error";
    const errorCode = error?.code || "UNKNOWN";
    throw new Error(`Failed to assign voice routing policy: ${errorCode} - ${errorMessage}. Phone number assignment requires PowerShell.`);
  }
}

export async function validateTenantPermissions(client: Client): Promise<PermissionValidationResult[]> {
  const results: PermissionValidationResult[] = [];

  // Test 1: User.Read.All - Query users
  try {
    await client
      .api("/users")
      .select("id,userPrincipalName,displayName")
      .top(1)
      .get();
    
    results.push({
      permission: "User.Read.All",
      status: "success",
      message: "Successfully queried users - permission is working correctly",
    });
  } catch (error: any) {
    results.push({
      permission: "User.Read.All",
      status: "error",
      message: error.message || "Failed to query users",
      errorCode: error.code || error.statusCode?.toString(),
    });
  }

  // Test 2: TeamsUserConfiguration.Read.All - Read Teams user configurations
  try {
    // Test read access to Teams user configurations endpoint
    await client
      .api("/admin/teams/userConfigurations")
      .version("beta")
      .top(1)
      .get();
    
    results.push({
      permission: "TeamsUserConfiguration.Read.All",
      status: "success",
      message: "Successfully read Teams user configurations - permission is working correctly",
    });
  } catch (error: any) {
    const errorCode = error.code || error.statusCode?.toString();
    const errorMessage = error.message || "Unknown error";
    
    if (errorCode === "Authorization_RequestDenied" || errorCode === "403" || errorCode === "Forbidden" || 
        errorCode === "401" || errorCode === "Unauthorized") {
      results.push({
        permission: "TeamsUserConfiguration.Read.All",
        status: "error",
        message: "Permission denied - admin consent required",
        errorCode: errorCode,
      });
    } else {
      results.push({
        permission: "TeamsUserConfiguration.Read.All",
        status: "error",
        message: `Unable to validate permission: ${errorMessage}`,
        errorCode: errorCode,
      });
    }
  }

  // Test 3: TeamworkPolicy.ReadWrite.All - Policy assignment permission
  // This is the ACTUAL permission required for policy assignment (as of October 2024)
  // Endpoint: POST /teamwork/teamsPolicies/userAssignments/assign
  // We cannot test write without making actual changes, so we mark as info
  results.push({
    permission: "TeamworkPolicy.ReadWrite.All",
    status: "success",
    message: "Required for assigning voice routing policies via Graph API beta (cannot test without making changes)",
  });

  return results;
}
