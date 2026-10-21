from __future__ import annotations

import json

from app.database.repository import _decode_json_fields


def test_asyncpg_jsonb_text_fields_decode_to_python_objects():
    row = {
        "settings": json.dumps({"architecture": False}),
        "result": json.dumps({"requirements": [{"id": "R1"}]}),
        "page_blocks": json.dumps([{"page": 1, "text": "Source text"}]),
        "sections": json.dumps([{"key": "summary", "content": "Draft"}]),
        "error": "ordinary string field",
    }

    decoded = _decode_json_fields(row, "settings", "result", "page_blocks", "sections")

    assert decoded["settings"] == {"architecture": False}
    assert decoded["result"]["requirements"][0]["id"] == "R1"
    assert decoded["page_blocks"][0]["text"] == "Source text"
    assert decoded["sections"][0]["content"] == "Draft"
    assert decoded["error"] == "ordinary string field"


def test_asyncpg_jsonb_decoder_preserves_non_json_text_for_diagnosis():
    decoded = _decode_json_fields({"settings": "not-json"}, "settings")
    assert decoded["settings"] == "not-json"
