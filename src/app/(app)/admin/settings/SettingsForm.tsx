'use client';

import { useState } from 'react';
import { api, isOk } from '@/lib/api';
import type { ReviewWindow } from '@/shared/review-format';

export function SettingsForm({ initial }: { initial: ReviewWindow }) {
  const [w, setW] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const field = (key: keyof ReviewWindow, label: string, min: number, max: number) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: 12 }}>
      <span style={{ letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6b6659' }}>{label}</span>
      <input type="number" min={min} max={max} value={w[key]}
        onChange={(e) => setW({ ...w, [key]: Number(e.target.value) })}
        style={{ fontFamily: 'var(--mono)', fontSize: 14, padding: '0.5rem', border: '1px solid #d8d4c8', width: '6rem' }} />
    </label>
  );

  async function save() {
    setBusy(true); setMsg(null);
    const res = await api<{ reviewWindow: ReviewWindow }>('/api/v1/admin/settings/review-window', { method: 'PUT', auth: true, body: JSON.stringify(w) });
    setBusy(false);
    if (isOk(res)) { setW(res.data.reviewWindow); setMsg('Saved. The composer and the server now use these.'); }
    else setMsg((res as { error: { message: string } }).error.message);
  }

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        {field('hookMaxWords', 'Hook max words', 1, 14)}
        {field('bodyMinWords', 'Body min words', 30, 120)}
        {field('bodyMaxWords', 'Body max words', 30, 120)}
        {field('underdogMaxSentences', 'Underdog sentences', 1, 3)}
      </div>
      <div style={{ marginTop: '1.2rem', display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
        <button className="btn" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        {msg && <span style={{ fontSize: 12, color: '#0b6b3a' }}>{msg}</span>}
      </div>
    </div>
  );
}
