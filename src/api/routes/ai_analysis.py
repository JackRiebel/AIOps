"""AI Analysis endpoints for network visualization insights."""

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from src.api.dependencies import require_viewer
from src.services.ai_service import get_ai_assistant
from src.services.cost_logger import get_cost_logger
from src.models.user import User
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class DeviceAnalysisRequest(BaseModel):
    device: Dict[str, Any]
    organization: str
    networkId: str


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
    device = request.device

    # Build the prompt for device analysis
    prompt = f"""You are a network engineer AI assistant analyzing a Meraki network device.
Provide a concise but thorough analysis of this device's status, health, and recommendations.

**Device Information:**
- Name: {device.get('name', 'Unknown')}
- Model: {device.get('model', 'Unknown')}
- Type: {device.get('type', 'Unknown')}
- Status: {device.get('status', 'Unknown')}
- Serial: {device.get('serial', 'Unknown')}
- LAN IP: {device.get('lanIp', 'N/A')}
- WAN IP: {device.get('wan1Ip', 'N/A')}

**Health Data (Last 24 Hours):**
{format_health_data(device.get('healthData', {}))}

Please provide:
1. **Status Assessment** - Current device health (2-3 sentences)
2. **Performance Analysis** - Key metrics interpretation (2-3 sentences)
3. **Recommendations** - 2-3 actionable items

Keep the response concise and actionable. Use markdown formatting with **bold** headers.
"""

    try:
        # Get AI assistant using user's preferred model if available
        user_model = getattr(user, 'ai_model', None)
        assistant = get_ai_assistant(model=user_model)

        if not assistant:
            logger.warning("No AI assistant available, using fallback")
            return AnalysisResponse(
                analysis=generate_fallback_device_analysis(device),
                model_used="fallback"
            )

        # Generate the analysis with usage tracking
        result = assistant.generate_response_with_usage(prompt, max_tokens=500)

        # Log cost to database
        if result.get("input_tokens", 0) > 0 or result.get("output_tokens", 0) > 0:
            try:
                cost_logger = get_cost_logger()
                await cost_logger.log_analysis(
                    analysis_type="device",
                    model=result.get("model", assistant.model),
                    input_tokens=result.get("input_tokens", 0),
                    output_tokens=result.get("output_tokens", 0),
                    user_id=user.id if user else None,
                    target_id=device.get("serial"),
                    target_type="device",
                )
                logger.info(f"[AI Analysis] Logged device analysis cost: {result.get('input_tokens', 0)} input, {result.get('output_tokens', 0)} output tokens")
            except Exception as cost_error:
                logger.error(f"[AI Analysis] Failed to log device analysis cost: {cost_error}")

        return AnalysisResponse(
            analysis=result.get("text", ""),
            model_used=result.get("model", assistant.model)
        )

    except Exception as e:
        logger.error(f"AI analysis failed: {e}")
        # Return fallback analysis on error
        return AnalysisResponse(
            analysis=generate_fallback_device_analysis(device),
            model_used="fallback"
        )


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
        # Get AI assistant using user's preferred model if available
        user_model = getattr(user, 'ai_model', None)
        assistant = get_ai_assistant(model=user_model)

        if not assistant:
            logger.warning("No AI assistant available, using fallback")
            return AnalysisResponse(
                analysis=generate_fallback_performance_analysis(stats, request.timeRange),
                model_used="fallback"
            )

        # Generate the analysis with usage tracking
        result = assistant.generate_response_with_usage(prompt, max_tokens=500)

        # Log cost to database
        if result.get("input_tokens", 0) > 0 or result.get("output_tokens", 0) > 0:
            try:
                cost_logger = get_cost_logger()
                await cost_logger.log_analysis(
                    analysis_type="performance",
                    model=result.get("model", assistant.model),
                    input_tokens=result.get("input_tokens", 0),
                    output_tokens=result.get("output_tokens", 0),
                    user_id=user.id if user else None,
                    target_id=request.networkId,
                    target_type="network",
                )
                logger.info(f"[AI Analysis] Logged performance analysis cost: {result.get('input_tokens', 0)} input, {result.get('output_tokens', 0)} output tokens")
            except Exception as cost_error:
                logger.error(f"[AI Analysis] Failed to log performance analysis cost: {cost_error}")

        return AnalysisResponse(
            analysis=result.get("text", ""),
            model_used=result.get("model", assistant.model)
        )

    except Exception as e:
        logger.error(f"AI performance analysis failed: {e}")
        return AnalysisResponse(
            analysis=generate_fallback_performance_analysis(stats, request.timeRange),
            model_used="fallback"
        )


# ============================================================================
# Helper Functions
# ============================================================================

def format_health_data(health_data: Dict[str, Any]) -> str:
    """Format health data for the AI prompt."""
    if not health_data:
        return "No health data available."

    lines = []

    # Loss and latency
    if 'lossAndLatency' in health_data:
        ts = health_data['lossAndLatency'].get('timeSeries', [])
        if ts:
            latencies = [d.get('latencyMs', 0) for d in ts if d.get('latencyMs')]
            losses = [d.get('lossPercent', 0) for d in ts if d.get('lossPercent') is not None]

            if latencies:
                avg_lat = sum(latencies) / len(latencies)
                max_lat = max(latencies)
                lines.append(f"- Average Latency: {avg_lat:.1f}ms (Max: {max_lat:.1f}ms)")

            if losses:
                avg_loss = sum(losses) / len(losses)
                max_loss = max(losses)
                lines.append(f"- Average Packet Loss: {avg_loss:.2f}% (Max: {max_loss:.2f}%)")

    # Uplink info
    if 'uplink' in health_data:
        uplink = health_data['uplink']
        lines.append(f"- Uplink Interface: {uplink.get('interface', 'N/A')}")
        lines.append(f"- Uplink Status: {uplink.get('status', 'N/A')}")
        if uplink.get('publicIp'):
            lines.append(f"- Public IP: {uplink.get('publicIp')}")

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
        except:
            pass

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
        except:
            pass

    lines.append("\n**Recommendations**")
    lines.append("• Review traffic patterns during peak hours")
    lines.append("• Monitor bandwidth utilization across uplinks")
    lines.append("• Consider QoS policies for latency-sensitive applications")

    return '\n'.join(lines)
