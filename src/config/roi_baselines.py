"""
ROI Baseline Configuration for AI Session Tracking

This module defines baseline time estimates for various operations that users
would perform manually without AI assistance. These baselines are used to
calculate the ROI (Return on Investment) of AI-assisted sessions.

Baselines are derived from industry studies on network operations:
- NOC performance benchmarks (INOC, TechTarget, Gartner)
- IT operations time-motion analysis (OpsDog, ServiceNow)
- Enterprise MTTR statistics (Atlassian, Splunk, PagerDuty)
- Network engineer salary data (PayScale, Glassdoor, Salary.com)

Key research findings incorporated:
- P1 incident MTTR target: Under 4 hours (NOC industry standard)
- Tier 1 resolution rate: 60-80% at first contact
- Help desk handle time: 4.45-8.7 minutes for simple tasks
- Complex troubleshooting: Can take hours to days (33%+ of IT pros)
- AI automation saves 10-50% of manual task time (ServiceNow 2024)
- Network downtime costs: $1,850-$25,402 per minute (enterprise)

Last updated: January 2025
"""

from typing import Dict, Tuple, NamedTuple
from enum import Enum


class ActionCategory(str, Enum):
    """Categories of actions for grouping and analysis."""
    DEVICE_OPERATIONS = "device_operations"
    LOG_ANALYSIS = "log_analysis"
    TROUBLESHOOTING = "troubleshooting"
    CONFIGURATION = "configuration"
    DOCUMENTATION = "documentation"
    MONITORING = "monitoring"
    INCIDENT_RESPONSE = "incident_response"


class BaselineEstimate(NamedTuple):
    """Represents a time estimate for a manual operation."""
    manual_minutes: float  # Estimated time to do manually
    confidence: float  # 0.0 to 1.0 - how confident we are in this estimate
    category: ActionCategory
    description: str


# =============================================================================
# BASELINE TIME ESTIMATES
# =============================================================================
# Format: action_type -> BaselineEstimate(minutes, confidence, category, description)
#
# Confidence levels:
#   0.9+  : Well-documented, repeatable tasks with consistent timing
#   0.75-0.89: Common tasks with some variation based on complexity
#   0.5-0.74: Tasks with high variability, rough estimates
#   <0.5  : Highly variable, use with caution

ROI_BASELINES: Dict[str, BaselineEstimate] = {
    # =========================================================================
    # DEVICE OPERATIONS (Tier 1 - Simple lookups)
    # Based on: Help desk handle time 4.45-8.7 minutes for simple tasks
    # =========================================================================
    "device_lookup": BaselineEstimate(
        manual_minutes=5.0,
        confidence=0.90,
        category=ActionCategory.DEVICE_OPERATIONS,
        description="Finding device info in Meraki dashboard manually (navigate, search, review)"
    ),
    "device_status_check": BaselineEstimate(
        manual_minutes=4.0,
        confidence=0.90,
        category=ActionCategory.DEVICE_OPERATIONS,
        description="Checking device online/offline status across multiple views"
    ),
    "client_lookup": BaselineEstimate(
        manual_minutes=8.0,
        confidence=0.85,
        category=ActionCategory.DEVICE_OPERATIONS,
        description="Finding client by MAC/IP, reviewing connection history and details"
    ),
    "port_status_check": BaselineEstimate(
        manual_minutes=6.0,
        confidence=0.85,
        category=ActionCategory.DEVICE_OPERATIONS,
        description="Checking switch port status, VLAN, PoE, and connected device"
    ),
    "uplink_status_check": BaselineEstimate(
        manual_minutes=8.0,
        confidence=0.80,
        category=ActionCategory.DEVICE_OPERATIONS,
        description="Reviewing WAN uplink status, failover state, and traffic utilization"
    ),

    # =========================================================================
    # LOG ANALYSIS (Tier 2-3 - Requires expertise and time)
    # Based on: Complex troubleshooting takes hours (33%+ IT pros), log analysis
    # is iterative - search, filter, interpret, pivot, repeat
    # =========================================================================
    "log_analysis": BaselineEstimate(
        manual_minutes=45.0,
        confidence=0.75,
        category=ActionCategory.LOG_ANALYSIS,
        description="Analyzing logs in Splunk - searching, filtering, pivoting, interpreting patterns"
    ),
    "log_search_simple": BaselineEstimate(
        manual_minutes=12.0,
        confidence=0.85,
        category=ActionCategory.LOG_ANALYSIS,
        description="Simple log search with known filters and quick review"
    ),
    "log_search_complex": BaselineEstimate(
        manual_minutes=60.0,
        confidence=0.65,
        category=ActionCategory.LOG_ANALYSIS,
        description="Complex log correlation across multiple sources, time ranges, and fields"
    ),
    "event_correlation": BaselineEstimate(
        manual_minutes=90.0,
        confidence=0.60,
        category=ActionCategory.LOG_ANALYSIS,
        description="Correlating events across systems to find root cause (multi-system analysis)"
    ),
    "security_event_analysis": BaselineEstimate(
        manual_minutes=60.0,
        confidence=0.70,
        category=ActionCategory.LOG_ANALYSIS,
        description="Analyzing security events, threat indicators, and attack patterns"
    ),

    # =========================================================================
    # TROUBLESHOOTING (Tier 2-3 - High variability)
    # Based on: Industry research shows troubleshooting ranges from minutes to days.
    # Conservative estimate uses median of resolved-within-hours cases.
    # =========================================================================
    "troubleshooting_research": BaselineEstimate(
        manual_minutes=45.0,
        confidence=0.65,
        category=ActionCategory.TROUBLESHOOTING,
        description="General troubleshooting research - KB search, documentation review, forums"
    ),
    "connectivity_troubleshooting": BaselineEstimate(
        manual_minutes=40.0,
        confidence=0.70,
        category=ActionCategory.TROUBLESHOOTING,
        description="Diagnosing connectivity issues (OSI layer analysis, packet tests, config review)"
    ),
    "wireless_troubleshooting": BaselineEstimate(
        manual_minutes=60.0,
        confidence=0.65,
        category=ActionCategory.TROUBLESHOOTING,
        description="Diagnosing wireless issues (RF analysis, client roaming, interference, config)"
    ),
    "performance_diagnosis": BaselineEstimate(
        manual_minutes=75.0,
        confidence=0.60,
        category=ActionCategory.TROUBLESHOOTING,
        description="Diagnosing performance/latency issues (multi-hop analysis, baseline comparison)"
    ),
    "path_trace": BaselineEstimate(
        manual_minutes=15.0,
        confidence=0.80,
        category=ActionCategory.TROUBLESHOOTING,
        description="Tracing network path between devices (traceroute, hop analysis)"
    ),

    # =========================================================================
    # INCIDENT RESPONSE (Tier 1-3 - Time-critical with high variability)
    # Based on: P1 MTTR target under 4 hours (240 min), Tier 1 resolution 60-80%,
    # Time to action under 15 minutes for initial response
    # =========================================================================
    "incident_triage": BaselineEstimate(
        manual_minutes=20.0,
        confidence=0.80,
        category=ActionCategory.INCIDENT_RESPONSE,
        description="Initial incident assessment - gather info, assess impact, set priority"
    ),
    "incident_investigation": BaselineEstimate(
        manual_minutes=90.0,
        confidence=0.65,
        category=ActionCategory.INCIDENT_RESPONSE,
        description="Deep investigation - root cause analysis, log correlation, testing"
    ),
    "incident_resolution": BaselineEstimate(
        manual_minutes=180.0,
        confidence=0.55,
        category=ActionCategory.INCIDENT_RESPONSE,
        description="Full incident resolution cycle - diagnosis, fix, verification, documentation"
    ),
    "alert_acknowledgment": BaselineEstimate(
        manual_minutes=5.0,
        confidence=0.90,
        category=ActionCategory.INCIDENT_RESPONSE,
        description="Reviewing alert context, acknowledging, and initial categorization"
    ),

    # =========================================================================
    # CONFIGURATION (Tier 1-2 - Procedural with verification)
    # Based on: Config tasks require review, change, and verification steps
    # =========================================================================
    "config_review": BaselineEstimate(
        manual_minutes=15.0,
        confidence=0.80,
        category=ActionCategory.CONFIGURATION,
        description="Reviewing configuration across relevant settings and dependencies"
    ),
    "config_comparison": BaselineEstimate(
        manual_minutes=30.0,
        confidence=0.75,
        category=ActionCategory.CONFIGURATION,
        description="Comparing configs (export, diff analysis, identify changes, document)"
    ),
    "config_change": BaselineEstimate(
        manual_minutes=25.0,
        confidence=0.75,
        category=ActionCategory.CONFIGURATION,
        description="Making configuration changes (plan, implement, verify, document)"
    ),
    "ssid_configuration": BaselineEstimate(
        manual_minutes=20.0,
        confidence=0.80,
        category=ActionCategory.CONFIGURATION,
        description="Configuring SSID settings (security, VLAN, bandwidth, access policy)"
    ),
    "firewall_rule_review": BaselineEstimate(
        manual_minutes=25.0,
        confidence=0.75,
        category=ActionCategory.CONFIGURATION,
        description="Reviewing firewall rules, understanding flow, checking for conflicts"
    ),

    # =========================================================================
    # DOCUMENTATION & RESEARCH (Tier 1 - Information retrieval)
    # Based on: Knowledge search typically 8-15 minutes including context switching
    # =========================================================================
    "api_documentation": BaselineEstimate(
        manual_minutes=10.0,
        confidence=0.85,
        category=ActionCategory.DOCUMENTATION,
        description="Looking up API documentation, finding endpoints, understanding parameters"
    ),
    "knowledge_search": BaselineEstimate(
        manual_minutes=15.0,
        confidence=0.75,
        category=ActionCategory.DOCUMENTATION,
        description="Searching knowledge base, reading articles, finding relevant solutions"
    ),
    "topology_trace": BaselineEstimate(
        manual_minutes=12.0,
        confidence=0.80,
        category=ActionCategory.DOCUMENTATION,
        description="Tracing network topology, understanding connections and dependencies"
    ),

    # =========================================================================
    # MONITORING (Tier 1-2 - Observation and analysis)
    # Based on: Monitoring requires context gathering and interpretation
    # =========================================================================
    "health_check": BaselineEstimate(
        manual_minutes=10.0,
        confidence=0.85,
        category=ActionCategory.MONITORING,
        description="Health check across dashboard views, alerts, and key metrics"
    ),
    "bandwidth_analysis": BaselineEstimate(
        manual_minutes=20.0,
        confidence=0.75,
        category=ActionCategory.MONITORING,
        description="Analyzing bandwidth usage patterns, identifying top consumers"
    ),
    "traffic_analysis": BaselineEstimate(
        manual_minutes=30.0,
        confidence=0.70,
        category=ActionCategory.MONITORING,
        description="Analyzing traffic patterns, application usage, top talkers, anomalies"
    ),
    "rf_analysis": BaselineEstimate(
        manual_minutes=25.0,
        confidence=0.70,
        category=ActionCategory.MONITORING,
        description="Analyzing RF environment, channel utilization, interference sources"
    ),
}


# =============================================================================
# CONFIGURATION CONSTANTS
# =============================================================================

# Default hourly rate for manual labor cost calculation (USD)
# Based on industry research (PayScale, Glassdoor, Salary.com 2025):
# - Network Engineer base salary: $93k-$123k/year ($45-$60/hr)
# - Fully-loaded cost (benefits, overhead, tools): ~1.3-1.5x base
# - Using $85/hr as realistic fully-loaded cost for mid-level engineer
# This can be overridden per organization in system settings
DEFAULT_HOURLY_RATE = 85.0

# Minimum ROI threshold for "good" session efficiency (percentage)
# AI automation typically saves 10-50% of manual task time (ServiceNow 2024)
# A 500% ROI means manual cost was 5x the AI cost
GOOD_ROI_THRESHOLD = 500  # 5x return

# Warning ROI threshold - sessions below this may need optimization
# Below 100% means AI cost exceeded manual cost equivalent
WARNING_ROI_THRESHOLD = 100  # 1x return (break-even)

# Session type definitions for categorization
SESSION_TYPES = {
    "incident_response": {
        "display_name": "Incident Response",
        "description": "Active incident investigation and resolution",
        "typical_actions": ["incident_triage", "log_analysis", "troubleshooting_research"],
        "expected_roi_multiplier": 1.5,  # Higher value due to time-critical nature
    },
    "investigation": {
        "display_name": "Investigation",
        "description": "Proactive investigation or research",
        "typical_actions": ["log_analysis", "device_lookup", "knowledge_search"],
        "expected_roi_multiplier": 1.0,
    },
    "configuration": {
        "display_name": "Configuration",
        "description": "Configuration changes and validation",
        "typical_actions": ["config_review", "config_comparison", "config_change"],
        "expected_roi_multiplier": 1.0,
    },
    "optimization": {
        "display_name": "Optimization",
        "description": "Performance tuning and optimization",
        "typical_actions": ["performance_diagnosis", "bandwidth_analysis", "rf_analysis"],
        "expected_roi_multiplier": 0.8,  # Lower immediate ROI but long-term value
    },
    "monitoring": {
        "display_name": "Monitoring",
        "description": "Regular monitoring and health checks",
        "typical_actions": ["health_check", "device_status_check", "uplink_status_check"],
        "expected_roi_multiplier": 1.0,
    },
}


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_baseline(action_type: str) -> BaselineEstimate:
    """Get baseline estimate for an action type.

    Returns the known baseline if it exists, otherwise returns a minimal
    fallback with low confidence. The fallback uses 0 minutes — unknown
    actions should not inflate ROI estimates.
    """
    return ROI_BASELINES.get(action_type, BaselineEstimate(
        manual_minutes=0.0,
        confidence=0.0,
        category=ActionCategory.TROUBLESHOOTING,
        description=f"Unknown action type: {action_type} (no baseline — excluded from ROI)"
    ))


def estimate_time_saved(action_type: str, ai_duration_seconds: float) -> Tuple[float, float]:
    """
    Calculate estimated time saved for an action.

    Args:
        action_type: The type of action performed
        ai_duration_seconds: How long the AI took to complete

    Returns:
        Tuple of (time_saved_minutes, confidence)
    """
    baseline = get_baseline(action_type)
    ai_minutes = ai_duration_seconds / 60.0
    time_saved = max(0, baseline.manual_minutes - ai_minutes)
    return time_saved, baseline.confidence


def calculate_manual_cost(time_minutes: float, hourly_rate: float = None) -> float:
    """Calculate the cost of manual labor for given time."""
    rate = hourly_rate or DEFAULT_HOURLY_RATE
    return (time_minutes / 60.0) * rate


def get_all_baselines_by_category() -> Dict[ActionCategory, list]:
    """Group all baselines by their category for display."""
    by_category = {}
    for action_type, baseline in ROI_BASELINES.items():
        if baseline.category not in by_category:
            by_category[baseline.category] = []
        by_category[baseline.category].append({
            "action_type": action_type,
            **baseline._asdict()
        })
    return by_category
