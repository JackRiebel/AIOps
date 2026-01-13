"""Dynamic proxy for all Meraki Dashboard API functions.

This module provides a dynamic proxy that can call ANY function from the Meraki Dashboard API SDK.
It automatically handles parameter mapping, authentication, and error handling for all 823+ SDK functions.
"""

import logging
from typing import Any, Dict, List, Optional
import meraki
import meraki.aio
from src.services.credential_manager import CredentialManager

logger = logging.getLogger(__name__)


class MerakiDynamicProxy:
    """Dynamic proxy for calling any Meraki Dashboard API function."""

    # Map of SDK module names to their classes
    MODULES = [
        'administered', 'appliance', 'camera', 'campusGateway', 'cellularGateway',
        'devices', 'insight', 'licensing', 'networks', 'organizations',
        'sensor', 'sm', 'spaces', 'switch', 'wireless', 'wirelessController'
    ]

    def __init__(self):
        """Initialize the Meraki Dynamic Proxy."""
        self.credential_manager = CredentialManager()

    async def call_meraki_function(
        self,
        organization: str,
        module_name: str,
        function_name: str,
        **kwargs
    ) -> Dict[str, Any]:
        """Dynamically call any Meraki Dashboard API function.

        Args:
            organization: Organization name to get credentials for
            module_name: SDK module name (e.g., 'organizations', 'networks', 'devices')
            function_name: Function name to call (e.g., 'getOrganizations', 'getNetworkDevices')
            **kwargs: Function parameters

        Returns:
            Dict containing the API response

        Raises:
            ValueError: If module or function doesn't exist
            HTTPException: If API call fails
        """
        # Validate module exists
        if module_name not in self.MODULES:
            raise ValueError(
                f"Invalid module '{module_name}'. "
                f"Available modules: {', '.join(self.MODULES)}"
            )

        # Get credentials
        credentials = await self.credential_manager.get_credentials(organization)
        if not credentials:
            raise ValueError(f"No credentials found for organization: {organization}")

        # Create async Meraki Dashboard instance
        async with meraki.aio.AsyncDashboardAPI(
            api_key=credentials["api_key"],
            base_url=credentials.get("base_url", "https://api.meraki.com/api/v1"),
            suppress_logging=True,
            output_log=False,
            print_console=False,
            maximum_retries=3,
            wait_on_rate_limit=True,
        ) as dashboard:
            try:
                # Get the module (e.g., dashboard.organizations)
                module = getattr(dashboard, module_name)

                # Get the function (e.g., dashboard.organizations.getOrganizations)
                func = getattr(module, function_name)

                # Call the function with provided parameters
                logger.info(f"Calling Meraki API: {module_name}.{function_name}")
                logger.debug(f"Parameters: {kwargs}")

                result = await func(**kwargs)

                logger.info(f"Successfully called {module_name}.{function_name}")
                return {
                    "success": True,
                    "module": module_name,
                    "function": function_name,
                    "data": result
                }

            except AttributeError as e:
                error_msg = f"Function '{function_name}' not found in module '{module_name}'"
                logger.error(f"{error_msg}: {e}")
                raise ValueError(error_msg)

            except Exception as e:
                logger.error(f"Error calling {module_name}.{function_name}: {e}")
                return {
                    "success": False,
                    "module": module_name,
                    "function": function_name,
                    "error": str(e),
                    "error_type": type(e).__name__
                }

    async def get_available_functions(self, module_name: Optional[str] = None) -> Dict[str, Any]:
        """Get list of available functions in SDK.

        Args:
            module_name: Optional module name to filter by

        Returns:
            Dict containing available modules and their functions
        """
        if module_name and module_name not in self.MODULES:
            raise ValueError(
                f"Invalid module '{module_name}'. "
                f"Available modules: {', '.join(self.MODULES)}"
            )

        result = {}

        # Use a temporary dashboard instance just to introspect the API
        dashboard = meraki.DashboardAPI(
            api_key="temp",  # Temporary key just for introspection
            suppress_logging=True,
            output_log=False
        )

        modules_to_check = [module_name] if module_name else self.MODULES

        for mod_name in modules_to_check:
            try:
                module = getattr(dashboard, mod_name)

                # Get all callable methods (functions)
                functions = [
                    name for name in dir(module)
                    if callable(getattr(module, name)) and not name.startswith('_')
                ]

                result[mod_name] = {
                    "count": len(functions),
                    "functions": sorted(functions)
                }

            except AttributeError:
                logger.warning(f"Module '{mod_name}' not found in SDK")
                continue

        return {
            "total_modules": len(result),
            "total_functions": sum(mod["count"] for mod in result.values()),
            "modules": result
        }


# Singleton instance
_proxy_instance: Optional[MerakiDynamicProxy] = None


def get_meraki_proxy() -> MerakiDynamicProxy:
    """Get singleton instance of Meraki Dynamic Proxy."""
    global _proxy_instance
    if _proxy_instance is None:
        _proxy_instance = MerakiDynamicProxy()
    return _proxy_instance
