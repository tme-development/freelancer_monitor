import { Injectable } from '@nestjs/common';

export interface WeightConfig {
  weight_direct: number;
  weight_alternative: number;
  weight_must_have: number;
  weight_nice_to_have: number;
}

export interface MatchInput {
  match_type: 'direct' | 'alternative' | 'none';
  is_must_have: boolean;
}

@Injectable()
export class MatchingCalculator {
  calculate(matches: MatchInput[], weights: WeightConfig): number {
    if (matches.length === 0) return 0;

    let weightedSum = 0;
    let totalWeight = 0;

    for (const m of matches) {
      const importance = m.is_must_have
        ? weights.weight_must_have
        : weights.weight_nice_to_have;

      let score = 0;
      if (m.match_type === 'direct') {
        score = weights.weight_direct;
      } else if (m.match_type === 'alternative') {
        score = weights.weight_alternative;
      }

      weightedSum += score * importance;
      totalWeight += importance;
    }

    if (totalWeight === 0) return 0;
    return Math.round((weightedSum / totalWeight) * 10000) / 100;
  }

  getDefaultWeights(): WeightConfig {
    return {
      weight_direct: 1.0,
      weight_alternative: 0.5,
      weight_must_have: 2.0,
      weight_nice_to_have: 1.0,
    };
  }
}
