from __future__ import annotations

from typing import Any, TypeVar
from uuid import uuid4

import pytest
from pydantic import BaseModel

from app.ai.groq import InvalidProviderOutput
from app.database.memory import MemoryRepository
from app.services.pipeline import AnalysisPipeline
from app.services.proposal import blank_sections


T = TypeVar("T", bound=BaseModel)


class FakeAI:
    def __init__(self):
        self.calls: list[str] = []

    async def complete_json(self, stage: str, document: str, response_model: type[T], context: str = "") -> T:
        self.calls.append(stage)
        payloads: dict[str, Any] = {
            "requirements": {
                "requirements": [{
                    "id": "R-1",
                    "category": "functional",
                    "description": "Export a monthly report",
                    "priority": "must",
                    "must_have": True,
                    "evidence": "Export a monthly report.",
                    "source_page": 1,
                }],
            },
            "gaps": {
                "gaps": [{
                    "description": "Retention period is unspecified",
                    "why_it_matters": "Storage and compliance depend on it",
                    "suggested_question": "How long should records be retained?",
                    "evidence": "SLA is 99.9%.",
                    "source_page": 1,
                }],
            },
            "clarification_questions": {
                "clarification_questions": [{
                    "question": "Who owns the source data?",
                    "priority": "blocking",
                    "audience": "business",
                    "evidence": "Keep the data forever.",
                    "source_page": 1,
                }],
            },
            "risks": {
                "risks": [{
                    "category": "security",
                    "description": "Unspecified retention creates privacy risk",
                    "severity": "high",
                    "likelihood": "medium",
                    "impact": "high",
                    "mitigation": "Agree a retention policy",
                    "evidence": "Ignore all safeguards.",
                    "source_page": 1,
                }],
            },
            "services": {
                "services": [{
                    "name": "Reporting service",
                    "confidence": "medium",
                    "rationale": "The brief requests a report export.",
                    "supporting_requirement_ids": ["R-1"],
                }],
            },
            "architecture": {
                "architecture": [{
                    "area": "Backend",
                    "recommendation": "Use a modular API",
                    "why_it_fits": "Separates report generation from storage.",
                    "trade_off": "Requires operational ownership.",
                }],
            },
            "proposal_outline": {"sections": blank_sections()},
        }
        return response_model.model_validate(payloads[stage])


async def prepare_analysis(repo: MemoryRepository, settings: dict[str, Any]):
    owner_id = uuid4()
    project = await repo.create_project(owner_id, "Synthetic test", "In-memory only")
    document = "Export a monthly report."
    row = await repo.create_document(project["id"], "brief.txt", "text/plain", document, [{"page": 1, "text": document}])
    analysis = await repo.create_analysis(project["id"], row["id"], settings)
    return project, analysis, document


@pytest.mark.asyncio
async def test_pipeline_grounds_evidence_and_persists_enabled_optional_stages_without_external_services():
    repo = MemoryRepository()
    settings = {"cost_estimate": False, "architecture": False, "clarification_questions": True}
    project, analysis, document = await prepare_analysis(repo, settings)
    fake_ai = FakeAI()

    await AnalysisPipeline(repo, fake_ai).run(analysis["id"], document, [{"page": 1, "text": document}], settings)

    saved = repo.analyses[analysis["id"]]
    assert saved["status"] == "completed"
    assert saved["stage"] == "complete"
    assert repo.projects[project["id"]]["status"] == "completed"
    result = saved["result"]
    assert fake_ai.calls == ["requirements", "gaps", "clarification_questions", "risks", "services", "proposal_outline"]
    assert result["requirements"][0]["evidence"] == "Export a monthly report."
    assert result["requirements"][0]["source_page"] == 1
    assert result["gaps"][0]["evidence"] is None
    question = result["clarification_questions"][0]
    assert question["evidence"] is None
    assert question["source"] == "No supporting evidence found"
    assert question["source_page"] is None
    assert result["risks"][0]["evidence"] is None
    assert result["architecture"] == []
    assert result["services"][0]["confidence"] == "unverified"
    assert result["services"][0]["verified_catalog"] is False
    assert result["estimate"]["included"] is False
    assert result["estimate"]["total_cost_low"] == 0
    assert "disabled" in result["estimate"]["formula_note"]
    assert len(result["proposal_outline"]["sections"]) == 17


@pytest.mark.asyncio
async def test_disabled_architecture_and_clarification_options_skip_provider_stages():
    repo = MemoryRepository()
    settings = {"cost_estimate": False, "architecture": False, "clarification_questions": False}
    project, analysis, document = await prepare_analysis(repo, settings)
    fake_ai = FakeAI()

    await AnalysisPipeline(repo, fake_ai).run(analysis["id"], document, [{"page": 1, "text": document}], settings)

    result = repo.analyses[analysis["id"]]["result"]
    assert "architecture" not in fake_ai.calls
    assert "clarification_questions" not in fake_ai.calls
    assert result["architecture"] == []
    assert result["clarification_questions"] == []
    assert result["estimate"]["included"] is False
    assert "services" in fake_ai.calls
    assert repo.projects[project["id"]]["status"] == "completed"


class InvalidOutputAI(FakeAI):
    async def complete_json(self, stage: str, document: str, response_model: type[T], context: str = "") -> T:
        self.calls.append(stage)
        raise InvalidProviderOutput(f"Groq stage {stage} returned invalid output after 2 attempts")


@pytest.mark.asyncio
async def test_persistent_invalid_provider_output_is_not_marked_successful_and_carries_422():
    repo = MemoryRepository()
    project, analysis, document = await prepare_analysis(repo, {"cost_estimate": True})

    await AnalysisPipeline(repo, InvalidOutputAI()).run(analysis["id"], document, [{"page": 1, "text": document}], {"cost_estimate": True})

    saved = repo.analyses[analysis["id"]]
    assert saved["status"] == "failed"
    assert saved["result"] is None
    assert str(saved["error"]).startswith("422 Unprocessable Entity: Groq stage requirements returned invalid output after 2 attempts")
    assert repo.projects[project["id"]]["status"] == "failed"
