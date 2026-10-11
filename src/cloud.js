import { supabase } from './supabase.js';

const SEP = '\u0001';
// session | term | assessment round, taken from the school details
export const periodOf = (g) => [g.session, g.term, g.ca].join('|');
export const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });

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

export async function fetchScores(classId, period) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('class_scores').select('student,subject,comp,value')
      .eq('class_id', classId).eq('period', period)
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
  const cls = await supabase.from('classes').select('id,name,published,data');
  if (cls.error) return { error: cls.error };
  const asg = await supabase.from('assignments').select('class_id,subject,teacher_id');
  if (asg.error) return { error: asg.error };
  let people = [];
  if (role === 'admin') {
    const p = await supabase.from('profiles').select('id,email,name,role').order('email');
    if (p.error) return { error: p.error };
    people = p.data;
  }
  return { role, glob: sch.data ? sch.data.data.school || null : null, classes: cls.data.sort(byName), assign: asg.data, people };
}

const now = () => new Date().toISOString();
export const saveGlobal = async (g) => (await supabase.from('school').upsert({ id: 1, data: { school: g }, updated_at: now() })).error;
export const saveClass = async (c) => (await supabase.from('classes').update({ name: c.name, data: c.data }).eq('id', c.id)).error;
export const createClass = async (name, data) => {
  const { data: row, error } = await supabase.from('classes').insert({ name, data }).select('id,name,published,data').single();
  return { row, error };
};
export const removeClass = async (id) => (await supabase.from('classes').delete().eq('id', id)).error;
export const setPublished = async (id, v) => (await supabase.from('classes').update({ published: v }).eq('id', id)).error;
export const assignTeacher = async (classId, subject, teacherId) => {
  if (!teacherId) return (await supabase.from('assignments').delete().match({ class_id: classId, subject })).error;
  return (await supabase.from('assignments').upsert({ class_id: classId, subject, teacher_id: teacherId })).error;
};

// Writes only the cells that changed since the last save, so teachers never overwrite each other.
export async function saveScores(classId, period, prev, next) {
  const stamp = now();
  const up = [], del = [];
  next.forEach((v, key) => {
    if (prev.get(key) !== v) { const [student, subject, comp] = key.split(SEP); up.push({ class_id: classId, period, student, subject, comp, value: v, updated_at: stamp }); }
  });
  prev.forEach((_v, key) => {
    if (!next.has(key)) { const [student, subject, comp] = key.split(SEP); del.push({ class_id: classId, period, student, subject, comp }); }
  });
  for (let i = 0; i < up.length; i += 500) {
    const { error } = await supabase.from('class_scores').upsert(up.slice(i, i + 500));
    if (error) return error;
  }
  for (const d of del) {
    const { error } = await supabase.from('class_scores').delete().match(d);
    if (error) return error;
  }
  return null;
}
