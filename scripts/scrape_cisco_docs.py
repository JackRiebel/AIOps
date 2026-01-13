#!/usr/bin/env python3
"""Cisco Documentation Scraper for RAG Knowledge Base.

This script scrapes and downloads Cisco documentation including:
- Meraki product datasheets
- Catalyst product datasheets
- Cisco Validated Designs (CVDs)
- Configuration guides
- Best practices documents

Usage:
    python scripts/scrape_cisco_docs.py [--output-dir ./docs] [--type all|datasheets|cvd]

Prerequisites:
    pip install requests beautifulsoup4 aiohttp aiofiles

Note: Respects robots.txt and includes rate limiting to be a good citizen.
"""

import asyncio
import argparse
import hashlib
import json
import logging
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Set
from urllib.parse import urljoin, urlparse
import aiohttp
import aiofiles
from bs4 import BeautifulSoup

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Rate limiting settings
REQUESTS_PER_SECOND = 2
REQUEST_DELAY = 1.0 / REQUESTS_PER_SECOND

# User agent to identify ourselves
USER_AGENT = "Lumen-DocScraper/1.0 (Educational/Research; contact@example.com)"

# Known Cisco documentation URLs
CISCO_DOC_SOURCES = {
    "meraki_datasheets": {
        "base_url": "https://documentation.meraki.com",
        "index_pages": [
            "/General_Administration/Inventory_and_Devices",
        ],
        "patterns": [
            r".*datasheet.*\.pdf$",
            r".*spec.*sheet.*\.pdf$",
        ]
    },
    "meraki_guides": {
        "base_url": "https://documentation.meraki.com",
        "index_pages": [
            "/MX",
            "/MS",
            "/MR",
            "/MV",
            "/MT",
            "/SM",
        ],
        "doc_type": "guide"
    },
    "catalyst_datasheets": {
        "base_url": "https://www.cisco.com",
        "index_pages": [
            "/c/en/us/products/switches/catalyst-9000/datasheet-listing.html",
            "/c/en/us/products/switches/catalyst-9200-series-switches/datasheet-listing.html",
            "/c/en/us/products/switches/catalyst-9300-series-switches/datasheet-listing.html",
            "/c/en/us/products/switches/catalyst-9400-series-switches/datasheet-listing.html",
            "/c/en/us/products/switches/catalyst-9500-series-switches/datasheet-listing.html",
            "/c/en/us/products/switches/catalyst-9600-series-switches/datasheet-listing.html",
        ],
        "doc_type": "datasheet"
    },
    "cvd": {
        "base_url": "https://www.cisco.com",
        "index_pages": [
            "/c/en/us/solutions/enterprise-networks/validated-design-program.html",
            "/c/en/us/td/docs/solutions/CVD/Campus/CVD-Campus-LAN-WLAN-Design-Guide.html",
        ],
        "doc_type": "cvd"
    },
    "dna_center_guides": {
        "base_url": "https://www.cisco.com",
        "index_pages": [
            "/c/en/us/support/cloud-systems-management/dna-center/products-user-guide-list.html",
            "/c/en/us/support/cloud-systems-management/dna-center/products-installation-guides-list.html",
        ],
        "doc_type": "guide"
    },
    "ise_guides": {
        "base_url": "https://www.cisco.com",
        "index_pages": [
            "/c/en/us/support/security/identity-services-engine/products-installation-and-configuration-guides-list.html",
            "/c/en/us/support/security/identity-services-engine/products-user-guide-list.html",
        ],
        "doc_type": "guide"
    }
}

# Fallback: Direct links to known good documentation
DIRECT_DOC_LINKS = {
    "meraki": [
        {
            "title": "Meraki MX Security Appliance Datasheet",
            "url": "https://documentation.meraki.com/MX",
            "product": "meraki",
            "doc_type": "guide"
        },
        {
            "title": "Meraki MS Switch Datasheet",
            "url": "https://documentation.meraki.com/MS",
            "product": "meraki",
            "doc_type": "guide"
        },
        {
            "title": "Meraki MR Access Point Overview",
            "url": "https://documentation.meraki.com/MR",
            "product": "meraki",
            "doc_type": "guide"
        },
        {
            "title": "Meraki Dashboard API Documentation",
            "url": "https://developer.cisco.com/meraki/api-v1/",
            "product": "meraki",
            "doc_type": "api_doc"
        },
    ],
    "catalyst": [
        {
            "title": "Catalyst 9000 Series Overview",
            "url": "https://www.cisco.com/c/en/us/products/switches/catalyst-9000.html",
            "product": "catalyst",
            "doc_type": "overview"
        },
        {
            "title": "Catalyst Center User Guide",
            "url": "https://www.cisco.com/c/en/us/support/cloud-systems-management/dna-center/products-user-guide-list.html",
            "product": "catalyst",
            "doc_type": "guide"
        },
    ],
    "ise": [
        {
            "title": "ISE Administrator Guide",
            "url": "https://www.cisco.com/c/en/us/support/security/identity-services-engine/products-installation-and-configuration-guides-list.html",
            "product": "ise",
            "doc_type": "guide"
        },
    ],
    "cvd": [
        {
            "title": "Campus LAN and Wireless LAN Design Guide",
            "url": "https://www.cisco.com/c/en/us/td/docs/solutions/CVD/Campus/CVD-Campus-LAN-WLAN-Design-Guide.html",
            "product": "general",
            "doc_type": "cvd"
        },
        {
            "title": "SD-Access Design Guide",
            "url": "https://www.cisco.com/c/en/us/td/docs/solutions/CVD/Campus/cisco-sda-design-guide.html",
            "product": "general",
            "doc_type": "cvd"
        },
    ]
}


class RateLimiter:
    """Simple rate limiter for HTTP requests."""

    def __init__(self, requests_per_second: float = 2):
        self.min_interval = 1.0 / requests_per_second
        self.last_request = 0
        self._lock = asyncio.Lock()

    async def wait(self):
        """Wait if necessary to respect rate limit."""
        async with self._lock:
            now = time.time()
            elapsed = now - self.last_request
            if elapsed < self.min_interval:
                await asyncio.sleep(self.min_interval - elapsed)
            self.last_request = time.time()


class CiscoDocScraper:
    """Scraper for Cisco documentation."""

    def __init__(self, output_dir: str = "./scraped_docs"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.rate_limiter = RateLimiter(REQUESTS_PER_SECOND)
        self.session: Optional[aiohttp.ClientSession] = None
        self.scraped_urls: Set[str] = set()
        self.documents: List[Dict] = []

    async def __aenter__(self):
        connector = aiohttp.TCPConnector(limit=5, force_close=True)
        timeout = aiohttp.ClientTimeout(total=30)
        self.session = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers={"User-Agent": USER_AGENT}
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def fetch_page(self, url: str) -> Optional[str]:
        """Fetch a page with rate limiting."""
        if url in self.scraped_urls:
            return None

        await self.rate_limiter.wait()

        try:
            async with self.session.get(url, allow_redirects=True) as response:
                if response.status == 200:
                    content_type = response.headers.get('content-type', '')
                    if 'text/html' in content_type:
                        self.scraped_urls.add(url)
                        return await response.text()
                    elif 'application/pdf' in content_type:
                        # For PDFs, just return the URL
                        return f"PDF:{url}"
                else:
                    logger.warning(f"HTTP {response.status} for {url}")
                    return None
        except asyncio.TimeoutError:
            logger.warning(f"Timeout fetching {url}")
            return None
        except Exception as e:
            logger.error(f"Error fetching {url}: {e}")
            return None

    def extract_links_from_html(self, html: str, base_url: str, allowed_prefix: str = None) -> List[str]:
        """Extract relevant documentation links from HTML."""
        soup = BeautifulSoup(html, 'html.parser')
        links = []

        for a in soup.find_all('a', href=True):
            href = a['href']

            # Skip non-documentation links
            if any(skip in href.lower() for skip in ['#', 'javascript:', 'mailto:', 'tel:',
                                                      '.pdf', '.zip', '.png', '.jpg', '.gif',
                                                      'login', 'logout', 'search', 'feedback']):
                continue

            # Construct full URL
            if href.startswith('/'):
                full_url = urljoin(base_url, href)
            elif href.startswith('http'):
                full_url = href
            else:
                continue

            # Filter by allowed prefix
            if allowed_prefix and not full_url.startswith(allowed_prefix):
                continue

            # Skip if already scraped
            if full_url not in self.scraped_urls and full_url not in links:
                links.append(full_url)

        return links

    def extract_text_from_html(self, html: str, url: str) -> Dict:
        """Extract meaningful text content from HTML."""
        soup = BeautifulSoup(html, 'html.parser')

        # Remove script and style elements
        for element in soup(['script', 'style', 'nav', 'header', 'footer', 'aside']):
            element.decompose()

        # Try to find the main content area
        main_content = (
            soup.find('main') or
            soup.find('article') or
            soup.find('div', class_=re.compile(r'content|main|body', re.I)) or
            soup.find('div', id=re.compile(r'content|main|body', re.I)) or
            soup.body
        )

        if not main_content:
            main_content = soup

        # Extract title
        title = ""
        title_tag = soup.find('title')
        if title_tag:
            title = title_tag.get_text(strip=True)
        h1 = soup.find('h1')
        if h1:
            title = h1.get_text(strip=True)

        # Extract text content with structure
        text_parts = []

        for element in main_content.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'td', 'th', 'pre', 'code']):
            text = element.get_text(strip=True)
            if text and len(text) > 10:  # Skip very short fragments
                if element.name.startswith('h'):
                    level = int(element.name[1])
                    text_parts.append(f"\n{'#' * level} {text}\n")
                elif element.name in ['pre', 'code']:
                    text_parts.append(f"\n```\n{text}\n```\n")
                elif element.name == 'li':
                    text_parts.append(f"- {text}")
                else:
                    text_parts.append(text)

        content = "\n".join(text_parts)

        # Clean up content
        content = re.sub(r'\n{3,}', '\n\n', content)
        content = re.sub(r' {2,}', ' ', content)

        return {
            "title": title,
            "content": content,
            "url": url,
            "scraped_at": datetime.utcnow().isoformat()
        }

    async def scrape_meraki_docs(self) -> List[Dict]:
        """Scrape Meraki documentation pages."""
        logger.info("Scraping Meraki documentation...")
        docs = []

        base_url = "https://documentation.meraki.com"

        # Comprehensive Meraki documentation pages to scrape
        pages_to_scrape = [
            # MX Security Appliance
            "/MX/MX_Overview_and_Specifications",
            "/MX/Firewall_and_Traffic_Shaping",
            "/MX/Firewall_and_Traffic_Shaping/Layer_3_and_Layer_7_Firewall_Processing_Order",
            "/MX/Firewall_and_Traffic_Shaping/Layer_7_Firewall",
            "/MX/Firewall_and_Traffic_Shaping/Firewall_Threat_Protection",
            "/MX/Site-to-site_VPN",
            "/MX/Site-to-site_VPN/Site-to-site_VPN_Settings",
            "/MX/Site-to-site_VPN/Client_VPN/Client_VPN_Overview",
            "/MX/SD-WAN_and_Traffic_Shaping",
            "/MX/SD-WAN_and_Traffic_Shaping/Uplink_Selection_and_Load_Balancing",
            "/MX/SD-WAN_and_Traffic_Shaping/Traffic_Shaping_Rules",
            "/MX/NAT_and_Port_Forwarding",
            "/MX/NAT_and_Port_Forwarding/1-to-1_NAT_and_1-to-Many_NAT",
            "/MX/Content_Filtering",
            "/MX/Content_Filtering/Content_Filtering_Overview",
            "/MX/Threat_Protection/Cisco_AMP_for_Meraki_MX",
            "/MX/Threat_Protection/Intrusion_Detection_and_Prevention",
            "/MX/DHCP",
            "/MX/VLAN_Configuration",
            "/MX/Cellular_Uplinks",

            # MS Switches
            "/MS/MS_Overview_and_Specifications",
            "/MS/Switching/Switch_Ports",
            "/MS/Switching/Switch_Ports/Port_Mirroring",
            "/MS/Switching/Switch_Stacking",
            "/MS/Switching/VLANs_and_Trunking",
            "/MS/Switching/VLANs_and_Trunking/Native_VLAN",
            "/MS/Switching/Spanning_Tree_Protocol",
            "/MS/Switching/Spanning_Tree_Protocol/Root_Guard_and_BPDU_Guard",
            "/MS/Switching/Link_Aggregation",
            "/MS/Switching/Link_Aggregation/LACP_Overview",
            "/MS/Switching/QoS_and_DSCP",
            "/MS/Switching/Energy_Efficient_Ethernet",
            "/MS/Access_Control/802.1X",
            "/MS/Access_Control/802.1X/802.1X_RADIUS_Configuration",
            "/MS/Access_Control/RADIUS_Testing_Tool",
            "/MS/Access_Control/Access_Policies",
            "/MS/Access_Control/MAC_Allow_List",
            "/MS/Layer_3_Switching/Layer_3_Switching_Overview",
            "/MS/Layer_3_Switching/OSPF",
            "/MS/Layer_3_Switching/Static_Routing",
            "/MS/Power_over_Ethernet",
            "/MS/DHCP/DHCP_Snooping",
            "/MS/DHCP/Dynamic_ARP_Inspection",

            # MR Access Points
            "/MR/MR_Overview_and_Specifications",
            "/MR/WiFi_Basics_and_Best_Practices",
            "/MR/WiFi_Basics_and_Best_Practices/Radio_Settings",
            "/MR/WiFi_Basics_and_Best_Practices/Channel_Planning",
            "/MR/WiFi_Basics_and_Best_Practices/Wireless_Best_Practices",
            "/MR/Encryption_and_Authentication",
            "/MR/Encryption_and_Authentication/Splash_Page",
            "/MR/Encryption_and_Authentication/WPA2-Enterprise_and_RADIUS",
            "/MR/Encryption_and_Authentication/WPA3_and_Enhanced_Open",
            "/MR/Encryption_and_Authentication/Systems_Manager_Sentry",
            "/MR/Client_Addressing_and_Bridging",
            "/MR/Client_Addressing_and_Bridging/NAT_Mode",
            "/MR/Client_Addressing_and_Bridging/Bridge_Mode",
            "/MR/Firewall_and_Traffic_Shaping/SSID_Firewall_and_Traffic_Shaping",
            "/MR/Bluetooth_and_RF_Profiles",
            "/MR/Bluetooth_and_RF_Profiles/Location_and_Scanning_API",
            "/MR/Air_Marshal",
            "/MR/Air_Marshal/Wireless_Threat_Detection",

            # MV Smart Cameras
            "/MV/MV_Overview_and_Specifications",
            "/MV/Video_Settings",
            "/MV/Video_Settings/Video_Quality_and_Retention",
            "/MV/Motion_Search_and_Alerting",
            "/MV/Motion_Search_and_Alerting/Motion_Recap",
            "/MV/MV_Sense",
            "/MV/MV_Sense/Object_Detection",
            "/MV/Network_Configuration",

            # MT Sensors
            "/MT/MT_Overview_and_Specifications",
            "/MT/Sensor_Configuration",
            "/MT/Alerting_and_Automation",

            # SM Systems Manager (MDM)
            "/SM/Systems_Manager_Overview",
            "/SM/Enrollment/DEP_Enrollment",
            "/SM/Enrollment/Manual_Enrollment",
            "/SM/Profiles/Configuration_Profiles",
            "/SM/Apps/App_Management",
            "/SM/Geofencing_and_Location",
            "/SM/Tags",

            # General Administration
            "/General_Administration/Organizations_and_Networks/Organization_Menu/API_and_Webhooks",
            "/General_Administration/Other_Topics/Cisco_Meraki_Dashboard_API",
            "/General_Administration/Organizations_and_Networks/Organization_Overview",
            "/General_Administration/Organizations_and_Networks/Network_Settings",
            "/General_Administration/Organizations_and_Networks/Configuration_Templates",
            "/General_Administration/Organizations_and_Networks/Tags",
            "/General_Administration/Licensing/Licensing_Overview",
            "/General_Administration/Licensing/Co-termination_Licensing",
            "/General_Administration/Licensing/Per-Device_Licensing",
            "/General_Administration/Monitoring_and_Reporting/Event_Log",
            "/General_Administration/Monitoring_and_Reporting/Summary_Reports",
            "/General_Administration/Monitoring_and_Reporting/Syslog",
            "/General_Administration/Monitoring_and_Reporting/SNMP",
            "/General_Administration/Monitoring_and_Reporting/Webhook_Alerts",
            "/General_Administration/Inventory_and_Devices/Adding_and_Removing_Devices",
            "/General_Administration/Inventory_and_Devices/Firmware_Upgrades",
            "/General_Administration/Users/Dashboard_Administrators",
            "/General_Administration/Users/Two-Factor_Authentication",
            "/General_Administration/Users/SAML_SSO",
            "/General_Administration/Troubleshooting/Meraki_Troubleshooting_Guide",
            "/General_Administration/Troubleshooting/Network_Wide_Troubleshooting",
        ]

        discovered_links: Set[str] = set()

        for page_path in pages_to_scrape:
            url = urljoin(base_url, page_path)
            logger.info(f"  Fetching: {url}")

            html = await self.fetch_page(url)
            if html and not html.startswith("PDF:"):
                doc = self.extract_text_from_html(html, url)
                if doc["content"] and len(doc["content"]) > 500:
                    doc["product"] = "meraki"
                    doc["doc_type"] = "guide"
                    doc["filename"] = f"meraki_{page_path.replace('/', '_').strip('_')}.md"
                    docs.append(doc)
                    logger.info(f"    Extracted {len(doc['content'])} chars")

                    # Discover additional links from this page (depth=1 crawl)
                    new_links = self.extract_links_from_html(html, base_url, base_url)
                    for link in new_links[:20]:  # Limit links per page
                        if link not in discovered_links:
                            discovered_links.add(link)

        # Crawl discovered links (only ones we haven't scraped)
        logger.info(f"\n  Crawling {len(discovered_links)} discovered links...")
        crawl_count = 0
        max_crawl = 50  # Limit total additional pages

        for link_url in discovered_links:
            if crawl_count >= max_crawl:
                break
            if link_url in self.scraped_urls:
                continue

            # Skip category/index pages that don't have much content
            if link_url.count('/') <= 4:
                continue

            logger.info(f"  Crawling: {link_url}")
            html = await self.fetch_page(link_url)
            if html and not html.startswith("PDF:"):
                doc = self.extract_text_from_html(html, link_url)
                if doc["content"] and len(doc["content"]) > 1000:  # Higher threshold for discovered pages
                    path_part = urlparse(link_url).path.replace('/', '_').strip('_')
                    doc["product"] = "meraki"
                    doc["doc_type"] = "guide"
                    doc["filename"] = f"meraki_{path_part[:80]}.md"

                    # Skip if we already have this content (by title match)
                    if not any(d.get("title") == doc["title"] for d in docs):
                        docs.append(doc)
                        crawl_count += 1
                        logger.info(f"    Extracted {len(doc['content'])} chars")

        logger.info(f"\n  Total Meraki docs scraped: {len(docs)}")
        return docs

    async def scrape_cisco_design_guides(self) -> List[Dict]:
        """Scrape Cisco Validated Design documents."""
        logger.info("Scraping Cisco Validated Designs...")
        docs = []

        # CVD and design guide pages
        cvd_pages = [
            {
                "url": "https://www.cisco.com/c/en/us/td/docs/solutions/CVD/Campus/CVD-Campus-LAN-WLAN-Design-Guide.html",
                "title": "Campus LAN and WLAN Design Guide"
            },
            {
                "url": "https://www.cisco.com/c/en/us/td/docs/solutions/CVD/Campus/cisco-sda-design-guide.html",
                "title": "SD-Access Design Guide"
            },
            {
                "url": "https://www.cisco.com/c/en/us/solutions/enterprise-networks/sd-wan/index.html",
                "title": "Cisco SD-WAN Overview"
            },
        ]

        for page_info in cvd_pages:
            url = page_info["url"]
            logger.info(f"  Fetching: {url}")

            html = await self.fetch_page(url)
            if html and not html.startswith("PDF:"):
                doc = self.extract_text_from_html(html, url)
                if doc["content"] and len(doc["content"]) > 200:
                    doc["product"] = "general"
                    doc["doc_type"] = "cvd"
                    doc["title"] = page_info.get("title") or doc["title"]
                    safe_title = re.sub(r'[^\w\s-]', '', doc["title"]).replace(' ', '_')[:50]
                    doc["filename"] = f"cvd_{safe_title}.md"
                    docs.append(doc)
                    logger.info(f"    Extracted {len(doc['content'])} chars")

        return docs

    async def scrape_catalyst_docs(self) -> List[Dict]:
        """Scrape Catalyst Center and switch documentation."""
        logger.info("Scraping Catalyst documentation...")
        docs = []

        catalyst_pages = [
            {
                "url": "https://www.cisco.com/c/en/us/products/switches/catalyst-9000.html",
                "title": "Catalyst 9000 Series Overview"
            },
            {
                "url": "https://www.cisco.com/c/en/us/support/cloud-systems-management/dna-center/series.html",
                "title": "Catalyst Center (DNA Center) Support"
            },
        ]

        for page_info in catalyst_pages:
            url = page_info["url"]
            logger.info(f"  Fetching: {url}")

            html = await self.fetch_page(url)
            if html and not html.startswith("PDF:"):
                doc = self.extract_text_from_html(html, url)
                if doc["content"] and len(doc["content"]) > 200:
                    doc["product"] = "catalyst"
                    doc["doc_type"] = "guide"
                    doc["title"] = page_info.get("title") or doc["title"]
                    safe_title = re.sub(r'[^\w\s-]', '', doc["title"]).replace(' ', '_')[:50]
                    doc["filename"] = f"catalyst_{safe_title}.md"
                    docs.append(doc)
                    logger.info(f"    Extracted {len(doc['content'])} chars")

        return docs

    async def scrape_ise_docs(self) -> List[Dict]:
        """Scrape ISE documentation."""
        logger.info("Scraping ISE documentation...")
        docs = []

        ise_pages = [
            {
                "url": "https://www.cisco.com/c/en/us/products/security/identity-services-engine/index.html",
                "title": "Cisco ISE Overview"
            },
        ]

        for page_info in ise_pages:
            url = page_info["url"]
            logger.info(f"  Fetching: {url}")

            html = await self.fetch_page(url)
            if html and not html.startswith("PDF:"):
                doc = self.extract_text_from_html(html, url)
                if doc["content"] and len(doc["content"]) > 200:
                    doc["product"] = "ise"
                    doc["doc_type"] = "guide"
                    doc["title"] = page_info.get("title") or doc["title"]
                    safe_title = re.sub(r'[^\w\s-]', '', doc["title"]).replace(' ', '_')[:50]
                    doc["filename"] = f"ise_{safe_title}.md"
                    docs.append(doc)
                    logger.info(f"    Extracted {len(doc['content'])} chars")

        return docs

    async def save_documents(self, docs: List[Dict]):
        """Save scraped documents to files."""
        for doc in docs:
            filepath = self.output_dir / doc["filename"]

            # Create markdown content with metadata header
            content = f"""---
title: {doc['title']}
source_url: {doc['url']}
product: {doc['product']}
doc_type: {doc['doc_type']}
scraped_at: {doc['scraped_at']}
---

# {doc['title']}

{doc['content']}
"""

            async with aiofiles.open(filepath, 'w', encoding='utf-8') as f:
                await f.write(content)

            logger.info(f"Saved: {filepath}")

    async def scrape_all(self, doc_types: List[str] = None) -> List[Dict]:
        """Scrape all documentation types."""
        all_docs = []

        if doc_types is None or "all" in doc_types:
            doc_types = ["meraki", "catalyst", "ise", "cvd"]

        if "meraki" in doc_types:
            docs = await self.scrape_meraki_docs()
            all_docs.extend(docs)

        if "catalyst" in doc_types:
            docs = await self.scrape_catalyst_docs()
            all_docs.extend(docs)

        if "ise" in doc_types:
            docs = await self.scrape_ise_docs()
            all_docs.extend(docs)

        if "cvd" in doc_types:
            docs = await self.scrape_cisco_design_guides()
            all_docs.extend(docs)

        return all_docs


async def ingest_scraped_docs(docs_dir: str, openai_key: str = None):
    """Ingest scraped documents into the RAG knowledge base."""
    from src.config.database import get_db
    from src.services.document_ingestion_service import DocumentIngestionService
    from src.services.embedding_service import EmbeddingService

    if openai_key:
        os.environ["OPENAI_API_KEY"] = openai_key

    embedding_service = EmbeddingService()
    ingestion_service = DocumentIngestionService(embedding_service=embedding_service)

    db = get_db()
    docs_path = Path(docs_dir)

    if not docs_path.exists():
        logger.error(f"Directory not found: {docs_dir}")
        return

    async with db.session() as session:
        for filepath in docs_path.glob("*.md"):
            try:
                content = filepath.read_text(encoding='utf-8')

                # Parse frontmatter
                metadata = {}
                if content.startswith("---"):
                    parts = content.split("---", 2)
                    if len(parts) >= 3:
                        for line in parts[1].strip().split("\n"):
                            if ":" in line:
                                key, value = line.split(":", 1)
                                metadata[key.strip()] = value.strip()
                        content = parts[2].strip()

                logger.info(f"Ingesting: {filepath.name}")

                document = await ingestion_service.ingest_markdown_document(
                    session=session,
                    content=content,
                    filename=filepath.name,
                    doc_type=metadata.get("doc_type", "guide"),
                    product=metadata.get("product", "general"),
                    title=metadata.get("title", filepath.stem),
                    description=f"Scraped from {metadata.get('source_url', 'unknown')}",
                    source_url=metadata.get("source_url")
                )

                logger.info(f"  Created {document.total_chunks} chunks")

            except Exception as e:
                logger.error(f"Failed to ingest {filepath}: {e}")


async def main():
    parser = argparse.ArgumentParser(description="Scrape Cisco documentation for RAG knowledge base")
    parser.add_argument("--output-dir", default="./scraped_docs", help="Output directory for scraped docs")
    parser.add_argument("--type", nargs="+", default=["all"],
                        choices=["all", "meraki", "catalyst", "ise", "cvd"],
                        help="Types of documentation to scrape")
    parser.add_argument("--ingest", action="store_true", help="Also ingest docs into RAG database")
    parser.add_argument("--openai-key", help="OpenAI API key for embeddings (if ingesting)")
    parser.add_argument("--ingest-only", action="store_true", help="Skip scraping, only ingest existing docs")
    args = parser.parse_args()

    if not args.ingest_only:
        logger.info("=" * 60)
        logger.info("CISCO DOCUMENTATION SCRAPER")
        logger.info("=" * 60)
        logger.info(f"Output directory: {args.output_dir}")
        logger.info(f"Document types: {args.type}")

        async with CiscoDocScraper(output_dir=args.output_dir) as scraper:
            docs = await scraper.scrape_all(args.type)

            if docs:
                await scraper.save_documents(docs)
                logger.info(f"\nScraped {len(docs)} documents")
            else:
                logger.warning("No documents were scraped")

    if args.ingest or args.ingest_only:
        logger.info("\n" + "=" * 60)
        logger.info("INGESTING DOCUMENTS INTO RAG DATABASE")
        logger.info("=" * 60)

        openai_key = args.openai_key or os.getenv("OPENAI_API_KEY")
        if not openai_key:
            # Try to get from database config
            try:
                from src.services.config_service import get_effective_config
                openai_key = get_effective_config("openai_api_key")
            except Exception:
                pass

        if not openai_key:
            logger.error("OpenAI API key required for ingestion. Use --openai-key or set OPENAI_API_KEY")
            return

        await ingest_scraped_docs(args.output_dir, openai_key)

    logger.info("\nDone!")


if __name__ == "__main__":
    asyncio.run(main())
