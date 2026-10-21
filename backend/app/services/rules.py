from __future__ import annotations

from app.models.schemas import Complexity, ComplexityFactor, Estimate, EstimateAssumptions, EstimatePhase, Gap, Requirement, Risk


def calculate_complexity(requirements: list[Requirement], gaps: list[Gap], risks: list[Risk], integration_count: int = 0) -> Complexity:
    count = len(requirements)
    requirement_factor = min(30.0, count * 1.5)
    gap_factor = min(25.0, len(gaps) * 4.0)
    risk_factor = min(25.0, sum({"low": 1, "medium": 3, "high": 6, "critical": 9}[r.severity] for r in risks))
    integration_factor = min(20.0, integration_count * 5.0)
    total = round(min(100.0, requirement_factor + gap_factor + risk_factor + integration_factor))
    label = "low" if total < 25 else "medium" if total < 50 else "high" if total < 75 else "very_high"
    factors = [ComplexityFactor(name="requirement volume", weight=.30, contribution=requirement_factor), ComplexityFactor(name="unresolved gaps", weight=.25, contribution=gap_factor), ComplexityFactor(name="risk profile", weight=.25, contribution=risk_factor), ComplexityFactor(name="integrations", weight=.20, contribution=integration_factor)]
    return Complexity(score=total, label=label, factors=factors, deterministic=True)


def calculate_estimate(requirements: list[Requirement], complexity: Complexity, assumptions: EstimateAssumptions | None = None) -> Estimate:
    assumptions = assumptions or EstimateAssumptions()
    base = max(24.0, len(requirements) * 6.0 + complexity.score * 0.8)
    phases = [("discovery", .12), ("design", .16), ("implementation", .48), ("integration and QA", .18), ("launch readiness", .06)]
    result = []
    for name, share in phases:
        low = round(base * share, 1); high = round(low * 1.6, 1)
        result.append(EstimatePhase(name=name, hours_low=low, hours_high=high, cost_low=round(low * assumptions.hourly_rate * (1 + assumptions.contingency_percent / 100), 2), cost_high=round(high * assumptions.hourly_rate * (1 + assumptions.contingency_percent / 100), 2)))
    return Estimate(assumptions=assumptions, phases=result, total_hours_low=round(sum(p.hours_low for p in result), 1), total_hours_high=round(sum(p.hours_high for p in result), 1), total_cost_low=round(sum(p.cost_low for p in result), 2), total_cost_high=round(sum(p.cost_high for p in result), 2), formula_note="Preliminary: phase hours derive from requirement volume and deterministic complexity; cost = total person-hours × hourly_rate × (1 + contingency_percent/100). Schedule = sequential person-hours ÷ (team_size × 8 working hours/day). Team size changes schedule, not total labor hours or cost.")
