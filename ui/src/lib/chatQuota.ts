// Simple client-side daily quota for sending chat messages.
// Stores a per-day count in localStorage under key 'obrolin:chat_quota'.
// Reset policy: quota resets at 00:01 local time the next day.

const STORAGE_KEY = 'obrolin:chat_quota';
const DAILY_LIMIT = 20;

type QuotaRecord = {
  date: string; // YYYY-MM-DD
  count: number;
};

function buildKey(userId?: string) {
  const uid = userId ? String(userId) : 'anon';
  return `${STORAGE_KEY}:${uid}`;
}

function todayKey(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function load(userId?: string): QuotaRecord {
  try {
    const key = buildKey(userId);
    const raw = localStorage.getItem(key);
    if (!raw) return { date: todayKey(), count: 0 };
    const parsed = JSON.parse(raw) as QuotaRecord;
    if (!parsed || typeof parsed.date !== 'string' || typeof parsed.count !== 'number') {
      return { date: todayKey(), count: 0 };
    }
    // If saved date is older than today, reset to today
    if (parsed.date !== todayKey()) {
      const rec = { date: todayKey(), count: 0 };
      save(rec, userId);
      return rec;
    }
    return parsed;
  } catch (e) {
    return { date: todayKey(), count: 0 };
  }
}

function save(rec: QuotaRecord, userId?: string) {
  try {
    const key = buildKey(userId);
    localStorage.setItem(key, JSON.stringify(rec));
    // notify other tabs/components
    try { window.dispatchEvent(new CustomEvent('obrolin:chat_quota_updated', { detail: { key } })); } catch {}
  } catch (e) {
    // ignore
  }
}

export function getCount(userId?: string): number {
  return load(userId).count;
}

export function canSend(userId?: string): boolean {
  return getCount(userId) < DAILY_LIMIT;
}

export function incrementCount(userId?: string): number {
  const rec = load(userId);
  rec.count = (rec.count || 0) + 1;
  save(rec, userId);
  return rec.count;
}

// Forcefully set the stored count for a user. Useful when the server
// reports the quota is exceeded and the client must reflect that state.
export function setCount(userId: string | undefined, count: number) {
  const rec = load(userId);
  rec.count = count;
  save(rec, userId);
  return rec.count;
}

// seconds until next day 00:01 local time
export function secondsUntilReset(): number {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 1, 0, 0);
  return Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 1000));
}

export function getResetLabel(): string {
  const secs = secondsUntilReset();
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;

  // Prefer an hours/minutes human readable label. If 0 hours, show minutes.
  if (hours > 0) {
    if (minutes === 0) return `Reset dalam ${hours} jam (00:01 besok)`;
    return `Reset dalam ${hours} jam ${minutes} menit (00:01 besok)`;
  }

  if (minutes > 0) return `Reset dalam ${minutes} menit (00:01 besok)`;
  return `Reset pada 00:01 besok`;
}

export function subscribeQuota(cb: () => void, userId?: string) {
  const key = buildKey(userId);
  const handler = (ev: any) => {
    // storage events in other tabs include ev.key
    try {
      if (ev && ev.key) {
        if (ev.key === key) cb();
        return;
      }
    } catch (e) {
      // ignore
    }

    // Custom event from save() includes detail.key
    try {
      const detailKey = ev?.detail?.key;
      if (!detailKey || detailKey === key) cb();
    } catch (e) {
      cb();
    }
  };
  window.addEventListener('storage', handler as any);
  window.addEventListener('obrolin:chat_quota_updated', handler as any);
  return () => {
    window.removeEventListener('storage', handler as any);
    window.removeEventListener('obrolin:chat_quota_updated', handler as any);
  };
}

export { DAILY_LIMIT };
