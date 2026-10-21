import { describe, expect, it } from 'vitest';
import { calculateEstimateDisplay } from './estimate';

const phases = [
  { name: 'Discovery', hours_low: 8, hours_high: 16 },
  { name: 'Delivery', hours_low: 24, hours_high: 48 },
];

describe('calculateEstimateDisplay', () => {
  it('recalculates each phase and total cost from rate and contingency', () => {
    const result = calculateEstimateDisplay(phases, { hourly_rate: 100, contingency_percent: 20, team_size: 2 });
    expect(result.phases[0]?.low).toBe(960);
    expect(result.phases[0]?.high).toBe(1920);
    expect(result.totalLow).toBe(3840);
    expect(result.totalHigh).toBe(7680);
  });

  it('recalculates phase and total schedule ranges from team size without multiplying person-hours cost', () => {
    const twoPersonTeam = calculateEstimateDisplay(phases, { hourly_rate: 100, contingency_percent: 0, team_size: 2 });
    const fourPersonTeam = calculateEstimateDisplay(phases, { hourly_rate: 100, contingency_percent: 0, team_size: 4 });
    expect(twoPersonTeam.phases[0]?.duration_low_days).toBe(0.5);
    expect(twoPersonTeam.durationHighDays).toBe(4);
    expect(fourPersonTeam.phases[0]?.duration_low_days).toBe(0.3);
    expect(fourPersonTeam.durationHighDays).toBe(2);
    expect(fourPersonTeam.totalLow).toBe(twoPersonTeam.totalLow);
    expect(fourPersonTeam.totalHigh).toBe(twoPersonTeam.totalHigh);
  });
});
