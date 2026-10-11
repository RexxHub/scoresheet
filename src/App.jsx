import { useState, useEffect, useRef } from 'react';
import { loadState, saveState, defaults, isSenior, sectionOf, hasMock, SUBJECTS, SENIOR_SUBJECTS } from './lib.js';
import Icon from './Icon.jsx';
import { supabase, configured } from './supabase.js';
import * as cloud from './cloud.js';
import { flatten, periodOf, byName } from './cloud.js';
import Auth from './Auth.jsx';
import SetupHelp from './SetupHelp.jsx';
import ConnectSupabase from './ConnectSupabase.jsx';
import Setup from './Setup.jsx';
import Scores from './Scores.jsx';
import Reports from './Reports.jsx';
import Certificates from './Certificates.jsx';
import ClassBar from './ClassBar.jsx';
import Backup from './Backup.jsx';
import Logo from './Logo.jsx';
import Footer from './Footer.jsx';

const TABS = [['set', 'Setup', 'set'], ['sco', 'Enter scores', 'edit'], ['rep', 'Report slips', 'file'], ['cer', 'Mock certificates', 'file'], ['bak', 'Backup and export', 'file']];
const SUB = { set: 'School, class, subjects, students and teachers', sco: 'Record marks one subject at a time', rep: 'Review, add remarks and print', cer: 'Print the mock statement of result', bak: 'Download your records' };
const missingTable = (e) => e && (e.code === 'PGRST205' || e.code === '42P01' || /(schema cache|does not exist)/i.test(e.message || ''));

// school-wide fields are saved once; class fields (cls, teacher, desig, section) belong to each class
const strip = (o) => { const c = { ...o }; ['cls', 'teacher', 'desig', 'section'].forEach((k) => delete c[k]); return c; };
const cleanGlob = (raw) => ({ ...strip(defaults().school), ...strip(raw || {}) });
const newClassData = (name) => ({
  teacher: '', desig: '', comps: defaults().comps, students: [], rem: {},
  subjects: isSenior({ school: { cls: name } }) ? [...SENIOR_SUBJECTS] : [...SUBJECTS],
});

export default function App() {
  const [session, setSession] = useState(configured ? undefined : null);
  const [off, setOff] = useState(() => loadState());
  const [glob, setGlob] = useState(null);
  const [classes, setClasses] = useState([]);
  const [assign, setAssign] = useState([]);
  const [people, setPeople] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [scores, setScores] = useState({});
  const [role, setRole] = useState('admin');
  const [ready, setReady] = useState(!configured);
  const [status, setStatus] = useState('');
  const [noTable, setNoTable] = useState(false);
  const [offline, setOffline] = useState(false);
  const [tab, setTab] = useState('set');
  const uid = session && session.user.id;

  const savedMap = useRef(new Map());
  const savedGlob = useRef('');
  const savedCls = useRef({});
  const ctx = useRef({ classId: '', period: '' });
  const queue = useRef(Promise.resolve());
  const latest = useRef({});
  const sRef = useRef(null);

  // ---- the view the screens work with: school-wide details + the active class
  const cls = classes.find((c) => c.id === activeId) || null;
  let S = null;
  if (!configured) S = off;
  else if (glob && cls) {
    const d = cls.data || {};
    const mine = role === 'admin' ? null : assign.filter((a) => a.class_id === cls.id && a.teacher_id === uid).map((a) => a.subject);
    const subs = d.subjects || [];
    S = {
      school: { ...glob, cls: cls.name, section: sectionOf({ school: { cls: cls.name } }), teacher: d.teacher || '', desig: d.desig || '' },
      comps: d.comps || defaults().comps,
      subjects: mine ? subs.filter((s) => mine.includes(s)) : subs,
      students: d.students || [],
      scores,
      rem: d.rem || {},
    };
  }
  sRef.current = S;
  latest.current = { glob, classes, scores, role };

  // ---- saving
  const persist = async () => {
    const L = latest.current;
    let err = null;
    if (L.role === 'admin' && L.glob) {
      const gs = JSON.stringify(L.glob);
      if (gs !== savedGlob.current) { err = await cloud.saveGlobal(L.glob); if (!err) savedGlob.current = gs; }
      for (const c of L.classes) {
        if (err) break;
        const cs = JSON.stringify([c.name, c.data]);
        if (savedCls.current[c.id] !== cs) { err = await cloud.saveClass(c); if (!err) savedCls.current[c.id] = cs; }
      }
    }
    if (!err && ctx.current.classId) {
      const next = flatten(L.scores);
      err = await cloud.saveScores(ctx.current.classId, ctx.current.period, savedMap.current, next);
      if (!err) savedMap.current = next;
    }
    return err;
  };
  const persistQ = () => { queue.current = queue.current.then(persist, persist); return queue.current; };

  const up = (fn) => {
    if (!configured) { setOff((p) => { const n = structuredClone(p); fn(n); return n; }); return; }
    const base = sRef.current;
    if (!base) return;
    const n = structuredClone(base);
    fn(n);
    sRef.current = n;
    setScores(n.scores);
    if (latest.current.role !== 'admin') return;
    setGlob(strip(n.school));
    setClasses((cs) => cs.map((c) => (c.id === activeId ? { ...c, data: { teacher: n.school.teacher, desig: n.school.desig, comps: n.comps, subjects: n.subjects, students: n.students, rem: n.rem } } : c)));
  };

  const openClass = async (id, g) => {
    const gl = g || latest.current.glob;
    const period = periodOf(gl);
    if (!id) { ctx.current = { classId: '', period }; savedMap.current = new Map(); setScores({}); setActiveId(''); return; }
    const r = await cloud.fetchScores(id, period);
    if (r.error) { setStatus('Could not load scores: ' + r.error.message); return; }
    ctx.current = { classId: id, period };
    savedMap.current = flatten(r.scores);
    setScores(r.scores);
    setActiveId(id);
  };

  // ---- login session
  useEffect(() => {
    if (!configured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // ---- first load after login
  useEffect(() => {
    if (!configured) return;
    if (!uid) { setReady(false); return; }
    let dead = false;
    (async () => {
      const r = await cloud.loadAll(uid);
      if (dead) return;
      if (r.error) {
        if (missingTable(r.error)) setNoTable(true);
        else setStatus('Could not load your data: ' + r.error.message);
        return;
      }
      setNoTable(false);
      const g = cleanGlob(r.glob);
      savedGlob.current = r.glob ? JSON.stringify(g) : '';
      savedCls.current = Object.fromEntries(r.classes.map((c) => [c.id, JSON.stringify([c.name, c.data])]));
      latest.current = { ...latest.current, glob: g, role: r.role };
      setRole(r.role); setGlob(g); setClasses(r.classes); setAssign(r.assign); setPeople(r.people);
      await openClass(r.classes[0] ? r.classes[0].id : '', g);
      if (dead) return;
      setTab(r.role === 'admin' ? 'set' : 'sco');
      setStatus('');
      setReady(true);
    })();
    return () => { dead = true; };
  }, [uid]);

  // ---- autosave
  useEffect(() => {
    if (!ready) return;
    if (!configured) { saveState(off); return; }
    setStatus('Saving...');
    const t = setTimeout(async () => {
      const err = await persistQ();
      setStatus(err ? 'Not saved: ' + err.message : 'All changes saved');
    }, 800);
    return () => clearTimeout(t);
  }, [glob, classes, scores, off, ready]);

  // ---- when the admin changes session, term or assessment, show the scores for that period
  const curPeriod = configured && ready && glob ? periodOf(glob) : '';
  useEffect(() => {
    if (!curPeriod || !ctx.current.classId || curPeriod === ctx.current.period) return;
    let dead = false;
    const t = setTimeout(async () => {
      await persistQ();
      if (dead) return;
      const r = await cloud.fetchScores(ctx.current.classId, curPeriod);
      if (dead || r.error) return;
      ctx.current = { ...ctx.current, period: curPeriod };
      savedMap.current = flatten(r.scores);
      setScores(r.scores);
    }, 900);
    return () => { dead = true; clearTimeout(t); };
  }, [curPeriod]);

  // ---- refreshing what other people changed
  const refresh = async () => {
    if (!configured || !ready || status === 'Saving...') return;
    await persistQ();
    if (role === 'admin') {
      if (!ctx.current.classId) return;
      const r = await cloud.fetchScores(ctx.current.classId, ctx.current.period);
      if (r.error) return;
      savedMap.current = flatten(r.scores);
      setScores(r.scores);
      return;
    }
    const r = await cloud.loadAll(uid);
    if (r.error) return;
    const g = cleanGlob(r.glob);
    latest.current = { ...latest.current, glob: g };
    setGlob(g); setClasses(r.classes); setAssign(r.assign);
    savedCls.current = Object.fromEntries(r.classes.map((c) => [c.id, JSON.stringify([c.name, c.data])]));
    await openClass(r.classes.some((c) => c.id === activeId) ? activeId : (r.classes[0] ? r.classes[0].id : ''), g);
  };
  const openTab = (k) => { setTab(k); refresh(); };
  const selectClass = async (id) => { await persistQ(); await openClass(id); };

  // ---- admin actions
  const addClass = async (name) => {
    await persistQ();
    const { row, error } = await cloud.createClass(name, newClassData(name));
    if (error) { setStatus('Could not create the class: ' + error.message); return; }
    savedCls.current[row.id] = JSON.stringify([row.name, row.data]);
    setClasses((cs) => [...cs, row].sort(byName));
    await openClass(row.id);
    setTab('set');
  };
  const deleteClass = async (id) => {
    if (!window.confirm('Delete this class with all its students, assignments and scores? This cannot be undone.')) return;
    await persistQ();
    ctx.current = { ...ctx.current, classId: '' };
    const err = await cloud.removeClass(id);
    if (err) { setStatus('Could not delete the class: ' + err.message); return; }
    const rest = classes.filter((c) => c.id !== id);
    delete savedCls.current[id];
    setClasses(rest);
    setAssign((a) => a.filter((x) => x.class_id !== id));
    await openClass(rest[0] ? rest[0].id : '');
  };
  const publish = async (v) => {
    await persistQ();
    const err = await cloud.setPublished(activeId, v);
    if (err) { setStatus('Could not change the publish status: ' + err.message); return; }
    setClasses((cs) => cs.map((c) => (c.id === activeId ? { ...c, published: v } : c)));
  };
  const assignSubject = async (subject, teacherId) => {
    const err = await cloud.assignTeacher(activeId, subject, teacherId);
    if (err) { setStatus('Could not save the assignment: ' + err.message); return; }
    setAssign((a) => {
      const rest = a.filter((x) => !(x.class_id === activeId && x.subject === subject));
      return teacherId ? [...rest, { class_id: activeId, subject, teacher_id: teacherId }] : rest;
    });
  };

  // ---- screens before the app
  if (!configured && !offline) return <ConnectSupabase onOffline={() => setOffline(true)} />;
  if (session === undefined) return <p className="center">Loading...</p>;
  if (configured && !session) return <Auth />;
  if (configured && noTable) return <SetupHelp onRetry={() => window.location.reload()} />;
  if (configured && !ready) {
    return (
      <p className="center">
        {status || 'Loading your data...'}
        {status && <><br /><button className="btn" onClick={() => window.location.reload()}>Try again</button></>}
      </p>
    );
  }
  const isAdmin = !configured || role === 'admin';
  if (configured && !isAdmin && !S) {
    return (
      <p className="center">
        No class has been assigned to you yet. Ask the admin to assign you a subject and publish the class.<br />
        <button className="btn" onClick={refresh}>Check again</button>{' '}
        <button className="btn alt" onClick={() => supabase.auth.signOut()}>Log out</button>
      </p>
    );
  }

  const visible = isAdmin ? TABS.filter((t) => (t[0] !== 'cer' || (S && hasMock(S))) && (t[0] !== 'bak' || configured)) : TABS.filter((t) => t[0] === 'sco');
  const cur = visible.some((t) => t[0] === tab) ? tab : visible[0][0];
  const who = session && (session.user.user_metadata.name || session.user.email);
  const cx = configured && isAdmin && cls ? {
    published: cls.published,
    people: people.filter((p) => p.role !== 'admin'),
    teacherOf: (subject) => (assign.find((a) => a.class_id === activeId && a.subject === subject) || {}).teacher_id || '',
    assign: assignSubject,
    publish,
  } : null;

  return (
    <div className="shell">
      <aside className="noprint">
        <div className="brand">
          <span className="logotile"><Logo size="sm" /></span>
          <div><b>{S ? S.school.name : 'CA Score Portal'}</b><small>CA Score Portal</small></div>
        </div>
        <nav className="side" role="tablist">
          {visible.map(([k, l, ic]) => (
            <button key={k} role="tab" aria-current={cur === k ? 'page' : undefined} onClick={() => openTab(k)}>
              <Icon n={ic} />{l}
            </button>
          ))}
        </nav>
        {configured && (
          <div className="me">
            <span className="who">{who}<br /><small>{isAdmin ? 'Admin' : 'Teacher'}</small></span>
            <button className="out" onClick={() => supabase.auth.signOut()}><Icon n="out" />Log out</button>
          </div>
        )}
      </aside>
      <div className="content">
        {!configured && <p className="banner noprint">Offline mode: scores are saved in this browser only. <button className="lnk" onClick={() => setOffline(false)}>Connect Supabase</button> to turn on teacher accounts.</p>}
        {configured && (
          <ClassBar classes={classes} activeId={activeId} admin={isAdmin} onSelect={selectClass} onAdd={addClass} onDelete={deleteClass} />
        )}
        <div className="top noprint">
          <div>
            <h1>{visible.find((t) => t[0] === cur)[1]}</h1>
            <p>{cur === 'bak' ? SUB.bak : S ? `${SUB[cur]}. ${S.school.cls}, ${S.school.term} term, ${S.school.session} session.` : 'Create your first class to begin.'}</p>
          </div>
          <span className="topr">
            {configured && !isAdmin && <button className="btn alt" onClick={refresh}>Refresh</button>}
            {configured && status && <span className="save">{status}</span>}
          </span>
        </div>
        {!S && cur !== 'bak' && (
          <section className="card">
            <h2>No class yet</h2>
            <p className="hint">Use <b>+ New class</b> above to add a class (Year 7 to Year 12). Then fill in its students and subjects, assign a teacher to each subject, and publish it.</p>
          </section>
        )}
        {cur === 'bak' && glob && <Backup classes={classes} glob={glob} />}
        {S && cur === 'set' && <Setup key={activeId} S={S} up={up} cx={cx} />}
        {S && cur === 'sco' && <Scores key={activeId} S={S} up={up} />}
        {S && cur === 'rep' && <Reports key={activeId} S={S} up={up} />}
        {S && cur === 'cer' && <Certificates key={activeId} S={S} up={up} />}
        <div className="noprint"><Footer /></div>
      </div>
    </div>
  );
}
