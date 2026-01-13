"""ThousandEyes Test Results skill module.

This module provides skills for retrieving test results across all test types.
"""

from typing import Any, Dict, List
from .base import (
    ThousandEyesSkillModule, ThousandEyesAPIClient, SkillDefinition, SkillResult,
    create_skill, success_result, error_result, log_skill_start, log_skill_success, log_skill_error,
    TEST_ID_SCHEMA, AGENT_ID_SCHEMA, ROUND_ID_SCHEMA, START_DATE_SCHEMA, END_DATE_SCHEMA, WINDOW_SCHEMA,
)

TEST_RESULTS_SKILLS: List[SkillDefinition] = [
    # Network Results
    {"id": "results_get_network", "name": "Get Network Results", "description": "Get network layer test results.", "tags": ["thousandeyes", "results", "network"], "examples": ["Get network results"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "agent_id": AGENT_ID_SCHEMA, "window": WINDOW_SCHEMA, "start_date": START_DATE_SCHEMA, "end_date": END_DATE_SCHEMA, "aid": {"type": "string"}}, "required": ["test_id"]}},
    {"id": "results_get_path_vis", "name": "Get Path Visualization", "description": "Get path visualization results.", "tags": ["thousandeyes", "results", "path-vis", "traceroute"], "examples": ["Get path visualization"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "agent_id": AGENT_ID_SCHEMA, "window": WINDOW_SCHEMA, "start_date": START_DATE_SCHEMA, "end_date": END_DATE_SCHEMA, "aid": {"type": "string"}}, "required": ["test_id"]}},
    {"id": "results_get_detailed_path", "name": "Get Detailed Path", "description": "Get detailed path trace for specific agent and round.", "tags": ["thousandeyes", "results", "path-vis", "detailed"], "examples": ["Get detailed path trace"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "agent_id": AGENT_ID_SCHEMA, "round_id": ROUND_ID_SCHEMA, "aid": {"type": "string"}}, "required": ["test_id", "agent_id", "round_id"]}},
    {"id": "results_get_bgp", "name": "Get BGP Results", "description": "Get BGP test results.", "tags": ["thousandeyes", "results", "bgp"], "examples": ["Get BGP results"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "window": WINDOW_SCHEMA, "start_date": START_DATE_SCHEMA, "end_date": END_DATE_SCHEMA, "aid": {"type": "string"}}, "required": ["test_id"]}},
    {"id": "results_get_bgp_routes", "name": "Get BGP Routes", "description": "Get BGP route prefix information.", "tags": ["thousandeyes", "results", "bgp", "routes"], "examples": ["Get BGP routes"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "prefix_id": {"type": "string"}, "round_id": ROUND_ID_SCHEMA, "aid": {"type": "string"}}, "required": ["test_id"]}},

    # HTTP/Web Results
    {"id": "results_get_http_server", "name": "Get HTTP Server Results", "description": "Get HTTP server test results.", "tags": ["thousandeyes", "results", "http-server"], "examples": ["Get HTTP results"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "agent_id": AGENT_ID_SCHEMA, "window": WINDOW_SCHEMA, "start_date": START_DATE_SCHEMA, "end_date": END_DATE_SCHEMA, "aid": {"type": "string"}}, "required": ["test_id"]}},
    {"id": "results_get_page_load", "name": "Get Page Load Results", "description": "Get page load test results.", "tags": ["thousandeyes", "results", "page-load"], "examples": ["Get page load results"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "agent_id": AGENT_ID_SCHEMA, "window": WINDOW_SCHEMA, "start_date": START_DATE_SCHEMA, "end_date": END_DATE_SCHEMA, "aid": {"type": "string"}}, "required": ["test_id"]}},
    {"id": "results_get_page_load_component", "name": "Get Page Load Component Details", "description": "Get detailed component information for page load.", "tags": ["thousandeyes", "results", "page-load", "component"], "examples": ["Get page components"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "agent_id": AGENT_ID_SCHEMA, "round_id": ROUND_ID_SCHEMA, "aid": {"type": "string"}}, "required": ["test_id", "agent_id", "round_id"]}},
    {"id": "results_get_web_transactions", "name": "Get Web Transaction Results", "description": "Get web transaction test results.", "tags": ["thousandeyes", "results", "web-transactions"], "examples": ["Get transaction results"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "agent_id": AGENT_ID_SCHEMA, "window": WINDOW_SCHEMA, "start_date": START_DATE_SCHEMA, "end_date": END_DATE_SCHEMA, "aid": {"type": "string"}}, "required": ["test_id"]}},
    {"id": "results_get_web_transactions_component", "name": "Get Web Transaction Component Details", "description": "Get detailed component information for web transaction.", "tags": ["thousandeyes", "results", "web-transactions", "component"], "examples": ["Get transaction components"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "agent_id": AGENT_ID_SCHEMA, "round_id": ROUND_ID_SCHEMA, "aid": {"type": "string"}}, "required": ["test_id", "agent_id", "round_id"]}},
    {"id": "results_get_api", "name": "Get API Test Results", "description": "Get API test results.", "tags": ["thousandeyes", "results", "api"], "examples": ["Get API results"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "agent_id": AGENT_ID_SCHEMA, "window": WINDOW_SCHEMA, "start_date": START_DATE_SCHEMA, "end_date": END_DATE_SCHEMA, "aid": {"type": "string"}}, "required": ["test_id"]}},

    # DNS Results
    {"id": "results_get_dns_server", "name": "Get DNS Server Results", "description": "Get DNS server test results.", "tags": ["thousandeyes", "results", "dns-server"], "examples": ["Get DNS results"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "agent_id": AGENT_ID_SCHEMA, "window": WINDOW_SCHEMA, "start_date": START_DATE_SCHEMA, "end_date": END_DATE_SCHEMA, "aid": {"type": "string"}}, "required": ["test_id"]}},
    {"id": "results_get_dns_trace", "name": "Get DNS Trace Results", "description": "Get DNS trace test results.", "tags": ["thousandeyes", "results", "dns-trace"], "examples": ["Get DNS trace results"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "agent_id": AGENT_ID_SCHEMA, "window": WINDOW_SCHEMA, "start_date": START_DATE_SCHEMA, "end_date": END_DATE_SCHEMA, "aid": {"type": "string"}}, "required": ["test_id"]}},
    {"id": "results_get_dnssec", "name": "Get DNSSEC Results", "description": "Get DNSSEC validation test results.", "tags": ["thousandeyes", "results", "dnssec"], "examples": ["Get DNSSEC results"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "agent_id": AGENT_ID_SCHEMA, "window": WINDOW_SCHEMA, "start_date": START_DATE_SCHEMA, "end_date": END_DATE_SCHEMA, "aid": {"type": "string"}}, "required": ["test_id"]}},

    # Voice Results
    {"id": "results_get_sip_server", "name": "Get SIP Server Results", "description": "Get SIP server test results.", "tags": ["thousandeyes", "results", "sip-server"], "examples": ["Get SIP results"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "agent_id": AGENT_ID_SCHEMA, "window": WINDOW_SCHEMA, "start_date": START_DATE_SCHEMA, "end_date": END_DATE_SCHEMA, "aid": {"type": "string"}}, "required": ["test_id"]}},
    {"id": "results_get_voice", "name": "Get Voice Results", "description": "Get voice (RTP) test results.", "tags": ["thousandeyes", "results", "voice", "rtp"], "examples": ["Get voice results"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "agent_id": AGENT_ID_SCHEMA, "window": WINDOW_SCHEMA, "start_date": START_DATE_SCHEMA, "end_date": END_DATE_SCHEMA, "aid": {"type": "string"}}, "required": ["test_id"]}},
    {"id": "results_get_voice_metrics", "name": "Get Voice Metrics", "description": "Get detailed voice quality metrics (MOS, jitter, packet loss).", "tags": ["thousandeyes", "results", "voice", "metrics", "mos"], "examples": ["Get voice metrics"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "agent_id": AGENT_ID_SCHEMA, "window": WINDOW_SCHEMA, "start_date": START_DATE_SCHEMA, "end_date": END_DATE_SCHEMA, "aid": {"type": "string"}}, "required": ["test_id"]}},

    # FTP Results
    {"id": "results_get_ftp_server", "name": "Get FTP Server Results", "description": "Get FTP server test results.", "tags": ["thousandeyes", "results", "ftp-server"], "examples": ["Get FTP results"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "agent_id": AGENT_ID_SCHEMA, "window": WINDOW_SCHEMA, "start_date": START_DATE_SCHEMA, "end_date": END_DATE_SCHEMA, "aid": {"type": "string"}}, "required": ["test_id"]}},

    # Aggregate/Agent-specific Results
    {"id": "results_get_network_by_agent", "name": "Get Network Results by Agent", "description": "Get network results for a specific agent.", "tags": ["thousandeyes", "results", "network", "agent"], "examples": ["Get agent network results"], "input_schema": {"type": "object", "properties": {"test_id": TEST_ID_SCHEMA, "agent_id": AGENT_ID_SCHEMA, "window": WINDOW_SCHEMA, "start_date": START_DATE_SCHEMA, "end_date": END_DATE_SCHEMA, "aid": {"type": "string"}}, "required": ["test_id", "agent_id"]}},
]


class TestResultsModule(ThousandEyesSkillModule):
    """Test results skill module for all test types."""

    MODULE_NAME = "test_results"
    MODULE_PREFIX = "results_"

    @classmethod
    def get_skills(cls) -> List[Any]:
        return [create_skill(s) for s in TEST_RESULTS_SKILLS]

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
        test_id = params.get("test_id")
        agent_id = params.get("agent_id")
        round_id = params.get("round_id")
        qp = {k: v for k, v in {"window": params.get("window"), "from": params.get("start_date"), "to": params.get("end_date"), "aid": params.get("aid")}.items() if v}

        # Network Results
        if skill_id == "results_get_network":
            endpoint = f"test-results/{test_id}/network" if not agent_id else f"test-results/{test_id}/network/{agent_id}"
            r = await client.get(endpoint, qp)
            if r.get("success"):
                results = r.get("data", {}).get("results", [])
                return success_result(data={"results": results, "count": len(results)})
            return error_result(r.get("error"))

        if skill_id == "results_get_path_vis":
            endpoint = f"test-results/{test_id}/path-vis" if not agent_id else f"test-results/{test_id}/path-vis/{agent_id}"
            r = await client.get(endpoint, qp)
            if r.get("success"):
                results = r.get("data", {}).get("results", [])
                return success_result(data={"results": results, "count": len(results)})
            return error_result(r.get("error"))

        if skill_id == "results_get_detailed_path":
            r = await client.get(f"test-results/{test_id}/path-vis/{agent_id}/{round_id}", {"aid": params.get("aid")})
            return success_result(data={"path": r.get("data", {}).get("results", {})}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "results_get_bgp":
            r = await client.get(f"test-results/{test_id}/bgp", qp)
            if r.get("success"):
                results = r.get("data", {}).get("results", [])
                return success_result(data={"results": results, "count": len(results)})
            return error_result(r.get("error"))

        if skill_id == "results_get_bgp_routes":
            qp2 = {"prefixId": params.get("prefix_id"), "roundId": round_id, "aid": params.get("aid")}
            qp2 = {k: v for k, v in qp2.items() if v}
            r = await client.get(f"test-results/{test_id}/bgp-routes", qp2)
            return success_result(data={"routes": r.get("data", {}).get("results", [])}) if r.get("success") else error_result(r.get("error"))

        # HTTP/Web Results
        if skill_id == "results_get_http_server":
            endpoint = f"test-results/{test_id}/http-server" if not agent_id else f"test-results/{test_id}/http-server/{agent_id}"
            r = await client.get(endpoint, qp)
            if r.get("success"):
                results = r.get("data", {}).get("results", [])
                return success_result(data={"results": results, "count": len(results)})
            return error_result(r.get("error"))

        if skill_id == "results_get_page_load":
            endpoint = f"test-results/{test_id}/page-load" if not agent_id else f"test-results/{test_id}/page-load/{agent_id}"
            r = await client.get(endpoint, qp)
            if r.get("success"):
                results = r.get("data", {}).get("results", [])
                return success_result(data={"results": results, "count": len(results)})
            return error_result(r.get("error"))

        if skill_id == "results_get_page_load_component":
            r = await client.get(f"test-results/{test_id}/page-load/{agent_id}/{round_id}", {"aid": params.get("aid")})
            return success_result(data={"components": r.get("data", {}).get("results", {})}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "results_get_web_transactions":
            endpoint = f"test-results/{test_id}/web-transactions" if not agent_id else f"test-results/{test_id}/web-transactions/{agent_id}"
            r = await client.get(endpoint, qp)
            if r.get("success"):
                results = r.get("data", {}).get("results", [])
                return success_result(data={"results": results, "count": len(results)})
            return error_result(r.get("error"))

        if skill_id == "results_get_web_transactions_component":
            r = await client.get(f"test-results/{test_id}/web-transactions/{agent_id}/{round_id}", {"aid": params.get("aid")})
            return success_result(data={"components": r.get("data", {}).get("results", {})}) if r.get("success") else error_result(r.get("error"))

        if skill_id == "results_get_api":
            endpoint = f"test-results/{test_id}/api" if not agent_id else f"test-results/{test_id}/api/{agent_id}"
            r = await client.get(endpoint, qp)
            if r.get("success"):
                results = r.get("data", {}).get("results", [])
                return success_result(data={"results": results, "count": len(results)})
            return error_result(r.get("error"))

        # DNS Results
        if skill_id == "results_get_dns_server":
            endpoint = f"test-results/{test_id}/dns-server" if not agent_id else f"test-results/{test_id}/dns-server/{agent_id}"
            r = await client.get(endpoint, qp)
            if r.get("success"):
                results = r.get("data", {}).get("results", [])
                return success_result(data={"results": results, "count": len(results)})
            return error_result(r.get("error"))

        if skill_id == "results_get_dns_trace":
            endpoint = f"test-results/{test_id}/dns-trace" if not agent_id else f"test-results/{test_id}/dns-trace/{agent_id}"
            r = await client.get(endpoint, qp)
            if r.get("success"):
                results = r.get("data", {}).get("results", [])
                return success_result(data={"results": results, "count": len(results)})
            return error_result(r.get("error"))

        if skill_id == "results_get_dnssec":
            endpoint = f"test-results/{test_id}/dnssec" if not agent_id else f"test-results/{test_id}/dnssec/{agent_id}"
            r = await client.get(endpoint, qp)
            if r.get("success"):
                results = r.get("data", {}).get("results", [])
                return success_result(data={"results": results, "count": len(results)})
            return error_result(r.get("error"))

        # Voice Results
        if skill_id == "results_get_sip_server":
            endpoint = f"test-results/{test_id}/sip-server" if not agent_id else f"test-results/{test_id}/sip-server/{agent_id}"
            r = await client.get(endpoint, qp)
            if r.get("success"):
                results = r.get("data", {}).get("results", [])
                return success_result(data={"results": results, "count": len(results)})
            return error_result(r.get("error"))

        if skill_id == "results_get_voice":
            endpoint = f"test-results/{test_id}/voice" if not agent_id else f"test-results/{test_id}/voice/{agent_id}"
            r = await client.get(endpoint, qp)
            if r.get("success"):
                results = r.get("data", {}).get("results", [])
                return success_result(data={"results": results, "count": len(results)})
            return error_result(r.get("error"))

        if skill_id == "results_get_voice_metrics":
            endpoint = f"test-results/{test_id}/voice/metrics" if not agent_id else f"test-results/{test_id}/voice/metrics/{agent_id}"
            r = await client.get(endpoint, qp)
            if r.get("success"):
                metrics = r.get("data", {}).get("results", [])
                return success_result(data={"metrics": metrics, "count": len(metrics)})
            return error_result(r.get("error"))

        # FTP Results
        if skill_id == "results_get_ftp_server":
            endpoint = f"test-results/{test_id}/ftp-server" if not agent_id else f"test-results/{test_id}/ftp-server/{agent_id}"
            r = await client.get(endpoint, qp)
            if r.get("success"):
                results = r.get("data", {}).get("results", [])
                return success_result(data={"results": results, "count": len(results)})
            return error_result(r.get("error"))

        # Agent-specific
        if skill_id == "results_get_network_by_agent":
            r = await client.get(f"test-results/{test_id}/network/{agent_id}", qp)
            if r.get("success"):
                results = r.get("data", {}).get("results", [])
                return success_result(data={"results": results, "count": len(results)})
            return error_result(r.get("error"))

        return error_result(f"Unknown skill: {skill_id}")
