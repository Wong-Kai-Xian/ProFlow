// src/services/leadScoreService.js
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, getDocs, setDoc, query, orderBy, limit } from 'firebase/firestore';
import { DEFAULT_LEAD_SCORING_SETTINGS, computeLeadScore } from '../utils/leadScore';

const SETTINGS_DOC_ID = 'leadScoring';

export async function getLeadScoringSettings(userId) {
  try {
    if (!userId) return DEFAULT_LEAD_SCORING_SETTINGS;
    const ref = doc(db, 'users', userId, 'settings', SETTINGS_DOC_ID);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() || {};
      return { ...DEFAULT_LEAD_SCORING_SETTINGS, ...data };
    }
  } catch {}
  return DEFAULT_LEAD_SCORING_SETTINGS;
}

export async function saveLeadScoringSettings(userId, settings) {
  if (!userId) throw new Error('Missing userId');
  const ref = doc(db, 'users', userId, 'settings', SETTINGS_DOC_ID);
  const merged = { ...DEFAULT_LEAD_SCORING_SETTINGS, ...(settings || {}) };
  await setDoc(ref, merged, { merge: true });
  return merged;
}

export async function logLeadEvent(customerId, type, meta = {}) {
  if (!customerId || !type) return null;
  const createdAtMs = Date.now();
  const ref = collection(db, 'customerProfiles', customerId, 'leadEvents');
  try {
    const docRef = await addDoc(ref, {
      type,
      meta,
      createdAt: serverTimestamp(),
      createdAtMs
    });
    return { id: docRef.id, type, meta, createdAtMs };
  } catch {
    return null;
  }
}

export async function fetchLeadEvents(customerId, { maxDays = 120, startAtMs = 0 } = {}) {
  if (!customerId) return [];
  try {
    const col = collection(db, 'customerProfiles', customerId, 'leadEvents');
    // Order by createdAt if present; fallback to createdAtMs in compute
    const q = query(col, orderBy('createdAt', 'desc'), limit(1000));
    const snap = await getDocs(q);
    const now = Date.now();
    const cutoff = now - maxDays * 24 * 60 * 60 * 1000;
    return snap.docs
      .map(d => ({ id: d.id, ...(d.data() || {}) }))
      .map(e => ({ type: String(e.type || ''), meta: e.meta || {}, createdAtMs: Number(e.createdAtMs || (e.createdAt?.seconds ? e.createdAt.seconds * 1000 : now)) }))
      .filter(e => e.createdAtMs >= cutoff)
      .filter(e => (startAtMs ? e.createdAtMs >= startAtMs : true))
      .sort((a,b) => a.createdAtMs - b.createdAtMs);
  } catch {
    return [];
  }
}

export async function recomputeAndSaveForCustomer({ userId, customerId, companyProfile }) {
  if (!customerId) return null;
  const settings = await getLeadScoringSettings(userId);
  // Consider reset point to avoid using events from previous cycles (e.g., after conversion)
  let startAtMs = 0;
  try {
    const snap = await getDoc(doc(db, 'customerProfiles', customerId));
    const data = snap.exists() ? (snap.data() || {}) : {};
    startAtMs = Number(data?.leadScores?.noProjectResetAt || 0);
  } catch {}
  const events = await fetchLeadEvents(customerId, { startAtMs });
  const result = computeLeadScore({ companyProfile, events, settings });
  try {
    // Store under a dedicated namespace per state
    await setDoc(doc(db, 'customerProfiles', customerId), {
      leadScores: {
        noProject: {
          score: result.score,
          band: result.band,
          breakdown: result.breakdown,
          fitPoints: result.fitPoints,
          intentPoints: result.intentPoints,
          penaltyPoints: result.penaltyPoints,
          updatedAt: Date.now()
        }
      }
    }, { merge: true });
  } catch {}
  return result;
}


