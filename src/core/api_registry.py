"""API Registry for managing Meraki Dashboard API."""

from typing import Dict, List, Optional
from dataclasses import dataclass


@dataclass
class APIDefinition:
    """Definition of a Meraki Dashboard API."""

    name: str
    display_name: str
    spec_file: str
    base_path: str
    description: str
    enabled: bool = True


class APIRegistry:
    """Registry for managing Meraki Dashboard API."""

    # Define all available APIs
    APIS: Dict[str, APIDefinition] = {
        "dashboard": APIDefinition(
            name="dashboard",
            display_name="Meraki Dashboard API",
            spec_file="meraki_dashboard.json",
            base_path="",  # Meraki paths are already complete in the spec
            description="Complete Meraki Dashboard API - Organizations, Networks, Devices, Wireless, Switch, Appliance, Camera",
            enabled=True
        ),
    }

    @classmethod
    def get_api(cls, name: str) -> Optional[APIDefinition]:
        """Get API definition by name.

        Args:
            name: API name

        Returns:
            APIDefinition or None if not found
        """
        return cls.APIS.get(name)

    @classmethod
    def get_enabled_apis(cls) -> List[APIDefinition]:
        """Get list of enabled APIs.

        Returns:
            List of enabled APIDefinition objects
        """
        return [api for api in cls.APIS.values() if api.enabled]

    @classmethod
    def get_all_apis(cls) -> List[APIDefinition]:
        """Get list of all APIs.

        Returns:
            List of all APIDefinition objects
        """
        return list(cls.APIS.values())

    @classmethod
    def enable_api(cls, name: str) -> bool:
        """Enable an API.

        Args:
            name: API name

        Returns:
            True if successful, False if API not found
        """
        api = cls.get_api(name)
        if api:
            api.enabled = True
            return True
        return False

    @classmethod
    def disable_api(cls, name: str) -> bool:
        """Disable an API.

        Args:
            name: API name

        Returns:
            True if successful, False if API not found
        """
        api = cls.get_api(name)
        if api:
            api.enabled = False
            return True
        return False

    @classmethod
    def get_base_path_for_api(cls, api_name: str) -> Optional[str]:
        """Get base path for an API.

        Args:
            api_name: API name

        Returns:
            Base path string or None if API not found
        """
        api = cls.get_api(api_name)
        return api.base_path if api else None
