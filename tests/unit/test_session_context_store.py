"""Unit tests for SessionContextStore."""

import pytest
import time
from datetime import datetime
from src.services.session_context_store import (
    SessionContextStore,
    SessionContext,
    DiscoveredEntity,
    EntityType,
    OrgType,
)


class TestDiscoveredEntity:
    """Test DiscoveredEntity dataclass."""

    def test_entity_creation(self):
        """Test basic entity creation."""
        entity = DiscoveredEntity(
            entity_type=EntityType.NETWORK,
            id="N_123456",
            name="Test Network",
            data={"productTypes": ["wireless", "switch"]},
            source_tool="meraki_list_networks",
        )
        assert entity.id == "N_123456"
        assert entity.name == "Test Network"
        assert entity.entity_type == EntityType.NETWORK
        assert entity.source_tool == "meraki_list_networks"

    def test_entity_touch_updates_timestamp(self):
        """Test that touch() updates last_accessed."""
        entity = DiscoveredEntity(
            entity_type=EntityType.DEVICE,
            id="Q2XX-XXXX-XXXX",
        )
        original_time = entity.last_accessed

        time.sleep(0.01)
        entity.touch()

        assert entity.last_accessed > original_time

    def test_entity_to_dict(self):
        """Test entity serialization."""
        entity = DiscoveredEntity(
            entity_type=EntityType.VLAN,
            id="100",
            name="Management VLAN",
        )
        d = entity.to_dict()

        assert d["entity_type"] == "vlan"
        assert d["id"] == "100"
        assert d["name"] == "Management VLAN"
        assert "last_accessed" in d
        assert "discovered_at" in d


class TestSessionContextStore:
    """Test SessionContextStore functionality."""

    @pytest.fixture
    def store(self):
        return SessionContextStore()

    @pytest.mark.asyncio
    async def test_get_or_create_new_session(self, store):
        """Test creating a new session context."""
        ctx = await store.get_or_create("session_123")

        assert ctx.session_id == "session_123"
        assert ctx.tool_call_count == 0

    @pytest.mark.asyncio
    async def test_get_or_create_existing_session(self, store):
        """Test retrieving existing session context."""
        ctx1 = await store.get_or_create("session_123")
        ctx1.tool_call_count = 5

        ctx2 = await store.get_or_create("session_123")

        assert ctx2.tool_call_count == 5
        assert ctx1 is ctx2

    @pytest.mark.asyncio
    async def test_add_discovered_entity(self, store):
        """Test adding discovered entities."""
        entity = await store.add_discovered_entity(
            session_id="session_123",
            entity_type=EntityType.NETWORK,
            entity_id="N_123456",
            name="Test Network",
            data={"tags": ["production"]},
            source_tool="meraki_list_networks",
        )

        assert entity.id == "N_123456"
        assert entity.name == "Test Network"

        ctx = await store.get_or_create("session_123")
        assert len(ctx.discovered_entities[EntityType.NETWORK]) == 1

    @pytest.mark.asyncio
    async def test_entity_lru_eviction_per_type(self, store):
        """Test LRU eviction when MAX_ENTITIES_PER_TYPE is exceeded."""
        session_id = "session_eviction"

        # Add more entities than the limit
        for i in range(store.MAX_ENTITIES_PER_TYPE + 5):
            await store.add_discovered_entity(
                session_id=session_id,
                entity_type=EntityType.DEVICE,
                entity_id=f"device_{i}",
                name=f"Device {i}",
            )

        ctx = await store.get_or_create(session_id)
        device_count = len(ctx.discovered_entities[EntityType.DEVICE])

        # Should not exceed limit
        assert device_count <= store.MAX_ENTITIES_PER_TYPE

    @pytest.mark.asyncio
    async def test_get_entity_touches_timestamp(self, store):
        """Test that get_entity updates last_accessed."""
        session_id = "session_touch"

        await store.add_discovered_entity(
            session_id=session_id,
            entity_type=EntityType.NETWORK,
            entity_id="N_123",
            name="Test",
        )

        ctx = await store.get_or_create(session_id)
        original_time = ctx.discovered_entities[EntityType.NETWORK]["N_123"].last_accessed

        time.sleep(0.01)

        entity = ctx.get_entity(EntityType.NETWORK, "N_123")

        assert entity.last_accessed > original_time

    @pytest.mark.asyncio
    async def test_get_context_stats(self, store):
        """Test context statistics."""
        session_id = "session_stats"

        await store.add_discovered_entity(
            session_id=session_id,
            entity_type=EntityType.NETWORK,
            entity_id="N_1",
            name="Network 1",
        )
        await store.add_discovered_entity(
            session_id=session_id,
            entity_type=EntityType.DEVICE,
            entity_id="D_1",
            name="Device 1",
        )

        stats = await store.get_context_stats(session_id)

        assert stats["total_entities"] == 2
        assert "network" in stats["entity_counts"]
        assert "device" in stats["entity_counts"]
        assert "limits" in stats
        assert "utilization" in stats


class TestSessionContext:
    """Test SessionContext class."""

    def test_get_entity_by_name(self):
        """Test entity lookup by name."""
        ctx = SessionContext(session_id="test")

        # Add entity
        entity = DiscoveredEntity(
            entity_type=EntityType.NETWORK,
            id="N_123",
            name="Test Network",
        )
        ctx.discovered_entities[EntityType.NETWORK]["N_123"] = entity

        # Find by name (case-insensitive)
        found = ctx.get_entity_by_name(EntityType.NETWORK, "test network")
        assert found is not None
        assert found.id == "N_123"

        # Not found
        not_found = ctx.get_entity_by_name(EntityType.NETWORK, "nonexistent")
        assert not_found is None

    def test_get_all_entities_sorted_by_recency(self):
        """Test that get_all_entities returns sorted by recency."""
        ctx = SessionContext(session_id="test")

        # Add entities with different access times
        for i in range(3):
            entity = DiscoveredEntity(
                entity_type=EntityType.DEVICE,
                id=f"D_{i}",
                name=f"Device {i}",
            )
            ctx.discovered_entities[EntityType.DEVICE][f"D_{i}"] = entity
            time.sleep(0.01)

        # Touch the first one to make it most recent
        ctx.discovered_entities[EntityType.DEVICE]["D_0"].touch()

        entities = ctx.get_all_entities(EntityType.DEVICE)

        # First entity should be D_0 (most recently accessed)
        assert entities[0].id == "D_0"

    def test_context_stats(self):
        """Test get_context_stats method."""
        ctx = SessionContext(session_id="test")
        ctx.tool_call_count = 10

        # Add some entities
        for i in range(3):
            ctx.discovered_entities[EntityType.NETWORK][f"N_{i}"] = DiscoveredEntity(
                entity_type=EntityType.NETWORK,
                id=f"N_{i}",
                name=f"Network {i}",
            )

        stats = ctx.get_context_stats()

        assert stats["total_entities"] == 3
        assert stats["tool_call_count"] == 10
        assert "network" in stats["entity_counts"]
