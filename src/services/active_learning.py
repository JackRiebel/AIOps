"""Active learning pipeline for knowledge gap identification.

Analyzes query patterns and outcomes to identify:
- Content gaps (topics with no good results)
- Frequently asked topics that need better coverage
- Documents that should be prioritized for ingestion

This creates a feedback loop that continuously improves
the knowledge base based on actual usage patterns.

Usage:
    pipeline = ActiveLearningPipeline()
    gaps = await pipeline.analyze_failed_queries(session, days=7)
    suggestions = await pipeline.suggest_documents(gaps)
"""

import logging
import re
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import defaultdict
from enum import Enum

logger = logging.getLogger(__name__)


class GapSeverity(Enum):
    """Severity level of a content gap."""
    CRITICAL = "critical"    # Many queries, very poor results
    HIGH = "high"            # Frequent queries, no good results
    MEDIUM = "medium"        # Some queries, could be improved
    LOW = "low"              # Occasional queries, minor gap


class GapType(Enum):
    """Type of content gap."""
    MISSING_TOPIC = "missing_topic"       # Topic not covered at all
    OUTDATED = "outdated"                 # Content exists but outdated
    INSUFFICIENT = "insufficient"         # Topic covered but not deeply
    FRAGMENTED = "fragmented"             # Info scattered, needs consolidation


@dataclass
class ContentGap:
    """A identified gap in the knowledge base."""
    topic: str
    description: str
    gap_type: GapType
    severity: GapSeverity
    query_count: int
    avg_relevance: float
    sample_queries: List[str]
    related_products: List[str] = field(default_factory=list)
    suggested_keywords: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "topic": self.topic,
            "description": self.description,
            "gap_type": self.gap_type.value,
            "severity": self.severity.value,
            "query_count": self.query_count,
            "avg_relevance": round(self.avg_relevance, 3),
            "sample_queries": self.sample_queries[:5],
            "related_products": self.related_products,
            "suggested_keywords": self.suggested_keywords,
        }


@dataclass
class DocumentSuggestion:
    """A suggested document to fill a content gap."""
    title: str
    url: Optional[str]
    source: str  # cisco_docs, community, etc.
    relevance_to_gap: float
    gap_topics: List[str]
    estimated_impact: float  # How many queries this would help
    priority_score: float
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "url": self.url,
            "source": self.source,
            "relevance_to_gap": round(self.relevance_to_gap, 3),
            "gap_topics": self.gap_topics,
            "estimated_impact": round(self.estimated_impact, 2),
            "priority_score": round(self.priority_score, 3),
        }


@dataclass
class FailedQuery:
    """A query that had poor results."""
    query: str
    relevance_score: float
    result_count: int
    had_negative_feedback: bool
    grounding_score: Optional[float]
    timestamp: datetime
    classification: Optional[str] = None


@dataclass
class ActiveLearningReport:
    """Report from active learning analysis."""
    analysis_period_days: int
    total_queries_analyzed: int
    failed_query_count: int
    content_gaps: List[ContentGap]
    document_suggestions: List[DocumentSuggestion]
    top_missing_topics: List[str]
    recommendations: List[str]
    generated_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "analysis_period_days": self.analysis_period_days,
            "total_queries_analyzed": self.total_queries_analyzed,
            "failed_query_count": self.failed_query_count,
            "content_gaps": [g.to_dict() for g in self.content_gaps],
            "document_suggestions": [s.to_dict() for s in self.document_suggestions],
            "top_missing_topics": self.top_missing_topics,
            "recommendations": self.recommendations,
            "generated_at": self.generated_at.isoformat(),
        }


class ActiveLearningPipeline:
    """Identify knowledge gaps and prioritize content updates.

    Analyzes:
    - Queries with zero or few results
    - Queries with low relevance scores
    - Queries with negative feedback
    - Queries with low grounding scores

    Then clusters these into content gaps and suggests
    documents that would fill those gaps.
    """

    # Topic extraction patterns
    TOPIC_PATTERNS = {
        "products": [
            r'\b(Meraki|Catalyst|Nexus|ISR|ASR|ISE|DNA Center|Duo|Umbrella)\b',
            r'\b(MX|MS|MR|MV|MT|SM|Z\d)\b',  # Meraki product lines
        ],
        "features": [
            r'\b(VLAN|VPN|QoS|ACL|NAT|SD-WAN|SDWAN)\b',
            r'\b(OSPF|BGP|EIGRP|STP|LACP|LLDP)\b',
            r'\b(RADIUS|TACACS|802\.1[xX]|MAB)\b',
        ],
        "tasks": [
            r'\b(configure|setup|troubleshoot|debug|monitor|upgrade)\b',
            r'\b(enable|disable|create|delete|modify)\b',
        ],
    }

    # Thresholds for failed queries
    RELEVANCE_THRESHOLD = 0.5  # Below this = poor results
    RESULT_COUNT_THRESHOLD = 2  # Fewer than this = insufficient
    GROUNDING_THRESHOLD = 0.6  # Below this = potential hallucination

    def __init__(
        self,
        min_queries_for_gap: int = 3,
        cluster_similarity_threshold: float = 0.6,
    ):
        """Initialize the active learning pipeline.

        Args:
            min_queries_for_gap: Minimum failed queries to identify a gap.
            cluster_similarity_threshold: Similarity for clustering queries.
        """
        self.min_queries_for_gap = min_queries_for_gap
        self.cluster_similarity_threshold = cluster_similarity_threshold

    def _extract_topics(self, query: str) -> Dict[str, List[str]]:
        """Extract topics from a query."""
        topics: Dict[str, List[str]] = defaultdict(list)

        for category, patterns in self.TOPIC_PATTERNS.items():
            for pattern in patterns:
                matches = re.findall(pattern, query, re.IGNORECASE)
                topics[category].extend(matches)

        # Deduplicate
        return {k: list(set(v)) for k, v in topics.items() if v}

    def _extract_keywords(self, query: str) -> List[str]:
        """Extract meaningful keywords from query."""
        stop_words = {
            'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
            'could', 'should', 'may', 'might', 'must', 'can', 'to', 'of',
            'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
            'how', 'what', 'when', 'where', 'why', 'which', 'who',
            'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'its',
            'and', 'or', 'but', 'if', 'then', 'so', 'this', 'that',
        }

        words = re.findall(r'\b[a-zA-Z]{3,}\b', query.lower())
        return [w for w in words if w not in stop_words]

    def _normalize_query(self, query: str) -> str:
        """Normalize query for comparison."""
        # Lowercase, remove extra whitespace, strip punctuation
        normalized = query.lower().strip()
        normalized = re.sub(r'[^\w\s]', ' ', normalized)
        normalized = re.sub(r'\s+', ' ', normalized)
        return normalized

    def _query_similarity(self, q1: str, q2: str) -> float:
        """Calculate similarity between two queries."""
        kw1 = set(self._extract_keywords(q1))
        kw2 = set(self._extract_keywords(q2))

        if not kw1 or not kw2:
            return 0.0

        # Jaccard similarity
        intersection = len(kw1 & kw2)
        union = len(kw1 | kw2)

        return intersection / union if union > 0 else 0.0

    def _cluster_queries(
        self,
        queries: List[FailedQuery],
    ) -> List[List[FailedQuery]]:
        """Cluster similar failed queries together."""
        if not queries:
            return []

        # Simple greedy clustering
        clusters: List[List[FailedQuery]] = []
        assigned = set()

        for i, q1 in enumerate(queries):
            if i in assigned:
                continue

            cluster = [q1]
            assigned.add(i)

            for j, q2 in enumerate(queries[i+1:], start=i+1):
                if j in assigned:
                    continue

                similarity = self._query_similarity(q1.query, q2.query)
                if similarity >= self.cluster_similarity_threshold:
                    cluster.append(q2)
                    assigned.add(j)

            clusters.append(cluster)

        return clusters

    def _determine_gap_type(
        self,
        cluster: List[FailedQuery],
    ) -> GapType:
        """Determine the type of content gap from query cluster."""
        avg_results = sum(q.result_count for q in cluster) / len(cluster)
        avg_relevance = sum(q.relevance_score for q in cluster) / len(cluster)

        if avg_results < 1:
            return GapType.MISSING_TOPIC
        elif avg_relevance < 0.3:
            return GapType.INSUFFICIENT
        elif any(q.grounding_score and q.grounding_score < 0.5 for q in cluster):
            return GapType.FRAGMENTED
        else:
            return GapType.INSUFFICIENT

    def _determine_severity(
        self,
        cluster: List[FailedQuery],
    ) -> GapSeverity:
        """Determine severity based on frequency and quality."""
        count = len(cluster)
        avg_relevance = sum(q.relevance_score for q in cluster) / len(cluster)
        has_negative = any(q.had_negative_feedback for q in cluster)

        if count >= 10 and (avg_relevance < 0.3 or has_negative):
            return GapSeverity.CRITICAL
        elif count >= 5 or (count >= 3 and has_negative):
            return GapSeverity.HIGH
        elif count >= 3:
            return GapSeverity.MEDIUM
        else:
            return GapSeverity.LOW

    def _generate_topic_label(self, cluster: List[FailedQuery]) -> str:
        """Generate a topic label for a query cluster."""
        # Extract all keywords from cluster
        all_keywords = []
        for q in cluster:
            all_keywords.extend(self._extract_keywords(q.query))

        # Find most common keywords
        keyword_counts = defaultdict(int)
        for kw in all_keywords:
            keyword_counts[kw] += 1

        top_keywords = sorted(
            keyword_counts.items(),
            key=lambda x: x[1],
            reverse=True
        )[:3]

        if top_keywords:
            return " ".join(kw for kw, _ in top_keywords)
        else:
            # Fallback: use first query truncated
            return cluster[0].query[:50]

    async def analyze_failed_queries(
        self,
        query_logs: List[Dict[str, Any]],
        days: int = 7,
    ) -> List[ContentGap]:
        """Analyze query logs to identify content gaps.

        Args:
            query_logs: List of query log dictionaries from database.
            days: Analysis period (for filtering, if not pre-filtered).

        Returns:
            List of identified content gaps.
        """
        # Filter to failed queries
        failed_queries = []
        cutoff = datetime.utcnow() - timedelta(days=days)

        for log in query_logs:
            # Check if this is a failed query
            timestamp = log.get('created_at', datetime.utcnow())
            if isinstance(timestamp, str):
                timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))

            if timestamp < cutoff:
                continue

            relevance = log.get('avg_relevance', 1.0)
            result_count = log.get('result_count', 10)
            grounding = log.get('grounding_score')
            feedback = log.get('feedback_negative', False)

            is_failed = (
                relevance < self.RELEVANCE_THRESHOLD or
                result_count < self.RESULT_COUNT_THRESHOLD or
                (grounding is not None and grounding < self.GROUNDING_THRESHOLD) or
                feedback
            )

            if is_failed:
                failed_queries.append(FailedQuery(
                    query=log.get('query', ''),
                    relevance_score=relevance,
                    result_count=result_count,
                    had_negative_feedback=feedback,
                    grounding_score=grounding,
                    timestamp=timestamp,
                    classification=log.get('classification'),
                ))

        logger.info(f"Found {len(failed_queries)} failed queries out of {len(query_logs)}")

        if not failed_queries:
            return []

        # Cluster similar failed queries
        clusters = self._cluster_queries(failed_queries)

        # Convert clusters to content gaps
        gaps = []
        for cluster in clusters:
            if len(cluster) < self.min_queries_for_gap:
                continue

            # Extract common topics
            all_topics: Dict[str, List[str]] = defaultdict(list)
            for q in cluster:
                topics = self._extract_topics(q.query)
                for category, items in topics.items():
                    all_topics[category].extend(items)

            # Get unique products
            products = list(set(all_topics.get('products', [])))

            gap = ContentGap(
                topic=self._generate_topic_label(cluster),
                description=f"Users frequently ask about this topic but receive poor results",
                gap_type=self._determine_gap_type(cluster),
                severity=self._determine_severity(cluster),
                query_count=len(cluster),
                avg_relevance=sum(q.relevance_score for q in cluster) / len(cluster),
                sample_queries=[q.query for q in cluster[:5]],
                related_products=products[:5],
                suggested_keywords=self._extract_keywords(cluster[0].query)[:10],
            )
            gaps.append(gap)

        # Sort by severity and count
        severity_order = {
            GapSeverity.CRITICAL: 0,
            GapSeverity.HIGH: 1,
            GapSeverity.MEDIUM: 2,
            GapSeverity.LOW: 3,
        }
        gaps.sort(key=lambda g: (severity_order[g.severity], -g.query_count))

        logger.info(f"Identified {len(gaps)} content gaps")
        return gaps

    async def suggest_documents(
        self,
        gaps: List[ContentGap],
        existing_docs: Optional[List[str]] = None,
    ) -> List[DocumentSuggestion]:
        """Suggest documents to fill identified gaps.

        Args:
            gaps: List of content gaps to address.
            existing_docs: Titles of already-ingested documents.

        Returns:
            Prioritized list of document suggestions.
        """
        suggestions = []
        existing = set(d.lower() for d in (existing_docs or []))

        for gap in gaps:
            # Generate document suggestions based on gap topic
            # In production, this would search external documentation sources

            # Cisco documentation patterns
            doc_patterns = [
                f"{gap.topic} Configuration Guide",
                f"{gap.topic} Administration Guide",
                f"{gap.topic} Troubleshooting Guide",
                f"{gap.topic} Best Practices",
                f"{gap.topic} Quick Start Guide",
            ]

            for product in gap.related_products[:2]:
                doc_patterns.extend([
                    f"{product} {gap.topic} Guide",
                    f"{product} CLI Reference - {gap.topic}",
                ])

            for title in doc_patterns:
                # Skip if already ingested
                if title.lower() in existing:
                    continue

                # Calculate priority based on gap severity and query count
                severity_weight = {
                    GapSeverity.CRITICAL: 1.0,
                    GapSeverity.HIGH: 0.8,
                    GapSeverity.MEDIUM: 0.5,
                    GapSeverity.LOW: 0.3,
                }[gap.severity]

                impact = min(gap.query_count / 10, 1.0)  # Normalize to 0-1
                priority = severity_weight * 0.6 + impact * 0.4

                suggestions.append(DocumentSuggestion(
                    title=title,
                    url=None,  # Would be populated by external search
                    source="cisco_docs",
                    relevance_to_gap=0.8,  # Would be calculated by semantic match
                    gap_topics=[gap.topic],
                    estimated_impact=gap.query_count,
                    priority_score=priority,
                ))

        # Deduplicate by title
        seen_titles = set()
        unique_suggestions = []
        for s in suggestions:
            if s.title.lower() not in seen_titles:
                seen_titles.add(s.title.lower())
                unique_suggestions.append(s)

        # Sort by priority
        unique_suggestions.sort(key=lambda s: s.priority_score, reverse=True)

        return unique_suggestions[:20]  # Top 20 suggestions

    async def prioritize_ingestion(
        self,
        suggestions: List[DocumentSuggestion],
        max_batch: int = 10,
    ) -> List[DocumentSuggestion]:
        """Prioritize documents for batch ingestion.

        Args:
            suggestions: List of document suggestions.
            max_batch: Maximum documents to queue for ingestion.

        Returns:
            Prioritized batch of documents to ingest.
        """
        # Already sorted by priority, just take top N
        batch = suggestions[:max_batch]

        # Additional optimization: diversify by gap topic
        # Ensure we're addressing multiple gaps, not just one
        seen_topics = set()
        diversified = []

        for s in suggestions:
            # Include if it addresses a new topic or is high priority
            if s.gap_topics[0] not in seen_topics or s.priority_score >= 0.8:
                diversified.append(s)
                seen_topics.update(s.gap_topics)

            if len(diversified) >= max_batch:
                break

        return diversified

    async def generate_report(
        self,
        query_logs: List[Dict[str, Any]],
        days: int = 7,
        existing_docs: Optional[List[str]] = None,
    ) -> ActiveLearningReport:
        """Generate a complete active learning report.

        Args:
            query_logs: Query logs from database.
            days: Analysis period.
            existing_docs: Already-ingested document titles.

        Returns:
            Complete ActiveLearningReport.
        """
        # Analyze gaps
        gaps = await self.analyze_failed_queries(query_logs, days)

        # Suggest documents
        suggestions = await self.suggest_documents(gaps, existing_docs)

        # Prioritize for ingestion
        prioritized = await self.prioritize_ingestion(suggestions)

        # Generate recommendations
        recommendations = []

        if gaps:
            critical_count = sum(1 for g in gaps if g.severity == GapSeverity.CRITICAL)
            if critical_count > 0:
                recommendations.append(
                    f"Immediate attention needed: {critical_count} critical content gap(s) identified"
                )

            recommendations.append(
                f"Top priority topic: {gaps[0].topic} ({gaps[0].query_count} failed queries)"
            )

        if prioritized:
            recommendations.append(
                f"Suggested next ingestion batch: {len(prioritized)} documents"
            )

        # Extract top missing topics
        top_topics = [g.topic for g in gaps[:5]]

        # Count failed vs total
        failed_count = sum(1 for g in gaps for _ in range(g.query_count))

        return ActiveLearningReport(
            analysis_period_days=days,
            total_queries_analyzed=len(query_logs),
            failed_query_count=failed_count,
            content_gaps=gaps,
            document_suggestions=prioritized,
            top_missing_topics=top_topics,
            recommendations=recommendations,
        )


# Singleton instance
_active_learning_pipeline: Optional[ActiveLearningPipeline] = None


def get_active_learning_pipeline() -> ActiveLearningPipeline:
    """Get or create the global active learning pipeline instance."""
    global _active_learning_pipeline
    if _active_learning_pipeline is None:
        _active_learning_pipeline = ActiveLearningPipeline()
    return _active_learning_pipeline
