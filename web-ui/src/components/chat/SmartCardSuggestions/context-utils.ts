/**
 * Context extraction utilities for SmartCardSuggestions
 * Extracts networkId, deviceSerial, organizationId from structured data
 */

/**
 * Check if a string is a valid Meraki network ID (L_ or N_ prefix)
 */
export function isMerakiNetworkId(id: unknown): id is string {
  return typeof id === 'string' && (id.startsWith('L_') || id.startsWith('N_'));
}

/**
 * Check if a string is a valid Meraki device serial (XXXX-XXXX-XXXX format)
 */
export function isMerakiSerial(serial: unknown): serial is string {
  return typeof serial === 'string' && /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(serial);
}

export interface ExtractedContext {
  networkId?: string;
  deviceSerial?: string;
  organizationId?: string;
}

/**
 * Extract context (networkId, deviceSerial, organizationId) from structured data
 * Uses the same patterns as CardContent.tsx extractNetworkId for consistency
 */
export function extractContextFromData(structuredData: unknown): ExtractedContext {
  const context: ExtractedContext = {};

  const toolDataArray = Array.isArray(structuredData) ? structuredData : [];

  for (const item of toolDataArray) {
    // Check item level
    if (!context.networkId) {
      if (isMerakiNetworkId(item?.networkId)) context.networkId = item.networkId;
      else if (isMerakiNetworkId(item?.network_id)) context.networkId = item.network_id;
    }
    if (!context.deviceSerial && isMerakiSerial(item?.serial)) {
      context.deviceSerial = item.serial;
    }
    if (!context.organizationId && item?.organizationId) {
      context.organizationId = item.organizationId;
    }

    // Check item.data level (where most Meraki responses store data)
    const itemData = item?.data;
    if (itemData && typeof itemData === 'object') {
      // Network extraction from nested locations
      if (!context.networkId) {
        if (isMerakiNetworkId(itemData.id)) context.networkId = itemData.id;
        else if (isMerakiNetworkId(itemData.networkId)) context.networkId = itemData.networkId;
        else if (isMerakiNetworkId(itemData.network_id)) context.networkId = itemData.network_id;
        else if (itemData.network && isMerakiNetworkId(itemData.network?.id)) {
          context.networkId = itemData.network.id;
        }
      }

      // Device serial extraction
      if (!context.deviceSerial && isMerakiSerial(itemData.serial)) {
        context.deviceSerial = itemData.serial;
      }

      // Organization ID extraction
      if (!context.organizationId && itemData.organizationId) {
        context.organizationId = itemData.organizationId;
      }

      // Check arrays within data
      if (Array.isArray(itemData)) {
        for (const d of itemData) {
          if (!context.networkId && isMerakiNetworkId(d?.networkId)) {
            context.networkId = d.networkId;
          }
          if (!context.networkId && isMerakiNetworkId(d?.network_id)) {
            context.networkId = d.network_id;
          }
          if (!context.deviceSerial && isMerakiSerial(d?.serial)) {
            context.deviceSerial = d.serial;
          }
        }
      }
    }
  }

  return context;
}
