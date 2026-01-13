"""PDF document parser.

Extracts text from PDF files with page-aware parsing,
preserving structure where possible.
"""

import io
import logging
from typing import List, Optional, BinaryIO
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class PDFPage:
    """Represents a single page of extracted PDF content."""
    page_number: int
    text: str
    metadata: dict


@dataclass
class PDFDocument:
    """Represents an extracted PDF document."""
    pages: List[PDFPage]
    metadata: dict
    total_pages: int

    @property
    def full_text(self) -> str:
        """Get all text concatenated with page markers."""
        parts = []
        for page in self.pages:
            if page.text.strip():
                parts.append(f"[Page {page.page_number}]\n{page.text}")
        return "\n\n".join(parts)

    @property
    def text_only(self) -> str:
        """Get all text without page markers."""
        return "\n\n".join(
            page.text.strip() for page in self.pages if page.text.strip()
        )


class PDFParser:
    """Parser for PDF documents.

    Uses pypdf for text extraction with fallback strategies
    for scanned/image-based PDFs.
    """

    def __init__(self):
        self._pypdf_available = False
        try:
            import pypdf
            self._pypdf_available = True
        except ImportError:
            logger.warning("pypdf not installed. PDF parsing will be unavailable.")

    def parse(
        self,
        file_path: Optional[str] = None,
        file_content: Optional[bytes] = None,
        file_stream: Optional[BinaryIO] = None,
    ) -> PDFDocument:
        """Parse a PDF file and extract text.

        Args:
            file_path: Path to PDF file
            file_content: Raw bytes of PDF content
            file_stream: File-like object containing PDF

        Returns:
            PDFDocument with extracted text and metadata

        Raises:
            ValueError: If no valid input provided or pypdf not available
        """
        if not self._pypdf_available:
            raise ValueError("pypdf library is required for PDF parsing. Install with: pip install pypdf")

        import pypdf

        # Get PDF reader
        if file_path:
            reader = pypdf.PdfReader(file_path)
        elif file_content:
            reader = pypdf.PdfReader(io.BytesIO(file_content))
        elif file_stream:
            reader = pypdf.PdfReader(file_stream)
        else:
            raise ValueError("Must provide file_path, file_content, or file_stream")

        # Extract metadata
        metadata = {}
        if reader.metadata:
            metadata = {
                "title": reader.metadata.get("/Title", ""),
                "author": reader.metadata.get("/Author", ""),
                "subject": reader.metadata.get("/Subject", ""),
                "creator": reader.metadata.get("/Creator", ""),
                "producer": reader.metadata.get("/Producer", ""),
                "creation_date": str(reader.metadata.get("/CreationDate", "")),
            }
            # Clean up empty values
            metadata = {k: v for k, v in metadata.items() if v}

        # Extract pages
        pages = []
        for i, page in enumerate(reader.pages, start=1):
            try:
                text = page.extract_text() or ""

                # Clean up extracted text
                text = self._clean_text(text)

                pages.append(PDFPage(
                    page_number=i,
                    text=text,
                    metadata={}
                ))
            except Exception as e:
                logger.warning(f"Failed to extract text from page {i}: {e}")
                pages.append(PDFPage(
                    page_number=i,
                    text="[Error extracting text from this page]",
                    metadata={"error": str(e)}
                ))

        return PDFDocument(
            pages=pages,
            metadata=metadata,
            total_pages=len(reader.pages)
        )

    def parse_to_text(
        self,
        file_path: Optional[str] = None,
        file_content: Optional[bytes] = None,
        include_page_markers: bool = True,
    ) -> str:
        """Parse PDF and return plain text.

        Convenience method for simple text extraction.

        Args:
            file_path: Path to PDF file
            file_content: Raw bytes of PDF content
            include_page_markers: Whether to include [Page N] markers

        Returns:
            Extracted text as string
        """
        doc = self.parse(file_path=file_path, file_content=file_content)

        if include_page_markers:
            return doc.full_text
        else:
            return doc.text_only

    def _clean_text(self, text: str) -> str:
        """Clean up extracted PDF text.

        Handles common PDF extraction issues like:
        - Null bytes and control characters (critical for PostgreSQL)
        - Excessive whitespace
        - Broken words (hyphenation)
        - Header/footer repetition
        """
        import re

        # CRITICAL: Remove null bytes that cause PostgreSQL UTF-8 errors
        # pypdf can extract text with embedded null bytes from binary PDF data
        text = text.replace('\x00', '')

        # Remove other control characters (except newline \n, tab \t, carriage return \r)
        text = re.sub(r'[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)

        # Normalize whitespace
        text = re.sub(r'[ \t]+', ' ', text)

        # Fix hyphenation at line breaks
        text = re.sub(r'-\s*\n\s*', '', text)

        # Normalize line endings
        text = re.sub(r'\n{3,}', '\n\n', text)

        # Remove page numbers that appear on their own line
        text = re.sub(r'^\s*\d+\s*$', '', text, flags=re.MULTILINE)

        return text.strip()

    def get_page_count(
        self,
        file_path: Optional[str] = None,
        file_content: Optional[bytes] = None,
    ) -> int:
        """Get the number of pages in a PDF without full parsing.

        Args:
            file_path: Path to PDF file
            file_content: Raw bytes of PDF content

        Returns:
            Number of pages
        """
        if not self._pypdf_available:
            raise ValueError("pypdf library required")

        import pypdf

        if file_path:
            reader = pypdf.PdfReader(file_path)
        elif file_content:
            reader = pypdf.PdfReader(io.BytesIO(file_content))
        else:
            raise ValueError("Must provide file_path or file_content")

        return len(reader.pages)


# Singleton instance
_pdf_parser: Optional[PDFParser] = None


def get_pdf_parser() -> PDFParser:
    """Get or create the PDFParser singleton."""
    global _pdf_parser
    if _pdf_parser is None:
        _pdf_parser = PDFParser()
    return _pdf_parser
