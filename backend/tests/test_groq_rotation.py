from __future__ import annotations

import json

import httpx
import pytest

from app.ai.groq import GroqClient, ProviderUnavailable
from app.config import Settings, parse_groq_api_keys, parse_numbered_groq_api_keys
from app.services.pipeline import _RequirementsOutput


def _valid_requirements_response() -> httpx.Response:
    content = json.dumps({
        "requirements": [{
            "id": "R1",
            "category": "functional",
            "description": "Export a report",
            "priority": "must",
            "must_have": True,
            "evidence": None,
            "source_page": None,
        }],
    })
    return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})


def test_parse_groq_api_keys_trims_deduplicates_and_accepts_newlines():
    assert parse_groq_api_keys(" key-a, key-b ;\nkey-a ,, key-c ") == ("key-a", "key-b", "key-c")


def test_parse_numbered_groq_api_keys_uses_numeric_order_and_ignores_invalid_slots():
    keys = parse_numbered_groq_api_keys({
        "GROQ_KEY_10": " key-10 ",
        "GROQ_KEY_2": "key-2",
        "GROQ_KEY_1": "key-1",
        "GROQ_KEY_3": "key-2",
        "GROQ_KEY_4": None,
        "GROQ_KEY_0": "ignored-zero",
        "GROQ_KEY_BACKUP": "ignored-name",
        "OTHER_KEY_4": "ignored-prefix",
    })
    assert keys == ("key-1", "key-2", "key-10")
    settings = Settings(groq_numbered_api_keys=keys, groq_api_keys=("pool-key",), groq_api_key="legacy-key")
    assert settings.groq_keys == ("key-1", "key-2", "key-10", "pool-key", "legacy-key")


@pytest.mark.asyncio
async def test_groq_client_rotates_starting_key_across_calls():
    seen_keys: list[str] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        seen_keys.append(request.headers["Authorization"])
        return _valid_requirements_response()

    settings = Settings(groq_api_keys=("key-a", "key-b"), groq_api_key="")
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="https://api.groq.test") as http:
        client = GroqClient(settings, http)
        await client.complete_json("requirements", "brief", _RequirementsOutput)
        await GroqClient(settings, http).complete_json("requirements", "brief", _RequirementsOutput)

    assert len(seen_keys) == 2
    assert seen_keys[0] != seen_keys[1]
    assert set(seen_keys) == {"Bearer key-a", "Bearer key-b"}


@pytest.mark.asyncio
async def test_groq_client_fails_over_to_next_key_after_rate_limit():
    seen_keys: list[str] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        seen_keys.append(request.headers["Authorization"])
        if len(seen_keys) == 1:
            return httpx.Response(429, json={"error": {"message": "rate limited"}})
        return _valid_requirements_response()

    settings = Settings(groq_numbered_api_keys=("key-a", "key-b"), groq_api_keys=(), groq_api_key="")
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="https://api.groq.test") as http:
        result = await GroqClient(settings, http).complete_json("requirements", "brief", _RequirementsOutput)

    assert result.requirements[0].id == "R1"
    assert len(seen_keys) == 2
    assert seen_keys[0] != seen_keys[1]


@pytest.mark.asyncio
async def test_single_key_429_error_explains_numbered_env_slots():
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={"error": {"message": "rate limited"}})

    settings = Settings(groq_numbered_api_keys=("key-a",), groq_api_keys=(), groq_api_key="")
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="https://api.groq.test") as http:
        with pytest.raises(ProviderUnavailable, match=r"trying 1 configured key\(s\).*GROQ_KEY_1"):
            await GroqClient(settings, http).complete_json("requirements", "brief", _RequirementsOutput)


@pytest.mark.asyncio
async def test_groq_client_normalizes_common_requirement_aliases():
    payload = {
        "requirements": [
            {"id": "R1", "category": "functional", "description": "Export report", "priority": "M", "must_have": None, "evidence": "Export report", "page": 3},
            {"id": "R2", "category": "functional", "description": "Keep records", "priority": None, "must_have": None, "evidence": None, "page": 3},
            {"id": "R3", "category": "functional", "description": "Provide search", "priority": "S", "must_have": None, "evidence": None, "page": 3},
            {"id": "R4", "category": "functional", "description": "Optional export", "priority": "C", "must_have": None, "evidence": None, "page": 3},
        ],
    }

    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(payload)}}]})

    settings = Settings(groq_api_keys=(), groq_api_key="test-key")
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="https://api.groq.test") as http:
        result = await GroqClient(settings, http).complete_json("requirements", "brief", _RequirementsOutput)

    assert [item.priority for item in result.requirements] == ["must", "unknown", "should", "could"]
    assert [item.must_have for item in result.requirements] == [True, False, False, False]
    assert [item.source_page for item in result.requirements] == [3, 3, 3, 3]
