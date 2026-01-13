"""ThousandEyes Credentials skill module.

This module provides skills for credential management.
"""

from typing import Any, Dict, List
from .base import (
    ThousandEyesSkillModule, ThousandEyesAPIClient, SkillDefinition, SkillResult,
    create_skill, success_result, error_result, log_skill_start, log_skill_success, log_skill_error,
    CREDENTIAL_ID_SCHEMA,
)

CREDENTIALS_SKILLS: List[SkillDefinition] = [
    {"id": "credentials_get_list", "name": "List Credentials", "description": "Get all stored credentials.", "tags": ["thousandeyes", "credentials", "list"], "examples": ["List credentials"], "input_schema": {"type": "object", "properties": {"aid": {"type": "string"}}, "required": []}},
    {"id": "credentials_get_by_id", "name": "Get Credential", "description": "Get details of a specific credential.", "tags": ["thousandeyes", "credentials", "details"], "examples": ["Get credential"], "input_schema": {"type": "object", "properties": {"credential_id": CREDENTIAL_ID_SCHEMA}, "required": ["credential_id"]}},
    {"id": "credentials_create", "name": "Create Credential", "description": "Create a new credential.", "tags": ["thousandeyes", "credentials", "create"], "examples": ["Create credential"], "input_schema": {"type": "object", "properties": {"name": {"type": "string"}, "type": {"type": "string", "enum": ["BASIC", "SSH", "TOKEN", "OAUTH"], "description": "Credential type"}, "username": {"type": "string"}, "password": {"type": "string"}, "token": {"type": "string"}, "ssh_private_key": {"type": "string"}, "ssh_passphrase": {"type": "string"}, "oauth_client_id": {"type": "string"}, "oauth_client_secret": {"type": "string"}}, "required": ["name", "type"]}},
    {"id": "credentials_update", "name": "Update Credential", "description": "Update an existing credential.", "tags": ["thousandeyes", "credentials", "update"], "examples": ["Update credential"], "input_schema": {"type": "object", "properties": {"credential_id": CREDENTIAL_ID_SCHEMA, "name": {"type": "string"}, "username": {"type": "string"}, "password": {"type": "string"}, "token": {"type": "string"}}, "required": ["credential_id"]}},
    {"id": "credentials_delete", "name": "Delete Credential", "description": "Delete a credential.", "tags": ["thousandeyes", "credentials", "delete"], "examples": ["Delete credential"], "input_schema": {"type": "object", "properties": {"credential_id": CREDENTIAL_ID_SCHEMA}, "required": ["credential_id"]}},
]


class CredentialsModule(ThousandEyesSkillModule):
    """Credentials skill module for credential management."""

    MODULE_NAME = "credentials"
    MODULE_PREFIX = "credentials_"

    @classmethod
    def get_skills(cls) -> List[Any]:
        return [create_skill(s) for s in CREDENTIALS_SKILLS]

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
        if skill_id == "credentials_get_list":
            r = await client.get("credentials", {"aid": params.get("aid")})
            if r.get("success"):
                creds = r.get("data", {}).get("credentials", [])
                return success_result(data={"credentials": creds, "count": len(creds)})
            return error_result(r.get("error"))

        if skill_id == "credentials_get_by_id":
            r = await client.get(f"credentials/{params.get('credential_id')}")
            return success_result(data={"credential": r.get("data", {}).get("credentials", [{}])[0]}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "credentials_create":
            payload = {k: v for k, v in {
                "name": params.get("name"),
                "type": params.get("type"),
                "username": params.get("username"),
                "password": params.get("password"),
                "token": params.get("token"),
                "sshPrivateKey": params.get("ssh_private_key"),
                "sshPassphrase": params.get("ssh_passphrase"),
                "oauthClientId": params.get("oauth_client_id"),
                "oauthClientSecret": params.get("oauth_client_secret"),
            }.items() if v is not None}
            r = await client.post("credentials", payload)
            if r.get("success"):
                cred = r.get("data", {}).get("credentials", [{}])[0] if isinstance(r.get("data", {}).get("credentials"), list) else r.get("data", {})
                return success_result(data={"message": "Credential created", "credential": cred})
            return error_result(r.get("error"))

        if skill_id == "credentials_update":
            cred_id = params.pop("credential_id", None)
            payload = {k: v for k, v in {
                "name": params.get("name"),
                "username": params.get("username"),
                "password": params.get("password"),
                "token": params.get("token"),
            }.items() if v is not None}
            r = await client.put(f"credentials/{cred_id}", payload)
            return success_result(data={"message": "Credential updated"}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "credentials_delete":
            r = await client.delete(f"credentials/{params.get('credential_id')}")
            return success_result(data={"message": "Credential deleted"}) if r.get("success") else error_result(r.get("error"))

        return error_result(f"Unknown skill: {skill_id}")
