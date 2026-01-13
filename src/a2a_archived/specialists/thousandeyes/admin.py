"""ThousandEyes Administration skill module.

This module provides skills for account administration including:
- Account groups
- Users
- Roles
- Permissions
- Audit log
"""

from typing import Any, Dict, List
from .base import (
    ThousandEyesSkillModule, ThousandEyesAPIClient, SkillDefinition, SkillResult,
    create_skill, success_result, error_result, log_skill_start, log_skill_success, log_skill_error,
    ACCOUNT_GROUP_ID_SCHEMA, USER_ID_SCHEMA, ROLE_ID_SCHEMA, START_DATE_SCHEMA, END_DATE_SCHEMA,
)

ADMIN_SKILLS: List[SkillDefinition] = [
    # Account Groups
    {"id": "admin_get_account_groups", "name": "List Account Groups", "description": "Get all account groups.", "tags": ["thousandeyes", "admin", "account-groups", "list"], "examples": ["List account groups"], "input_schema": {"type": "object", "properties": {}, "required": []}},
    {"id": "admin_get_account_group", "name": "Get Account Group", "description": "Get details of a specific account group.", "tags": ["thousandeyes", "admin", "account-group", "details"], "examples": ["Get account group"], "input_schema": {"type": "object", "properties": {"aid": ACCOUNT_GROUP_ID_SCHEMA}, "required": ["aid"]}},
    {"id": "admin_create_account_group", "name": "Create Account Group", "description": "Create a new account group.", "tags": ["thousandeyes", "admin", "account-group", "create"], "examples": ["Create account group"], "input_schema": {"type": "object", "properties": {"account_group_name": {"type": "string"}, "organization_id": {"type": "string"}}, "required": ["account_group_name"]}},
    {"id": "admin_update_account_group", "name": "Update Account Group", "description": "Update an account group.", "tags": ["thousandeyes", "admin", "account-group", "update"], "examples": ["Update account group"], "input_schema": {"type": "object", "properties": {"aid": ACCOUNT_GROUP_ID_SCHEMA, "account_group_name": {"type": "string"}}, "required": ["aid"]}},
    {"id": "admin_delete_account_group", "name": "Delete Account Group", "description": "Delete an account group.", "tags": ["thousandeyes", "admin", "account-group", "delete"], "examples": ["Delete account group"], "input_schema": {"type": "object", "properties": {"aid": ACCOUNT_GROUP_ID_SCHEMA}, "required": ["aid"]}},

    # Users
    {"id": "admin_get_users", "name": "List Users", "description": "Get all users.", "tags": ["thousandeyes", "admin", "users", "list"], "examples": ["List users"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}}, "required": []}},
    {"id": "admin_get_user", "name": "Get User", "description": "Get details of a specific user.", "tags": ["thousandeyes", "admin", "user", "details"], "examples": ["Get user"], "input_schema": {"type": "object", "properties": {"uid": USER_ID_SCHEMA}, "required": ["uid"]}},
    {"id": "admin_get_current_user", "name": "Get Current User", "description": "Get the current authenticated user.", "tags": ["thousandeyes", "admin", "user", "current"], "examples": ["Get current user", "Who am I"], "input_schema": {"type": "object", "properties": {}, "required": []}},
    {"id": "admin_create_user", "name": "Create User", "description": "Create a new user.", "tags": ["thousandeyes", "admin", "user", "create"], "examples": ["Create user"], "input_schema": {"type": "object", "properties": {"email": {"type": "string"}, "name": {"type": "string"}, "account_group_roles": {"type": "array", "items": {"type": "object", "properties": {"accountGroupId": {"type": "string"}, "roleId": {"type": "string"}}}}, "login_account_group_id": {"type": "string"}}, "required": ["email", "name", "account_group_roles"]}},
    {"id": "admin_update_user", "name": "Update User", "description": "Update a user.", "tags": ["thousandeyes", "admin", "user", "update"], "examples": ["Update user"], "input_schema": {"type": "object", "properties": {"uid": USER_ID_SCHEMA, "name": {"type": "string"}, "account_group_roles": {"type": "array", "items": {"type": "object"}}, "login_account_group_id": {"type": "string"}}, "required": ["uid"]}},
    {"id": "admin_delete_user", "name": "Delete User", "description": "Delete a user.", "tags": ["thousandeyes", "admin", "user", "delete"], "examples": ["Delete user"], "input_schema": {"type": "object", "properties": {"uid": USER_ID_SCHEMA}, "required": ["uid"]}},

    # Roles
    {"id": "admin_get_roles", "name": "List Roles", "description": "Get all roles.", "tags": ["thousandeyes", "admin", "roles", "list"], "examples": ["List roles"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}}, "required": []}},
    {"id": "admin_get_role", "name": "Get Role", "description": "Get details of a specific role.", "tags": ["thousandeyes", "admin", "role", "details"], "examples": ["Get role"], "input_schema": {"type": "object", "properties": {"role_id": ROLE_ID_SCHEMA}, "required": ["role_id"]}},
    {"id": "admin_get_permissions", "name": "List Permissions", "description": "Get all available permissions.", "tags": ["thousandeyes", "admin", "permissions", "list"], "examples": ["List permissions"], "input_schema": {"type": "object", "properties": {}, "required": []}},

    # Audit
    {"id": "admin_get_activity_log", "name": "Get Activity Log", "description": "Get audit activity log.", "tags": ["thousandeyes", "admin", "audit", "activity", "log"], "examples": ["Get activity log", "Show audit log"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}, "start_date": START_DATE_SCHEMA, "end_date": END_DATE_SCHEMA, "event_type": {"type": "string"}, "user_email": {"type": "string"}}, "required": []}},
]


class AdminModule(ThousandEyesSkillModule):
    """Administration skill module for account management."""

    MODULE_NAME = "admin"
    MODULE_PREFIX = "admin_"

    @classmethod
    def get_skills(cls) -> List[Any]:
        return [create_skill(s) for s in ADMIN_SKILLS]

    @classmethod
    async def execute(cls, skill_id: str, client: ThousandEyesAPIClient, params: Dict[str, Any], context: Any) -> SkillResult:
        log_skill_start(skill_id, params)
        try:
            result = await cls._execute_skill(skill_id, client, params)
            log_skill_success(skill_id, result)
            return result
        except Exception as e:
            log_skill_error(skill_id, e)
            return error_result(f"Failed: {str(e)}")

    @classmethod
    async def _execute_skill(cls, skill_id: str, client: ThousandEyesAPIClient, params: Dict[str, Any]) -> SkillResult:
        # Account Groups
        if skill_id == "admin_get_account_groups":
            r = await client.get("account-groups")
            if r.get("success"):
                groups = r.get("data", {}).get("accountGroups", [])
                return success_result(data={"account_groups": groups, "count": len(groups)})
            return error_result(r.get("error"))

        if skill_id == "admin_get_account_group":
            r = await client.get(f"account-groups/{params.get('aid')}")
            return success_result(data={"account_group": r.get("data", {}).get("accountGroups", [{}])[0]}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "admin_create_account_group":
            payload = {k: v for k, v in {"accountGroupName": params.get("account_group_name"), "organizationId": params.get("organization_id")}.items() if v is not None}
            r = await client.post("account-groups", payload)
            if r.get("success"):
                group = r.get("data", {}).get("accountGroups", [{}])[0] if isinstance(r.get("data", {}).get("accountGroups"), list) else r.get("data", {})
                return success_result(data={"message": "Account group created", "account_group": group})
            return error_result(r.get("error"))

        if skill_id == "admin_update_account_group":
            aid = params.pop("aid", None)
            payload = {k: v for k, v in {"accountGroupName": params.get("account_group_name")}.items() if v is not None}
            r = await client.put(f"account-groups/{aid}", payload)
            return success_result(data={"message": "Account group updated"}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "admin_delete_account_group":
            r = await client.delete(f"account-groups/{params.get('aid')}")
            return success_result(data={"message": "Account group deleted"}) if r.get("success") else error_result(r.get("error"))

        # Users
        if skill_id == "admin_get_users":
            r = await client.get("users", {"aid": params.get("aid")})
            if r.get("success"):
                users = r.get("data", {}).get("users", [])
                return success_result(data={"users": users, "count": len(users)})
            return error_result(r.get("error"))

        if skill_id == "admin_get_user":
            r = await client.get(f"users/{params.get('uid')}")
            return success_result(data={"user": r.get("data", {}).get("users", [{}])[0]}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "admin_get_current_user":
            r = await client.get("users/current")
            return success_result(data={"user": r.get("data", {})}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "admin_create_user":
            payload = {k: v for k, v in {
                "email": params.get("email"),
                "name": params.get("name"),
                "accountGroupRoles": params.get("account_group_roles", []),
                "loginAccountGroupId": params.get("login_account_group_id"),
            }.items() if v is not None}
            r = await client.post("users", payload)
            if r.get("success"):
                user = r.get("data", {}).get("users", [{}])[0] if isinstance(r.get("data", {}).get("users"), list) else r.get("data", {})
                return success_result(data={"message": "User created", "user": user})
            return error_result(r.get("error"))

        if skill_id == "admin_update_user":
            uid = params.pop("uid", None)
            payload = {k: v for k, v in {
                "name": params.get("name"),
                "accountGroupRoles": params.get("account_group_roles"),
                "loginAccountGroupId": params.get("login_account_group_id"),
            }.items() if v is not None}
            r = await client.put(f"users/{uid}", payload)
            return success_result(data={"message": "User updated"}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "admin_delete_user":
            r = await client.delete(f"users/{params.get('uid')}")
            return success_result(data={"message": "User deleted"}) if r.get("success") else error_result(r.get("error"))

        # Roles
        if skill_id == "admin_get_roles":
            r = await client.get("roles", {"aid": params.get("aid")})
            if r.get("success"):
                roles = r.get("data", {}).get("roles", [])
                return success_result(data={"roles": roles, "count": len(roles)})
            return error_result(r.get("error"))

        if skill_id == "admin_get_role":
            r = await client.get(f"roles/{params.get('role_id')}")
            return success_result(data={"role": r.get("data", {}).get("roles", [{}])[0]}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "admin_get_permissions":
            r = await client.get("permissions")
            if r.get("success"):
                permissions = r.get("data", {}).get("permissions", [])
                return success_result(data={"permissions": permissions, "count": len(permissions)})
            return error_result(r.get("error"))

        # Audit
        if skill_id == "admin_get_activity_log":
            qp = {k: v for k, v in {"aid": params.get("aid"), "from": params.get("start_date"), "to": params.get("end_date"), "eventType": params.get("event_type"), "userEmail": params.get("user_email")}.items() if v}
            r = await client.get("audit-user-events", qp)
            if r.get("success"):
                events = r.get("data", {}).get("auditEvents", [])
                return success_result(data={"audit_events": events, "count": len(events)})
            return error_result(r.get("error"))

        return error_result(f"Unknown skill: {skill_id}")
