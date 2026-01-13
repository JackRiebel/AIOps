"""
UI Specialists - Compatibility Shim

This module provides backward compatibility for UI module imports.
The UI modules generate card data and are still functional.

They are imported from the archived location since they work independently
of the A2A orchestration system.
"""

# Import UI modules from archived location
# These provide card generation functionality that's still needed
try:
    from src.a2a_archived.specialists.ui import (
        HealthModule,
        TopologyModule,
        TrafficModule,
        PerformanceModule,
        AlertsModule,
        ClientsModule,
        SecurityModule,
        SitesModule,
        EventsModule,
        IntegrationsModule,
        CostsModule,
        WirelessModule,
        CardDataNormalizer,
    )
except ImportError as e:
    # If archived modules fail to import, provide stub classes
    import logging
    logger = logging.getLogger(__name__)
    logger.warning(f"Could not import UI modules from archive: {e}")

    class _StubModule:
        """Stub module that returns error responses."""
        @staticmethod
        async def execute(skill_id, params, context):
            return {
                "error": "UI module not available - A2A framework archived",
                "data": {}
            }

    HealthModule = _StubModule
    TopologyModule = _StubModule
    TrafficModule = _StubModule
    PerformanceModule = _StubModule
    AlertsModule = _StubModule
    ClientsModule = _StubModule
    SecurityModule = _StubModule
    SitesModule = _StubModule
    EventsModule = _StubModule
    IntegrationsModule = _StubModule
    CostsModule = _StubModule
    WirelessModule = _StubModule

    class CardDataNormalizer:
        """Stub normalizer."""
        @staticmethod
        def normalize(data):
            return data


__all__ = [
    "HealthModule",
    "TopologyModule",
    "TrafficModule",
    "PerformanceModule",
    "AlertsModule",
    "ClientsModule",
    "SecurityModule",
    "SitesModule",
    "EventsModule",
    "IntegrationsModule",
    "CostsModule",
    "WirelessModule",
    "CardDataNormalizer",
]
