import { useState } from 'react';
import { testConnection, saveConfig, envIssue } from './supabase.js';
import { defaults } from './lib.js';
import Logo from './Logo.jsx';
import Footer from './Footer.jsx';

const school = defaults().school.name;

export default function ConnectSupabase({ onOffline }) {
  const [f, setF] = useState({ url: '', key: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    const err = await testConnection(f.url, f.key);
    if (err) { setMsg(err); setBusy(false); return; }
    saveConfig(f.url, f.key);
    window.location.reload();
  };

  return (
    <div className="authwrap">
      <div className="authside">
        <span className="logotile big"><Logo size="lg" /></span>
        <h1>{school}</h1>
        <p>Connect the portal to Supabase so teachers can have their own accounts and their scores are saved online.</p>
      </div>
      <div className="authmain">
        <form className="auth" onSubmit={submit}>
          <h2>Connect to Supabase</h2>
          <p className="hint">Find both values in Supabase under Project Settings, then API.</p>
          {envIssue && <p className="err" role="alert">Your .env file has a problem: {envIssue}</p>}
          <label>Project URL
            <input value={f.url} onChange={set('url')} placeholder="https://abcdefgh.supabase.co" required autoComplete="off" spellCheck="false" />
          </label>
          <label>Anon public key
            <input value={f.key} onChange={set('key')} placeholder="eyJ..." required autoComplete="off" spellCheck="false" />
          </label>
          {msg && <p className="err" role="alert">{msg}</p>}
          <button className="btn full" disabled={busy}>{busy ? 'Testing connection...' : 'Test and connect'}</button>
          <p className="swap">
            <button type="button" className="lnk" onClick={onOffline}>Continue offline (this browser only)</button>
          </p>
        </form>
        <Footer />
      </div>
    </div>
  );
}
