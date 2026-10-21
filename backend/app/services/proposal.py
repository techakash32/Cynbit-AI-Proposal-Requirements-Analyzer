from __future__ import annotations

from datetime import datetime, timezone

HEADINGS = [
    ("executive_summary", "Executive Summary"), ("context", "Project Context"), ("objectives", "Objectives"),
    ("scope", "Scope"), ("users_and_roles", "Users and Roles"), ("functional_requirements", "Functional Requirements"),
    ("nonfunctional_requirements", "Non-functional Requirements"), ("integrations", "Integrations"), ("user_experience", "User Experience"),
    ("architecture", "Architecture Approach"), ("delivery_plan", "Delivery Plan"), ("quality_assurance", "Quality Assurance"),
    ("security_and_privacy", "Security and Privacy"), ("risks_and_assumptions", "Risks and Assumptions"), ("estimate", "Preliminary Estimate"),
    ("acceptance_criteria", "Acceptance Criteria"), ("open_questions", "Open Questions"),
]


def blank_sections() -> list[dict]:
    now = datetime.now(timezone.utc).isoformat()
    return [{"key": key, "heading": heading, "content": "", "metadata": "ai-draft", "updated_at": now} for key, heading in HEADINGS]
