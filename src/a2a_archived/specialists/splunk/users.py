"""Splunk Users skill module.

This module provides skills for user management including:
- Current user information
- User listing
"""

from typing import Any, Dict, List

from src.a2a.types import AgentSkill

from .base import (
    SplunkSkillModule,
    SplunkAPIClient,
    SkillDefinition,
    SkillResult,
    create_skill,
    success_result,
    error_result,
    log_skill_start,
    log_skill_success,
    log_skill_error,
)

# ============================================================================
# SKILL DEFINITIONS
# ============================================================================

USER_SKILLS: List[SkillDefinition] = [
    {
        "id": "users_get_user_info",
        "name": "Get User Info",
        "description": (
            "Retrieves detailed information about the currently authenticated user including "
            "roles and permissions. Returns comprehensive user profile data for the current session."
        ),
        "tags": ["splunk", "users", "current-user", "profile", "permissions", "roles"],
        "examples": [
            "Who am I in Splunk?",
            "Get my user info",
            "What are my permissions?",
            "Show my Splunk roles",
            "What access do I have?",
        ],
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "id": "users_get_user_list",
        "name": "Get User List",
        "description": (
            "Get a list of users from Splunk. Retrieves information about all users including "
            "authentication details, roles, and account status. Requires admin privileges."
        ),
        "tags": ["splunk", "users", "list", "admin", "management"],
        "examples": [
            "List all Splunk users",
            "Who has access to Splunk?",
            "Show me all users",
            "Get user accounts",
            "List admin users",
        ],
        "input_schema": {
            "type": "object",
            "properties": {
                "role_filter": {
                    "type": "string",
                    "description": "Filter users by role (e.g., 'admin', 'user', 'power')"
                },
            },
            "required": [],
        },
    },
]


# ============================================================================
# MODULE CLASS
# ============================================================================

class UsersModule(SplunkSkillModule):
    """Users management skills module."""

    MODULE_NAME = "users"
    MODULE_PREFIX = "users_"

    @classmethod
    def get_skills(cls) -> List[AgentSkill]:
        """Get all user skills."""
        return [create_skill(skill_def) for skill_def in USER_SKILLS]

    @classmethod
    async def execute(
        cls,
        skill_id: str,
        client: SplunkAPIClient,
        params: Dict[str, Any],
        context: Any,
    ) -> SkillResult:
        """Execute a user skill."""
        log_skill_start(skill_id, params)

        try:
            result = await cls._execute_skill(skill_id, client, params, context)
            log_skill_success(skill_id, result)
            return result
        except Exception as e:
            log_skill_error(skill_id, e)
            return error_result(f"Failed to execute {skill_id}: {str(e)}")

    @classmethod
    async def _execute_skill(
        cls,
        skill_id: str,
        client: SplunkAPIClient,
        params: Dict[str, Any],
        context: Any,
    ) -> SkillResult:
        """Internal skill execution dispatcher."""

        if skill_id == "users_get_user_info":
            return await cls._get_user_info(client, params)

        if skill_id == "users_get_user_list":
            return await cls._get_user_list(client, params)

        return error_result(f"Unknown skill: {skill_id}")

    @classmethod
    async def _get_user_info(
        cls,
        client: SplunkAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get information about the current user."""
        response = await client.get("/services/authentication/current-context")

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get user info"))

        data = response.get("data", {})
        entries = data.get("entry", [])

        if not entries:
            return error_result("No user context available")

        content = entries[0].get("content", {})

        user_info = {
            "username": content.get("username"),
            "realname": content.get("realname"),
            "email": content.get("email"),
            "roles": content.get("roles", []),
            "capabilities": content.get("capabilities", []),
            "defaultApp": content.get("defaultApp"),
            "type": content.get("type"),
            "tz": content.get("tz"),
        }

        # Get capabilities summary
        caps = user_info.get("capabilities", [])
        cap_summary = {
            "can_search": "search" in caps,
            "can_admin": "admin_all_objects" in caps,
            "can_edit_users": "edit_user" in caps,
            "can_schedule_searches": "schedule_search" in caps,
            "can_edit_alerts": "edit_alert" in caps,
            "total_capabilities": len(caps),
        }
        user_info["capability_summary"] = cap_summary

        return success_result(
            data=user_info,
            entities={
                "username": user_info.get("username"),
                "roles": user_info.get("roles", []),
            },
            follow_up="Would you like to list all users or check specific permissions?"
        )

    @classmethod
    async def _get_user_list(
        cls,
        client: SplunkAPIClient,
        params: Dict[str, Any]
    ) -> SkillResult:
        """Get list of all Splunk users."""
        role_filter = params.get("role_filter", "")

        response = await client.get(
            "/services/authentication/users",
            {"count": 100}
        )

        if not response.get("success"):
            return error_result(response.get("error", "Failed to get user list"))

        data = response.get("data", {})
        entries = data.get("entry", [])

        users = []
        roles_seen = set()

        for entry in entries:
            content = entry.get("content", {})
            user_roles = content.get("roles", [])

            # Apply role filter if specified
            if role_filter:
                if not any(role_filter.lower() in r.lower() for r in user_roles):
                    continue

            user = {
                "username": entry.get("name"),
                "realname": content.get("realname"),
                "email": content.get("email"),
                "roles": user_roles,
                "defaultApp": content.get("defaultApp"),
                "type": content.get("type"),
                "locked_out": content.get("locked-out", False),
            }
            users.append(user)

            for role in user_roles:
                roles_seen.add(role)

        # Sort by username
        users.sort(key=lambda x: x.get("username", "").lower())

        # Summary by role
        role_counts = {}
        for user in users:
            for role in user.get("roles", []):
                role_counts[role] = role_counts.get(role, 0) + 1

        summary = {
            "total_users": len(users),
            "unique_roles": len(roles_seen),
            "users_by_role": role_counts,
            "locked_out_count": sum(1 for u in users if u.get("locked_out")),
        }

        return success_result(
            data={
                "users": users,
                "summary": summary,
            },
            entities={
                "usernames": [u["username"] for u in users],
                "roles": list(roles_seen),
            },
            follow_up="Would you like details on a specific user or role?"
        )
