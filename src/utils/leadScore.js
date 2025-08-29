// src/utils/leadScore.js
// Simple, configurable lead score computation for internal conversion likelihood.

/**
 * Default lead scoring settings. These can be overridden per user in Firestore at users/{uid}/settings/leadScoring.
 */
export const DEFAULT_LEAD_SCORING_SETTINGS = {
  distribution: { fitPercent: 20, intentPercent: 80 },
  fit: {
    maxPoints: 20,
    industryMatchScore: 12,
    locationMatchScore: 8,
    targetIndustries: [], // e.g., ["Construction","Manufacturing"]
    targetCountries: [], // e.g., ["MY","SG"]
    worldwide: false
  },
  intent: {
    maxPoints: 80,
    stageAdvancedPoints: 20, // user adjustable within [10,30]
    stageAdvanceCapPerDay: 20,
    approvalRequestedPoints: 8,
    approvalApprovedPoints: 20,
    quoteCreatedPoints: 12,
    taskCompletedPoints: 2,
    taskCapPer14d: 10
  },
  penalties: {
    noReply7d: -6,
    stuckPenalty: -15,
    inactivityPenalty: -10,
    approvalRejected: -10
  },
  thresholds: {
    emailReplyWindowHours: 48,
    stuckDays: 14,
    activityWindowDays: 14,
    quoteWindowDays: 30
  }
};

/**
 * Normalize a country/location string to an uppercase 2-3 letter token if possible, else lowercased word tokens.
 */
function normalizeLocationTokens(location) {
  try {
    const s = String(location || '').trim();
    if (!s) return [];
    // Extract last token if contains comma (e.g., "Singapore, SG" or "New York, USA")
    const parts = s.split(/[\s,]+/).filter(Boolean);
    return parts.map(p => p.toUpperCase());
  } catch {
    return [];
  }
}

function clamp(min, v, max) {
  return Math.max(min, Math.min(max, v));
}

function daysBetween(tsMs, nowMs) {
  return (nowMs - tsMs) / (1000 * 60 * 60 * 24);
}

function isSameDay(aMs, bMs) {
  const a = new Date(aMs), b = new Date(bMs);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Compute Fit points and breakdown.
 */
function computeFit(companyProfile = {}, settings) {
  const s = settings.fit || DEFAULT_LEAD_SCORING_SETTINGS.fit;
  let pts = 0;
  const breakdown = [];

  const industry = String(companyProfile.industry || '').trim();
  const loc = String(companyProfile.location || companyProfile.country || '').trim();

  if (industry && Array.isArray(s.targetIndustries) && s.targetIndustries.includes(industry)) {
    pts += s.industryMatchScore;
    breakdown.push(`+${s.industryMatchScore} Industry match`);
  }

  let locationMatched = false;
  if (s.worldwide) {
    locationMatched = true;
  } else if (Array.isArray(s.targetCountries) && s.targetCountries.length > 0) {
    const norm = normalizeLocationTokens(loc);
    const set = new Set((s.targetCountries || []).map(c => String(c || '').toUpperCase()));
    locationMatched = norm.some(tok => set.has(tok));
  }
  if (locationMatched) {
    pts += s.locationMatchScore;
    breakdown.push(`+${s.locationMatchScore} Location match`);
  }

  pts = clamp(0, pts, s.maxPoints);
  return { fitPoints: pts, breakdown };
}

/**
 * Compute Intent points from recent events with dedupe and caps, and penalties from windows.
 * events: array of { type, createdAtMs }
 */
function computeIntentAndPenalties(events = [], settings, nowMs, meta = {}) {
  const intentCfg = settings.intent || DEFAULT_LEAD_SCORING_SETTINGS.intent;
  const penCfg = settings.penalties || DEFAULT_LEAD_SCORING_SETTINGS.penalties;
  const th = settings.thresholds || DEFAULT_LEAD_SCORING_SETTINGS.thresholds;

  let intentPts = 0;
  let penaltyPts = 0;
  const breakdown = [];

  // Stage advanced: cap per day (allow multiple advances per day up to cap)
  const stageEvents = events.filter(e => e.type === 'stageAdvanced');
  const stagePointsByDay = {};
  for (const e of stageEvents) {
    const dayKey = new Date(e.createdAtMs).toDateString();
    if (!stagePointsByDay[dayKey]) stagePointsByDay[dayKey] = 0;
    
    // Add points for this stage advance if we haven't hit the daily cap
    const pointsToAdd = Math.min(intentCfg.stageAdvancedPoints, intentCfg.stageAdvanceCapPerDay - stagePointsByDay[dayKey]);
    if (pointsToAdd > 0) {
      stagePointsByDay[dayKey] += pointsToAdd;
      intentPts += pointsToAdd;
      breakdown.push(`+${pointsToAdd} Stage advanced`);
    }
  }

  // Approval events (optional wiring in v1)
  if (events.some(e => e.type === 'approvalRequested')) {
    intentPts += intentCfg.approvalRequestedPoints;
    breakdown.push(`+${intentCfg.approvalRequestedPoints} Approval requested`);
  }
  if (events.some(e => e.type === 'approvalApproved')) {
    intentPts += intentCfg.approvalApprovedPoints;
    breakdown.push(`+${intentCfg.approvalApprovedPoints} Approval approved`);
  }
  if (events.some(e => e.type === 'approvalRejected')) {
    penaltyPts += Math.abs(penCfg.approvalRejected);
    breakdown.push(`${penCfg.approvalRejected} Approval rejected`);
  }

  // Quote created: only count first within window
  const quoteWindowDays = Number(th.quoteWindowDays || 30);
  const firstQuote = events
    .filter(e => e.type === 'quoteCreated')
    .sort((a,b) => a.createdAtMs - b.createdAtMs)[0];
  if (firstQuote && daysBetween(firstQuote.createdAtMs, nowMs) <= quoteWindowDays) {
    intentPts += intentCfg.quoteCreatedPoints;
    breakdown.push(`+${intentCfg.quoteCreatedPoints} First quote (≤${quoteWindowDays}d)`);
  }

  // Tasks completed: cap per 14 days window
  const taskWindowDays = 14;
  const recentTasks = events.filter(e => e.type === 'taskCompleted' && daysBetween(e.createdAtMs, nowMs) <= taskWindowDays).length;
  if (recentTasks > 0) {
    const add = clamp(0, recentTasks * intentCfg.taskCompletedPoints, intentCfg.taskCapPer14d);
    intentPts += add;
    breakdown.push(`+${add} Tasks completed (cap ${intentCfg.taskCapPer14d}/14d)`);
  }

  // Email reply tracking
  const replyWindowHrs = Number((settings.thresholds || {}).emailReplyWindowHours || 48);
  const lastOutbound = events.filter(e => e.type === 'emailOutbound').sort((a,b) => b.createdAtMs - a.createdAtMs)[0];
  const firstReplyAfterOutbound = (() => {
    if (!lastOutbound) return null;
    return events
      .filter(e => e.type === 'emailReply' && e.createdAtMs >= lastOutbound.createdAtMs)
      .sort((a,b) => a.createdAtMs - b.createdAtMs)[0] || null;
  })();
  if (lastOutbound && firstReplyAfterOutbound) {
    const deltaMs = firstReplyAfterOutbound.createdAtMs - lastOutbound.createdAtMs;
    const deltaHours = deltaMs / (1000 * 60 * 60);
    // Award configurable positive intent when reply comes within window
    const bonus = Number(intentCfg.emailReplyBonus || 10);
    if (deltaHours <= replyWindowHrs && bonus > 0) {
      intentPts += bonus;
      breakdown.push(`+${bonus} Replied within ${replyWindowHrs}h`);
    }
  } else if (lastOutbound) {
    // No reply yet; if older than 7 days (configurable via penalties.noReply7d), apply penalty
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if ((nowMs - lastOutbound.createdAtMs) >= sevenDaysMs) {
      const p = Math.abs(penCfg.noReply7d);
      if (p > 0) {
        penaltyPts += p;
        breakdown.push(`${penCfg.noReply7d} No reply in 7d`);
      }
    }
  }

  // Penalties: inactivity and stuck (apply only after at least some activity)
  const hasAnyEvents = events.length > 0;
  const lastActivity = hasAnyEvents ? Math.max(...events.map(e => e.createdAtMs)) : 0;
  if (hasAnyEvents && daysBetween(lastActivity, nowMs) > (th.activityWindowDays || 14)) {
    penaltyPts += Math.abs(penCfg.inactivityPenalty);
    breakdown.push(`${penCfg.inactivityPenalty} No activity in ${th.activityWindowDays || 14}d`);
  }

  // Stuck: only if there has been at least one stage advance in this cycle
  const lastStage = stageEvents.length > 0 ? Math.max(...stageEvents.map(e => e.createdAtMs)) : 0;
  if (stageEvents.length > 0 && daysBetween(lastStage, nowMs) > (th.stuckDays || 14)) {
    penaltyPts += Math.abs(penCfg.stuckPenalty);
    breakdown.push(`${penCfg.stuckPenalty} Stage stuck > ${th.stuckDays || 14}d`);
  }

  intentPts = clamp(0, intentPts, intentCfg.maxPoints);

  return { intentPoints: intentPts, penaltyPoints: penaltyPts, breakdown };
}

/**
 * Compute overall lead score 0..100 and band + breakdown strings.
 * @param {Object} params
 * @param {Object} params.companyProfile
 * @param {Array} params.events - Array of { type: string, createdAtMs: number }
 * @param {Object} params.settings - lead scoring settings
 * @returns {{ score: number, band: string, breakdown: string[], fitPoints: number, intentPoints: number, penaltyPoints: number }}
 */
export function computeLeadScore({ companyProfile = {}, events = [], settings = DEFAULT_LEAD_SCORING_SETTINGS }) {
  const nowMs = Date.now();
  const cfg = { ...DEFAULT_LEAD_SCORING_SETTINGS, ...(settings || {}) };

  // Update maxPoints based on distribution percentages
  const fitPercent = Number(cfg.distribution?.fitPercent || 20);
  const intentPercent = Number(cfg.distribution?.intentPercent || 80);
  
  // Ensure fit and intent configs exist and update their maxPoints
  const updatedCfg = {
    ...cfg,
    fit: {
      ...cfg.fit,
      maxPoints: fitPercent // Use percentage as maxPoints for proper scaling
    },
    intent: {
      ...cfg.intent,
      maxPoints: intentPercent // Use percentage as maxPoints for proper scaling
    }
  };

  const fit = computeFit(companyProfile, updatedCfg);
  const intent = computeIntentAndPenalties(events, updatedCfg, nowMs);

  const fitWeight = fitPercent / 100;
  const intentWeight = intentPercent / 100;

  const fitNormalized = (fit.fitPoints || 0) / fitPercent;
  const intentNormalized = (intent.intentPoints || 0) / intentPercent;

  const raw = clamp(0, (fitWeight * fitNormalized + intentWeight * intentNormalized) * 100 - (intent.penaltyPoints || 0), 100);
  const score = Math.round(raw);
  const band = score >= 80 ? 'Hot' : score >= 50 ? 'Warm' : 'Cold';

  const breakdown = [...fit.breakdown, ...intent.breakdown];

  return { score, band, breakdown, fitPoints: fit.fitPoints, intentPoints: intent.intentPoints, penaltyPoints: intent.penaltyPoints };
}


