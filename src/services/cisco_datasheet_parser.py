"""Cisco Datasheet Parser for RAG ingestion.

Specialized parser for Cisco product datasheets that:
- Extracts and converts HTML tables to structured, semantic text
- Preserves hierarchical context (section headers with table data)
- Handles specification tables, feature tables, ordering info
- Produces chunks optimized for RAG retrieval

Cisco datasheets typically contain:
1. Product overview/highlights (prose)
2. Feature tables (feature name + description)
3. Specification tables (spec name + values per model)
4. Ordering information (SKUs, licensing)
5. Environmental/physical specs
"""

import logging
import re
from dataclasses import dataclass, field
from typing import List, Optional, Tuple, Dict, Any
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# Try to import BeautifulSoup
try:
    from bs4 import BeautifulSoup, Tag
    BS4_AVAILABLE = True
except ImportError:
    BS4_AVAILABLE = False
    # Create stub types for type hints when bs4 is not installed
    BeautifulSoup = Any  # type: ignore
    Tag = Any  # type: ignore
    logger.warning("BeautifulSoup not available - datasheet parsing will be limited")


@dataclass
class ParsedTable:
    """A parsed table with structured data."""
    section_header: str  # Parent section/heading
    table_title: Optional[str]  # Caption or nearby heading
    headers: List[str]  # Column headers
    rows: List[List[str]]  # Data rows
    table_type: str  # spec, feature, ordering, environmental, general
    product_context: Optional[str] = None  # Which product(s) this applies to


@dataclass
class DatasheetSection:
    """A section of the datasheet with prose and/or tables."""
    heading: str
    level: int  # 1 = h1, 2 = h2, etc.
    prose_content: str
    tables: List[ParsedTable] = field(default_factory=list)


@dataclass
class ParsedDatasheet:
    """Complete parsed datasheet."""
    title: str
    product_name: str
    product_family: str
    sections: List[DatasheetSection]
    metadata: Dict[str, Any] = field(default_factory=dict)


class CiscoDatasheetParser:
    """Parser for Cisco product datasheets."""

    # Table type detection patterns
    TABLE_TYPE_PATTERNS = {
        'spec': [
            r'specification', r'technical\s+spec', r'dimensions',
            r'weight', r'power', r'environmental', r'physical',
            r'operating\s+temp', r'capacity', r'throughput', r'performance'
        ],
        'feature': [
            r'feature', r'capability', r'function', r'benefit',
            r'support', r'highlights', r'key\s+attributes'
        ],
        'ordering': [
            r'ordering', r'part\s+number', r'sku', r'license',
            r'software\s+option', r'pricing', r'product\s+id'
        ],
        'environmental': [
            r'environmental', r'temperature', r'humidity',
            r'altitude', r'acoustic', r'noise', r'mtbf'
        ],
        'port': [
            r'port', r'interface', r'uplink', r'downlink',
            r'connector', r'sfp', r'ethernet', r'poe'
        ],
    }

    # Product family detection
    PRODUCT_FAMILIES = {
        'catalyst_9200': [r'catalyst\s*9200', r'c9200', r'cat\s*9200'],
        'catalyst_9300': [r'catalyst\s*9300', r'c9300', r'cat\s*9300'],
        'catalyst_9400': [r'catalyst\s*9400', r'c9400', r'cat\s*9400'],
        'catalyst_9500': [r'catalyst\s*9500', r'c9500', r'cat\s*9500'],
        'catalyst_9600': [r'catalyst\s*9600', r'c9600', r'cat\s*9600'],
        'meraki_mx': [r'meraki\s*mx', r'\bmx\s*\d+'],
        'meraki_ms': [r'meraki\s*ms', r'\bms\s*\d+'],
        'meraki_mr': [r'meraki\s*mr', r'\bmr\s*\d+'],
    }

    def __init__(self):
        self._compiled_table_patterns = {
            ttype: [re.compile(p, re.I) for p in patterns]
            for ttype, patterns in self.TABLE_TYPE_PATTERNS.items()
        }
        self._compiled_product_patterns = {
            family: [re.compile(p, re.I) for p in patterns]
            for family, patterns in self.PRODUCT_FAMILIES.items()
        }

    def is_datasheet_url(self, url: str) -> bool:
        """Check if a URL appears to be a Cisco datasheet.

        Args:
            url: URL to check.

        Returns:
            True if likely a datasheet URL.
        """
        url_lower = url.lower()
        datasheet_patterns = [
            r'data-?sheet',
            r'/collateral/',
            r'/dam/.*\.pdf',
            r'nb-\d+-.*-cte-en',  # Common Cisco datasheet naming
            r'product.*sheet',
        ]
        return any(re.search(p, url_lower) for p in datasheet_patterns)

    def detect_product_family(self, text: str) -> Tuple[str, str]:
        """Detect the product family from text.

        Args:
            text: Text to analyze (title, content).

        Returns:
            Tuple of (product_family, product_name).
        """
        text_lower = text.lower()

        for family, patterns in self._compiled_product_patterns.items():
            for pattern in patterns:
                match = pattern.search(text_lower)
                if match:
                    # Extract the matched product name
                    product_name = match.group(0).strip()
                    return family, product_name

        return 'unknown', 'Cisco Product'

    def detect_table_type(self, context: str, headers: List[str]) -> str:
        """Detect the type of table based on context and headers.

        Args:
            context: Surrounding text (section header, caption).
            headers: Table column headers.

        Returns:
            Table type string.
        """
        combined = f"{context} {' '.join(headers)}".lower()

        for table_type, patterns in self._compiled_table_patterns.items():
            for pattern in patterns:
                if pattern.search(combined):
                    return table_type

        return 'general'

    def parse_html(self, html: str, source_url: Optional[str] = None) -> ParsedDatasheet:
        """Parse a Cisco datasheet HTML page.

        Args:
            html: Raw HTML content.
            source_url: Original URL for context.

        Returns:
            ParsedDatasheet with structured content.
        """
        if not BS4_AVAILABLE:
            raise ImportError("BeautifulSoup is required for datasheet parsing")

        soup = BeautifulSoup(html, 'html.parser')

        # Extract title
        title = self._extract_title(soup)

        # Detect product family
        product_family, product_name = self.detect_product_family(title)

        # Remove non-content elements
        for tag in soup.find_all(['script', 'style', 'nav', 'footer', 'header', 'aside', 'noscript', 'iframe']):
            tag.decompose()

        # Find main content area
        main_content = (
            soup.find('main') or
            soup.find('article') or
            soup.find(class_=re.compile(r'content|main|article', re.I)) or
            soup.find('body') or
            soup
        )

        # Parse sections with their tables
        sections = self._parse_sections(main_content, product_name)

        return ParsedDatasheet(
            title=title,
            product_name=product_name,
            product_family=product_family,
            sections=sections,
            metadata={
                'source_url': source_url,
                'table_count': sum(len(s.tables) for s in sections),
                'section_count': len(sections),
            }
        )

    def _extract_title(self, soup: BeautifulSoup) -> str:
        """Extract the document title."""
        # Try various title sources
        title_sources = [
            soup.find('h1'),
            soup.find('title'),
            soup.find(class_=re.compile(r'title|heading', re.I)),
        ]

        for source in title_sources:
            if source:
                title = source.get_text(strip=True)
                if title and len(title) > 5:
                    # Clean up common suffixes
                    title = re.sub(r'\s*[-|]\s*Cisco\s*$', '', title, flags=re.I)
                    return title

        return 'Cisco Product Datasheet'

    def _parse_sections(self, content, product_name: str) -> List[DatasheetSection]:
        """Parse content into sections with prose and tables."""
        sections = []
        current_section = DatasheetSection(
            heading='Overview',
            level=1,
            prose_content='',
            tables=[]
        )

        # Track the current heading context
        current_heading = 'Overview'
        current_level = 1

        def process_element(element):
            nonlocal current_section, current_heading, current_level

            if not hasattr(element, 'name') or element.name is None:
                return

            tag_name = element.name

            # Handle headings - start new section
            if tag_name in ['h1', 'h2', 'h3', 'h4']:
                heading_text = element.get_text(strip=True)
                if heading_text and len(heading_text) > 2:
                    # Save current section if it has content
                    if current_section.prose_content.strip() or current_section.tables:
                        sections.append(current_section)

                    level = int(tag_name[1])
                    current_heading = heading_text
                    current_level = level
                    current_section = DatasheetSection(
                        heading=heading_text,
                        level=level,
                        prose_content='',
                        tables=[]
                    )
                return

            # Handle tables
            if tag_name == 'table':
                parsed_table = self._parse_table(element, current_heading, product_name)
                if parsed_table:
                    current_section.tables.append(parsed_table)
                return

            # Handle paragraphs and other text
            if tag_name in ['p', 'li', 'span', 'div']:
                text = element.get_text(strip=True)
                if text and len(text) > 10:
                    # Check if this div contains actual content (not nested structure)
                    if tag_name == 'div' and element.find(['div', 'table', 'p']):
                        # Process children instead
                        for child in element.children:
                            process_element(child)
                    else:
                        current_section.prose_content += f"\n{text}"
                return

            # Recursively process children for container elements
            if tag_name in ['div', 'section', 'article', 'main', 'body']:
                for child in element.children:
                    process_element(child)

        # Process all elements
        for child in content.children:
            process_element(child)

        # Add final section
        if current_section.prose_content.strip() or current_section.tables:
            sections.append(current_section)

        return sections

    def _parse_table(self, table_element, section_header: str, product_name: str) -> Optional[ParsedTable]:
        """Parse an HTML table into structured data."""
        rows = table_element.find_all('tr')
        if not rows:
            return None

        # Extract headers from first row with th elements, or first row
        headers = []
        header_row = table_element.find('thead')
        if header_row:
            header_cells = header_row.find_all(['th', 'td'])
            headers = [cell.get_text(strip=True) for cell in header_cells]
        else:
            # Try first row
            first_row = rows[0]
            header_cells = first_row.find_all(['th', 'td'])
            if first_row.find('th'):
                headers = [cell.get_text(strip=True) for cell in header_cells]
                rows = rows[1:]  # Skip header row for data

        if not headers:
            # Generate generic headers
            first_data_row = rows[0] if rows else None
            if first_data_row:
                num_cols = len(first_data_row.find_all(['th', 'td']))
                headers = [f'Column {i+1}' for i in range(num_cols)]

        # Extract data rows
        data_rows = []
        for row in rows:
            cells = row.find_all(['td', 'th'])
            if cells:
                row_data = [cell.get_text(strip=True) for cell in cells]
                # Skip empty rows
                if any(cell.strip() for cell in row_data):
                    data_rows.append(row_data)

        if not data_rows:
            return None

        # Check for caption or nearby title
        caption = table_element.find('caption')
        table_title = caption.get_text(strip=True) if caption else None

        # Detect table type
        table_type = self.detect_table_type(
            f"{section_header} {table_title or ''}",
            headers
        )

        return ParsedTable(
            section_header=section_header,
            table_title=table_title,
            headers=headers,
            rows=data_rows,
            table_type=table_type,
            product_context=product_name,
        )

    def convert_to_semantic_text(self, datasheet: ParsedDatasheet) -> str:
        """Convert parsed datasheet to semantic, readable text.

        This produces text optimized for RAG retrieval by:
        - Converting tables to key-value prose
        - Adding context headers to each section
        - Structuring specifications clearly

        Args:
            datasheet: Parsed datasheet data.

        Returns:
            Formatted text content.
        """
        lines = []

        # Document header
        lines.append(f"# {datasheet.title}")
        lines.append(f"\n**Product:** {datasheet.product_name}")
        lines.append(f"**Product Family:** {datasheet.product_family}")
        lines.append("")

        for section in datasheet.sections:
            # Section header
            header_prefix = '#' * min(section.level + 1, 4)
            lines.append(f"\n{header_prefix} {section.heading}\n")

            # Prose content
            if section.prose_content.strip():
                lines.append(section.prose_content.strip())
                lines.append("")

            # Tables converted to semantic text
            for table in section.tables:
                table_text = self._table_to_semantic_text(table)
                if table_text:
                    lines.append(table_text)
                    lines.append("")

        return "\n".join(lines)

    def _table_to_semantic_text(self, table: ParsedTable) -> str:
        """Convert a table to semantic, readable text.

        Different strategies based on table type:
        - Specifications: "The [Model] has [Spec]: [Value]"
        - Features: "[Feature]: [Description]"
        - Ordering: "Part number [SKU] is [Description]"
        """
        lines = []

        if table.table_title:
            lines.append(f"**{table.table_title}**")
            lines.append("")

        headers = table.headers
        num_cols = len(headers) if headers else 0

        # Determine conversion strategy based on table type and structure
        if table.table_type == 'spec' and num_cols > 2:
            # Multi-model specification table
            # First column is spec name, rest are model values
            lines.append(f"Specifications for {table.product_context}:")
            lines.append("")

            for row in table.rows:
                if len(row) < 2:
                    continue
                spec_name = row[0]
                if not spec_name.strip():
                    continue

                # For multi-model tables, create entries per model
                for i, value in enumerate(row[1:], 1):
                    if i < len(headers) and value.strip():
                        model = headers[i] if i < len(headers) else f"Model {i}"
                        lines.append(f"- **{spec_name}** ({model}): {value}")

        elif table.table_type == 'spec' and num_cols == 2:
            # Simple two-column spec table
            lines.append(f"Specifications:")
            lines.append("")
            for row in table.rows:
                if len(row) >= 2 and row[0].strip():
                    lines.append(f"- **{row[0]}**: {row[1]}")

        elif table.table_type == 'feature':
            # Feature table
            lines.append(f"Features and Capabilities:")
            lines.append("")
            for row in table.rows:
                if len(row) >= 1 and row[0].strip():
                    feature = row[0]
                    description = row[1] if len(row) > 1 else ''
                    if description:
                        lines.append(f"- **{feature}**: {description}")
                    else:
                        lines.append(f"- {feature}")

        elif table.table_type == 'ordering':
            # Ordering information
            lines.append(f"Ordering Information:")
            lines.append("")
            for row in table.rows:
                if len(row) >= 2 and row[0].strip():
                    part_num = row[0]
                    description = ' - '.join(c for c in row[1:] if c.strip())
                    lines.append(f"- Part Number **{part_num}**: {description}")

        elif table.table_type == 'port' or table.table_type == 'environmental':
            # Port/interface or environmental specs
            category = 'Port/Interface' if table.table_type == 'port' else 'Environmental'
            lines.append(f"{category} Specifications:")
            lines.append("")
            for row in table.rows:
                if len(row) >= 1 and row[0].strip():
                    spec = row[0]
                    values = ', '.join(c for c in row[1:] if c.strip())
                    if values:
                        lines.append(f"- **{spec}**: {values}")
                    else:
                        lines.append(f"- {spec}")

        else:
            # Generic table handling
            if table.section_header:
                lines.append(f"{table.section_header} details:")
                lines.append("")

            # Use headers as template if available
            for row in table.rows:
                if len(row) >= 1:
                    if headers and len(headers) == len(row):
                        # Create key-value pairs from headers and values
                        pairs = [f"{h}: {v}" for h, v in zip(headers, row) if v.strip()]
                        if pairs:
                            lines.append(f"- {'; '.join(pairs)}")
                    else:
                        # Just join the values
                        content = ' | '.join(c for c in row if c.strip())
                        if content:
                            lines.append(f"- {content}")

        return "\n".join(lines)

    def create_chunks(
        self,
        datasheet: ParsedDatasheet,
        max_chunk_size: int = 800,
    ) -> List[Dict[str, Any]]:
        """Create optimized chunks from parsed datasheet.

        Creates chunks that:
        - Keep related specifications together
        - Include context (product name, section) in each chunk
        - Don't split tables across chunks

        Args:
            datasheet: Parsed datasheet.
            max_chunk_size: Maximum tokens per chunk (approximate).

        Returns:
            List of chunk dictionaries ready for ingestion.
        """
        chunks = []
        chunk_index = 0

        # Create header chunk with overview
        header_chunk = f"""# {datasheet.title}

**Product:** {datasheet.product_name}
**Product Family:** {datasheet.product_family.replace('_', ' ').title()}

This is the official Cisco datasheet for the {datasheet.product_name}.
"""
        # Find overview section
        for section in datasheet.sections:
            if 'overview' in section.heading.lower() or section.level == 1:
                if section.prose_content.strip():
                    header_chunk += f"\n{section.prose_content.strip()}"
                break

        chunks.append({
            'chunk_index': chunk_index,
            'content': header_chunk,
            'tokens': len(header_chunk.split()),  # Approximate
            'metadata': {
                'section': 'Overview',
                'content_type': 'datasheet_overview',
                'product': datasheet.product_name,
                'product_family': datasheet.product_family,
            },
            'hierarchy_level': 0,  # Top-level
        })
        chunk_index += 1

        # Process each section
        for section in datasheet.sections:
            if 'overview' in section.heading.lower():
                continue  # Already handled

            # Create chunk for prose content if substantial
            if section.prose_content.strip() and len(section.prose_content.strip()) > 100:
                prose_chunk = f"""## {section.heading}

{section.prose_content.strip()}

(From {datasheet.product_name} Datasheet)
"""
                chunks.append({
                    'chunk_index': chunk_index,
                    'content': prose_chunk,
                    'tokens': len(prose_chunk.split()),
                    'metadata': {
                        'section': section.heading,
                        'content_type': 'datasheet_prose',
                        'product': datasheet.product_name,
                    },
                    'hierarchy_level': 1,
                    'parent_index': 0,
                })
                chunk_index += 1

            # Create chunks for each table
            for table in section.tables:
                table_text = self._table_to_semantic_text(table)
                if not table_text.strip():
                    continue

                # Add context to table chunk
                table_chunk = f"""## {section.heading}: {table.table_title or table.table_type.replace('_', ' ').title()}

{table_text}

(From {datasheet.product_name} Datasheet - {section.heading})
"""
                chunks.append({
                    'chunk_index': chunk_index,
                    'content': table_chunk,
                    'tokens': len(table_chunk.split()),
                    'metadata': {
                        'section': section.heading,
                        'table_type': table.table_type,
                        'content_type': 'datasheet_table',
                        'product': datasheet.product_name,
                    },
                    'hierarchy_level': 1,
                    'parent_index': 0,
                })
                chunk_index += 1

        return chunks


# =============================================================================
# Singleton
# =============================================================================

_parser: Optional[CiscoDatasheetParser] = None


def get_datasheet_parser() -> CiscoDatasheetParser:
    """Get or create singleton datasheet parser."""
    global _parser
    if _parser is None:
        _parser = CiscoDatasheetParser()
    return _parser
