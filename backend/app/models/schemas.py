from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")


class SignupRequest(APIModel):
    name: str = Field(min_length=1, max_length=160)
    email: EmailStr
    password: str = Field(min_length=12, max_length=256)


class LoginRequest(APIModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class UserResponse(APIModel):
    id: UUID
    name: str
    email: EmailStr
    csrf_token: str | None = None


class ProjectCreate(APIModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)


class ProjectPatch(APIModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)


class ProjectResponse(APIModel):
    id: UUID
    owner_id: UUID
    name: str
    description: str | None
    status: str
    requirements_count: int = Field(default=0, ge=0)
    risks_count: int = Field(default=0, ge=0)
    created_at: datetime
    updated_at: datetime


class AnalyzeRequest(APIModel):
    source_text: str = Field(min_length=1, max_length=2_000_000)
    filename: str = Field(default="brief.txt", max_length=255)
    content_type: str = Field(default="text/plain", max_length=120)
    architecture: bool = True
    cost_estimate: bool = True
    clarification_questions: bool = True


class AnalyzeSettings(APIModel):
    architecture: bool = True
    cost_estimate: bool = True
    clarification_questions: bool = True


class PasswordChangeRequest(APIModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=12, max_length=256)


class UserProfilePatch(APIModel):
    name: str = Field(min_length=1, max_length=160)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value


class AnalysisStartResponse(APIModel):
    id: UUID
    status: str


class Requirement(APIModel):
    id: str = Field(min_length=1, max_length=80)
    category: str
    description: str
    priority: Literal["must", "should", "could", "unknown"] = "unknown"
    must_have: bool = False
    evidence: str | None = None
    source_page: int | None = Field(default=None, ge=1)


class Gap(APIModel):
    description: str
    why_it_matters: str
    suggested_question: str
    source: str | None = None
    evidence: str | None = None
    source_page: int | None = Field(default=None, ge=1)


class ClarificationQuestion(APIModel):
    question: str
    priority: Literal["blocking", "important", "nice-to-know"]
    audience: Literal["business", "technical", "either"]
    source: str | None = None
    evidence: str | None = None
    source_page: int | None = Field(default=None, ge=1)


class Risk(APIModel):
    category: str | None = None
    description: str
    severity: Literal["low", "medium", "high", "critical"]
    likelihood: Literal["low", "medium", "high"]
    impact: Literal["low", "medium", "high"]
    mitigation: str
    evidence: str | None = None
    source_page: int | None = Field(default=None, ge=1)


class ComplexityFactor(APIModel):
    name: str
    weight: float = Field(ge=0, le=1)
    contribution: float = Field(ge=0, le=100)


class Complexity(APIModel):
    score: int = Field(ge=0, le=100)
    label: Literal["low", "medium", "high", "very_high"]
    factors: list[ComplexityFactor]
    deterministic: bool = True


class ServiceRecommendation(APIModel):
    name: str
    confidence: Literal["high", "medium", "low", "unverified"]
    rationale: str
    supporting_requirement_ids: list[str] = []
    verified_catalog: bool = False


class ArchitectureRecommendation(APIModel):
    area: str
    recommendation: str
    why_it_fits: str
    trade_off: str


class EstimateAssumptions(APIModel):
    hourly_rate: float = Field(default=150, ge=0)
    contingency_percent: float = Field(default=15, ge=0, le=100)
    team_size: int = Field(default=2, ge=1, le=100)
    preliminary: bool = True


class EstimatePhase(APIModel):
    name: str
    hours_low: float = Field(ge=0)
    hours_high: float = Field(ge=0)
    cost_low: float = Field(ge=0)
    cost_high: float = Field(ge=0)


class Estimate(APIModel):
    included: bool = True
    assumptions: EstimateAssumptions
    phases: list[EstimatePhase]
    total_hours_low: float = Field(ge=0)
    total_hours_high: float = Field(ge=0)
    total_cost_low: float = Field(ge=0)
    total_cost_high: float = Field(ge=0)
    formula_note: str


class ProposalSection(APIModel):
    key: str
    heading: str
    content: str
    metadata: Literal["ai-draft", "edited"] = "ai-draft"
    updated_at: datetime | None = None


class ProposalOutline(APIModel):
    sections: list[ProposalSection] = Field(min_length=17, max_length=17)


class UnifiedAnalysis(APIModel):
    requirements: list[Requirement]
    gaps: list[Gap]
    clarification_questions: list[ClarificationQuestion]
    risks: list[Risk]
    complexity: Complexity
    services: list[ServiceRecommendation]
    architecture: list[ArchitectureRecommendation]
    estimate: Estimate
    proposal_outline: ProposalOutline


class AnalysisResponse(APIModel):
    id: UUID
    project_id: UUID
    status: str
    stage: str | None = None
    error: str | None = None
    result: UnifiedAnalysis | None = None
    created_at: datetime
    updated_at: datetime


class AnalysisStatus(APIModel):
    id: UUID
    status: str
    stage: str | None
    error: str | None
    progress_percent: int = Field(ge=0, le=100)


class RegenerateSectionRequest(APIModel):
    section_key: str = Field(min_length=1, max_length=100)
    confirmed: bool


class ProposalResponse(APIModel):
    id: UUID
    analysis_id: UUID
    sections: list[ProposalSection]
    created_at: datetime
    updated_at: datetime


class ProposalPatch(APIModel):
    sections: list[ProposalSection] = Field(min_length=17, max_length=17)


class ErrorResponse(APIModel):
    detail: str
