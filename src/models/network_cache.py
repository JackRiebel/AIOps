"""Database models for caching networks and devices."""

from datetime import datetime
from typing import Optional

from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from src.config.database import Base


class CachedNetwork(Base):
    """Model for caching network data from all organization types."""

    __tablename__ = "cached_networks"

    id = Column(Integer, primary_key=True, index=True)

    # Organization info
    organization_name = Column(String(255), nullable=False, index=True)
    organization_type = Column(String(50), nullable=False)  # meraki, thousandeyes, splunk

    # Network info (from Meraki)
    network_id = Column(String(255), nullable=False, index=True)
    network_name = Column(String(500), nullable=False)
    product_types = Column(JSON, nullable=True)  # List of product types
    time_zone = Column(String(100), nullable=True)
    tags = Column(JSON, nullable=True)  # List of tags
    enrollment_string = Column(String(500), nullable=True)
    url = Column(String(500), nullable=True)

    # Raw data from API
    raw_data = Column(JSON, nullable=True)

    # Cache metadata
    last_updated = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    is_stale = Column(String(10), default="false", nullable=False)  # "true" if org is offline

    # Relationships
    devices = relationship("CachedDevice", back_populates="network", cascade="all, delete-orphan")

    # Composite index for fast lookups
    __table_args__ = (
        Index('idx_org_network', 'organization_name', 'network_id'),
    )

    def __repr__(self) -> str:
        return f"<CachedNetwork(id={self.id}, org='{self.organization_name}', name='{self.network_name}')>"

    def to_dict(self) -> dict:
        """Convert network to dictionary.

        Returns:
            Dictionary representation of network
        """
        return {
            "id": self.network_id,
            "name": self.network_name,
            "organizationId": self.organization_name,
            "productTypes": self.product_types or [],
            "timeZone": self.time_zone,
            "tags": self.tags or [],
            "enrollmentString": self.enrollment_string,
            "url": self.url,
            "_cached_at": self.last_updated.isoformat() if self.last_updated else None,
            "_is_stale": self.is_stale == "true",
        }


class CachedDevice(Base):
    """Model for caching device data from all organization types."""

    __tablename__ = "cached_devices"

    id = Column(Integer, primary_key=True, index=True)

    # Organization info
    organization_name = Column(String(255), nullable=False, index=True)
    organization_type = Column(String(50), nullable=False)  # meraki, thousandeyes, splunk

    # Device info (from Meraki)
    serial = Column(String(255), nullable=False, index=True)
    device_name = Column(String(500), nullable=False)
    model = Column(String(255), nullable=True)
    network_id = Column(String(255), nullable=False, index=True)

    # Status and network info
    status = Column(String(50), nullable=True)  # online, offline, alerting, dormant
    lan_ip = Column(String(50), nullable=True)
    public_ip = Column(String(50), nullable=True)
    mac = Column(String(50), nullable=True)
    firmware = Column(String(255), nullable=True)

    # Additional metadata
    tags = Column(JSON, nullable=True)
    notes = Column(Text, nullable=True)

    # Raw data from API
    raw_data = Column(JSON, nullable=True)

    # Cache metadata
    last_updated = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    is_stale = Column(String(10), default="false", nullable=False)  # "true" if org is offline

    # Foreign key to network
    cached_network_id = Column(Integer, ForeignKey("cached_networks.id"), nullable=True)
    network = relationship("CachedNetwork", back_populates="devices")

    # Composite index for fast lookups
    __table_args__ = (
        Index('idx_org_serial', 'organization_name', 'serial'),
        Index('idx_network_devices', 'network_id'),
    )

    def __repr__(self) -> str:
        return f"<CachedDevice(id={self.id}, serial='{self.serial}', name='{self.device_name}', status='{self.status}')>"

    def to_dict(self) -> dict:
        """Convert device to dictionary.

        Returns:
            Dictionary representation of device
        """
        # Extract WAN IPs from raw_data (full Meraki API response)
        raw = self.raw_data if isinstance(self.raw_data, dict) else {}
        return {
            "serial": self.serial,
            "name": self.device_name,
            "model": self.model,
            "networkId": self.network_id,
            "status": self.status,
            "lanIp": self.lan_ip,
            "wan1Ip": raw.get("wan1Ip", ""),
            "wan2Ip": raw.get("wan2Ip", ""),
            "publicIp": self.public_ip,
            "mac": self.mac,
            "firmware": self.firmware,
            "tags": self.tags or [],
            "_cached_at": self.last_updated.isoformat() if self.last_updated else None,
            "_is_stale": self.is_stale == "true",
        }


class DeviceMetricsCache(Base):
    """Model for caching device metrics (bandwidth, latency, etc.)."""

    __tablename__ = "device_metrics_cache"

    id = Column(Integer, primary_key=True, index=True)

    # Composite key: serial:metrics_type (e.g., "Q2AB-XXXX-XXXX:bandwidth")
    cache_key = Column(String(500), nullable=False, unique=True, index=True)

    # Metrics data as JSON
    data = Column(JSON, nullable=False)

    # Cache metadata
    expires_at = Column(DateTime, nullable=False, index=True)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    def __repr__(self) -> str:
        return f"<DeviceMetricsCache(key='{self.cache_key}', expires_at={self.expires_at})>"

    def to_dict(self) -> dict:
        """Convert to dictionary.

        Returns:
            Dictionary representation
        """
        return {
            "cache_key": self.cache_key,
            "data": self.data,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
