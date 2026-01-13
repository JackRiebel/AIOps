"""Credential management service for secure storage and retrieval."""

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.models import Cluster
from src.utils.encryption import decrypt_password, encrypt_password


class CredentialManager:
    """Manager for cluster credentials with encryption."""

    def __init__(self):
        """Initialize credential manager."""
        self.db = get_db()

    async def store_credentials(
        self,
        name: str,
        api_key: str,
        base_url: str = "https://api.meraki.com/api/v1",
        verify_ssl: bool = True,
        display_name: Optional[str] = None,
        username: Optional[str] = None,
    ) -> Cluster:
        """Store cluster credentials with encryption.

        Args:
            name: Organization name (unique identifier)
            api_key: API key or password (will be encrypted)
            base_url: API base URL
            verify_ssl: Whether to verify SSL certificates
            display_name: Optional friendly name for display
            username: Optional username for basic auth (Splunk, etc.)

        Returns:
            Created Cluster instance
        """
        # Encrypt API key/password before storing
        encrypted_api_key = encrypt_password(api_key)

        async with self.db.session() as session:
            # Check if organization already exists
            result = await session.execute(
                select(Cluster).where(Cluster.name == name)
            )
            existing_cluster = result.scalar_one_or_none()

            if existing_cluster:
                # Update existing organization
                existing_cluster.display_name = display_name
                existing_cluster.url = base_url
                existing_cluster.username = username
                existing_cluster.password_encrypted = encrypted_api_key
                existing_cluster.verify_ssl = verify_ssl
                await session.commit()
                await session.refresh(existing_cluster)
                return existing_cluster
            else:
                # Create new organization
                cluster = Cluster(
                    name=name,
                    display_name=display_name,
                    url=base_url,
                    username=username,
                    password_encrypted=encrypted_api_key,
                    verify_ssl=verify_ssl,
                )
                session.add(cluster)
                await session.commit()
                await session.refresh(cluster)
                return cluster

    async def get_credentials(self, name: str) -> Optional[dict]:
        """Retrieve and decrypt organization credentials.

        Args:
            name: Organization name

        Returns:
            Dictionary with base_url, api_key, username, password, verify_ssl or None if not found
        """
        async with self.db.session() as session:
            result = await session.execute(
                select(Cluster).where(Cluster.name == name, Cluster.is_active == True)
            )
            cluster = result.scalar_one_or_none()

            if not cluster:
                return None

            # Decrypt API key/password
            decrypted_credential = decrypt_password(cluster.password_encrypted)

            return {
                "base_url": cluster.url,
                "api_key": decrypted_credential,  # For API key-based auth (Meraki, ThousandEyes)
                "password": decrypted_credential,  # For password-based auth (Splunk)
                "username": cluster.username,  # For basic auth (Splunk)
                "verify_ssl": cluster.verify_ssl,
            }

    async def get_cluster(self, name: str) -> Optional[Cluster]:
        """Get cluster instance by name.

        Args:
            name: Cluster name

        Returns:
            Cluster instance or None if not found
        """
        async with self.db.session() as session:
            result = await session.execute(
                select(Cluster).where(Cluster.name == name)
            )
            return result.scalar_one_or_none()

    async def list_clusters(self, active_only: bool = True) -> list[Cluster]:
        """List all clusters.

        Args:
            active_only: If True, only return active clusters

        Returns:
            List of Cluster instances
        """
        async with self.db.session() as session:
            query = select(Cluster)
            if active_only:
                query = query.where(Cluster.is_active == True)

            result = await session.execute(query)
            return list(result.scalars().all())

    async def list_organizations(self, active_only: bool = True) -> list[dict]:
        """List all organizations/clusters as dictionaries.

        This is an alias for list_clusters() that returns dicts for compatibility
        with code that expects dictionary-style access.

        Args:
            active_only: If True, only return active clusters

        Returns:
            List of organization dictionaries with name, url, display_name, etc.
        """
        clusters = await self.list_clusters(active_only=active_only)
        return [cluster.to_dict() for cluster in clusters]

    async def delete_credentials(self, name: str) -> bool:
        """Delete cluster credentials and associated audit logs.

        Args:
            name: Cluster name

        Returns:
            True if deleted, False if not found
        """
        from src.models.audit import AuditLog
        from sqlalchemy import delete as sql_delete

        async with self.db.session() as session:
            result = await session.execute(
                select(Cluster).where(Cluster.name == name)
            )
            cluster = result.scalar_one_or_none()

            if not cluster:
                return False

            # First delete all audit logs associated with this cluster
            await session.execute(
                sql_delete(AuditLog).where(AuditLog.cluster_id == cluster.id)
            )

            # Then delete the cluster
            await session.delete(cluster)
            await session.commit()
            return True

    async def deactivate_cluster(self, name: str) -> bool:
        """Deactivate a cluster (soft delete).

        Args:
            name: Cluster name

        Returns:
            True if deactivated, False if not found
        """
        async with self.db.session() as session:
            result = await session.execute(
                select(Cluster).where(Cluster.name == name)
            )
            cluster = result.scalar_one_or_none()

            if not cluster:
                return False

            cluster.is_active = False
            await session.commit()
            return True
