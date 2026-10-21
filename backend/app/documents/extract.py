from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast


@dataclass
class ExtractedDocument:
    text: str
    page_blocks: list[dict[str, Any]]
    ocr_used: bool = False


def extract_document(content: bytes, filename: str, content_type: str) -> ExtractedDocument:
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf" or content_type == "application/pdf":
        import fitz
        doc = fitz.open(stream=content, filetype="pdf")
        blocks: list[dict[str, Any]] = []
        pages: list[str] = []
        for page_offset in range(doc.page_count):
            page_index = page_offset + 1
            page = doc.load_page(page_offset)
            page_text = cast(str, page.get_text("text"))
            pages.append(page_text)
            for block in page.get_text("blocks"):
                text = block[4].strip()
                if text:
                    blocks.append({"page": page_index, "text": text})
        return ExtractedDocument("\n".join(pages).strip(), blocks, ocr_used=False)
    if suffix == ".docx" or content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        from io import BytesIO
        from docx import Document
        document = Document(BytesIO(content))
        paragraphs = [p.text for p in document.paragraphs if p.text.strip()]
        text = "\n".join(paragraphs).strip()
        return ExtractedDocument(text, [{"page": None, "text": line} for line in paragraphs], ocr_used=False)
    if suffix in {".txt", ".md"} or content_type.startswith("text/"):
        text = content.decode("utf-8", errors="replace").strip()
        return ExtractedDocument(text, [{"page": None, "text": line} for line in text.splitlines() if line.strip()], ocr_used=False)
    raise ValueError("Unsupported document type; provide PDF, DOCX, or TXT")


def ground_evidence(evidence: str | None, source_text: str, source_page: int | None = None, page_blocks: list[dict[str, Any]] | None = None) -> tuple[str | None, int | None]:
    """Return only verbatim source evidence; unsupported model claims become null."""
    if not evidence or evidence not in source_text:
        return None, None
    if page_blocks:
        for block in page_blocks:
            if evidence in str(block.get("text", "")):
                page = block.get("page")
                return evidence, page if isinstance(page, int) and page >= 1 else None
        return evidence, None
    return evidence, source_page
