/**
 * ConnectWise Manage API Integration
 *
 * Provides authentication and API methods for ConnectWise Manage PSA
 *
 * API Documentation: https://developer.connectwise.com/Products/Manage/REST
 */

import { pool } from './db.js';
import { decrypt, encrypt } from './encryption.js';

// ConnectWise API credentials interface
export interface ConnectWiseCredentials {
  baseUrl: string;
  companyId: string;
  publicKey: string;
  privateKey: string;
  clientId: string;
}

// ConnectWise API configuration interface
export interface ConnectWiseConfig {
  defaultTimeMinutes: number;
  autoUpdateStatus: boolean;
  defaultStatusId?: number;
}

// ConnectWise ticket interface (basic structure)
export interface ConnectWiseTicket {
  id: number;
  summary: string;
  recordType?: string;
  board?: {
    id: number;
    name: string;
  };
  status?: {
    id: number;
    name: string;
  };
  company?: {
    id: number;
    identifier: string;
    name: string;
  };
  contact?: {
    id: number;
    name: string;
  };
  priority?: {
    id: number;
    name: string;
  };
}

// ConnectWise ticket search result
export interface ConnectWiseTicketSearchResult {
  id: number;
  summary: string;
  status: string;
  company: string;
  board: string;
}

// ConnectWise time entry interface
export interface ConnectWiseTimeEntry {
  chargeToId: number; // Ticket ID
  chargeToType: 'ServiceTicket' | 'ProjectTicket' | 'Activity';
  member: {
    identifier: string;
  };
  workType?: {
    id: number;
    name?: string;
  };
  timeStart: string; // ISO date-time
  timeEnd?: string; // ISO date-time
  actualHours: number;
  notes?: string;
  internalNotes?: string;
  billableOption?: 'Billable' | 'DoNotBill' | 'NoCharge' | 'NoDefault';
}

// ConnectWise note interface
export interface ConnectWiseNote {
  text: string;
  detailDescriptionFlag?: boolean;
  internalAnalysisFlag?: boolean;
  resolutionFlag?: boolean;
  member?: {
    identifier: string;
  };
}

/**
 * Get ConnectWise credentials for a tenant (decrypted)
 */
export async function getConnectWiseCredentials(tenantId: string): Promise<ConnectWiseCredentials & ConnectWiseConfig | null> {
  try {
    const result = await pool.query(
      `SELECT
        base_url,
        company_id,
        public_key,
        private_key,
        client_id,
        default_time_minutes,
        auto_update_status,
        default_status_id
      FROM connectwise_credentials
      WHERE tenant_id = $1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const cred = result.rows[0];

    // Decrypt sensitive fields
    const publicKey = decrypt(cred.public_key);
    const privateKey = decrypt(cred.private_key);
    const clientId = decrypt(cred.client_id);

    return {
      baseUrl: cred.base_url,
      companyId: cred.company_id,
      publicKey,
      privateKey,
      clientId,
      defaultTimeMinutes: cred.default_time_minutes || 15,
      autoUpdateStatus: cred.auto_update_status || false,
      defaultStatusId: cred.default_status_id,
    };
  } catch (error) {
    console.error('[ConnectWise] Error fetching credentials:', error);
    throw error;
  }
}

/**
 * Store ConnectWise credentials for a tenant (encrypted)
 */
export async function storeConnectWiseCredentials(
  tenantId: string,
  credentials: ConnectWiseCredentials & Partial<ConnectWiseConfig>,
  adminUserId: string
): Promise<void> {
  try {
    // Encrypt sensitive fields
    const encryptedPublicKey = encrypt(credentials.publicKey);
    const encryptedPrivateKey = encrypt(credentials.privateKey);
    const encryptedClientId = encrypt(credentials.clientId);

    await pool.query(
      `INSERT INTO connectwise_credentials (
        tenant_id,
        base_url,
        company_id,
        public_key,
        private_key,
        client_id,
        default_time_minutes,
        auto_update_status,
        default_status_id,
        created_by,
        updated_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )
      ON CONFLICT (tenant_id) DO UPDATE SET
        base_url = EXCLUDED.base_url,
        company_id = EXCLUDED.company_id,
        public_key = EXCLUDED.public_key,
        private_key = EXCLUDED.private_key,
        client_id = EXCLUDED.client_id,
        default_time_minutes = EXCLUDED.default_time_minutes,
        auto_update_status = EXCLUDED.auto_update_status,
        default_status_id = EXCLUDED.default_status_id,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()`,
      [
        tenantId,
        credentials.baseUrl,
        credentials.companyId,
        encryptedPublicKey,
        encryptedPrivateKey,
        encryptedClientId,
        credentials.defaultTimeMinutes || 15,
        credentials.autoUpdateStatus || false,
        credentials.defaultStatusId || null,
        adminUserId,
        adminUserId
      ]
    );

    console.log(`[ConnectWise] Credentials stored for tenant ${tenantId}`);
  } catch (error) {
    console.error('[ConnectWise] Error storing credentials:', error);
    throw error;
  }
}

/**
 * Create authorization header for ConnectWise API
 * Format: "Basic <base64(companyId+publicKey:privateKey)>"
 */
function createAuthHeader(credentials: ConnectWiseCredentials): string {
  const authString = `${credentials.companyId}+${credentials.publicKey}:${credentials.privateKey}`;
  const base64Auth = Buffer.from(authString).toString('base64');
  return `Basic ${base64Auth}`;
}

/**
 * Create common headers for ConnectWise API requests
 */
function createHeaders(credentials: ConnectWiseCredentials): HeadersInit {
  return {
    'Authorization': createAuthHeader(credentials),
    'clientId': credentials.clientId,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

/**
 * Search for ConnectWise tickets
 *
 * @param tenantId - Tenant ID
 * @param searchQuery - Search string (searches summary and ID)
 * @param limit - Maximum results (default 25)
 */
export async function searchTickets(
  tenantId: string,
  searchQuery: string,
  limit: number = 25
): Promise<ConnectWiseTicketSearchResult[]> {
  try {
    const credentials = await getConnectWiseCredentials(tenantId);
    if (!credentials) {
      throw new Error('ConnectWise credentials not configured for this tenant');
    }

    // Build conditions for search
    const conditions: string[] = [];

    // If search query is numeric, search by ID
    if (/^\d+$/.test(searchQuery)) {
      conditions.push(`id = ${parseInt(searchQuery)}`);
    } else {
      // Search in summary
      conditions.push(`summary contains "${searchQuery}"`);
    }

    // Build condition string
    const conditionString = conditions.join(' OR ');

    // Build API URL with conditions
    const apiUrl = new URL(`${credentials.baseUrl}/v4_6_release/apis/3.0/service/tickets`);
    apiUrl.searchParams.set('conditions', conditionString);
    apiUrl.searchParams.set('pageSize', limit.toString());
    apiUrl.searchParams.set('orderBy', 'id desc');
    apiUrl.searchParams.set('fields', 'id,summary,status/name,company/name,board/name');

    console.log(`[ConnectWise] Searching tickets: ${conditionString}`);

    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: createHeaders(credentials),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ConnectWise API error: ${response.status} - ${errorText}`);
    }

    const tickets: ConnectWiseTicket[] = await response.json();

    // Map to search result format
    return tickets.map(ticket => ({
      id: ticket.id,
      summary: ticket.summary,
      status: ticket.status?.name || 'Unknown',
      company: ticket.company?.name || 'Unknown',
      board: ticket.board?.name || 'Unknown',
    }));
  } catch (error: any) {
    console.error('[ConnectWise] Error searching tickets:', error);
    throw new Error(`Failed to search tickets: ${error.message}`);
  }
}

/**
 * Get a specific ConnectWise ticket by ID
 */
export async function getTicket(tenantId: string, ticketId: number): Promise<ConnectWiseTicket | null> {
  try {
    const credentials = await getConnectWiseCredentials(tenantId);
    if (!credentials) {
      throw new Error('ConnectWise credentials not configured for this tenant');
    }

    const apiUrl = `${credentials.baseUrl}/v4_6_release/apis/3.0/service/tickets/${ticketId}`;

    console.log(`[ConnectWise] Fetching ticket ${ticketId}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: createHeaders(credentials),
      signal: AbortSignal.timeout(10000),
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ConnectWise API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error(`[ConnectWise] Error fetching ticket ${ticketId}:`, error);
    throw new Error(`Failed to fetch ticket: ${error.message}`);
  }
}

/**
 * Add a note to a ConnectWise ticket
 */
export async function addTicketNote(
  tenantId: string,
  ticketId: number,
  noteText: string,
  memberIdentifier?: string,
  isInternal: boolean = false
): Promise<void> {
  try {
    const credentials = await getConnectWiseCredentials(tenantId);
    if (!credentials) {
      throw new Error('ConnectWise credentials not configured for this tenant');
    }

    const apiUrl = `${credentials.baseUrl}/v4_6_release/apis/3.0/service/tickets/${ticketId}/notes`;

    const notePayload: ConnectWiseNote = {
      text: noteText,
      internalAnalysisFlag: isInternal,
      detailDescriptionFlag: !isInternal,
    };

    if (memberIdentifier) {
      notePayload.member = { identifier: memberIdentifier };
    }

    console.log(`[ConnectWise] Adding note to ticket ${ticketId}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: createHeaders(credentials),
      body: JSON.stringify(notePayload),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ConnectWise API error: ${response.status} - ${errorText}`);
    }

    console.log(`[ConnectWise] Note added to ticket ${ticketId}`);
  } catch (error: any) {
    console.error(`[ConnectWise] Error adding note to ticket ${ticketId}:`, error);
    throw new Error(`Failed to add note: ${error.message}`);
  }
}

/**
 * Add a time entry to a ConnectWise ticket
 */
export async function addTimeEntry(
  tenantId: string,
  ticketId: number,
  memberIdentifier: string,
  hours: number,
  notes?: string,
  workTypeId?: number
): Promise<void> {
  try {
    const credentials = await getConnectWiseCredentials(tenantId);
    if (!credentials) {
      throw new Error('ConnectWise credentials not configured for this tenant');
    }

    const apiUrl = `${credentials.baseUrl}/v4_6_release/apis/3.0/time/entries`;

    const now = new Date();
    const timeEntry: ConnectWiseTimeEntry = {
      chargeToId: ticketId,
      chargeToType: 'ServiceTicket',
      member: {
        identifier: memberIdentifier,
      },
      timeStart: now.toISOString(),
      actualHours: hours,
      billableOption: 'Billable',
    };

    if (notes) {
      timeEntry.notes = notes;
    }

    if (workTypeId) {
      timeEntry.workType = { id: workTypeId };
    }

    console.log(`[ConnectWise] Adding ${hours} hour(s) time entry to ticket ${ticketId} for ${memberIdentifier}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: createHeaders(credentials),
      body: JSON.stringify(timeEntry),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ConnectWise API error: ${response.status} - ${errorText}`);
    }

    console.log(`[ConnectWise] Time entry added to ticket ${ticketId}`);
  } catch (error: any) {
    console.error(`[ConnectWise] Error adding time entry to ticket ${ticketId}:`, error);
    throw new Error(`Failed to add time entry: ${error.message}`);
  }
}

/**
 * Update a ConnectWise ticket status
 */
export async function updateTicketStatus(
  tenantId: string,
  ticketId: number,
  statusId: number
): Promise<void> {
  try {
    const credentials = await getConnectWiseCredentials(tenantId);
    if (!credentials) {
      throw new Error('ConnectWise credentials not configured for this tenant');
    }

    const apiUrl = `${credentials.baseUrl}/v4_6_release/apis/3.0/service/tickets/${ticketId}`;

    const updatePayload = [
      {
        op: 'replace',
        path: 'status/id',
        value: statusId,
      },
    ];

    console.log(`[ConnectWise] Updating ticket ${ticketId} status to ${statusId}`);

    const response = await fetch(apiUrl, {
      method: 'PATCH',
      headers: {
        ...createHeaders(credentials),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ConnectWise API error: ${response.status} - ${errorText}`);
    }

    console.log(`[ConnectWise] Ticket ${ticketId} status updated`);
  } catch (error: any) {
    console.error(`[ConnectWise] Error updating ticket ${ticketId} status:`, error);
    throw new Error(`Failed to update ticket status: ${error.message}`);
  }
}

/**
 * Get available ticket statuses for a board
 */
export async function getTicketStatuses(
  tenantId: string,
  boardId?: number
): Promise<Array<{ id: number; name: string; boardId: number; boardName: string }>> {
  try {
    const credentials = await getConnectWiseCredentials(tenantId);
    if (!credentials) {
      throw new Error('ConnectWise credentials not configured for this tenant');
    }

    // Build API URL
    const apiUrl = new URL(`${credentials.baseUrl}/v4_6_release/apis/3.0/service/boards`);

    // If boardId specified, get statuses for that board only
    if (boardId) {
      apiUrl.pathname += `/${boardId}/statuses`;
    }

    console.log(`[ConnectWise] Fetching statuses${boardId ? ` for board ${boardId}` : ''}`);

    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: createHeaders(credentials),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ConnectWise API error: ${response.status} - ${errorText}`);
    }

    const statuses = await response.json();

    // If fetching all boards, flatten the statuses
    if (!boardId) {
      const allStatuses: Array<{ id: number; name: string; boardId: number; boardName: string }> = [];
      for (const board of statuses) {
        const boardStatuses = await getTicketStatuses(tenantId, board.id);
        allStatuses.push(...boardStatuses);
      }
      return allStatuses;
    }

    // Return statuses for specific board
    return statuses.map((status: any) => ({
      id: status.id,
      name: status.name,
      boardId: status.board?.id || boardId,
      boardName: status.board?.name || '',
    }));
  } catch (error: any) {
    console.error('[ConnectWise] Error fetching statuses:', error);
    throw new Error(`Failed to fetch statuses: ${error.message}`);
  }
}

/**
 * Test ConnectWise API connection
 */
export async function testConnection(tenantId: string): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    const credentials = await getConnectWiseCredentials(tenantId);
    if (!credentials) {
      return {
        success: false,
        message: 'ConnectWise credentials not configured for this tenant',
      };
    }

    // Try to fetch company info as a connection test
    const apiUrl = `${credentials.baseUrl}/v4_6_release/apis/3.0/company/companies?pageSize=1`;

    console.log('[ConnectWise] Testing API connection...');

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: createHeaders(credentials),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        message: `ConnectWise API error: ${response.status}`,
        details: errorText,
      };
    }

    const data = await response.json();

    return {
      success: true,
      message: 'Successfully connected to ConnectWise API',
      details: {
        baseUrl: credentials.baseUrl,
        companyId: credentials.companyId,
        responseStatus: response.status,
        companiesFound: data.length,
      },
    };
  } catch (error: any) {
    console.error('[ConnectWise] Connection test failed:', error);
    return {
      success: false,
      message: `Connection failed: ${error.message}`,
      details: error.stack,
    };
  }
}

/**
 * Check if ConnectWise integration is enabled for a tenant
 */
export async function isConnectWiseEnabled(tenantId: string): Promise<boolean> {
  try {
    // Check if feature flag is enabled globally
    const featureFlagResult = await pool.query(
      `SELECT is_enabled
      FROM feature_flags
      WHERE feature_key = $1`,
      ['connectwise_integration']
    );

    if (featureFlagResult.rows.length === 0 || !featureFlagResult.rows[0].is_enabled) {
      return false;
    }

    // Check if tenant has credentials configured
    const credentials = await getConnectWiseCredentials(tenantId);
    return credentials !== null;
  } catch (error) {
    console.error('[ConnectWise] Error checking if enabled:', error);
    return false;
  }
}
