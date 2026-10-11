import { useState, useEffect } from 'react';
import { loadState, saveState, defaults } from './lib.js';
import Icon from './Icon.jsx';
import { supabase, configured } from './supabase.js';
import Auth from './Auth.jsx';
import SetupHelp from './SetupHelp.jsx';
import ConnectSupabase from './ConnectSupabase.jsx';
import Setup from './Setup.jsx';
import Scores from './Scores.jsx';
import Reports from './Reports.jsx';
import Logo from './Logo.jsx';
import Footer from './Footer.jsx';

const TABS = [['set', 'Setup', 'set'], ['sco', 'Enter scores', 'edit'], ['rep', 'Report slips', 'file']];
const missingTable = (e) => e && (e.code === 'PGRST205' || e.code === '42P01' || /ca_state/.test(e.message || '') && /(schema cache|does not exist)/i.test(e.message || ''));
const SUB = { set: 'School, class, subjects and students', sco: 'Record marks one subject at a time', rep: 'Review, add remarks and print' };

export default function App() {
  const [session, setSession] = useState(configured ? undefined : null);
  const [S, setS] = useState(() => (configured ? defaults() : loadState()));
  const [ready, setReady] = useState(!configured);
  const [status, setStatus] = useState('');
  const [noTable, setNoTable] = useState(false);
  const [offline, setOffline] = useState(false);
  const [tab, setTab] = useState('set');
  const uid = session && session.user.id;

  // watch the login session
  useEffect(() => {
    if (!configured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // load this teacher's saved data after login
  useEffect(() => {
    if (!configured) return;
    if (!uid) { setReady(false); return; }
    let off = false;
    supabase.from('ca_state').select('data').eq('user_id', uid).maybeSingle().then(({ data, error }) => {
      if (off) return;
      if (error) {
        if (missingTable(error)) setNoTable(true);
        else setStatus('Could not load your saved data: ' + error.message);
        return;
      }
      setNoTable(false);
      setS(data ? data.data : defaults());
      setStatus('');
      setReady(true);
    });
    return () => { off = true; };
  }, [uid]);

  // save changes (cloud when configured, browser otherwise)
  useEffect(() => {
    if (!ready) return;
    if (!configured) { saveState(S); return; }
    setStatus('Saving...');
    const t = setTimeout(async () => {
      const { error } = await supabase.from('ca_state').upsert({ user_id: uid, data: S, updated_at: new Date().toISOString() });
      setStatus(error ? 'Not saved: ' + error.message : 'All changes saved');
    }, 800);
    return () => clearTimeout(t);
  }, [S, ready]);

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

  const who = session && (session.user.user_metadata.name || session.user.email);

  return (
    <div className="shell">
      <aside className="noprint">
        <div className="brand">
          <span className="logotile"><Logo size="sm" /></span>
          <div><b>{S.school.name}</b><small>CA Score Portal</small></div>
        </div>
        <nav className="side" role="tablist">
          {TABS.map(([k, l, ic]) => (
            <button key={k} role="tab" aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}>
              <Icon n={ic} />{l}
            </button>
          ))}
        </nav>
        {configured && (
          <div className="me">
            <span className="who">{who}</span>
            <button className="out" onClick={() => supabase.auth.signOut()}><Icon n="out" />Log out</button>
          </div>
        )}
      </aside>
      <div className="content">
        {!configured && <p className="banner noprint">Offline mode: scores are saved in this browser only. <button className="lnk" onClick={() => setOffline(false)}>Connect Supabase</button> to turn on teacher accounts.</p>}
        <div className="top noprint">
          <div>
            <h1>{TABS.find((t) => t[0] === tab)[1]}</h1>
            <p>{SUB[tab]}. {S.school.cls}, {S.school.term} term, {S.school.session} session.</p>
          </div>
          {configured && status && <span className="save">{status}</span>}
        </div>
        {tab === 'set' && <Setup S={S} up={up} />}
        {tab === 'sco' && <Scores S={S} up={up} />}
        {tab === 'rep' && <Reports S={S} up={up} />}
        <div className="noprint"><Footer /></div>
      </div>
    </div>
  );
}
