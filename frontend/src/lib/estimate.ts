export type EstimateAssumptions = {
  hourly_rate: number;
  contingency_percent: number;
  team_size: number;
};

export type EstimatePhaseInput = {
  name: string;
  hours_low: number;
  hours_high: number;
};

export function calculateEstimateDisplay(phases: EstimatePhaseInput[], assumptions: EstimateAssumptions) {
  const teamSize = Math.max(1, assumptions.team_size);
  const rateWithContingency = assumptions.hourly_rate * (1 + assumptions.contingency_percent / 100);
  const hoursPerTeamDay = teamSize * 8;
  const calculatedPhases = phases.map((phase) => ({
    ...phase,
    team_size: teamSize,
    low: Math.round(phase.hours_low * rateWithContingency * 100) / 100,
    high: Math.round(phase.hours_high * rateWithContingency * 100) / 100,
    duration_low_days: Math.round((phase.hours_low / hoursPerTeamDay) * 10) / 10,
    duration_high_days: Math.round((phase.hours_high / hoursPerTeamDay) * 10) / 10,
  }));
  const totalHoursLow = phases.reduce((sum, phase) => sum + phase.hours_low, 0);
  const totalHoursHigh = phases.reduce((sum, phase) => sum + phase.hours_high, 0);
  return {
    phases: calculatedPhases,
    totalLow: calculatedPhases.reduce((sum, phase) => sum + phase.low, 0),
    totalHigh: calculatedPhases.reduce((sum, phase) => sum + phase.high, 0),
    durationLowDays: Math.round((totalHoursLow / hoursPerTeamDay) * 10) / 10,
    durationHighDays: Math.round((totalHoursHigh / hoursPerTeamDay) * 10) / 10,
  };
}
