"""Smart Chunker with multiple chunking strategies.

Provides semantic-aware chunking that respects document structure:
- Markdown: Header-based chunking preserving hierarchy
- API Specs: Endpoint-based chunking
- Runbooks: Procedure-based chunking
- Default: Semantic similarity-based chunking
"""

import re
import logging
from typing import List, Optional, Tuple, Any
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class Chunk:
    """A chunk of text with metadata.

    Attributes:
        content: The chunk text content.
        index: Sequential index within the document.
        metadata: Additional metadata (headers, section, etc.).
        token_count: Estimated token count.
        hierarchy_level: Hierarchy level for parent-child relationships:
            0 = Section level (h1/h2 headers)
            1 = Subsection level (h3/h4 headers)
            2 = Paragraph level (content under headers)
        parent_index: Index of the parent chunk (for building relationships during ingestion).
    """
    content: str
    index: int
    metadata: dict = field(default_factory=dict)
    token_count: Optional[int] = None
    hierarchy_level: int = 2  # Default to paragraph level
    parent_index: Optional[int] = None  # Index of parent chunk (resolved during ingestion)

    def __post_init__(self):
        # Estimate token count if not provided (rough estimate: ~4 chars per token)
        if self.token_count is None:
            self.token_count = len(self.content) // 4


class SmartChunker:
    """Semantic-aware chunking with multiple strategies.

    Selects the appropriate chunking strategy based on document type
    and content structure.
    """

    def __init__(
        self,
        max_chunk_tokens: int = 500,
        min_chunk_tokens: int = 100,
        overlap_tokens: int = 50,
    ):
        self.max_chunk_tokens = max_chunk_tokens
        self.min_chunk_tokens = min_chunk_tokens
        self.overlap_tokens = overlap_tokens

    def chunk_document(
        self,
        content: str,
        doc_type: str,
        filename: Optional[str] = None,
    ) -> List[Chunk]:
        """Chunk a document using the appropriate strategy.

        Args:
            content: Document content
            doc_type: Document type (markdown, api_spec, runbook, guide, etc.)
            filename: Optional filename for additional context

        Returns:
            List of Chunk objects
        """
        if not content or not content.strip():
            return []

        # Select strategy based on document type
        if doc_type == "api_spec" or (filename and filename.endswith(".json")):
            return self._chunk_by_endpoint(content)
        elif doc_type == "markdown" or (filename and filename.endswith(".md")):
            return self._chunk_by_headers(content)
        elif doc_type == "runbook":
            return self._chunk_by_procedure(content)
        elif doc_type == "cli_reference":
            return self._chunk_by_command(content)
        elif doc_type == "datasheet" or (filename and "datasheet" in filename.lower()):
            return self._chunk_by_page(content)
        else:
            return self._chunk_by_semantic_similarity(content)

    def _chunk_by_headers(self, content: str) -> List[Chunk]:
        """Chunk markdown content by headers, preserving hierarchy.

        Creates a hierarchical chunk structure:
        - Level 0 (Section): h1/h2 headers - act as parent chunks
        - Level 1 (Subsection): h3/h4 headers - can be parents or children
        - Level 2 (Paragraph): Content chunks under headers

        This enables parent-child retrieval where paragraph chunks
        can reference their parent section for additional context.
        """
        chunks: List[Chunk] = []

        # Split by headers while preserving them
        header_pattern = r'^(#{1,6})\s+(.+)$'
        lines = content.split('\n')

        # Track the current section hierarchy
        current_h1 = ""
        current_h2 = ""
        current_h3 = ""
        current_section: List[str] = []

        # Track parent indices for hierarchy
        # section_parent_idx tracks the index of the current section-level chunk
        section_parent_idx: Optional[int] = None
        subsection_parent_idx: Optional[int] = None

        # Buffer for small sections that need to be merged
        pending_small_section: Optional[Tuple[List[str], dict, int, Optional[int]]] = None

        def save_section(section_lines: List[str], metadata: dict,
                        hierarchy_level: int, parent_idx: Optional[int]) -> None:
            """Helper to save a section as one or more chunks."""
            nonlocal pending_small_section

            chunk_content = '\n'.join(section_lines).strip()
            if not chunk_content:
                return

            # Skip sections that are just headers with no real content
            # Remove markdown headers and check what's left
            content_without_headers = re.sub(r'^#{1,6}\s+.*$', '', chunk_content, flags=re.MULTILINE).strip()
            if len(content_without_headers) < 50:
                # This is just a header or near-empty section
                # Store it to merge with next section
                if pending_small_section:
                    # Merge with existing pending
                    old_lines, old_meta, old_level, old_parent = pending_small_section
                    pending_small_section = (old_lines + [''] + section_lines, metadata, hierarchy_level, parent_idx)
                else:
                    pending_small_section = (section_lines, metadata, hierarchy_level, parent_idx)
                return

            # If we have a pending small section, prepend it
            if pending_small_section:
                old_lines, old_meta, old_level, old_parent = pending_small_section
                section_lines = old_lines + [''] + section_lines
                chunk_content = '\n'.join(section_lines).strip()
                pending_small_section = None

            # Check if we need to split this section
            estimated_tokens = len(chunk_content) // 4

            # Enforce minimum chunk size - if too small, buffer it
            if estimated_tokens < self.min_chunk_tokens:
                if pending_small_section:
                    old_lines, old_meta, old_level, old_parent = pending_small_section
                    pending_small_section = (old_lines + [''] + section_lines, metadata, hierarchy_level, parent_idx)
                else:
                    pending_small_section = (section_lines, metadata, hierarchy_level, parent_idx)
                return

            if estimated_tokens <= self.max_chunk_tokens:
                # Single chunk
                chunks.append(Chunk(
                    content=chunk_content,
                    index=len(chunks),
                    metadata=metadata.copy(),
                    token_count=estimated_tokens,
                    hierarchy_level=hierarchy_level,
                    parent_index=parent_idx,
                ))
            else:
                # Split into multiple chunks, all with same hierarchy level
                split_chunks = self._split_large_section(chunk_content, metadata)
                for sc in split_chunks:
                    # Only add if chunk is large enough
                    if sc.token_count >= self.min_chunk_tokens:
                        chunks.append(Chunk(
                            content=sc.content,
                            index=len(chunks),
                            metadata=sc.metadata,
                            token_count=sc.token_count,
                            hierarchy_level=hierarchy_level,
                            parent_index=parent_idx,
                        ))

        for i, line in enumerate(lines):
            match = re.match(header_pattern, line)

            if match:
                hashes, title = match.groups()
                level = len(hashes)

                if level == 1:
                    # Save previous section if exists
                    if current_section:
                        # Determine hierarchy level based on what header we had
                        if current_h3:
                            hier_level = 1  # Subsection
                            parent = section_parent_idx
                        elif current_h2 or current_h1:
                            hier_level = 0  # Section
                            parent = None
                        else:
                            hier_level = 2  # Paragraph
                            parent = subsection_parent_idx or section_parent_idx

                        save_section(
                            current_section,
                            {"h1": current_h1, "h2": current_h2, "h3": current_h3},
                            hier_level,
                            parent
                        )

                    current_h1 = title
                    current_h2 = ""
                    current_h3 = ""
                    current_section = [line]
                    # This will become a section-level parent
                    section_parent_idx = len(chunks)
                    subsection_parent_idx = None

                elif level == 2:
                    # Save previous section
                    if current_section:
                        if current_h3:
                            hier_level = 1
                            parent = section_parent_idx
                        elif current_h2 or current_h1:
                            hier_level = 0
                            parent = None
                        else:
                            hier_level = 2
                            parent = subsection_parent_idx or section_parent_idx

                        save_section(
                            current_section,
                            {"h1": current_h1, "h2": current_h2, "h3": current_h3},
                            hier_level,
                            parent
                        )

                    current_h2 = title
                    current_h3 = ""
                    # Include h1 context if available
                    if current_h1:
                        current_section = [f"# {current_h1}", "", line]
                    else:
                        current_section = [line]
                    # This becomes the new section parent
                    section_parent_idx = len(chunks)
                    subsection_parent_idx = None

                elif level in (3, 4):
                    # h3/h4 creates subsection level chunks
                    if current_section:
                        if current_h3:
                            hier_level = 1
                            parent = section_parent_idx
                        elif current_h2 or current_h1:
                            hier_level = 0
                            parent = None
                        else:
                            hier_level = 2
                            parent = subsection_parent_idx or section_parent_idx

                        save_section(
                            current_section,
                            {"h1": current_h1, "h2": current_h2, "h3": current_h3},
                            hier_level,
                            parent
                        )

                    current_h3 = title
                    current_section = [line]
                    # This becomes a subsection parent (children will be paragraphs under it)
                    subsection_parent_idx = len(chunks)

                else:
                    # h5/h6 stay in current section as content
                    current_section.append(line)
            else:
                current_section.append(line)

        # Don't forget the last section
        if current_section:
            if current_h3:
                hier_level = 1
                parent = section_parent_idx
            elif current_h2 or current_h1:
                hier_level = 0
                parent = None
            else:
                hier_level = 2
                parent = subsection_parent_idx or section_parent_idx

            save_section(
                current_section,
                {"h1": current_h1, "h2": current_h2, "h3": current_h3},
                hier_level,
                parent
            )

        # Flush any remaining pending small section
        # (force add it even if small - it's the last content)
        if pending_small_section:
            old_lines, old_meta, old_level, old_parent = pending_small_section
            chunk_content = '\n'.join(old_lines).strip()
            estimated_tokens = len(chunk_content) // 4
            # Only add if it has some meaningful content (at least 50 tokens)
            if estimated_tokens >= 50:
                chunks.append(Chunk(
                    content=chunk_content,
                    index=len(chunks),
                    metadata=old_meta,
                    token_count=estimated_tokens,
                    hierarchy_level=old_level,
                    parent_index=old_parent,
                ))

        return chunks

    def _chunk_by_endpoint(self, content: str) -> List[Chunk]:
        """Chunk OpenAPI/Swagger specs by endpoint.

        Each endpoint (path + method) becomes its own chunk with
        full context about parameters, responses, and description.
        """
        import json

        try:
            spec = json.loads(content)
        except json.JSONDecodeError:
            logger.warning("Failed to parse API spec as JSON, falling back to text chunking")
            return self._chunk_by_semantic_similarity(content)

        chunks = []

        # Extract API info for context
        api_title = spec.get("info", {}).get("title", "API")
        api_version = spec.get("info", {}).get("version", "")
        base_path = spec.get("basePath", "") or spec.get("servers", [{}])[0].get("url", "")

        # Process each path
        paths = spec.get("paths", {})

        for path, methods in paths.items():
            if not isinstance(methods, dict):
                continue

            for method, details in methods.items():
                if method.startswith("x-") or not isinstance(details, dict):
                    continue

                # Build endpoint chunk
                endpoint_content = self._format_endpoint(
                    path=path,
                    method=method.upper(),
                    details=details,
                    api_title=api_title,
                    base_path=base_path
                )

                chunks.append(Chunk(
                    content=endpoint_content,
                    index=len(chunks),
                    metadata={
                        "api_title": api_title,
                        "api_version": api_version,
                        "path": path,
                        "method": method.upper(),
                        "operation_id": details.get("operationId", ""),
                        "tags": details.get("tags", []),
                    }
                ))

        # If no paths found, chunk the whole spec as text
        if not chunks:
            return self._chunk_by_semantic_similarity(content)

        return chunks

    def _format_endpoint(
        self,
        path: str,
        method: str,
        details: dict,
        api_title: str,
        base_path: str,
    ) -> str:
        """Format an API endpoint as readable text."""
        lines = [
            f"# {api_title}",
            f"## {method} {path}",
            "",
        ]

        # Summary and description
        if details.get("summary"):
            lines.append(f"**Summary:** {details['summary']}")
        if details.get("description"):
            lines.append(f"\n{details['description']}")

        lines.append("")

        # Parameters
        params = details.get("parameters", [])
        if params:
            lines.append("### Parameters")
            for param in params:
                param_in = param.get("in", "query")
                required = "required" if param.get("required") else "optional"
                param_type = param.get("schema", {}).get("type", param.get("type", "string"))
                lines.append(f"- `{param.get('name')}` ({param_in}, {param_type}, {required}): {param.get('description', '')}")
            lines.append("")

        # Request body
        request_body = details.get("requestBody", {})
        if request_body:
            lines.append("### Request Body")
            rb_content = request_body.get("content", {})
            for content_type, schema_info in rb_content.items():
                lines.append(f"Content-Type: `{content_type}`")
                if schema_info.get("schema"):
                    lines.append(f"```json\n{json.dumps(schema_info['schema'], indent=2)}\n```")
            lines.append("")

        # Responses
        responses = details.get("responses", {})
        if responses:
            lines.append("### Responses")
            for code, resp in responses.items():
                desc = resp.get("description", "") if isinstance(resp, dict) else str(resp)
                lines.append(f"- **{code}**: {desc}")
            lines.append("")

        return '\n'.join(lines)

    def _chunk_by_procedure(self, content: str) -> List[Chunk]:
        """Chunk runbooks/procedures by numbered steps or sections.

        Keeps related steps together while respecting size limits.
        """
        chunks = []

        # Pattern for procedure steps
        step_patterns = [
            r'^(?:Step\s+)?(\d+)[.)]\s+',  # "Step 1." or "1." or "1)"
            r'^[-*]\s+',  # Bullet points
            r'^(?:Phase|Stage)\s+\d+',  # "Phase 1"
        ]

        # First, try to split by major sections (Prerequisites, Steps, Verification, etc.)
        section_pattern = r'^(?:##?\s*)?(Prerequisites?|Overview|Steps?|Procedure|Verification|Troubleshooting|Rollback|Notes?):?\s*$'

        sections = re.split(section_pattern, content, flags=re.IGNORECASE | re.MULTILINE)

        if len(sections) > 1:
            # We have section headers
            current_section = ""
            for i, part in enumerate(sections):
                if re.match(section_pattern, part, re.IGNORECASE):
                    current_section = part.strip()
                elif part.strip():
                    section_content = f"## {current_section}\n\n{part.strip()}" if current_section else part.strip()
                    chunks.extend(self._split_large_section(
                        section_content,
                        {"section": current_section}
                    ))
        else:
            # No clear sections, split by step patterns
            chunks.extend(self._split_large_section(content, {"type": "procedure"}))

        return [
            Chunk(content=c.content, index=i, metadata=c.metadata, token_count=c.token_count)
            for i, c in enumerate(chunks)
        ]

    def _chunk_by_command(self, content: str) -> List[Chunk]:
        """Chunk CLI reference by command.

        Each command with its syntax, description, and examples
        becomes a separate chunk.
        """
        chunks = []

        # Common patterns for CLI documentation
        command_pattern = r'^(?:###?\s+)?(?:Command:\s*)?`?([a-z][a-z0-9_-]+(?:\s+[a-z0-9_-]+)*)`?\s*$'

        lines = content.split('\n')
        current_command = ""
        current_content: List[str] = []

        for line in lines:
            # Check if this looks like a new command header
            cmd_match = re.match(command_pattern, line, re.IGNORECASE)

            if cmd_match or (line.startswith('## ') and 'command' in line.lower()):
                # Save previous command
                if current_content:
                    chunk_content = '\n'.join(current_content).strip()
                    if chunk_content:
                        chunks.append(Chunk(
                            content=chunk_content,
                            index=len(chunks),
                            metadata={"command": current_command}
                        ))

                current_command = cmd_match.group(1) if cmd_match else line.replace('## ', '')
                current_content = [line]
            else:
                current_content.append(line)

        # Last command
        if current_content:
            chunk_content = '\n'.join(current_content).strip()
            if chunk_content:
                chunks.append(Chunk(
                    content=chunk_content,
                    index=len(chunks),
                    metadata={"command": current_command}
                ))

        # If no commands found, fall back to semantic chunking
        if not chunks:
            return self._chunk_by_semantic_similarity(content)

        return chunks

    def _chunk_by_page(self, content: str) -> List[Chunk]:
        """Chunk content by page markers for PDF datasheets.

        PDFs extracted with pypdf include [Page N] markers.
        Each page becomes its own chunk to preserve datasheet structure.
        Large pages are split while preserving page context.
        """
        chunks = []

        # Split by page markers - format is [Page N]
        page_pattern = r'\[Page (\d+)\]'
        parts = re.split(page_pattern, content)

        # parts will be: [text_before_first_page, page_num, page_content, page_num, page_content, ...]
        if len(parts) <= 1:
            # No page markers found, fall back to semantic chunking
            return self._chunk_by_semantic_similarity(content)

        # Skip any content before first page marker
        i = 1  # Start at first page number
        while i < len(parts) - 1:
            page_num = parts[i]
            page_content = parts[i + 1].strip() if i + 1 < len(parts) else ""

            if page_content:
                # Add page marker back for context
                full_content = f"[Page {page_num}]\n{page_content}"
                estimated_tokens = len(full_content) // 4

                if estimated_tokens <= self.max_chunk_tokens:
                    # Page fits in one chunk
                    chunks.append(Chunk(
                        content=full_content,
                        index=len(chunks),
                        metadata={"page": int(page_num)},
                        token_count=estimated_tokens,
                        hierarchy_level=1,  # Page level
                    ))
                else:
                    # Page too large, split it
                    sub_chunks = self._split_large_section(
                        full_content,
                        {"page": int(page_num)}
                    )
                    for sc in sub_chunks:
                        chunks.append(Chunk(
                            content=sc.content,
                            index=len(chunks),
                            metadata=sc.metadata,
                            token_count=sc.token_count,
                            hierarchy_level=1,
                        ))

            i += 2  # Move to next page

        return chunks

    def _chunk_by_semantic_similarity(self, content: str) -> List[Chunk]:
        """Default chunking by paragraphs with size limits.

        Groups related paragraphs together based on size constraints.
        """
        chunks = []

        # Split by double newlines (paragraphs)
        paragraphs = re.split(r'\n\s*\n', content)

        current_chunk: List[str] = []
        current_tokens = 0

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            para_tokens = len(para) // 4  # Rough estimate

            # Check if adding this paragraph would exceed max size
            if current_tokens + para_tokens > self.max_chunk_tokens and current_chunk:
                # Save current chunk
                chunk_content = '\n\n'.join(current_chunk)
                chunks.append(Chunk(
                    content=chunk_content,
                    index=len(chunks),
                    metadata={},
                    token_count=current_tokens
                ))

                # Start new chunk with overlap
                if self.overlap_tokens > 0 and current_chunk:
                    # Include last paragraph as overlap if it fits
                    overlap_para = current_chunk[-1]
                    overlap_tokens = len(overlap_para) // 4
                    if overlap_tokens <= self.overlap_tokens:
                        current_chunk = [overlap_para, para]
                        current_tokens = overlap_tokens + para_tokens
                    else:
                        current_chunk = [para]
                        current_tokens = para_tokens
                else:
                    current_chunk = [para]
                    current_tokens = para_tokens
            else:
                current_chunk.append(para)
                current_tokens += para_tokens

        # Don't forget last chunk
        if current_chunk:
            chunk_content = '\n\n'.join(current_chunk)
            chunks.append(Chunk(
                content=chunk_content,
                index=len(chunks),
                metadata={},
                token_count=current_tokens
            ))

        return chunks

    def _split_large_section(
        self,
        content: str,
        metadata: dict,
    ) -> List[Chunk]:
        """Split a large section into smaller chunks while preserving context.

        Used when a header section exceeds max_chunk_tokens.
        """
        estimated_tokens = len(content) // 4

        if estimated_tokens <= self.max_chunk_tokens:
            return [Chunk(content=content, index=0, metadata=metadata)]

        # Split by paragraphs first
        paragraphs = re.split(r'\n\s*\n', content)

        chunks = []
        current_chunk: List[str] = []
        current_tokens = 0

        # Extract header for context preservation
        header_lines = []
        content_started = False

        for para in paragraphs:
            if not content_started and para.strip().startswith('#'):
                header_lines.append(para)
            else:
                content_started = True
                para_tokens = len(para) // 4

                if current_tokens + para_tokens > self.max_chunk_tokens and current_chunk:
                    # Save chunk with header context
                    chunk_content = '\n\n'.join(header_lines + current_chunk)
                    chunks.append(Chunk(
                        content=chunk_content,
                        index=len(chunks),
                        metadata=metadata.copy(),
                        token_count=current_tokens
                    ))

                    current_chunk = [para]
                    current_tokens = para_tokens
                else:
                    current_chunk.append(para)
                    current_tokens += para_tokens

        # Last chunk
        if current_chunk:
            chunk_content = '\n\n'.join(header_lines + current_chunk)
            chunks.append(Chunk(
                content=chunk_content,
                index=len(chunks),
                metadata=metadata.copy(),
                token_count=current_tokens
            ))

        return chunks


# Singleton instance
_smart_chunker: Optional[SmartChunker] = None


def get_smart_chunker() -> SmartChunker:
    """Get or create the SmartChunker singleton."""
    global _smart_chunker
    if _smart_chunker is None:
        _smart_chunker = SmartChunker()
    return _smart_chunker
