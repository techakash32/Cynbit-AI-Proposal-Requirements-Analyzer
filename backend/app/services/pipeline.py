from __future__ import annotations

from typing import Any, Protocol, TypeVar

from pydantic import BaseModel, Field

from app.ai.groq import InvalidProviderOutput
from app.documents.extract import ground_evidence
from app.models.schemas import (
    ArchitectureRecommendation,
    ClarificationQuestion,
    Complexity,
    Estimate,
    EstimateAssumptions,
    Gap,
    ProposalOutline,
    Requirement,
    Risk,
    ServiceRecommendation,
    UnifiedAnalysis,
)
from app.services.rules import calculate_complexity, calculate_estimate


T = TypeVar("T", bound=BaseModel)


class JSONCompleter(Protocol):
    async def complete_json(self, stage: str, document: str, response_model: type[T], context: str = "") -> T: ...


class AnalysisPipeline:
    def __init__(self, repo: Any, ai: JSONCompleter):
        self.repo = repo
        self.ai = ai

    async def run(self, analysis_id, document: str, page_blocks: list[dict[str, Any]], settings: dict[str, Any]) -> None:
        analysis = None
        try:
            analysis = await self.repo.get_analysis_by_id(analysis_id) if hasattr(self.repo, "get_analysis_by_id") else None
            if analysis:
                await self.repo.update_project_status(analysis["project_id"], "analyzing")
            await self.repo.update_analysis(analysis_id, "running", "requirements", progress_percent=10)
            requirement_result = await self.ai.complete_json("requirements", document, _RequirementsOutput)
            grounded_requirements = []
            for item in requirement_result.requirements:
                evidence, page = ground_evidence(item.evidence, document, item.source_page, page_blocks)
                grounded_requirements.append(item.model_copy(update={"evidence": evidence, "source_page": page}))

            await self.repo.update_analysis(analysis_id, "running", "gaps", progress_percent=30)
            gap_result = await self.ai.complete_json("gaps", document, _GapOutput)
            grounded_gaps = []
            for item in gap_result.gaps:
                evidence, page = ground_evidence(item.evidence, document, item.source_page, page_blocks)
                grounded_gaps.append(item.model_copy(update={"evidence": evidence, "source_page": page}))

            grounded_questions: list[ClarificationQuestion] = []
            if settings.get("clarification_questions", True):
                await self.repo.update_analysis(analysis_id, "running", "clarification_questions", progress_percent=42)
                question_result = await self.ai.complete_json("clarification_questions", document, _ClarificationOutput)
                for item in question_result.clarification_questions:
                    evidence, page = ground_evidence(item.evidence, document, item.source_page, page_blocks)
                    grounded_questions.append(item.model_copy(update={"source": evidence or "No supporting evidence found", "evidence": evidence, "source_page": page}))

            await self.repo.update_analysis(analysis_id, "running", "risks", progress_percent=54)
            risk_result = await self.ai.complete_json("risks", document, _RiskOutput)
            grounded_risks = []
            for item in risk_result.risks:
                evidence, page = ground_evidence(item.evidence, document, item.source_page, page_blocks)
                grounded_risks.append(item.model_copy(update={"evidence": evidence, "source_page": page}))

            await self.repo.update_analysis(analysis_id, "running", "services", progress_percent=68)
            service_result = await self.ai.complete_json("services", document, _ServiceOutput)

            architecture: list[ArchitectureRecommendation] = []
            if settings.get("architecture", True):
                await self.repo.update_analysis(analysis_id, "running", "architecture", progress_percent=76)
                architecture_result = await self.ai.complete_json("architecture", document, _ArchitectureOutput)
                architecture = architecture_result.architecture

            complexity = calculate_complexity(grounded_requirements, grounded_gaps, grounded_risks, integration_count=sum("integrat" in item.description.lower() for item in grounded_requirements))
            if settings.get("cost_estimate", True):
                estimate = calculate_estimate(grounded_requirements, complexity)
            else:
                estimate = Estimate(
                    included=False,
                    assumptions=EstimateAssumptions(),
                    phases=[],
                    total_hours_low=0,
                    total_hours_high=0,
                    total_cost_low=0,
                    total_cost_high=0,
                    formula_note="No estimate was calculated because the estimate option was disabled.",
                )

            await self.repo.update_analysis(analysis_id, "running", "proposal_outline", progress_percent=86)
            proposal = await self.ai.complete_json("proposal_outline", document, ProposalOutline)
            result = UnifiedAnalysis(
                requirements=grounded_requirements,
                gaps=grounded_gaps,
                clarification_questions=grounded_questions,
                risks=grounded_risks,
                complexity=complexity,
                services=[item.model_copy(update={"verified_catalog": False, "confidence": "unverified"}) for item in service_result.services],
                architecture=architecture,
                estimate=estimate,
                proposal_outline=proposal,
            )
            await self.repo.update_analysis(analysis_id, "completed", "complete", result=result.model_dump(mode="json"), progress_percent=100)
            await self.repo.create_proposal(analysis_id, [section.model_dump(mode="json") for section in proposal.sections])
            if analysis:
                await self.repo.update_project_status(analysis["project_id"], "completed")
        except Exception as exc:
            error = f"422 Unprocessable Entity: {exc}" if isinstance(exc, InvalidProviderOutput) else str(exc)
            await self.repo.update_analysis(analysis_id, "failed", "terminal_error", error=error, progress_percent=100)
            if "analysis" in locals() and analysis:
                await self.repo.update_project_status(analysis["project_id"], "failed")


class _RequirementsOutput(BaseModel):
    requirements: list[Requirement]


class _GapOutput(BaseModel):
    gaps: list[Gap]


class _ClarificationOutput(BaseModel):
    clarification_questions: list[ClarificationQuestion] = Field(default_factory=list)


class _RiskOutput(BaseModel):
    risks: list[Risk]


class _ServiceOutput(BaseModel):
    services: list[ServiceRecommendation] = Field(default_factory=list)


class _ArchitectureOutput(BaseModel):
    architecture: list[ArchitectureRecommendation] = Field(default_factory=list)
