"""AI Analysis endpoints for network visualization insights."""

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from src.api.dependencies import require_viewer
from src.services.multi_provider_ai import generate_text
from src.services.config_service import get_configured_ai_provider
from src.models.user import User
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class DeviceAnalysisRequest(BaseModel):
    device: Dict[str, Any]
    organization: str
    networkId: str
    incidents: Optional[List[Dict[str, Any]]] = None
    connections: Optional[List[Dict[str, Any]]] = None
    networkName: Optional[str] = None


class PerformanceAnalysisRequest(BaseModel):
    performance_data: Dict[str, Any]
    organization: str
    networkId: str
    networkName: Optional[str] = None
    timeRange: str = "24h"


class AnalysisResponse(BaseModel):
    analysis: str
    model_used: Optional[str] = None


@router.post("/api/ai/analyze-device", response_model=AnalysisResponse)
async def analyze_device(
    request: DeviceAnalysisRequest,
    user: User = Depends(require_viewer)
):
    """
    Generate AI-powered analysis for a network device.
    Provides health assessment, performance insights, and recommendations.
    """
    try:
        device = request.device
        incidents = request.incidents or []
        connections = request.connections or []

        # Log what we received for debugging
        logger.info(f"[Device Analysis] Received device type: {type(device)}, incidents type: {type(incidents)}, connections type: {type(connections)}")

        # Ensure device is a dict
        if not isinstance(device, dict):
            raise HTTPException(status_code=400, detail=f"Invalid device data: expected dict, got {type(device).__name__}")

        # Determine device type for specialized analysis
        model_name = device.get('model', '').upper()
        device_type = device.get('type', 'unknown')

        # Device type classification
        if model_name.startswith('MX') or model_name.startswith('Z') or device_type == 'appliance':
            device_category = 'security_appliance'
            device_role = 'Security Appliance / Router / Firewall'
        elif model_name.startswith('MR') or device_type == 'wireless':
            device_category = 'wireless_ap'
            device_role = 'Wireless Access Point'
        elif model_name.startswith('MS') or device_type == 'switch':
            device_category = 'switch'
            device_role = 'Network Switch'
        elif model_name.startswith('MV') or device_type == 'camera':
            device_category = 'camera'
            device_role = 'Security Camera'
        elif model_name.startswith('MG') or device_type == 'cellularGateway':
            device_category = 'cellular'
            device_role = 'Cellular Gateway'
        else:
            device_category = 'unknown'
            device_role = device_type.title() if device_type else 'Network Device'

        # Build health data section
        health_info = format_health_data(device.get('healthData', {}))

        # Build incidents section
        incidents_section = ""
        if incidents:
            incidents_section = "\n**Active Incidents:**\n"
            for inc in incidents[:5]:
                if isinstance(inc, dict):
                    severity = inc.get('severity', 'unknown')
                    title = inc.get('title', 'Unknown incident')
                    status = inc.get('status', 'open')
                    incidents_section += f"- [{severity.upper()}] {title} (Status: {status})\n"

        # Build connections section
        connections_section = ""
        if connections:
            connections_section = "\n**Connected Devices:**\n"
            for conn in connections[:8]:
                if isinstance(conn, dict):
                    conn_name = conn.get('name', 'Unknown')
                    conn_model = conn.get('model', '')
                    conn_type = conn.get('type', '')
                    connections_section += f"- {conn_name} ({conn_model or conn_type})\n"

        # Build device-type specific prompt
        prompt = f"""You are an expert network engineer analyzing a Meraki {device_role}.
Provide specific, actionable insights based on the device data below.

**Device:** {device.get('name', 'Unknown')} ({device.get('model', 'Unknown')})
**Role:** {device_role}
**Serial:** {device.get('serial', 'Unknown')}
**Status:** {device.get('status', 'Unknown')}
**Network:** {request.networkName or request.networkId}

**Network Configuration:**
- LAN IP: {device.get('lanIp', 'N/A')}
- WAN IP: {device.get('wan1Ip', 'N/A')}
- Firmware: {device.get('firmware', 'N/A')}

**Performance Metrics (Last 24 Hours):**
{health_info}
{incidents_section}{connections_section}
"""

        # Add device-type specific analysis guidance
        if device_category == 'security_appliance':
            prompt += """
**Analysis Focus for Security Appliance:**
Analyze WAN connectivity, uplink health, throughput capacity, and security posture.

Provide:
1. **WAN Health**: Assess uplink status, loss/latency (healthy: <1% loss, <50ms latency). Flag any degradation.
2. **Security Posture**: Based on model capabilities (MX68 supports IDS/IPS, content filtering, AMP).
3. **Capacity Check**: Is this MX model appropriate for the connected device count?
4. **Action Items**: 2-3 specific recommendations (firmware, config optimizations, monitoring alerts).
"""
        elif device_category == 'wireless_ap':
            prompt += """
**Analysis Focus for Wireless AP:**
Analyze RF health, client capacity, channel utilization, and coverage.

Provide:
1. **RF Health**: Assess signal quality, interference, channel utilization.
2. **Client Load**: Is the AP handling appropriate client counts for its model?
3. **Coverage**: Any indicators of coverage gaps or overlap issues?
4. **Action Items**: 2-3 specific recommendations (channel optimization, power adjustment, client steering).
"""
        elif device_category == 'switch':
            prompt += """
**Analysis Focus for Network Switch:**
Analyze port utilization, PoE budget, STP health, and trunk configurations.

Provide:
1. **Port Health**: Assess utilization, error rates, connected devices.
2. **PoE Status**: Power budget usage if applicable.
3. **Network Role**: Is this switch appropriately positioned (access/distribution/core)?
4. **Action Items**: 2-3 specific recommendations (VLAN optimization, port security, monitoring).
"""
        else:
            prompt += """
Provide:
1. **Health Assessment**: Current operational status and any concerns.
2. **Performance Analysis**: Key metrics interpretation.
3. **Action Items**: 2-3 specific, actionable recommendations.
"""

        prompt += """
Be specific and technical. Reference actual values from the data provided.
Use markdown formatting. Keep response concise but actionable (150-250 words).
"""

        # Check if AI is configured
        ai_config = await get_configured_ai_provider()
        if not ai_config:
            logger.warning("No AI provider configured for device analysis")
            raise HTTPException(status_code=503, detail="AI service not configured. Please configure an AI provider in Admin > System Config.")

        logger.info(f"[Device Analysis] Generating analysis for {device.get('name')} ({device.get('model')}) using {ai_config.get('model', 'unknown')}")

        # Generate the analysis using multi-provider AI (async, works with database config)
        result = await generate_text(prompt, max_tokens=800)

        if not result:
            raise HTTPException(status_code=503, detail="AI provider returned no response")

        analysis_text = result.get("text", "")
        model_used = result.get("model", ai_config.get("model", "unknown"))

        logger.info(f"[Device Analysis] Successfully generated analysis ({len(analysis_text)} chars)")

        return AnalysisResponse(
            analysis=analysis_text,
            model_used=model_used
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI device analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")


@router.post("/api/ai/analyze-performance", response_model=AnalysisResponse)
async def analyze_performance(
    request: PerformanceAnalysisRequest,
    user: User = Depends(require_viewer)
):
    """
    Generate AI-powered analysis for network performance metrics.
    Identifies trends, anomalies, and provides optimization recommendations.
    """
    perf_data = request.performance_data

    # Extract stats from performance data
    stats = perf_data.get('stats', {})
    data_points = perf_data.get('dataPoints', [])

    prompt = f"""You are a network performance analyst AI. Analyze the following network performance data
and provide insights about trends, potential issues, and optimization recommendations.

**Network:** {request.networkName or request.networkId}
**Time Range:** {request.timeRange}

**Performance Summary:**
- Average Latency: {stats.get('avgLatency', 'N/A')} ms
- Max Latency: {stats.get('maxLatency', 'N/A')} ms
- Average Packet Loss: {stats.get('avgLoss', 'N/A')}%
- Max Packet Loss: {stats.get('maxLoss', 'N/A')}%
- Data Points: {len(data_points)}

**Traffic Analysis:**
{format_traffic_data(perf_data.get('trafficAnalysis', []))}

Please provide:
1. **Performance Overview** - Overall network health assessment (2-3 sentences)
2. **Trend Analysis** - Notable patterns or anomalies (2-3 sentences)
3. **Optimization Recommendations** - 2-3 specific actions to improve performance

Keep the response concise and actionable. Use markdown formatting.
"""

    try:
        # Check if AI is configured
        ai_config = await get_configured_ai_provider()
        if not ai_config:
            logger.warning("No AI provider configured for performance analysis")
            raise HTTPException(status_code=503, detail="AI service not configured. Please configure an AI provider in Admin > System Config.")

        # Generate the analysis using multi-provider AI (async, works with database config)
        result = await generate_text(prompt, max_tokens=500)

        if not result:
            raise HTTPException(status_code=503, detail="AI provider returned no response")

        analysis_text = result.get("text", "")
        model_used = result.get("model", ai_config.get("model", "unknown"))

        return AnalysisResponse(
            analysis=analysis_text,
            model_used=model_used
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI performance analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")


# ============================================================================
# Helper Functions
# ============================================================================

def format_health_data(health_data: Dict[str, Any]) -> str:
    """Format health data for the AI prompt."""
    if not health_data or not isinstance(health_data, dict):
        return "No health data available."

    lines = []

    # Loss and latency
    if 'lossAndLatency' in health_data:
        loss_latency = health_data['lossAndLatency']
        # Handle both dict format and list format
        if isinstance(loss_latency, dict):
            ts = loss_latency.get('timeSeries', [])
        elif isinstance(loss_latency, list):
            ts = loss_latency  # It's already the time series array
        else:
            ts = []
        if ts and isinstance(ts, list):
            latencies = [d.get('latencyMs', 0) for d in ts if isinstance(d, dict) and d.get('latencyMs')]
            losses = [d.get('lossPercent', 0) for d in ts if isinstance(d, dict) and d.get('lossPercent') is not None]

            if latencies:
                avg_lat = sum(latencies) / len(latencies)
                max_lat = max(latencies)
                min_lat = min(latencies)
                # Calculate health status
                lat_status = "HEALTHY" if avg_lat < 50 else "ELEVATED" if avg_lat < 100 else "HIGH"
                lines.append(f"- Latency: avg={avg_lat:.1f}ms, min={min_lat:.1f}ms, max={max_lat:.1f}ms [{lat_status}]")

            if losses:
                avg_loss = sum(losses) / len(losses)
                max_loss = max(losses)
                # Calculate health status
                loss_status = "HEALTHY" if avg_loss < 0.5 else "ELEVATED" if avg_loss < 2 else "HIGH"
                lines.append(f"- Packet Loss: avg={avg_loss:.2f}%, max={max_loss:.2f}% [{loss_status}]")

            lines.append(f"- Data Points: {len(ts)} samples over 24h")

    # Uplink info
    if 'uplink' in health_data:
        uplink = health_data['uplink']
        if isinstance(uplink, dict):
            uplink_interface = uplink.get('interface', 'N/A')
            uplink_status = uplink.get('status', 'N/A')
            lines.append(f"- Uplink: {uplink_interface} ({uplink_status})")
            if uplink.get('publicIp'):
                lines.append(f"- Public IP: {uplink.get('publicIp')}")
            if uplink.get('gateway'):
                lines.append(f"- Gateway: {uplink.get('gateway')}")
            if uplink.get('primaryDns'):
                lines.append(f"- DNS: {uplink.get('primaryDns')}")

    # Device status if available
    if 'status' in health_data:
        lines.append(f"- Device Status: {health_data['status']}")

    # Clients if available
    if 'clients' in health_data:
        clients = health_data['clients']
        if isinstance(clients, int):
            lines.append(f"- Connected Clients: {clients}")
        elif isinstance(clients, dict):
            total = clients.get('total', 0)
            lines.append(f"- Connected Clients: {total}")

    # Utilization if available
    if 'utilization' in health_data:
        util = health_data['utilization']
        if isinstance(util, dict):
            cpu = util.get('cpu', util.get('average'))
            if cpu is not None:
                lines.append(f"- CPU Utilization: {cpu}%")

    return '\n'.join(lines) if lines else "No detailed health metrics available."


def format_traffic_data(traffic: List[Dict[str, Any]]) -> str:
    """Format traffic analysis data for the AI prompt."""
    if not traffic:
        return "No traffic data available."

    # Get top 5 applications by traffic volume
    sorted_traffic = sorted(
        traffic,
        key=lambda x: (x.get('sent', 0) or 0) + (x.get('recv', 0) or 0),
        reverse=True
    )[:5]

    lines = []
    for item in sorted_traffic:
        app = item.get('application', 'Unknown')
        sent = item.get('sent', 0) or 0
        recv = item.get('recv', 0) or 0
        total_mb = (sent + recv) / 1024 / 1024
        lines.append(f"- {app}: {total_mb:.2f} MB")

    return '\n'.join(lines) if lines else "No traffic breakdown available."


def generate_fallback_device_analysis(device: Dict[str, Any]) -> str:
    """Generate a basic analysis when AI is unavailable."""
    status = device.get('status', 'unknown')
    device_type = device.get('type', 'Unknown')
    name = device.get('name', 'This device')
    model = device.get('model', 'Unknown')

    lines = [
        f"**Status Assessment**",
        f"{name} ({model}) is a {device_type} device currently in **{status}** state.",
    ]

    if status == 'online':
        lines.append("The device appears to be functioning normally.")
    elif status == 'offline':
        lines.append("⚠️ The device is offline and requires immediate attention.")
    else:
        lines.append("⚠️ The device has alerts that should be investigated.")

    # Performance section
    health = device.get('healthData', {})
    if health.get('lossAndLatency', {}).get('timeSeries'):
        ts = health['lossAndLatency']['timeSeries']
        latencies = [d.get('latencyMs', 0) for d in ts if d.get('latencyMs')]
        losses = [d.get('lossPercent', 0) for d in ts if d.get('lossPercent') is not None]

        lines.append("\n**Performance Analysis**")
        if latencies:
            avg_lat = sum(latencies) / len(latencies)
            lines.append(f"Average latency is {avg_lat:.1f}ms, which is {'acceptable' if avg_lat < 100 else 'elevated'}.")
        if losses:
            avg_loss = sum(losses) / len(losses)
            lines.append(f"Packet loss averaging {avg_loss:.2f}% is {'within normal range' if avg_loss < 1 else 'higher than expected'}.")

    # Recommendations
    lines.append("\n**Recommendations**")
    if status != 'online':
        lines.append("• Check physical connectivity and power supply")
        lines.append("• Verify network configuration and upstream connectivity")
    else:
        lines.append("• Continue monitoring - no immediate action required")
        lines.append("• Consider scheduling firmware updates if available")

    return '\n'.join(lines)


def generate_fallback_performance_analysis(stats: Dict[str, Any], time_range: str) -> str:
    """Generate a basic performance analysis when AI is unavailable."""
    avg_latency = stats.get('avgLatency', 'N/A')
    avg_loss = stats.get('avgLoss', 'N/A')

    lines = [
        f"**Performance Overview** ({time_range})",
    ]

    # Assess latency
    if avg_latency != 'N/A':
        try:
            lat = float(avg_latency)
            if lat < 50:
                lines.append(f"Network latency averaging {lat:.1f}ms is excellent.")
            elif lat < 100:
                lines.append(f"Network latency averaging {lat:.1f}ms is acceptable.")
            else:
                lines.append(f"⚠️ Network latency averaging {lat:.1f}ms is elevated and may affect user experience.")
        except (ValueError, TypeError):
            pass  # Skip if latency can't be converted to float

    # Assess packet loss
    if avg_loss != 'N/A':
        try:
            loss = float(avg_loss)
            if loss < 0.5:
                lines.append(f"Packet loss at {loss:.2f}% is within normal parameters.")
            elif loss < 2:
                lines.append(f"⚠️ Packet loss at {loss:.2f}% is slightly elevated - monitor for trends.")
            else:
                lines.append(f"⚠️ Packet loss at {loss:.2f}% is high and should be investigated.")
        except (ValueError, TypeError):
            pass  # Skip if loss can't be converted to float

    lines.append("\n**Recommendations**")
    lines.append("• Review traffic patterns during peak hours")
    lines.append("• Monitor bandwidth utilization across uplinks")
    lines.append("• Consider QoS policies for latency-sensitive applications")

    return '\n'.join(lines)
