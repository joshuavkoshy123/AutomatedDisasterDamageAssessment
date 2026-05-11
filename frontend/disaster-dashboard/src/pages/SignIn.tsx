import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { useAuth } from '../AuthContext';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500&family=Space+Mono:wght@400;700&display=swap');

  .auth-bg-grid {
    position: fixed; inset: 0;
    background-image:
      linear-gradient(rgba(30,143,255,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(30,143,255,0.04) 1px, transparent 1px);
    background-size: 40px 40px;
    mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%);
    animation: gridShift 20s linear infinite;
  }
  @keyframes gridShift {
    0%   { background-position: 0 0; }
    100% { background-position: 40px 40px; }
  }
  .auth-scanlines {
    position: fixed; inset: 0;
    background: repeating-linear-gradient(
      0deg, transparent, transparent 2px,
      rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px
    );
    pointer-events: none; z-index: 1;
  }
  .auth-corner { position: fixed; width: 80px; height: 80px; z-index: 2; }
  .auth-corner::before, .auth-corner::after {
    content: ''; position: absolute; background: #ff4e1a; opacity: 0.6;
  }
  .auth-corner.tl { top: 24px; left: 24px; }
  .auth-corner.tl::before { top:0; left:0; width:2px; height:40px; }
  .auth-corner.tl::after  { top:0; left:0; width:40px; height:2px; }
  .auth-corner.tr { top: 24px; right: 24px; }
  .auth-corner.tr::before { top:0; right:0; width:2px; height:40px; }
  .auth-corner.tr::after  { top:0; right:0; width:40px; height:2px; }
  .auth-corner.bl { bottom: 24px; left: 24px; }
  .auth-corner.bl::before { bottom:0; left:0; width:2px; height:40px; }
  .auth-corner.bl::after  { bottom:0; left:0; width:40px; height:2px; }
  .auth-corner.br { bottom: 24px; right: 24px; }
  .auth-corner.br::before { bottom:0; right:0; width:2px; height:40px; }
  .auth-corner.br::after  { bottom:0; right:0; width:40px; height:2px; }

  .auth-page {
    position: relative; z-index: 5;
    min-height: 100vh;
    display: grid;
    grid-template-rows: 1fr 48px;
    background: #0a0c0f;
    color: #e4eaf2;
    font-family: 'IBM Plex Sans', sans-serif;
    overflow: hidden;
  }
  .auth-center {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 24px;
  }
  .auth-card {
    width: 100%;
    max-width: 460px;
    background: #111418;
    border: 1px solid #2d3a4a;
    position: relative;
    overflow: hidden;
    opacity: 0;
    animation: fadeUp 0.5s ease 0.1s forwards;
  }
  .auth-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, transparent, #ff4e1a, transparent);
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .auth-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-bottom: 1px solid #1e2530;
  }
  .auth-tab {
    padding: 16px;
    font-family: 'Space Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #5a6a7e;
    cursor: pointer;
    border: none;
    background: transparent;
    transition: color 0.2s, background 0.2s;
    position: relative;
    user-select: none;
  }
  .auth-tab.active { color: #e4eaf2; background: rgba(255,78,26,0.04); }
  .auth-tab.active::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0; height: 2px;
    background: #ff4e1a;
  }
  .auth-tab:hover:not(.active) { color: #8a9ab0; }
  .auth-steps { display: flex; align-items: center; padding: 16px 36px 0; }
  .auth-step { display: flex; align-items: center; gap: 8px; flex: 1; }
  .auth-step-num {
    width: 20px; height: 20px;
    border: 1px solid #2d3a4a;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Space Mono', monospace;
    font-size: 9px; color: #5a6a7e; flex-shrink: 0;
    transition: border-color 0.3s, color 0.3s, background 0.3s;
  }
  .auth-step-num.active  { border-color: #ff4e1a; color: #ff4e1a; background: rgba(255,78,26,0.08); }
  .auth-step-num.done    { border-color: #2ecf7e; color: #2ecf7e; background: rgba(46,207,126,0.08); }
  .auth-step-label {
    font-family: 'Space Mono', monospace;
    font-size: 8px; color: #5a6a7e; letter-spacing: 0.1em; text-transform: uppercase;
    transition: color 0.3s;
  }
  .auth-step-label.active { color: #e4eaf2; }
  .auth-step-connector { height: 1px; background: #1e2530; flex: 1; margin: 0 12px; max-width: 40px; }
  .auth-body { padding: 20px 36px 32px; }
  .auth-section-label {
    font-family: 'Space Mono', monospace;
    font-size: 10px; color: #5a6a7e;
    letter-spacing: 0.2em; text-transform: uppercase;
    margin-bottom: 20px; padding-bottom: 12px;
    border-bottom: 1px solid #1e2530;
  }
  .auth-name-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .auth-field { margin-bottom: 16px; }
  .auth-field label {
    display: block;
    font-family: 'Space Mono', monospace;
    font-size: 9px; color: #5a6a7e;
    letter-spacing: 0.16em; text-transform: uppercase; margin-bottom: 8px;
  }
  .auth-field .field-optional {
    font-size: 8px; color: #2d3a4a;
    margin-left: 6px; text-transform: none; letter-spacing: 0.05em;
  }
  .auth-field-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .auth-field-row label { margin-bottom: 0; }
  .auth-forgot {
    font-family: 'Space Mono', monospace;
    font-size: 9px; color: #5a6a7e; letter-spacing: 0.1em;
    text-decoration: none; transition: color 0.2s;
  }
  .auth-forgot:hover { color: #1e8fff; }
  .auth-input-wrap { position: relative; }
  .auth-input-wrap svg {
    position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
    color: #5a6a7e; pointer-events: none; z-index: 2; transition: color 0.2s;
  }
  .auth-input-wrap:focus-within svg { color: #1e8fff; }
  .auth-input {
    width: 100%; background: #0a0c0f;
    border: 1px solid #2d3a4a; color: #e4eaf2;
    font-family: 'Space Mono', monospace;
    font-size: 12px; letter-spacing: 0.05em;
    padding: 12px 14px 12px 40px;
    outline: none; transition: border-color 0.2s, box-shadow 0.2s;
    position: relative; z-index: 1; box-sizing: border-box;
  }
  .auth-input.no-icon { padding-left: 14px; }
  .auth-input::placeholder { color: #5a6a7e; font-size: 11px; }
  .auth-input:focus { border-color: #1e8fff; box-shadow: 0 0 0 3px rgba(30,143,255,0.1); }
  .auth-input.error-field { border-color: #ff4e1a; box-shadow: 0 0 0 3px rgba(255,78,26,0.1); }
  .pw-strength { margin-top: 6px; display: flex; gap: 4px; }
  .pw-bar { height: 2px; flex: 1; background: #1e2530; transition: background 0.3s; }
  .pw-bar.weak   { background: #ff4e1a; }
  .pw-bar.medium { background: #f5a623; }
  .pw-bar.strong { background: #2ecf7e; }
  .pw-label {
    font-family: 'Space Mono', monospace;
    font-size: 8px; color: #5a6a7e; letter-spacing: 0.1em;
    margin-top: 4px; text-align: right;
  }
  .auth-error {
    font-family: 'Space Mono', monospace;
    font-size: 9px; color: #ff4e1a; letter-spacing: 0.08em;
    margin-bottom: 16px; padding: 10px 12px;
    background: rgba(255,78,26,0.08); border: 1px solid rgba(255,78,26,0.2);
    display: flex; align-items: center; gap: 8px;
  }
  .auth-error::before { content: '⚠'; font-size: 11px; }
  .auth-check-row {
    display: flex; align-items: flex-start;
    gap: 10px; margin-bottom: 24px;
    cursor: pointer; user-select: none;
  }
  .auth-checkbox {
    width: 14px; height: 14px;
    border: 1px solid #2d3a4a; background: #0a0c0f;
    display: flex; align-items: center; justify-content: center;
    transition: border-color 0.2s, background 0.2s;
    flex-shrink: 0; margin-top: 1px;
  }
  .auth-checkbox.checked { border-color: #ff4e1a; background: rgba(255,78,26,0.12); }
  .auth-checkbox.checked::after { content: ''; width: 6px; height: 6px; background: #ff4e1a; display: block; }
  .auth-check-row span {
    font-family: 'Space Mono', monospace;
    font-size: 9px; color: #5a6a7e; letter-spacing: 0.08em; line-height: 1.6;
  }
  .auth-check-row a { color: #1e8fff; text-decoration: none; }
  .auth-check-row a:hover { text-decoration: underline; }
  .auth-btn {
    width: 100%; background: #ff4e1a; border: none; color: #fff;
    font-family: 'Space Mono', monospace;
    font-size: 11px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase;
    padding: 15px; cursor: pointer;
    transition: background 0.2s, transform 0.1s, opacity 0.2s;
  }
  .auth-btn:hover:not(:disabled) { background: #ff6636; }
  .auth-btn:active:not(:disabled) { transform: scale(0.99); }
  .auth-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .auth-btn-ghost {
    width: 100%; background: transparent;
    border: 1px solid #2d3a4a; color: #8a9ab0;
    font-family: 'Space Mono', monospace;
    font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;
    padding: 12px; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 10px;
    transition: border-color 0.2s, color 0.2s;
    margin-top: 10px;
  }
  .auth-btn-ghost:hover { border-color: #5a6a7e; color: #e4eaf2; }
  .auth-btn-ghost.sso:hover { border-color: #1e8fff; color: #1e8fff; }
  .auth-divider { display: flex; align-items: center; gap: 12px; margin: 20px 0; }
  .auth-divider-line { flex:1; height:1px; background:#1e2530; }
  .auth-divider-text { font-family: 'Space Mono', monospace; font-size: 9px; color: #5a6a7e; letter-spacing: 0.1em; }
  .auth-card-footer {
    padding: 16px 36px; border-top: 1px solid #1e2530;
    display: flex; justify-content: space-between; align-items: center;
  }
  .auth-clearance { display:flex; align-items:center; gap:8px; }
  .auth-clearance-dot {
    width:6px; height:6px; background:#2ecf7e; border-radius:50%;
    animation: pulse 2s ease-in-out infinite; box-shadow: 0 0 6px #2ecf7e;
  }
  @keyframes pulse {
    0%,100% { opacity:1; transform:scale(1); }
    50%      { opacity:0.5; transform:scale(0.8); }
  }
  .auth-clearance-text { font-family:'Space Mono',monospace; font-size:9px; color:#5a6a7e; letter-spacing:0.1em; }
  .auth-version        { font-family:'Space Mono',monospace; font-size:9px; color:#2d3a4a; letter-spacing:0.1em; }
  .auth-bottom-bar {
    border-top: 1px solid #1e2530;
    display: flex; align-items: center; padding: 0 24px; gap: 24px;
  }
  .auth-bottom-item {
    font-family:'Space Mono',monospace; font-size:9px; color:#5a6a7e; letter-spacing:0.1em;
    display:flex; align-items:center; gap:6px;
  }
  .auth-bottom-item::before { content:''; width:4px; height:4px; background:#2d3a4a; }
  .auth-bottom-item:first-child::before { display:none; }
  .auth-panel { animation: panelIn 0.28s ease forwards; }
  @keyframes panelIn {
    from { opacity:0; transform:translateX(10px); }
    to   { opacity:1; transform:translateX(0); }
  }
`;

/* ── Icons ── */
const IconEmail = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3,5 12,13 21,5"/>
  </svg>
);
const IconLock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const IconShield = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const IconUser = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconBadge = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
  </svg>
);
const IconSSO = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);

/* ── Helpers ── */
function pwStrength(pw: string) {
  if (!pw) return 0;
  if (pw.length < 6) return 1;
  if (pw.length < 10) return 2;
  return 3;
}
function firebaseSignInError(code: string) {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Invalid operator ID or password.';
    case 'auth/too-many-requests':  return 'Too many failed attempts. Please try again later.';
    case 'auth/user-disabled':      return 'This account has been disabled.';
    default:                        return 'Authentication error. Please try again.';
  }
}
function firebaseSignUpError(code: string) {
  switch (code) {
    case 'auth/email-already-in-use': return 'An account with this email already exists.';
    case 'auth/invalid-email':        return 'Invalid email address format.';
    case 'auth/weak-password':        return 'Password must be at least 6 characters.';
    default:                          return 'Registration error. Please try again.';
  }
}

/* ── Component ── */
type Mode = 'signin' | 'signup';

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, register, currentUser } = useAuth();

  // ✅ KEY FIX: when Firebase confirms a user (login or existing session),
  // navigate to dashboard automatically — no manual navigate() after login()
  useEffect(() => {
    if (currentUser) navigate('/');
  }, [currentUser]);

  const [mode, setMode] = useState<Mode>('signin');
  const [signupStep, setSignupStep] = useState<1 | 2>(1);

  // Sign-in state
  const [siEmail, setSiEmail]       = useState('');
  const [siPassword, setSiPassword] = useState('');
  const [remember, setRemember]     = useState(false);

  // Sign-up state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [agencyId, setAgencyId]   = useState('');
  const [suEmail, setSuEmail]     = useState('');
  const [suPassword, setSuPassword] = useState('');
  const [suConfirm, setSuConfirm]   = useState('');
  const [agree, setAgree]           = useState(false);

  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const switchMode = (m: Mode) => { setMode(m); setError(''); setSignupStep(1); };

  /* ── Sign in ── */
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      await login(siEmail, siPassword);
      // ✅ No navigate() here — useEffect above handles it once currentUser updates
      const user = auth.currentUser;
      if (user) {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) localStorage.setItem('userInfo', JSON.stringify(snap.data()));
      }
    } catch (err: any) {
      setError(firebaseSignInError(err.code));
    } finally {
      setLoading(false);
    }
  };

  /* ── Sign up step 1 ── */
  const handleSignUpNext = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!firstName.trim() || !lastName.trim()) { setError('First and last name are required.'); return; }
    setSignupStep(2);
  };

  /* ── Sign up step 2 ── */
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (suPassword !== suConfirm) { setError('Access codes do not match.'); return; }
    if (!agree) { setError('You must accept the terms to register.'); return; }
    setLoading(true);
    try {
      await register(suEmail, suPassword);
      const user = auth.currentUser;
      if (user) {
        const userInfo = {
          firstName, lastName,
          agencyId: agencyId.trim() || null,
          email: suEmail, uid: user.uid,
          role: 'operator', createdAt: serverTimestamp(),
        };
        await setDoc(doc(db, 'users', user.uid), userInfo);
        localStorage.setItem('userInfo', JSON.stringify(userInfo));
      }
      // ✅ No navigate() here either — useEffect handles it
    } catch (err: any) {
      setError(firebaseSignUpError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const strength = pwStrength(suPassword);
  const strengthLabel = ['', 'Weak', 'Moderate', 'Strong'][strength];
  const strengthClass = ['', 'weak', 'medium', 'strong'][strength];

  return (
    <>
      <style>{STYLES}</style>

      <div className="auth-bg-grid" />
      <div className="auth-scanlines" />
      <div className="auth-corner tl" />
      <div className="auth-corner tr" />
      <div className="auth-corner bl" />
      <div className="auth-corner br" />

      <div className="auth-page">
        <div className="auth-center">
          <div className="auth-card">

            {/* Tabs */}
            <div className="auth-tabs">
              <button className={`auth-tab ${mode === 'signin' ? 'active' : ''}`} onClick={() => switchMode('signin')}>Sign In</button>
              <button className={`auth-tab ${mode === 'signup' ? 'active' : ''}`} onClick={() => switchMode('signup')}>Register</button>
            </div>

            {/* ══ SIGN IN ══ */}
            {mode === 'signin' && (
              <form className="auth-body auth-panel" onSubmit={handleSignIn}>
                <div className="auth-field">
                  <label>Operator ID / Email</label>
                  <div className="auth-input-wrap">
                    <IconEmail />
                    <input
                      className={`auth-input${error ? ' error-field' : ''}`}
                      type="email" placeholder="operator@agency.gov"
                      autoComplete="email" required
                      value={siEmail}
                      onChange={e => { setSiEmail(e.target.value); setError(''); }}
                    />
                  </div>
                </div>

                <div className="auth-field">
                  <div className="auth-input-wrap">
                    <IconLock />
                    <input
                      className={`auth-input${error ? ' error-field' : ''}`}
                      type="password" placeholder="••••••••••••"
                      autoComplete="current-password" required
                      value={siPassword}
                      onChange={e => { setSiPassword(e.target.value); setError(''); }}
                    />
                  </div>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <div className="auth-check-row" onClick={() => setRemember(r => !r)}>
                  <div className={`auth-checkbox ${remember ? 'checked' : ''}`} />
                  <span>Keep me signed in on this terminal</span>
                </div>

                <button type="submit" className="auth-btn" disabled={loading}>
                  {loading ? 'Authenticating...' : 'Authenticate →'}
                </button>

                <div className="auth-divider">
                  <div className="auth-divider-line" />
                  <div className="auth-divider-text">if forgot password: email support@agency.gov</div>
                  <div className="auth-divider-line" />
                </div>
              </form>
            )}

            {/* ══ SIGN UP ══ */}
            {mode === 'signup' && (
              <>
                <div className="auth-steps">
                  <div
                     className="auth-step">
                    <div className={`auth-step-num ${signupStep === 1 ? 'active' : 'done'}`}>
                      {signupStep > 1 ? '✓' : '1'}
                    </div>
                    <span className={`auth-step-label ${signupStep === 1 ? 'active' : ''}`}>Identity</span>
                  </div>
                  <div className="auth-step-connector" />
                  <div className="auth-step">
                    <div className={`auth-step-num ${signupStep === 2 ? 'active' : ''}`}>2</div>
                    <span className={`auth-step-label ${signupStep === 2 ? 'active' : ''}`}>Credentials</span>
                  </div>
                </div>

                {/* Step 1 */}
                {signupStep === 1 && (
                  <form className="auth-body auth-panel" onSubmit={handleSignUpNext}>
                    <div className="auth-section-label">Operator Registration — Step 1 of 2</div>
                    <div className="auth-name-row">
                      <div className="auth-field">
                        <label>First Name</label>
                        <div className="auth-input-wrap">
                          <IconUser />
                          <input className="auth-input" type="text" placeholder="Jane" required
                            value={firstName} onChange={e => { setFirstName(e.target.value); setError(''); }} />
                        </div>
                      </div>
                      <div className="auth-field">
                        <label>Last Name</label>
                        <div className="auth-input-wrap">
                          <input className="auth-input no-icon" type="text" placeholder="Smith" required
                            value={lastName} onChange={e => { setLastName(e.target.value); setError(''); }} />
                        </div>
                      </div>
                    </div>
                    <div className="auth-field">
                      <label>Agency ID <span className="field-optional">— optional</span></label>
                      <div className="auth-input-wrap">
                        <IconBadge />
                        <input className="auth-input" type="text" placeholder="FEMA-OPS-0000"
                          value={agencyId} onChange={e => setAgencyId(e.target.value)} />
                      </div>
                    </div>
                    {error && <div className="auth-error">{error}</div>}
                    <button type="submit" className="auth-btn">Continue →</button>
                  </form>
                )}

                {/* Step 2 */}
                {signupStep === 2 && (
                  <form className="auth-body auth-panel" onSubmit={handleSignUp}>
                    <div className="auth-section-label">Operator Registration — Step 2 of 2</div>
                    <div className="auth-field">
                      <label>Operator ID / Email</label>
                      <div className="auth-input-wrap">
                        <IconEmail />
                        <input className={`auth-input${error ? ' error-field' : ''}`}
                          type="email" placeholder="operator@agency.gov"
                          autoComplete="email" required
                          value={suEmail} onChange={e => { setSuEmail(e.target.value); setError(''); }} />
                      </div>
                    </div>
                    <div className="auth-field">
                      <label>Access Code</label>
                      <div className="auth-input-wrap">
                        <IconLock />
                        <input className={`auth-input${error ? ' error-field' : ''}`}
                          type="password" placeholder="••••••••••••"
                          autoComplete="new-password" required
                          value={suPassword} onChange={e => { setSuPassword(e.target.value); setError(''); }} />
                      </div>
                      {suPassword && (
                        <>
                          <div className="pw-strength">
                            {[1, 2, 3].map(i => (
                              <div key={i} className={`pw-bar ${i <= strength ? strengthClass : ''}`} />
                            ))}
                          </div>
                          <div className="pw-label">{strengthLabel}</div>
                        </>
                      )}
                    </div>
                    <div className="auth-field">
                      <label>Confirm Access Code</label>
                      <div className="auth-input-wrap">
                        <IconShield />
                        <input className={`auth-input${suConfirm && suPassword !== suConfirm ? ' error-field' : ''}`}
                          type="password" placeholder="••••••••••••"
                          autoComplete="new-password" required
                          value={suConfirm} onChange={e => { setSuConfirm(e.target.value); setError(''); }} />
                      </div>
                    </div>
                    {error && <div className="auth-error">{error}</div>}
                    <div className="auth-check-row" onClick={() => setAgree(a => !a)}>
                      <div className={`auth-checkbox ${agree ? 'checked' : ''}`} />
                      <span>
                        I acknowledge that this platform is for authorized FEMA-certified operators only, and I accept the{' '}
                        <a href="#" onClick={e => e.stopPropagation()}>Terms of Use</a> and{' '}
                        <a href="#" onClick={e => e.stopPropagation()}>Privacy Policy</a>.
                      </span>
                    </div>
                    <button type="submit" className="auth-btn" disabled={loading}>
                      {loading ? 'Registering operator...' : 'Create Account →'}
                    </button>
                    <button type="button" className="auth-btn-ghost" onClick={() => { setSignupStep(1); setError(''); }}>
                      ← Back
                    </button>
                  </form>
                )}
              </>
            )}

            <div className="auth-card-footer">
              <div className="auth-clearance">
                <div className="auth-clearance-dot" />
                <div className="auth-clearance-text">Secure connection verified</div>
              </div>
              <div className="auth-version">v4.1.2 — FEMA-CERT</div>
            </div>
          </div>
        </div>

        <div className="auth-bottom-bar">
          <div className="auth-bottom-item">DisasterSight Platform</div>
          <div className="auth-bottom-item">FEMA Certified</div>
          <div className="auth-bottom-item">AES-256 Encrypted</div>
          <div className="auth-bottom-item">SOC 2 Type II</div>
          <div className="auth-bottom-item">Privacy Policy</div>
          <div className="auth-bottom-item">Terms of Use</div>
        </div>
      </div>
    </>
  );
};