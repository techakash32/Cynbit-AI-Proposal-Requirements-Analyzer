from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pymupdf
import pytest

from app.documents import extract as document_extractor


def _pdf_page(text: str = "", page_count: int = 1, width: float = 700, height: float = 300) -> bytes:
    document = pymupdf.open()
    for page_index in range(page_count):
        page = document.new_page(width=width, height=height)
        if text and page_index == 0:
            page.insert_text((40, 60), text)
    content = document.tobytes()
    document.close()
    return content


def test_pdf_uses_rapidocr_when_page_has_no_selectable_text(monkeypatch):
    images: list[Any] = []

    def fake_engine(image: Any) -> SimpleNamespace:
        images.append(image)
        return SimpleNamespace(txts=("Recognized source clause", "Second OCR line"))

    monkeypatch.setattr(document_extractor, "_get_rapidocr_engine", lambda: fake_engine)

    extracted = document_extractor.extract_document(_pdf_page(), "scan.pdf", "application/pdf")

    assert extracted.ocr_used is True
    assert extracted.text == "Recognized source clause\nSecond OCR line"
    assert extracted.page_blocks == [
        {"page": 1, "text": "Recognized source clause"},
        {"page": 1, "text": "Second OCR line"},
    ]
    assert len(images) == 1
    assert images[0].ndim == 3
    assert images[0].shape[2] == 3


def test_pdf_with_selectable_text_does_not_initialize_rapidocr(monkeypatch):
    native_text = "This PDF page contains enough selectable native text to avoid invoking OCR."
    monkeypatch.setattr(
        document_extractor,
        "_get_rapidocr_engine",
        lambda: (_ for _ in ()).throw(AssertionError("OCR should not run for a text PDF")),
    )

    extracted = document_extractor.extract_document(_pdf_page(native_text), "brief.pdf", "application/pdf")

    assert extracted.ocr_used is False
    assert native_text in extracted.text
    assert extracted.page_blocks[0] == {"page": 1, "text": native_text}


def test_pdf_rejects_more_scanned_pages_than_ocr_limit(monkeypatch):
    monkeypatch.setattr(document_extractor, "MAX_OCR_PAGES", 1)
    monkeypatch.setattr(
        document_extractor,
        "_get_rapidocr_engine",
        lambda: lambda image: SimpleNamespace(txts=("scanned page",)),
    )

    with pytest.raises(document_extractor.DocumentExtractionError, match="more than 1 pages"):
        document_extractor.extract_document(_pdf_page(page_count=2), "long-scan.pdf", "application/pdf")


def test_pdf_rejects_oversized_ocr_render_before_allocating_image():
    with pytest.raises(document_extractor.DocumentExtractionError, match="too large for OCR"):
        document_extractor.extract_document(_pdf_page(width=10_000, height=10_000), "poster-scan.pdf", "application/pdf")
