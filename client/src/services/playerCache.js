import { api } from './api';

/** In-memory + session cache for profile /player payload */
let memory = null;
let inflight = null;
const SS_KEY = 'ks_player_payload_v1';

function readSession() {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data) return null;
    // 30 min soft TTL
    if (parsed.__ts && Date.now() - parsed.__ts > 30 * 60 * 1000) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeSession(data) {
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify({ __ts: Date.now(), data }));
  } catch {
    /* quota */
  }
}

export function getCachedPlayer() {
  if (memory) return memory;
  const s = readSession();
  if (s) memory = s;
  return memory;
}

export function setCachedPlayer(data) {
  memory = data || null;
  if (data) writeSession(data);
}

export function clearPlayerCache() {
  memory = null;
  inflight = null;
  try {
    sessionStorage.removeItem(SS_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Prefetch / reuse live player profile.
 * @param {{ force?: boolean }} opts
 */
export async function prefetchPlayer(opts = {}) {
  const force = !!opts.force;
  if (!force) {
    const hit = getCachedPlayer();
    if (hit) return hit;
    if (inflight) return inflight;
  }
  const p = api
    .get('/player?include=base,heroes,ranks')
    .then((data) => {
      setCachedPlayer(data);
      inflight = null;
      return data;
    })
    .catch((e) => {
      inflight = null;
      throw e;
    });
  inflight = p;
  return p;
}

export async function refreshPlayerRemote() {
  const data = await api.post('/player/refresh', {});
  setCachedPlayer(data);
  return data;
}
