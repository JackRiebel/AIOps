"""Bulk discovery service for finding and importing Cisco documentation.

This service handles:
- AI-powered search for Cisco documentation URLs
- Sitemap crawling for official documentation
- URL validation and filtering (allow official, block blogs/community)
- Rate limiting for external requests
- AI-powered metadata suggestion for discovered documents
"""

import asyncio
import hashlib
import json
import logging
import re
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Tuple, Literal, Dict, Any
from urllib.parse import urlparse, urljoin

import httpx

logger = logging.getLogger(__name__)


# =============================================================================
# Data Models
# =============================================================================

@dataclass
class DiscoveredURL:
    """A discovered documentation URL with AI-suggested metadata."""
    url: str
    title: str
    description: str
    source: Literal["ai_search", "sitemap_crawl", "manual"]
    doc_type_suggestion: str  # AI-suggested: datasheet, guide, etc.
    product_suggestion: str   # AI-suggested: meraki, catalyst, etc.
    relevance_score: float    # 0-1
    blocked: bool = False
    blocked_reason: Optional[str] = None


@dataclass
class ImportResult:
    """Result of importing a single URL."""
    url: str
    status: Literal["success", "duplicate", "error", "skipped"]
    document_id: Optional[int] = None
    chunk_count: Optional[int] = None
    title: Optional[str] = None
    error: Optional[str] = None


@dataclass
class BulkImportJob:
    """Tracks the state of a bulk import operation."""
    id: str
    query: str
    urls: List[DiscoveredURL] = field(default_factory=list)
    status: Literal["discovering", "ready", "importing", "complete", "failed"] = "discovering"
    progress: int = 0  # 0-100
    results: List[ImportResult] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)
    error: Optional[str] = None


@dataclass
class PageMetadata:
    """Extracted metadata from a web page."""
    title: str
    description: str
    doc_type: str
    product: str


# =============================================================================
# Known Cisco Documentation Sources
# =============================================================================

CISCO_DOC_SOURCES = {
    "meraki": [
        "https://documentation.meraki.com",
        "https://developer.cisco.com/meraki/api-v1/",
    ],
    "catalyst": [
        "https://www.cisco.com/c/en/us/support/switches/catalyst-9200-series-switches/",
        "https://www.cisco.com/c/en/us/support/switches/catalyst-9300-series-switches/",
        "https://www.cisco.com/c/en/us/support/switches/catalyst-9400-series-switches/",
        "https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9200/",
        "https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9300/",
    ],
    "ise": [
        "https://www.cisco.com/c/en/us/support/security/identity-services-engine/",
        "https://www.cisco.com/c/en/us/td/docs/security/ise/",
    ],
    "thousandeyes": [
        "https://docs.thousandeyes.com/",
        "https://developer.thousandeyes.com/",
    ],
    "dnac": [
        "https://www.cisco.com/c/en/us/support/cloud-systems-management/dna-center/",
        "https://developer.cisco.com/docs/dna-center/",
    ],
    "general": [
        "https://www.cisco.com/c/en/us/support/",
        "https://developer.cisco.com/docs/",
    ],
}

# Known sitemap locations (index files that list sub-sitemaps)
SITEMAP_LOCATIONS = {
    "meraki": "https://documentation.meraki.com/sitemap.xml",
    "cisco_us": "https://www.cisco.com/web/sitemap/www_cisco_com_en_us_index.xml",
    "developer": "https://developer.cisco.com/sitemap.xml",
}

# Cisco sitemap shards (gzipped text files with URLs)
CISCO_SITEMAP_SHARDS = [
    f"https://www.cisco.com/web/sitemap/www/cisco/com/en_us/www_cisco_com_en_us{i}.txt.gz"
    for i in range(13)  # 0-12 based on the sitemap index
]

# Direct Cisco documentation search endpoints
CISCO_SEARCH_ENDPOINTS = {
    "support_search": "https://www.cisco.com/c/en/us/support/all-products.html",
    "td_docs_switches": "https://www.cisco.com/c/en/us/td/docs/switches/lan/",
}

# Known Cisco product documentation patterns for direct lookup
CISCO_PRODUCT_DOC_PATTERNS = {
    "c9200": {
        "support_page": "https://www.cisco.com/c/en/us/support/switches/catalyst-9200-series-switches/series.html",
        "config_guides": "https://www.cisco.com/c/en/us/support/switches/catalyst-9200-series-switches/products-installation-and-configuration-guides-list.html",
        "datasheets": "https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9200-series-switches/nb-06-cat9200-ser-data-sheet-cte-en.html",
    },
    "c9300": {
        "support_page": "https://www.cisco.com/c/en/us/support/switches/catalyst-9300-series-switches/series.html",
        "config_guides": "https://www.cisco.com/c/en/us/support/switches/catalyst-9300-series-switches/products-installation-and-configuration-guides-list.html",
    },
    "c9400": {
        "support_page": "https://www.cisco.com/c/en/us/support/switches/catalyst-9400-series-switches/series.html",
    },
    "c9500": {
        "support_page": "https://www.cisco.com/c/en/us/support/switches/catalyst-9500-series-switches/series.html",
    },
    "meraki_mx": {
        "support_page": "https://documentation.meraki.com/MX",
    },
    "meraki_ms": {
        "support_page": "https://documentation.meraki.com/MS",
    },
    "meraki_mr": {
        "support_page": "https://documentation.meraki.com/MR",
    },
}


# =============================================================================
# URL Filtering Rules
# =============================================================================

# ALLOWED: Official documentation patterns
ALLOWED_PATTERNS = [
    r"^https://(www\.)?cisco\.com/c/en/us/(td/docs|support)",
    r"^https://(www\.)?cisco\.com/c/en/us/products/collateral",  # Datasheets and collateral
    r"^https://(www\.)?cisco\.com/c/dam/en/us/(td/docs|products)",  # PDF datasheets
    r"^https://documentation\.meraki\.com",
    r"^https://developer\.cisco\.com/(docs|meraki)",
    r"^https://docs\.thousandeyes\.com",
    r"^https://developer\.thousandeyes\.com",
]

# BLOCKED: Blogs, community, marketing
BLOCKED_PATTERNS = [
    r"blogs\.cisco\.com",
    r"community\.cisco\.com",
    r"newsroom\.cisco\.com",
    r"cisco\.com/c/en/us/about",
    r"cisco\.com/c/en/us/buy",
    r"cisco\.com/c/en/us/partners",
    r"cisco\.com/site/",
    r"cisco\.com/c/en/us/products/(?!collateral).*\.html$",  # Product marketing pages (exclude collateral/datasheets)
    r"/training/",
    r"/events/",
    r"/webinars/",
]

# Compiled patterns for performance
_ALLOWED_COMPILED = [re.compile(p, re.I) for p in ALLOWED_PATTERNS]
_BLOCKED_COMPILED = [re.compile(p, re.I) for p in BLOCKED_PATTERNS]


def is_url_allowed(url: str) -> Tuple[bool, Optional[str]]:
    """Check if a URL is allowed based on filtering rules.

    Args:
        url: URL to check.

    Returns:
        Tuple of (is_allowed, blocked_reason).
    """
    # Check blocked patterns first
    for pattern in _BLOCKED_COMPILED:
        if pattern.search(url):
            return False, f"Matches blocked pattern: {pattern.pattern}"

    # Check if matches allowed patterns
    for pattern in _ALLOWED_COMPILED:
        if pattern.search(url):
            return True, None

    # Default: block if not explicitly allowed
    return False, "URL does not match any official documentation patterns"


# =============================================================================
# Rate Limiter
# =============================================================================

class RateLimiter:
    """Token bucket rate limiter for external requests."""

    def __init__(
        self,
        requests_per_second: float = 2.0,
        burst_size: int = 5,
    ):
        """Initialize rate limiter.

        Args:
            requests_per_second: Sustained request rate.
            burst_size: Maximum burst capacity.
        """
        self.rate = requests_per_second
        self.burst = burst_size
        self.tokens = float(burst_size)
        self.last_update = time.time()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        """Wait until a token is available."""
        async with self._lock:
            now = time.time()
            elapsed = now - self.last_update
            self.tokens = min(self.burst, self.tokens + elapsed * self.rate)
            self.last_update = now

            if self.tokens < 1:
                wait_time = (1 - self.tokens) / self.rate
                await asyncio.sleep(wait_time)
                self.tokens = 0
            else:
                self.tokens -= 1


# Global rate limiter for external requests
_rate_limiter = RateLimiter(requests_per_second=2.0, burst_size=5)


# =============================================================================
# Bulk Discovery Service
# =============================================================================

class BulkDiscoveryService:
    """Service for discovering and importing Cisco documentation URLs."""

    def __init__(self):
        self.rate_limiter = _rate_limiter
        self._jobs: Dict[str, BulkImportJob] = {}

    def _generate_job_id(self) -> str:
        """Generate a unique job ID."""
        return hashlib.sha256(f"{time.time()}-{id(self)}".encode()).hexdigest()[:12]

    async def discover_urls(
        self,
        query: str,
        max_results: int = 20,
        use_ai_search: bool = True,
        use_sitemap_crawl: bool = True,
        product_filter: Optional[str] = None,
    ) -> List[DiscoveredURL]:
        """Discover Cisco documentation URLs for a query.

        If the query is a URL (e.g., a Cisco community page with links),
        this will extract documentation links from that page.

        Args:
            query: Search query (e.g., "MX firewall configuration") OR a URL to extract links from.
            max_results: Maximum URLs to return.
            use_ai_search: Use AI-powered web search.
            use_sitemap_crawl: Crawl known sitemaps.
            product_filter: Filter by product (meraki, catalyst, etc.).

        Returns:
            List of discovered URLs with metadata.
        """
        discovered: List[DiscoveredURL] = []

        # Check if query is actually a URL (aggregator page or product hierarchy)
        if query.startswith('http://') or query.startswith('https://'):
            logger.info(f"Query is a URL - analyzing: {query}")

            # Check if this is a Cisco product hierarchy page
            is_product_hierarchy = any(x in query.lower() for x in [
                '/site/us/en/products/',
                '/products/networking/',
                '/products/security/',
                '/products/collaboration/',
                '/products/data-center/',
            ])

            if is_product_hierarchy:
                logger.info(f"Detected product hierarchy page - using hierarchical crawler")
                return await self.crawl_product_hierarchy(
                    start_url=query,
                    max_depth=4,
                    max_docs=max_results,
                )

            # Otherwise use regular link extraction
            extracted = await self.extract_links_from_page(
                page_url=query,
                max_links=max_results,
                doc_type_filter=product_filter,
            )
            return extracted

        # Extract keywords for sitemap filtering
        keywords = self._extract_keywords(query)

        # AI-powered web search
        if use_ai_search:
            try:
                ai_results = await self.ai_search_cisco_docs(
                    query=query,
                    max_results=min(max_results, 15),
                    product_filter=product_filter,
                )
                discovered.extend(ai_results)
                logger.info(f"AI search found {len(ai_results)} URLs")
            except Exception as e:
                logger.error(f"AI search failed: {e}")

        # Sitemap crawl
        if use_sitemap_crawl:
            try:
                sitemap_results = await self.crawl_cisco_sitemaps(
                    keywords=keywords,
                    product_filter=product_filter,
                    max_pages=min(max_results * 2, 50),
                )
                discovered.extend(sitemap_results)
                logger.info(f"Sitemap crawl found {len(sitemap_results)} URLs")
            except Exception as e:
                logger.error(f"Sitemap crawl failed: {e}")

        # Deduplicate by URL
        seen_urls = set()
        unique = []
        for url_info in discovered:
            if url_info.url not in seen_urls:
                seen_urls.add(url_info.url)
                unique.append(url_info)

        # Sort by relevance
        unique.sort(key=lambda x: x.relevance_score, reverse=True)

        # Apply filtering and mark blocked URLs
        for url_info in unique:
            allowed, reason = is_url_allowed(url_info.url)
            if not allowed:
                url_info.blocked = True
                url_info.blocked_reason = reason

        return unique[:max_results]

    def _extract_keywords(self, query: str) -> List[str]:
        """Extract searchable keywords from a query.

        Args:
            query: User query.

        Returns:
            List of keywords.
        """
        # Remove common words
        stopwords = {'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
                     'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
                     'would', 'could', 'should', 'may', 'might', 'can', 'for',
                     'of', 'on', 'in', 'to', 'with', 'and', 'or', 'but', 'how',
                     'what', 'when', 'where', 'which', 'who', 'why', 'get', 'all',
                     'give', 'me', 'show', 'find', 'about', 'documentation', 'docs'}

        # Tokenize and filter
        words = re.findall(r'\b\w+\b', query.lower())
        keywords = [w for w in words if w not in stopwords and len(w) > 2]

        return keywords

    def _detect_product_from_query(self, query: str) -> List[str]:
        """Detect product codes from query.

        Args:
            query: User query.

        Returns:
            List of detected product codes.
        """
        query_lower = query.lower()
        detected = []

        # Check for Catalyst 9000 series
        catalyst_patterns = [
            (r'\bc?9200\b', 'c9200'),
            (r'\bc?9300\b', 'c9300'),
            (r'\bc?9400\b', 'c9400'),
            (r'\bc?9500\b', 'c9500'),
            (r'\bcatalyst\s*9200\b', 'c9200'),
            (r'\bcatalyst\s*9300\b', 'c9300'),
            (r'\bcatalyst\s*9400\b', 'c9400'),
            (r'\bcatalyst\s*9500\b', 'c9500'),
        ]

        for pattern, code in catalyst_patterns:
            if re.search(pattern, query_lower):
                if code not in detected:
                    detected.append(code)

        # Check for Meraki products
        meraki_patterns = [
            (r'\bmeraki\s*mx\b|\bmx\s*(6[045]|[789]\d|[0-9]{3})\b', 'meraki_mx'),
            (r'\bmeraki\s*ms\b|\bms\s*(1[02][05]|2[02][05]|3[05]0|4[02][05]|[0-9]{3})\b', 'meraki_ms'),
            (r'\bmeraki\s*mr\b|\bmr\s*\d+\b', 'meraki_mr'),
        ]

        for pattern, code in meraki_patterns:
            if re.search(pattern, query_lower):
                if code not in detected:
                    detected.append(code)

        return detected

    async def _scrape_cisco_support_page(
        self,
        url: str,
        keywords: List[str],
        max_links: int = 20,
    ) -> List[DiscoveredURL]:
        """Scrape a Cisco support page for documentation links.

        Args:
            url: Support page URL.
            keywords: Keywords to filter links.
            max_links: Maximum links to return.

        Returns:
            List of discovered URLs.
        """
        results: List[DiscoveredURL] = []

        try:
            await self.rate_limiter.acquire()

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    url,
                    headers={
                        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    },
                    follow_redirects=True,
                )

                if response.status_code != 200:
                    logger.warning(f"Failed to fetch {url}: {response.status_code}")
                    return results

                html = response.text

                # Extract links with titles
                # Pattern for Cisco documentation links
                link_patterns = [
                    r'<a[^>]+href="(https?://[^"]*cisco\.com[^"]*)"[^>]*>([^<]+)</a>',
                    r'<a[^>]+href="(/c/en/us/[^"]+)"[^>]*>([^<]+)</a>',
                ]

                seen_urls = set()

                for pattern in link_patterns:
                    matches = re.findall(pattern, html, re.I)

                    for href, title in matches:
                        # Make relative URLs absolute
                        if href.startswith('/'):
                            href = f"https://www.cisco.com{href}"

                        # Skip if already seen
                        if href in seen_urls:
                            continue
                        seen_urls.add(href)

                        # Check if URL matches keywords
                        href_lower = href.lower()
                        title_lower = title.lower()
                        combined = f"{href_lower} {title_lower}"

                        # Filter by keywords if provided
                        if keywords:
                            if not any(kw in combined for kw in keywords):
                                continue

                        # Skip blocked URLs
                        allowed, _ = is_url_allowed(href)
                        if not allowed:
                            continue

                        # Calculate relevance
                        keyword_matches = sum(1 for kw in keywords if kw in combined)
                        relevance = min(0.7 + (keyword_matches * 0.1), 0.95)

                        doc_type, product = self._suggest_metadata_from_url(href, title)

                        results.append(DiscoveredURL(
                            url=href,
                            title=title.strip()[:200],
                            description=f"Found on {urlparse(url).path}",
                            source="ai_search",
                            doc_type_suggestion=doc_type,
                            product_suggestion=product,
                            relevance_score=relevance,
                        ))

                        if len(results) >= max_links:
                            break

                    if len(results) >= max_links:
                        break

        except Exception as e:
            logger.warning(f"Failed to scrape {url}: {e}")

        return results

    async def extract_links_from_page(
        self,
        page_url: str,
        max_links: int = 50,
        doc_type_filter: Optional[str] = None,
    ) -> List[DiscoveredURL]:
        """Extract documentation links from an aggregator/index page.

        This is useful for pages like the Cisco Validated Design community page
        that link to many official documentation URLs.

        Args:
            page_url: URL of the aggregator page.
            max_links: Maximum links to extract.
            doc_type_filter: Optional filter (e.g., 'guide', 'design').

        Returns:
            List of discovered URLs from the page.
        """
        results: List[DiscoveredURL] = []

        try:
            await self.rate_limiter.acquire()

            # Use Jina Reader to get clean markdown from the page
            jina_url = f"https://r.jina.ai/{page_url}"

            async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
                response = await client.get(
                    jina_url,
                    headers={
                        "User-Agent": "Mozilla/5.0",
                        "Accept": "text/markdown",
                        "X-Return-Format": "markdown",
                    },
                )

                if response.status_code != 200:
                    logger.warning(f"Failed to fetch aggregator page {page_url}: {response.status_code}")
                    return results

                content = response.text

                # Extract all markdown links [title](url)
                link_pattern = r'\[([^\]]+)\]\((https?://[^\)]+)\)'
                matches = re.findall(link_pattern, content)

                logger.info(f"Found {len(matches)} total links on aggregator page")

                seen_urls = set()

                for title, url in matches:
                    # Skip empty titles or very short ones
                    if not title.strip() or len(title.strip()) < 3:
                        continue

                    # Skip if already seen
                    url_normalized = url.lower().rstrip('/')
                    if url_normalized in seen_urls:
                        continue
                    seen_urls.add(url_normalized)

                    # Skip navigation/login links
                    if any(x in url.lower() for x in ['javascript:', 'login', 'signin', 'community-login']):
                        continue

                    # Check if it's an allowed Cisco documentation URL
                    allowed, blocked_reason = is_url_allowed(url)

                    # Skip community.cisco.com links (they're navigation, not docs)
                    if 'community.cisco.com' in url.lower():
                        continue

                    # Also check for CVD/design guide patterns that should be allowed
                    is_cvd_doc = any(x in url.lower() for x in [
                        '/td/docs/', '/dam/en/us/td/docs/', 'cvd', 'design-guide',
                        'deployment-guide', 'validated', '.pdf'
                    ])

                    # Allow Cisco short links (cs.co) - they redirect to official docs
                    is_cisco_short_link = 'cs.co/' in url.lower()

                    # Also check title for guide patterns
                    is_guide_title = any(x in title.lower() for x in [
                        'design guide', 'deployment guide', 'configuration guide',
                        'implementation guide', 'best practice', 'validated design'
                    ])

                    if not allowed and not is_cvd_doc and not is_guide_title and not is_cisco_short_link:
                        continue

                    # Apply doc_type filter if provided
                    if doc_type_filter:
                        filter_lower = doc_type_filter.lower()
                        if filter_lower not in title.lower() and filter_lower not in url.lower():
                            continue

                    # Determine doc type and product
                    doc_type, product = self._suggest_metadata_from_url(url, title)

                    # Calculate relevance based on patterns
                    relevance = 0.7
                    if is_cvd_doc:
                        relevance = 0.9
                    if is_guide_title:
                        relevance = 0.95
                    if '.pdf' in url.lower():
                        relevance = min(relevance + 0.05, 0.95)

                    # Determine if URL should be marked as blocked
                    is_allowed = allowed or is_cvd_doc or is_cisco_short_link

                    results.append(DiscoveredURL(
                        url=url,
                        title=title.strip()[:200],
                        description=f"Extracted from: {urlparse(page_url).path[:50]}",
                        source="ai_search",
                        doc_type_suggestion=doc_type,
                        product_suggestion=product,
                        relevance_score=relevance,
                        blocked=not is_allowed,
                        blocked_reason=blocked_reason if not is_allowed else None,
                    ))

                    if len(results) >= max_links:
                        break

                logger.info(f"Extracted {len(results)} documentation links from aggregator page")

        except Exception as e:
            logger.error(f"Failed to extract links from {page_url}: {e}")

        return results

    async def crawl_product_hierarchy(
        self,
        start_url: str,
        max_depth: int = 4,
        max_docs: int = 100,
        doc_types: Optional[List[str]] = None,
    ) -> List[DiscoveredURL]:
        """Crawl Cisco product pages hierarchically to find documentation.

        Navigates from product index pages through categories to find
        datasheets, guides, and other documentation.

        Pattern: Products → Category → Subcategory → Product Series → Datasheet

        Args:
            start_url: Starting URL (e.g., cisco.com/site/us/en/products/networking/index.html)
            max_depth: Maximum navigation depth (default 4)
            max_docs: Maximum documents to discover
            doc_types: Filter by doc types (e.g., ['datasheet', 'guide'])

        Returns:
            List of discovered documentation URLs.
        """
        if doc_types is None:
            doc_types = ['datasheet', 'data-sheet', 'data sheet', 'guide', 'white-paper', 'whitepaper', 'at-a-glance', 'aag']

        results: List[DiscoveredURL] = []
        visited: set = set()
        queue: List[Tuple[str, int]] = [(start_url, 0)]  # (url, depth)

        # URLs to skip (not documentation)
        skip_patterns = [
            r'/site/[a-z]{2}/[a-z]{2}/',  # Language/country pages like /site/be/nl/
            r'software\.cisco\.com/download',  # Download portal
            r'/c/en/us/products/[^/]+/index\.html$',  # Generic product category indexes
            r'collaboration-endpoints',
            r'/support/web/',
            r'/login',
            r'/register',
        ]
        skip_pattern_compiled = [re.compile(p, re.I) for p in skip_patterns]

        # Patterns to identify documentation URLs (must be specific)
        doc_patterns = [
            r'/collateral/[^/]+/[^/]+/[^/]+-ds[^/]*\.(html|pdf)$',  # /collateral/.../...-ds.html
            r'/collateral/[^/]+/[^/]+/[^/]*data-?sheet[^/]*\.(html|pdf)$',  # explicit datasheet
            r'-ds\.html$',             # ends in -ds.html (strict)
            r'-ds\.pdf$',              # ends in -ds.pdf
            r'data-sheet.*\.(html|pdf)$',  # data-sheet in filename
            r'datasheet.*\.(html|pdf)$',   # datasheet in filename
            r'-aag\.(html|pdf)$',      # at-a-glance docs
            r'at-a-glance.*\.(html|pdf)$',
            r'white-?paper.*\.(html|pdf)$',  # whitepaper
            r'deployment-guide.*\.(html|pdf)$',
            r'design-guide.*\.(html|pdf)$',
        ]
        doc_pattern_compiled = [re.compile(p, re.I) for p in doc_patterns]

        # Patterns for navigation pages (to follow links)
        nav_patterns = [
            r'/site/us/en/products/[^/]+/[^/]+/',  # Product subcategory pages
            r'/site/us/en/products/networking/',
            r'/site/us/en/products/security/',
            r'/site/us/en/products/data-center/',
            r'catalyst-\d+',  # Catalyst series pages
            r'nexus-\d+',     # Nexus series pages
            r'c\d{3,4}-series', # C-series pages (c9200, c9300, etc.)
            r'meraki-[a-z]',   # Meraki product pages
            r'-series-switches',
            r'-series-routers',
            r'-smart-switches',
            r'-switches/index\.html',
            r'-routers/index\.html',
        ]
        nav_pattern_compiled = [re.compile(p, re.I) for p in nav_patterns]

        # Keywords in link titles that indicate product pages to follow
        follow_title_keywords = [
            'explore', 'series', 'learn more', 'view all', 'see all',
            'catalyst', 'nexus', 'meraki', 'c9200', 'c9300', 'c9400', 'c9500',
            'switches', 'routers', 'wireless', 'access points',
        ]

        logger.info(f"Starting product hierarchy crawl from: {start_url}")

        while queue and len(results) < max_docs:
            current_url, depth = queue.pop(0)

            # Skip if already visited or too deep
            url_normalized = current_url.lower().rstrip('/')
            if url_normalized in visited:
                continue
            if depth > max_depth:
                continue

            visited.add(url_normalized)

            try:
                await self.rate_limiter.acquire()

                # Fetch page via Jina Reader
                jina_url = f"https://r.jina.ai/{current_url}"

                async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
                    response = await client.get(
                        jina_url,
                        headers={
                            "User-Agent": "Mozilla/5.0",
                            "Accept": "text/markdown",
                            "X-Return-Format": "markdown",
                        },
                    )

                    if response.status_code != 200:
                        continue

                    content = response.text

                    # Extract all links
                    link_pattern = r'\[([^\]]*)\]\((https?://[^\)]+)\)'
                    matches = re.findall(link_pattern, content)

                    for title, url in matches:
                        # Skip non-Cisco URLs
                        if 'cisco.com' not in url.lower():
                            continue

                        # Skip already visited
                        url_norm = url.lower().rstrip('/')
                        if url_norm in visited:
                            continue

                        # Skip junk URLs
                        if any(p.search(url) for p in skip_pattern_compiled):
                            continue

                        # Check if this is a documentation URL
                        is_doc = any(p.search(url) for p in doc_pattern_compiled)

                        # Also check title for specific doc indicators (more strict)
                        title_lower = title.lower()
                        doc_title_keywords = ['data sheet', 'datasheet', 'at-a-glance', 'white paper', 'whitepaper']
                        is_doc_by_title = any(kw in title_lower for kw in doc_title_keywords)

                        if is_doc or is_doc_by_title:
                            # This is a documentation URL - add to results
                            doc_type, product = self._suggest_metadata_from_url(url, title)

                            results.append(DiscoveredURL(
                                url=url,
                                title=title.strip()[:200] if title.strip() else f"Document from {urlparse(url).path[-50:]}",
                                description=f"Found at depth {depth} from product hierarchy",
                                source="ai_search",
                                doc_type_suggestion=doc_type,
                                product_suggestion=product,
                                relevance_score=0.9 - (depth * 0.05),  # Higher relevance for shallower finds
                            ))

                            logger.debug(f"Found doc: {title[:50]} at depth {depth}")

                            if len(results) >= max_docs:
                                break

                        else:
                            # Check if this is a navigation page to follow
                            is_nav_url = any(p.search(url) for p in nav_pattern_compiled)
                            is_nav_title = any(kw in title_lower for kw in follow_title_keywords)

                            if (is_nav_url or is_nav_title) and depth < max_depth:
                                queue.append((url, depth + 1))

            except Exception as e:
                logger.warning(f"Error crawling {current_url}: {e}")
                continue

        logger.info(f"Product hierarchy crawl complete: found {len(results)} documents")
        return results

    async def ai_search_cisco_docs(
        self,
        query: str,
        max_results: int = 10,
        product_filter: Optional[str] = None,
    ) -> List[DiscoveredURL]:
        """Search for Cisco documentation using multiple methods.

        Uses:
        1. Known product documentation patterns
        2. Direct Cisco support page scraping
        3. DuckDuckGo search as fallback

        Args:
            query: User search query.
            max_results: Maximum results.
            product_filter: Product filter.

        Returns:
            List of discovered URLs.
        """
        results: List[DiscoveredURL] = []
        keywords = self._extract_keywords(query)

        # Step 1: Check for known product patterns
        detected_products = self._detect_product_from_query(query)

        for product_code in detected_products:
            if product_code in CISCO_PRODUCT_DOC_PATTERNS:
                patterns = CISCO_PRODUCT_DOC_PATTERNS[product_code]

                # Add known URLs directly
                for doc_type, url in patterns.items():
                    # Check if URL matches query keywords
                    if any(kw in doc_type or kw in query.lower() for kw in ['datasheet', 'config', 'guide', 'support']):
                        doc_type_suggestion, product = self._suggest_metadata_from_url(url, doc_type)

                        results.append(DiscoveredURL(
                            url=url,
                            title=f"Cisco {product_code.upper()} {doc_type.replace('_', ' ').title()}",
                            description=f"Official Cisco documentation for {product_code.upper()}",
                            source="ai_search",
                            doc_type_suggestion=doc_type_suggestion,
                            product_suggestion=product,
                            relevance_score=0.95,
                        ))

                # Also scrape the support page for more links
                if 'support_page' in patterns:
                    scraped = await self._scrape_cisco_support_page(
                        patterns['support_page'],
                        keywords,
                        max_links=max_results // 2,
                    )
                    results.extend(scraped)

        # Step 2: If we found results from known patterns, return them
        if results:
            logger.info(f"Found {len(results)} URLs from known product patterns")
            return results[:max_results]

        # Step 3: Try direct Cisco support page scraping
        if product_filter:
            product_lower = product_filter.lower()
            if product_lower == "catalyst":
                support_urls = [
                    "https://www.cisco.com/c/en/us/support/switches/catalyst-9200-series-switches/series.html",
                    "https://www.cisco.com/c/en/us/support/switches/catalyst-9300-series-switches/series.html",
                ]
                for support_url in support_urls:
                    scraped = await self._scrape_cisco_support_page(support_url, keywords, max_links=10)
                    results.extend(scraped)

        # Step 4: Fall back to DuckDuckGo search (may be unreliable)
        if not results:
            ddg_results = await self._duckduckgo_search(query, max_results, product_filter)
            results.extend(ddg_results)

        return results[:max_results]

    async def _duckduckgo_search(
        self,
        query: str,
        max_results: int = 10,
        product_filter: Optional[str] = None,
    ) -> List[DiscoveredURL]:
        """Fall back to DuckDuckGo search.

        Note: This may be unreliable due to rate limiting.
        """
        results: List[DiscoveredURL] = []

        # Build search query targeting official Cisco docs
        site_filters = [
            "site:cisco.com/c/en/us/td/docs",
            "site:cisco.com/c/en/us/support",
            "site:documentation.meraki.com",
            "site:developer.cisco.com",
        ]

        if product_filter:
            product_lower = product_filter.lower()
            if product_lower == "meraki":
                site_filters = ["site:documentation.meraki.com", "site:developer.cisco.com/meraki"]
            elif product_lower in ["catalyst", "ios-xe"]:
                site_filters = ["site:cisco.com/c/en/us/td/docs/switches", "site:cisco.com/c/en/us/support/switches"]
            elif product_lower == "ise":
                site_filters = ["site:cisco.com/c/en/us/td/docs/security/ise", "site:cisco.com/c/en/us/support/security/identity-services-engine"]

        # Construct search URL using DuckDuckGo HTML
        for site_filter in site_filters[:2]:  # Limit to avoid too many requests
            try:
                await self.rate_limiter.acquire()

                search_query = f"{query} {site_filter}"
                search_url = f"https://html.duckduckgo.com/html/?q={search_query.replace(' ', '+')}"

                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(
                        search_url,
                        headers={
                            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
                        },
                        follow_redirects=True,
                    )

                    if response.status_code == 200:
                        # Parse search results from HTML
                        html = response.text

                        # Extract result links (try multiple patterns)
                        link_patterns = [
                            r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)</a>',
                            r'<a[^>]+href="([^"]+)"[^>]+class="result__a"[^>]*>([^<]+)</a>',
                            r'class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]*)</a>',
                        ]

                        matches = []
                        for pattern in link_patterns:
                            matches = re.findall(pattern, html, re.I)
                            if matches:
                                break

                        for url, title in matches[:max_results // len(site_filters)]:
                            # DuckDuckGo uses redirect URLs, extract actual URL
                            if "uddg=" in url:
                                actual_url = re.search(r'uddg=([^&]+)', url)
                                if actual_url:
                                    from urllib.parse import unquote
                                    url = unquote(actual_url.group(1))

                            # Skip non-HTTP URLs
                            if not url.startswith("http"):
                                continue

                            # Get description snippet
                            desc_pattern = rf'{re.escape(title)}.*?<a[^>]+class="result__snippet"[^>]*>([^<]+)</a>'
                            desc_match = re.search(desc_pattern, html, re.I | re.DOTALL)
                            description = desc_match.group(1) if desc_match else ""

                            # Suggest doc type and product
                            doc_type, product = self._suggest_metadata_from_url(url, title)

                            results.append(DiscoveredURL(
                                url=url,
                                title=title.strip(),
                                description=description.strip()[:200],
                                source="ai_search",
                                doc_type_suggestion=doc_type,
                                product_suggestion=product,
                                relevance_score=0.8,
                            ))
                    else:
                        logger.warning(f"DuckDuckGo returned status {response.status_code}")

            except Exception as e:
                logger.warning(f"DuckDuckGo search failed for {site_filter}: {e}")
                continue

        return results

    async def crawl_cisco_sitemaps(
        self,
        keywords: List[str],
        product_filter: Optional[str] = None,
        max_pages: int = 50,
    ) -> List[DiscoveredURL]:
        """Crawl Cisco sitemaps to find relevant documentation.

        Dynamically searches through Cisco's sitemap shards (gzipped text files)
        to find URLs matching the given keywords.

        Args:
            keywords: Keywords to filter URLs.
            product_filter: Product filter.
            max_pages: Maximum pages to return.

        Returns:
            List of discovered URLs.
        """
        import gzip

        results: List[DiscoveredURL] = []

        if not keywords:
            logger.warning("No keywords provided for sitemap crawl")
            return results

        # For Meraki, use their sitemap directly
        if product_filter and product_filter.lower() == "meraki":
            return await self._crawl_meraki_sitemap(keywords, max_pages)

        # For Cisco products, search through the gzipped sitemap shards
        # We'll search a subset of shards to avoid overwhelming the service
        shards_to_search = CISCO_SITEMAP_SHARDS[:5]  # First 5 shards

        for shard_url in shards_to_search:
            if len(results) >= max_pages:
                break

            try:
                await self.rate_limiter.acquire()

                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(
                        shard_url,
                        headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"},
                        follow_redirects=True,
                    )

                    if response.status_code != 200:
                        logger.warning(f"Failed to fetch sitemap shard {shard_url}: {response.status_code}")
                        continue

                    # Decompress gzipped content
                    try:
                        content = gzip.decompress(response.content).decode('utf-8')
                    except Exception as e:
                        logger.warning(f"Failed to decompress {shard_url}: {e}")
                        continue

                    # Each line is a URL
                    urls = content.strip().split('\n')

                    # Filter URLs by keywords
                    for url in urls:
                        url = url.strip()
                        if not url:
                            continue

                        url_lower = url.lower()

                        # Check if URL matches any keyword
                        keyword_matches = sum(1 for kw in keywords if kw in url_lower)
                        if keyword_matches == 0:
                            continue

                        # Check if URL is allowed
                        allowed, _ = is_url_allowed(url)
                        if not allowed:
                            continue

                        # Calculate relevance
                        relevance = min(0.5 + (keyword_matches * 0.15), 0.95)

                        doc_type, product = self._suggest_metadata_from_url(url, "")

                        # Extract title from URL path
                        parsed = urlparse(url)
                        path_parts = parsed.path.strip("/").split("/")
                        filename = path_parts[-1] if path_parts else "Documentation"
                        # Clean up filename
                        title = filename.replace("-", " ").replace("_", " ").replace(".html", "").replace(".pdf", " (PDF)").title()

                        results.append(DiscoveredURL(
                            url=url,
                            title=title[:100],
                            description=f"Cisco documentation matching: {', '.join(keywords[:3])}",
                            source="sitemap_crawl",
                            doc_type_suggestion=doc_type,
                            product_suggestion=product,
                            relevance_score=relevance,
                        ))

                        if len(results) >= max_pages:
                            break

                logger.info(f"Found {len(results)} URLs from sitemap shard")

            except Exception as e:
                logger.warning(f"Failed to crawl sitemap shard {shard_url}: {e}")
                continue

        # Sort by relevance
        results.sort(key=lambda x: x.relevance_score, reverse=True)

        return results[:max_pages]

    async def _crawl_meraki_sitemap(
        self,
        keywords: List[str],
        max_pages: int = 50,
    ) -> List[DiscoveredURL]:
        """Crawl Meraki documentation sitemap."""
        results: List[DiscoveredURL] = []

        try:
            await self.rate_limiter.acquire()

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    SITEMAP_LOCATIONS["meraki"],
                    headers={"User-Agent": "Mozilla/5.0 (compatible; CiscoAIOpsHub/1.0)"},
                    follow_redirects=True,
                )

                if response.status_code != 200:
                    return results

                # Parse XML sitemap
                urls = self._parse_sitemap(response.text, keywords)

                for url in urls[:max_pages]:
                    doc_type, product = self._suggest_metadata_from_url(url, "")
                    parsed = urlparse(url)
                    path_parts = parsed.path.strip("/").split("/")
                    title = path_parts[-1].replace("-", " ").replace("_", " ").title() if path_parts else "Meraki Documentation"

                    url_lower = url.lower()
                    matches = sum(1 for kw in keywords if kw in url_lower)
                    relevance = min(0.5 + (matches * 0.1), 0.95)

                    results.append(DiscoveredURL(
                        url=url,
                        title=title[:100],
                        description="Meraki documentation",
                        source="sitemap_crawl",
                        doc_type_suggestion=doc_type,
                        product_suggestion="meraki",
                        relevance_score=relevance,
                    ))

        except Exception as e:
            logger.warning(f"Failed to crawl Meraki sitemap: {e}")

        return results

    def _parse_sitemap(self, xml_content: str, keywords: List[str]) -> List[str]:
        """Parse a sitemap XML and filter URLs by keywords.

        Args:
            xml_content: Raw XML content.
            keywords: Keywords to filter by.

        Returns:
            List of matching URLs.
        """
        urls = []

        try:
            # Handle XML namespaces
            xml_content = re.sub(r'\sxmlns="[^"]+"', '', xml_content)
            root = ET.fromstring(xml_content)

            # Find all URL elements
            for url_elem in root.iter():
                if url_elem.tag.endswith('loc') or url_elem.tag == 'loc':
                    url = url_elem.text
                    if url:
                        # Filter by keywords if provided
                        if keywords:
                            url_lower = url.lower()
                            if any(kw in url_lower for kw in keywords):
                                urls.append(url)
                        else:
                            urls.append(url)
        except ET.ParseError as e:
            logger.warning(f"Failed to parse sitemap XML: {e}")

        return urls

    def _suggest_metadata_from_url(self, url: str, title: str) -> Tuple[str, str]:
        """Suggest doc_type and product from URL patterns.

        Args:
            url: URL to analyze.
            title: Page title.

        Returns:
            Tuple of (doc_type, product).
        """
        url_lower = url.lower()
        title_lower = title.lower() if title else ""
        combined = f"{url_lower} {title_lower}"

        # Determine product (order matters - more specific first)
        product = "general"
        if "meraki" in combined:
            product = "meraki"
        elif "nexus" in combined:
            product = "nexus"
        elif "catalyst" in combined:
            product = "catalyst"
        elif "/switches/" in url_lower:
            # Generic switches, default to catalyst unless already detected
            product = "catalyst"
        elif "ise" in combined or "identity-services-engine" in url_lower:
            product = "ise"
        elif "thousandeyes" in combined:
            product = "thousandeyes"
        elif "dna-center" in combined or "dnac" in combined:
            product = "dnac"
        elif "ios-xe" in combined or "ios_xe" in combined:
            product = "ios-xe"
        elif "firepower" in combined:
            product = "firepower"
        elif "business-" in combined and "switch" in combined:
            product = "cbs"  # Cisco Business Switches

        # Determine doc_type
        doc_type = "guide"
        if "datasheet" in combined or "/dam/" in url_lower:
            doc_type = "datasheet"
        elif "api" in combined or "/api/" in url_lower:
            doc_type = "api_spec"
        elif "cli" in combined or "command" in combined:
            doc_type = "cli_reference"
        elif "cvd" in combined or "validated-design" in combined:
            doc_type = "cvd"
        elif "troubleshoot" in combined:
            doc_type = "troubleshooting"
        elif "release-notes" in combined or "release_notes" in combined:
            doc_type = "release_notes"
        elif "config" in combined or "configuration" in combined:
            doc_type = "config_guide"

        return doc_type, product

    async def validate_url(self, url: str) -> Tuple[bool, Optional[str]]:
        """Validate that a URL is accessible.

        Args:
            url: URL to validate.

        Returns:
            Tuple of (is_valid, error_message).
        """
        try:
            await self.rate_limiter.acquire()

            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.head(
                    url,
                    headers={"User-Agent": "Mozilla/5.0 (compatible; CiscoAIOpsHub/1.0)"},
                    follow_redirects=True,
                )

                if response.status_code == 200:
                    return True, None
                else:
                    return False, f"HTTP {response.status_code}"

        except httpx.TimeoutException:
            return False, "Request timed out"
        except Exception as e:
            return False, str(e)

    async def extract_page_metadata(self, url: str) -> Optional[PageMetadata]:
        """Extract metadata from a web page.

        Args:
            url: URL to fetch and analyze.

        Returns:
            PageMetadata or None if failed.
        """
        try:
            await self.rate_limiter.acquire()

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    url,
                    headers={"User-Agent": "Mozilla/5.0 (compatible; CiscoAIOpsHub/1.0)"},
                    follow_redirects=True,
                )

                if response.status_code != 200:
                    return None

                html = response.text

                # Extract title
                title_match = re.search(r'<title[^>]*>([^<]+)</title>', html, re.I)
                title = title_match.group(1).strip() if title_match else "Untitled"

                # Extract description
                desc_match = re.search(
                    r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']',
                    html, re.I
                )
                description = desc_match.group(1).strip() if desc_match else ""

                # Suggest doc_type and product
                doc_type, product = self._suggest_metadata_from_url(url, title)

                return PageMetadata(
                    title=title[:200],
                    description=description[:500],
                    doc_type=doc_type,
                    product=product,
                )

        except Exception as e:
            logger.warning(f"Failed to extract metadata from {url}: {e}")
            return None

    async def suggest_metadata_with_ai(
        self,
        url: str,
        content_preview: str,
    ) -> Optional[Dict[str, str]]:
        """Use AI to suggest metadata for a document.

        Args:
            url: Document URL.
            content_preview: First 2000 chars of content.

        Returns:
            Dictionary with suggested metadata or None.
        """
        try:
            from src.services.cisco_ai_service import get_cisco_circuit_service

            circuit = get_cisco_circuit_service()

            prompt = f"""Analyze this Cisco documentation page and suggest metadata.

URL: {url}
Content Preview: {content_preview[:2000]}

Respond with ONLY a JSON object (no markdown, no explanation):
{{
    "title": "Concise descriptive title",
    "doc_type": "datasheet|guide|api_spec|cli_reference|cvd|troubleshooting|config_guide|release_notes",
    "product": "meraki|catalyst|ios-xe|ise|thousandeyes|dnac|firepower|general",
    "description": "One sentence summary"
}}"""

            response = await circuit.chat(prompt, max_tokens=200)

            # Parse JSON response
            json_match = re.search(r'\{[^}]+\}', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())

        except Exception as e:
            logger.warning(f"AI metadata suggestion failed: {e}")

        return None

    def get_job(self, job_id: str) -> Optional[BulkImportJob]:
        """Get a bulk import job by ID.

        Args:
            job_id: Job ID.

        Returns:
            BulkImportJob or None.
        """
        return self._jobs.get(job_id)

    def create_job(self, query: str) -> BulkImportJob:
        """Create a new bulk import job.

        Args:
            query: User query.

        Returns:
            New BulkImportJob.
        """
        job = BulkImportJob(
            id=self._generate_job_id(),
            query=query,
        )
        self._jobs[job.id] = job
        return job


# =============================================================================
# Safe Fetch Utility
# =============================================================================

async def safe_fetch_url(
    url: str,
    rate_limiter: Optional[RateLimiter] = None,
    max_retries: int = 3,
) -> Tuple[bool, Optional[str], Optional[str]]:
    """Fetch URL with retry logic and error handling.

    Args:
        url: URL to fetch.
        rate_limiter: Optional rate limiter.
        max_retries: Maximum retry attempts.

    Returns:
        Tuple of (success, content, error_message).
    """
    limiter = rate_limiter or _rate_limiter

    for attempt in range(max_retries):
        try:
            await limiter.acquire()

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    url,
                    headers={
                        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
                    },
                    follow_redirects=True,
                )
                response.raise_for_status()
                return True, response.text, None

        except httpx.TimeoutException:
            if attempt == max_retries - 1:
                return False, None, f"Timeout after {max_retries} attempts"
            await asyncio.sleep(2 ** attempt)  # Exponential backoff

        except httpx.HTTPStatusError as e:
            return False, None, f"HTTP {e.response.status_code}"

        except Exception as e:
            return False, None, str(e)

    return False, None, "Max retries exceeded"


# =============================================================================
# Singleton
# =============================================================================

_bulk_discovery_service: Optional[BulkDiscoveryService] = None


def get_bulk_discovery_service() -> BulkDiscoveryService:
    """Get or create singleton bulk discovery service."""
    global _bulk_discovery_service
    if _bulk_discovery_service is None:
        _bulk_discovery_service = BulkDiscoveryService()
    return _bulk_discovery_service
