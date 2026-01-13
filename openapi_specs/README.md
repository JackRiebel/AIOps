# Meraki Dashboard API OpenAPI Specifications

This directory should contain the Meraki Dashboard API OpenAPI specification files.

## How to Obtain Meraki OpenAPI Specs

The official Meraki Dashboard API OpenAPI v3 specifications are available from the official repository:

**Repository**: https://github.com/meraki/openapi

### Download Instructions

1. Clone the repository:
   ```bash
   git clone https://github.com/meraki/openapi.git
   ```

2. Copy the OpenAPI spec file to this directory:
   ```bash
   cp openapi/openapi/spec3.json ./openapi_specs/meraki_dashboard.json
   ```

   Or download directly:
   ```bash
   curl -o ./openapi_specs/meraki_dashboard.json https://raw.githubusercontent.com/meraki/openapi/master/openapi/spec3.json
   ```

## API Documentation

- **Official Documentation**: https://developer.cisco.com/meraki/api-v1/
- **Base URL**: https://api.meraki.com/api/v1
- **Authentication**: Bearer token with Meraki API key

## File Structure

Place your downloaded OpenAPI specs in this directory:
- `meraki_dashboard.json` - Main Meraki Dashboard API specification (OpenAPI v3)

## Notes

- The Meraki Dashboard API uses a unified API structure (unlike Nexus which had separate APIs)
- All endpoints use Bearer authentication with your Meraki API key
- The OpenAPI spec is regularly updated by Cisco Meraki
- Always refer to the official repository for the latest version
