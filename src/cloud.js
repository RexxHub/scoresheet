import { supabase } from './supabase.js';

const SEP = '\u0001';
export const periodOf = (S) => [S.school.session, S.school.term, S.school.ca].join('|');

// scores {student:{subject:{comp:value}}} <-> flat Map, so only changed cells are saved
export const flatten = (scores) => {
  const m = new Map();
  Object.entries(scores || {}).forEach(([n, subs]) => Object.entries(subs || {}).forEach(([s, comps]) => Object.entries(comps || {}).forEach(([k, v]) => {
    if (v !== '' && v !== undefined && v !== null && !isNaN(+v)) m.set([n, s, k].join(SEP), +v);
  })));
  return m;
};
const unflatten = (rows) => {
  const o = {};
  rows.forEach((r) => {
    if (!o[r.student]) o[r.student] = {};
    if (!o[r.student][r.subject]) o[r.student][r.subject] = {};
    o[r.student][r.subject][r.comp] = Number(r.value);
  });
  return o;
};

export async function fetchScores(period) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('scores').select('student,subject,comp,value').eq('period', period)
      .order('student').order('subject').order('comp').range(from, from + 999);
    if (error) return { error };
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return { scores: unflatten(rows) };
}

export async function loadAll(uid) {
  const prof = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle();
  if (prof.error) return { error: prof.error };
  const role = prof.data && prof.data.role === 'admin' ? 'admin' : 'teacher';
  const sch = await supabase.from('school').select('data').eq('id', 1).maybeSingle();
  if (sch.error) return { error: sch.error };
  if (!sch.data) return { role, config: null, scores: {} };
  const sc = await fetchScores(periodOf(sch.data.data));
  if (sc.error) return { error: sc.error };
  return { role, config: sch.data.data, scores: sc.scores };
}

export async function saveConfig(config) {
  const { error } = await supabase.from('school').upsert({ id: 1, data: config, updated_at: new Date().toISOString() });
  return error;
}

// Writes only the cells that changed since the last save, so teachers never overwrite each other.
export async function saveScores(period, prev, next) {
  const now = new Date().toISOString();
  const up = [], del = [];
  next.forEach((v, key) => {
    if (prev.get(key) !== v) { const [student, subject, comp] = key.split(SEP); up.push({ period, student, subject, comp, value: v, updated_at: now }); }
  });
  prev.forEach((_v, key) => {
    if (!next.has(key)) { const [student, subject, comp] = key.split(SEP); del.push({ period, student, subject, comp }); }
  });
  for (let i = 0; i < up.length; i += 500) {
    const { error } = await supabase.from('scores').upsert(up.slice(i, i + 500));
    if (error) return error;
  }
  for (const d of del) {
    const { error } = await supabase.from('scores').delete().match(d);
    if (error) return error;
  }
  return null;
}
