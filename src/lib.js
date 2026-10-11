export const SUBJECTS = ['MATHEMATICS','ENGLISH LANGUAGE','BASIC SCIENCE & TECHNOLOGY','CULTURAL & CREATIVE ARTS','IGBO LANGUAGE','FRENCH','BUSINESS STUDIES','NATIONAL VALUE EDUCATION','NIGERIA HISTORY','CHRISTIAN RELIGIOUS STUDIES','PREVOCATIONAL STUDIES'];
const NAMES = 'AGBO CHIMDI, M\nCHUKWUEZE NELLY, F\nEKWUEME CHIOMA, F\nIFEANYI PRAISE, F\nILOACHIE IFEANYICHUKWU, M\nMADU CHIGOZIE, M';

export const parseStudents = (t) => t.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
  const m = l.match(/^(.*?)[,\t]\s*([A-Za-z]+)$/);
  return m ? { n: m[1].trim().toUpperCase(), g: /^f/i.test(m[2]) ? 'FEMALE' : 'MALE' } : { n: l.toUpperCase(), g: 'MALE' };
});

export const defaults = () => ({
  school: { name: 'THE WINS SECONDARY SCHOOL ENUGU', addr: 'No.8 Rangers Avenue, Independence Layout Enugu', ca: 'FIRST', session: '2025/2026', section: 'JUNIOR SECTION', term: '2ND', cls: 'YEAR 8', teacher: '', desig: '' },
  comps: [{ k: 'ha', n: 'H/A', m: 5 }, { k: 'cw', n: 'C/W', m: 2 }, { k: 'as', n: 'ASS', m: 2 }, { k: 'nt', n: 'NOTE', m: 1 }, { k: 'cat', n: 'CAT1', m: 10 }],
  subjects: SUBJECTS, students: parseStudents(NAMES), scores: {}, rem: {},
});

export const loadState = () => {
  try { const o = JSON.parse(localStorage.getItem('caportal') || 'null'); if (o && o.school) return o; } catch (e) { /* ignore */ }
  return defaults();
};
export const saveState = (s) => { try { localStorage.setItem('caportal', JSON.stringify(s)); } catch (e) { /* ignore */ } };

export const maxTotal = (S) => S.comps.reduce((a, c) => a + (+c.m || 0), 0);
export const gradeOf = (p) => (p >= 80 ? 'A' : p >= 70 ? 'B' : p >= 60 ? 'C' : p >= 50 ? 'P' : 'F');
const r2 = (x) => Math.round(x * 100) / 100;
export const getScore = (S, n, s) => (S.scores[n] && S.scores[n][s]) || {};
export const calc = (S, n, s) => {
  const v = getScore(S, n, s);
  const f = S.comps.some((c) => v[c.k] !== undefined && v[c.k] !== '');
  const t = S.comps.reduce((a, c) => a + (+v[c.k] || 0), 0);
  const mt = maxTotal(S);
  const p = mt ? (t / mt) * 100 : 0;
  return { f, t: r2(t), p: r2(p), g: f ? gradeOf(p) : '' };
};
export const scoredCount = (S, s) => S.students.filter((st) => calc(S, st.n, s).f).length;

export const initials = (n) => (n || '').split(/\s+/).filter((w) => w && !/^(THE|OF|AND)$/i.test(w)).slice(0, 3).map((w) => w[0]).join('').toUpperCase() || 'CA';
export const subjectStats = (S, s) => {
  const r = S.students.map((st) => calc(S, st.n, s)).filter((c) => c.f);
  if (!r.length) return { n: 0, avg: null, hi: null, lo: null };
  const p = r.map((c) => c.p);
  return { n: r.length, avg: Math.round((p.reduce((a, b) => a + b, 0) / p.length) * 10) / 10, hi: Math.max(...p), lo: Math.min(...p) };
};
export const overall = (S, st) => {
  const r = S.subjects.map((s) => calc(S, st.n, s)).filter((c) => c.f);
  const mt = maxTotal(S) * r.length;
  const sum = r.reduce((a, c) => a + c.t, 0);
  const pct = mt ? Math.round((sum / mt) * 1000) / 10 : 0;
  return { n: r.length, sum: Math.round(sum * 100) / 100, max: mt, pct, g: r.length ? gradeOf(pct) : '' };
};
