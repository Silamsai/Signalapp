export type ScoreComponents = {
  fit: number;
  recency: number;
  quality: number;
  total: number;
  explanation: string[];
};

/** Heuristic prioritization — not purchase probability. Missing evidence cannot inflate confidence. */
export function scoreEvidence(input: {
  hasEvidence: boolean;
  daysSinceEvent: number | null;
  sourceQuality: number;
  fitHints: number;
}): ScoreComponents {
  const explanation: string[] = [];
  if (!input.hasEvidence) {
    return {
      fit: 0,
      recency: 0,
      quality: 0,
      total: 0,
      explanation: ["No evidence — score not inflated"],
    };
  }
  const fit = Math.min(100, Math.max(0, input.fitHints));
  explanation.push(`Fit component ${fit} from signal match hints`);

  let recency = 40;
  if (input.daysSinceEvent == null) {
    recency = 20;
    explanation.push("Unknown event date — recency capped");
  } else if (input.daysSinceEvent <= 30) {
    recency = 100;
    explanation.push("Event within 30 days");
  } else if (input.daysSinceEvent <= 90) {
    recency = 70;
    explanation.push("Event within 90 days");
  } else {
    recency = 30;
    explanation.push("Older than 90 days");
  }

  const quality = Math.min(100, Math.max(0, input.sourceQuality));
  explanation.push(`Source quality ${quality}`);

  const total = Math.round(fit * 0.45 + recency * 0.35 + quality * 0.2);
  return { fit, recency, quality, total, explanation };
}
