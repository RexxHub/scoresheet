import { useState, useEffect, useRef } from 'react';
import { loadState, saveState, defaults } from './lib.js';
import Icon from './Icon.jsx';
import { supabase, configured } from './supabase.js';
import { loadAll, fetchScores, saveConfig, saveScores, flatten, periodOf } from './cloud.js';
import Auth from './Auth.jsx';
import SetupHelp from './SetupHelp.jsx';
import ConnectSupabase from './ConnectSupabase.jsx';
import Setup from './Setup.jsx';
import Scores from './Scores.jsx';
import Reports from './Reports.jsx';
import Logo from './Logo.jsx';
import Footer from './Footer.jsx';

const TABS = [['set', 'Setup', 'set'], ['sco', 'Enter scores', 'edit'], ['rep', 'Report slips', 'file']];
const missingTable = (e) => e && (e.code === 'PGRST205' || e.code === '42P01' || /(schema cache|does not exist)/i.test(e.message || ''));
const SUB = { set: 'School, class, subjects and students', sco: 'Record marks one subject at a time', rep: 'Review, add remarks and print' };

export default function App() {
  const [session, setSession] = useState(configured ? undefined : null);
  const [S, setS] = useState(() => (configured ? defaults() : loadState()));
  const [ready, setReady] = useState(!configured);
  const [role, setRole] = useState('admin');
  const [waiting, setWaiting] = useState(false);
  const [status, setStatus] = useState('');
  const [noTable, setNoTable] = useState(false);
  const [offline, setOffline] = useState(false);
  const [tab, setTab] = useState('set');
  const uid = session && session.user.id;
  const per = useRef('');
  const savedMap = useRef(new Map());
  const savedCfg = useRef('');

  // watch the login session
  useEffect(() => {
    if (!configured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // after login: load the role, the school setup and the scores
  useEffect(() => {
    if (!configured) return;
    if (!uid) { setReady(false); return; }
    let off = false;
    loadAll(uid).then((r) => {
      if (off) return;
      if (r.error) {
        if (missingTable(r.error)) setNoTable(true);
        else setStatus('Could not load your data: ' + r.error.message);
        return;
      }
      setNoTable(false);
      setRole(r.role);
      if (!r.config && r.role !== 'admin') { setWaiting(true); setReady(true); return; }
      setWaiting(false);
      const base = r.config ? { ...r.config, scores: r.scores } : defaults();
      per.current = periodOf(base);
      savedMap.current = flatten(base.scores);
      savedCfg.current = r.config ? JSON.stringify(r.config) : '';
      setS(base);
      setTab(r.role === 'admin' ? 'set' : 'sco');
      setStatus('');
      setReady(true);
    });
    return () => { off = true; };
  }, [uid]);

  // save changes (cloud when configured, browser otherwise)
  useEffect(() => {
    if (!ready || waiting) return;
    if (!configured) { saveState(S); return; }
    setStatus('Saving...');
    const t = setTimeout(async () => {
      const { scores, ...config } = S;
      let err = null;
      const cfgStr = JSON.stringify(config);
      if (role === 'admin' && cfgStr !== savedCfg.current) {
        err = await saveConfig(config);
        if (!err) savedCfg.current = cfgStr;
      }
      if (!err) {
        const next = flatten(scores);
        err = await saveScores(per.current, savedMap.current, next);
        if (!err) savedMap.current = next;
      }
      setStatus(err ? 'Not saved: ' + err.message : 'All changes saved');
    }, 800);
    return () => clearTimeout(t);
  }, [S, ready]);

  // when the admin changes session, term or CA, show the scores for that period
  const curPeriod = configured && ready && !waiting ? periodOf(S) : '';
  useEffect(() => {
    if (!curPeriod || curPeriod === per.current) return;
    let off = false;
    fetchScores(curPeriod).then((r) => {
      if (off || r.error) return;
      per.current = curPeriod;
      savedMap.current = flatten(r.scores);
      setS((p) => ({ ...p, scores: r.scores }));
    });
    return () => { off = true; };
  }, [curPeriod]);

  // pull in scores that teachers entered since this page loaded
  const reloadScores = async () => {
    if (!configured || !ready || waiting || status === 'Saving...') return;
    const r = await fetchScores(per.current);
    if (r.error) return;
    savedMap.current = flatten(r.scores);
    setS((p) => ({ ...p, scores: r.scores }));
  };
  const openTab = (k) => { setTab(k); if (k === 'rep' || k === 'sco') reloadScores(); };

  const up = (fn) => setS((prev) => { const n = structuredClone(prev); fn(n); return n; });

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
  if (waiting) {
    return (
      <p className="center">
        The class has not been set up yet. Ask the admin to log in first and finish the Setup tab.<br />
        <button className="btn" onClick={() => window.location.reload()}>Check again</button>{' '}
        <button className="btn alt" onClick={() => supabase.auth.signOut()}>Log out</button>
      </p>
    );
  }

  const isAdmin = !configured || role === 'admin';
  const visible = isAdmin ? TABS : TABS.filter((t) => t[0] === 'sco');
  const cur = visible.some((t) => t[0] === tab) ? tab : visible[0][0];
  const who = session && (session.user.user_metadata.name || session.user.email);

  return (
    <div className="shell">
      <aside className="noprint">
        <div className="brand">
          <span className="logotile"><Logo size="sm" /></span>
          <div><b>{S.school.name}</b><small>CA Score Portal</small></div>
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
        <div className="top noprint">
          <div>
            <h1>{visible.find((t) => t[0] === cur)[1]}</h1>
            <p>{SUB[cur]}. {S.school.cls}, {S.school.term} term, {S.school.session} session.</p>
          </div>
          {configured && status && <span className="save">{status}</span>}
        </div>
        {cur === 'set' && <Setup S={S} up={up} />}
        {cur === 'sco' && <Scores S={S} up={up} />}
        {cur === 'rep' && <Reports S={S} up={up} />}
        <div className="noprint"><Footer /></div>
      </div>
    </div>
  );
}
