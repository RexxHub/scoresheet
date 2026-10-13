import { useState } from 'react';
import { supabase, hasStoredConfig, clearConfig } from './supabase.js';
import { defaults } from './lib.js';
import Logo from './Logo.jsx';
import Footer from './Footer.jsx';

const school = defaults().school.name;

export default function Auth() {
  const [mode, setMode] = useState('in');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [msg, setMsg] = useState({ text: '', ok: false });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg({ text: '', ok: false });
    const { name, email, password } = f;
    const res = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { name } } });
    setBusy(false);
    if (res.error) setMsg({ text: /failed to fetch|networkerror/i.test(res.error.message) ? 'Cannot reach Supabase. The Project URL is wrong, the project is paused, or your internet is down.' : res.error.message, ok: false });
    else if (mode === 'up' && !res.data.session) {
      setMsg({ text: 'Account created. Check your email to confirm it, then log in.', ok: true });
      setMode('in');
    }
  };

  return (
    <div className="authwrap">
      <div className="authside">
        <span className="logotile big"><Logo size="lg" /></span>
        <h1>{school}</h1>
        <p>Record continuous assessment scores once, then print clean report slips for every student.</p>
      </div>
      <div className="authmain">
        <form className="auth" onSubmit={submit}>
          <h2>{mode === 'in' ? 'Teacher log in' : 'Create a teacher account'}</h2>
          <p className="hint">{mode === 'in' ? 'Enter your details to open your class scores.' : 'Use your school email so you can recover your account.'}</p>
          {mode === 'up' && (
            <label>Full name
              <input value={f.name} onChange={set('name')} required autoComplete="name" />
            </label>
          )}
          <label>Email
            <input type="email" value={f.email} onChange={set('email')} required autoComplete="email" />
          </label>
          <label>Password
            <input type="password" value={f.password} onChange={set('password')} required minLength={6}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
          </label>
          {msg.text && <p className={msg.ok ? 'okmsg' : 'err'} role="alert">{msg.text}</p>}
          <button className="btn full" disabled={busy}>
            {busy ? 'Please wait...' : mode === 'in' ? 'Log in' : 'Create account'}
          </button>
          <p className="swap">
            {mode === 'in' ? 'New teacher? ' : 'Already have an account? '}
            <button type="button" className="lnk" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg({ text: '', ok: false }); }}>
              {mode === 'in' ? 'Create an account' : 'Log in'}
            </button>
          </p>
        </form>
        {hasStoredConfig() && <p className="swap"><button type="button" className="lnk" onClick={() => { clearConfig(); window.location.reload(); }}>Wrong Supabase keys? Change them</button></p>}
        <Footer />
      </div>
    </div>
  );
}
