#!/usr/bin/env python3
"""
RBAC Migration Script

This script migrates the existing user/role system to the new enterprise RBAC system.
It creates necessary tables, seeds permissions and roles, and migrates existing users.

Usage:
    python scripts/migrate_rbac.py

The script is idempotent - running it multiple times is safe.
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db, Base
from src.models.user import User, UserRole
from src.models.permission import Permission, RolePermission
from src.models.role import Role
from src.models.organization import Organization, UserOrganization

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ===================================================================
# System Permissions
# ===================================================================
SYSTEM_PERMISSIONS = [
    # Users
    {"code": "users.view", "name": "View Users", "category": "users", "description": "View user list and profiles"},
    {"code": "users.create", "name": "Create Users", "category": "users", "description": "Create new user accounts"},
    {"code": "users.update", "name": "Update Users", "category": "users", "description": "Update user information"},
    {"code": "users.delete", "name": "Delete Users", "category": "users", "description": "Delete user accounts"},
    {"code": "users.manage_roles", "name": "Manage User Roles", "category": "users", "description": "Assign and change user roles"},

    # Incidents
    {"code": "incidents.view", "name": "View Incidents", "category": "incidents", "description": "View incident timeline and details"},
    {"code": "incidents.create", "name": "Create Incidents", "category": "incidents", "description": "Create new incidents manually"},
    {"code": "incidents.update", "name": "Update Incidents", "category": "incidents", "description": "Update incident status and details"},
    {"code": "incidents.delete", "name": "Delete Incidents", "category": "incidents", "description": "Delete incidents"},
    {"code": "incidents.refresh", "name": "Refresh Incidents", "category": "incidents", "description": "Trigger incident data refresh"},

    # Network
    {"code": "network.view", "name": "View Network", "category": "network", "description": "View network overview and topology"},
    {"code": "network.manage", "name": "Manage Network", "category": "network", "description": "Make network configuration changes"},
    {"code": "network.devices.view", "name": "View Devices", "category": "network", "description": "View device list and details"},
    {"code": "network.devices.manage", "name": "Manage Devices", "category": "network", "description": "Configure and manage devices"},

    # AI
    {"code": "ai.chat", "name": "AI Chat", "category": "ai", "description": "Use AI chat assistant"},
    {"code": "ai.settings", "name": "AI Settings", "category": "ai", "description": "Configure AI settings and models"},
    {"code": "ai.costs.view", "name": "View AI Costs", "category": "ai", "description": "View AI usage and costs"},
    {"code": "ai.knowledge.view", "name": "View Knowledge Base", "category": "ai", "description": "Browse knowledge base"},
    {"code": "ai.knowledge.manage", "name": "Manage Knowledge Base", "category": "ai", "description": "Add and edit knowledge articles"},

    # Audit
    {"code": "audit.view", "name": "View Audit Logs", "category": "audit", "description": "View audit log entries"},
    {"code": "audit.export", "name": "Export Audit Logs", "category": "audit", "description": "Export audit logs"},

    # Admin
    {"code": "admin.system.view", "name": "View System Config", "category": "admin", "description": "View system configuration"},
    {"code": "admin.system.manage", "name": "Manage System Config", "category": "admin", "description": "Modify system configuration"},
    {"code": "admin.security.view", "name": "View Security Settings", "category": "admin", "description": "View security configuration"},
    {"code": "admin.security.manage", "name": "Manage Security Settings", "category": "admin", "description": "Modify security configuration"},
    {"code": "admin.edit_mode", "name": "Edit Mode Control", "category": "admin", "description": "Toggle edit mode"},

    # RBAC
    {"code": "rbac.permissions.view", "name": "View Permissions", "category": "rbac", "description": "View available permissions"},
    {"code": "rbac.permissions.manage", "name": "Manage Permissions", "category": "rbac", "description": "Create and modify permissions"},
    {"code": "rbac.roles.view", "name": "View Roles", "category": "rbac", "description": "View role definitions"},
    {"code": "rbac.roles.manage", "name": "Manage Roles", "category": "rbac", "description": "Create and modify roles"},
    {"code": "rbac.organizations.view", "name": "View Organizations", "category": "rbac", "description": "View organization list"},
    {"code": "rbac.organizations.manage", "name": "Manage Organizations", "category": "rbac", "description": "Create and modify organizations"},
    {"code": "rbac.delegations.view", "name": "View Delegations", "category": "rbac", "description": "View permission delegations"},
    {"code": "rbac.delegations.manage", "name": "Manage Delegations", "category": "rbac", "description": "Create and revoke delegations"},
    {"code": "rbac.requests.view", "name": "View Role Requests", "category": "rbac", "description": "View role change requests"},
    {"code": "rbac.requests.manage", "name": "Manage Role Requests", "category": "rbac", "description": "Approve or reject role requests"},

    # Integrations
    {"code": "integrations.view", "name": "View Integrations", "category": "integrations", "description": "View integration configurations"},
    {"code": "integrations.manage", "name": "Manage Integrations", "category": "integrations", "description": "Configure integrations"},
    {"code": "integrations.splunk", "name": "Splunk Access", "category": "integrations", "description": "Access Splunk integration"},
    {"code": "integrations.thousandeyes", "name": "ThousandEyes Access", "category": "integrations", "description": "Access ThousandEyes integration"},

    # Workflows
    {"code": "workflows.view", "name": "View Workflows", "category": "workflows", "description": "View workflow definitions and executions"},
    {"code": "workflows.create", "name": "Create Workflows", "category": "workflows", "description": "Create new workflows"},
    {"code": "workflows.edit", "name": "Edit Workflows", "category": "workflows", "description": "Modify existing workflows"},
    {"code": "workflows.delete", "name": "Delete Workflows", "category": "workflows", "description": "Delete workflows"},
    {"code": "workflows.approve", "name": "Approve Workflow Actions", "category": "workflows", "description": "Approve or reject pending workflow actions"},
    {"code": "workflows.execute", "name": "Execute Workflows", "category": "workflows", "description": "Manually trigger workflow execution"},
    {"code": "workflows.admin", "name": "Workflow Administration", "category": "workflows", "description": "Full workflow administration access"},
]


# ===================================================================
# System Roles with Permission Mappings
# ===================================================================
SYSTEM_ROLES = {
    "super_admin": {
        "display_name": "Super Administrator",
        "description": "Full cross-organization access with all permissions",
        "priority": 1000,
        "permissions": "*",  # All permissions
    },
    "admin": {
        "display_name": "Administrator",
        "description": "Full organization access",
        "priority": 100,
        "permissions": [
            "users.*", "incidents.*", "network.*", "ai.*", "audit.*", "admin.*", "rbac.*", "integrations.*", "workflows.*"
        ],
    },
    "editor": {
        "display_name": "Editor",
        "description": "Read/write access to most resources",
        "priority": 50,
        "permissions": [
            "users.view",
            "incidents.view", "incidents.create", "incidents.update",
            "network.view", "network.manage", "network.devices.view", "network.devices.manage",
            "ai.chat", "ai.settings", "ai.costs.view", "ai.knowledge.view", "ai.knowledge.manage",
            "audit.view", "audit.export",
            "admin.system.view",
            "rbac.permissions.view", "rbac.roles.view", "rbac.organizations.view",
            "integrations.view", "integrations.splunk", "integrations.thousandeyes",
            "workflows.view", "workflows.create", "workflows.edit", "workflows.execute",
        ],
    },
    "operator": {
        "display_name": "Operator",
        "description": "Limited write access, can trigger operations",
        "priority": 25,
        "permissions": [
            "users.view",
            "incidents.view", "incidents.refresh",
            "network.view", "network.devices.view",
            "ai.chat", "ai.costs.view", "ai.knowledge.view",
            "audit.view",
            "admin.system.view",
            "rbac.permissions.view", "rbac.roles.view", "rbac.organizations.view",
            "integrations.view", "integrations.splunk", "integrations.thousandeyes",
            "workflows.view", "workflows.approve", "workflows.execute",
        ],
    },
    "viewer": {
        "display_name": "Viewer",
        "description": "Read-only access to all data",
        "priority": 10,
        "permissions": [
            "users.view",
            "incidents.view",
            "network.view", "network.devices.view",
            "ai.chat", "ai.costs.view", "ai.knowledge.view",
            "audit.view",
            "admin.system.view",
            "rbac.permissions.view", "rbac.roles.view", "rbac.organizations.view",
            "integrations.view", "integrations.splunk", "integrations.thousandeyes",
            "workflows.view",
        ],
    },
}


async def create_tables():
    """Create all RBAC tables if they don't exist."""
    logger.info("Creating RBAC tables...")

    db = get_db()
    async with db.async_engine.begin() as conn:
        # Add missing columns to users table (safe to run multiple times)
        alter_statements = [
            """
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                               WHERE table_name='users' AND column_name='is_super_admin') THEN
                    ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN DEFAULT FALSE;
                END IF;
            END $$;
            """,
            """
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                               WHERE table_name='users' AND column_name='primary_organization_id') THEN
                    ALTER TABLE users ADD COLUMN primary_organization_id INTEGER;
                END IF;
            END $$;
            """,
        ]

        for stmt in alter_statements:
            await conn.execute(text(stmt))
        logger.info("Added missing columns to users table")

        # Create tables
        await conn.run_sync(Base.metadata.create_all)

    logger.info("RBAC tables created successfully")


async def seed_permissions(session: AsyncSession) -> dict:
    """Seed system permissions. Returns dict of code -> permission."""
    logger.info("Seeding permissions...")

    permissions_map = {}

    for perm_data in SYSTEM_PERMISSIONS:
        # Check if permission exists
        result = await session.execute(
            select(Permission).where(Permission.code == perm_data["code"])
        )
        existing = result.scalar_one_or_none()

        if existing:
            permissions_map[perm_data["code"]] = existing
            logger.debug(f"Permission '{perm_data['code']}' already exists")
        else:
            permission = Permission(
                code=perm_data["code"],
                name=perm_data["name"],
                category=perm_data["category"],
                description=perm_data.get("description"),
                resource_type=perm_data.get("resource_type"),
                is_system=True,
            )
            session.add(permission)
            permissions_map[perm_data["code"]] = permission
            logger.info(f"Created permission: {perm_data['code']}")

    await session.flush()
    logger.info(f"Seeded {len(permissions_map)} permissions")
    return permissions_map


async def seed_roles(session: AsyncSession, permissions_map: dict) -> dict:
    """Seed system roles with permission mappings. Returns dict of name -> role."""
    logger.info("Seeding roles...")

    roles_map = {}

    for role_name, role_data in SYSTEM_ROLES.items():
        # Check if role exists
        result = await session.execute(
            select(Role).where(Role.name == role_name, Role.organization_id.is_(None))
        )
        existing = result.scalar_one_or_none()

        if existing:
            roles_map[role_name] = existing
            role = existing
            logger.info(f"Role '{role_name}' already exists - syncing permissions")
        else:
            role = Role(
                name=role_name,
                display_name=role_data["display_name"],
                description=role_data["description"],
                priority=role_data["priority"],
                is_system=True,
                organization_id=None,  # Global roles
            )
            session.add(role)
            await session.flush()  # Get role ID
            roles_map[role_name] = role

        # Determine permissions to assign
        perm_specs = role_data["permissions"]

        if perm_specs == "*":
            # All permissions
            perms_to_assign = list(permissions_map.values())
        else:
            perms_to_assign = []
            for spec in perm_specs:
                if spec.endswith(".*"):
                    # Wildcard - match all in category
                    prefix = spec[:-2]  # Remove .*
                    for code, perm in permissions_map.items():
                        if code.startswith(prefix + "."):
                            perms_to_assign.append(perm)
                elif spec in permissions_map:
                    perms_to_assign.append(permissions_map[spec])

        # Add missing permissions (idempotent)
        added_count = 0
        for perm in perms_to_assign:
            # Check if role already has this permission
            existing_rp = await session.execute(
                select(RolePermission).where(
                    RolePermission.role_id == role.id,
                    RolePermission.permission_id == perm.id
                )
            )
            if not existing_rp.scalar_one_or_none():
                rp = RolePermission(role_id=role.id, permission_id=perm.id)
                session.add(rp)
                added_count += 1

        if added_count > 0:
            logger.info(f"Added {added_count} new permissions to role: {role_name}")
        else:
            logger.debug(f"Role '{role_name}' already has all permissions")

    await session.flush()
    logger.info(f"Seeded {len(roles_map)} roles")
    return roles_map


async def create_default_organization(session: AsyncSession) -> Organization:
    """Create default organization for existing users."""
    logger.info("Creating default organization...")

    # Check if default org exists
    result = await session.execute(
        select(Organization).where(Organization.slug == "default")
    )
    existing = result.scalar_one_or_none()

    if existing:
        logger.info("Default organization already exists")
        return existing

    org = Organization(
        name="Default Organization",
        display_name="Default Organization",
        slug="default",
        settings={
            "created_by_migration": True,
            "description": "Default organization for migrated users",
        },
        is_active=True,
    )
    session.add(org)
    await session.flush()

    logger.info(f"Created default organization with ID {org.id}")
    return org


async def migrate_users(
    session: AsyncSession,
    roles_map: dict,
    default_org: Organization
):
    """Migrate existing users to the new RBAC system."""
    logger.info("Migrating users...")

    # Get all users
    result = await session.execute(select(User))
    users = result.scalars().all()

    migrated_count = 0
    skipped_count = 0

    for user in users:
        # Check if user already has organization membership
        membership_result = await session.execute(
            select(UserOrganization).where(UserOrganization.user_id == user.id)
        )
        existing_membership = membership_result.scalar_one_or_none()

        if existing_membership:
            logger.debug(f"User {user.username} already has organization membership")
            skipped_count += 1
            continue

        # Map legacy role to new role
        legacy_role = user.role
        role_mapping = {
            UserRole.ADMIN.value: "admin",
            UserRole.EDITOR.value: "editor",
            UserRole.OPERATOR.value: "operator",
            UserRole.VIEWER.value: "viewer",
            "admin": "admin",
            "editor": "editor",
            "operator": "operator",
            "viewer": "viewer",
        }

        new_role_name = role_mapping.get(legacy_role, "viewer")
        new_role = roles_map.get(new_role_name)

        if not new_role:
            logger.warning(f"No role found for user {user.username} with legacy role {legacy_role}")
            continue

        # Create organization membership
        membership = UserOrganization(
            user_id=user.id,
            organization_id=default_org.id,
            role_id=new_role.id,
            is_primary=True,
        )
        session.add(membership)

        # Set primary organization on user
        user.primary_organization_id = default_org.id

        # First admin becomes super admin
        if legacy_role in [UserRole.ADMIN.value, "admin"]:
            # Check if there's already a super admin
            super_admin_result = await session.execute(
                select(User).where(User.is_super_admin == True)
            )
            if not super_admin_result.scalar_one_or_none():
                user.is_super_admin = True
                logger.info(f"User {user.username} promoted to super admin")

        migrated_count += 1
        logger.info(f"Migrated user {user.username}: {legacy_role} -> {new_role_name}")

    await session.flush()
    logger.info(f"Migration complete: {migrated_count} users migrated, {skipped_count} skipped")


async def run_migration():
    """Run the full RBAC migration."""
    logger.info("=" * 60)
    logger.info("Starting RBAC Migration")
    logger.info("=" * 60)

    try:
        # Create tables
        await create_tables()

        # Get database session
        db = get_db()
        async with db.session() as session:
            # Seed permissions
            permissions_map = await seed_permissions(session)

            # Seed roles
            roles_map = await seed_roles(session, permissions_map)

            # Create default organization
            default_org = await create_default_organization(session)

            # Migrate users
            await migrate_users(session, roles_map, default_org)

            # Commit all changes
            await session.commit()

        logger.info("=" * 60)
        logger.info("RBAC Migration completed successfully!")
        logger.info("=" * 60)

    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(run_migration())
