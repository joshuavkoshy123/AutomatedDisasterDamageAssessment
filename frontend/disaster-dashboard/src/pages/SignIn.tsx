import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const SignIn: React.FC = () => {
  const navigate = useNavigate();
  const [remember, setRemember] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: wire up real auth — for now just navigate to dashboard
    navigate('/');
  };

  return (
    <>
      <style>{`
        .signin-bg-grid {
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(30, 143, 255, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(30, 143, 255, 0.04) 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%);
          animation: gridShift 20s linear infinite;
        }
        @keyframes gridShift {
          0%   { background-position: 0 0; }
          100% { background-position: 40px 40px; }
        }
        .signin-scanlines {
          position: fixed;
          inset: 0;
          background: repeating-linear-gradient(
            0deg, transparent, transparent 2px,
            rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px
          );
          pointer-events: none;
          z-index: 1;
        }
        .signin-corner {
          position: fixed;
          width: 80px;
          height: 80px;
          z-index: 2;
        }
        .signin-corner::before, .signin-corner::after {
          content: '';
          position: absolute;
          background: #ff4e1a;
          opacity: 0.6;
        }
        .signin-corner.tl { top: 24px; left: 24px; }
        .signin-corner.tl::before { top:0; left:0; width:2px; height:40px; }
        .signin-corner.tl::after  { top:0; left:0; width:40px; height:2px; }
        .signin-corner.tr { top: 24px; right: 24px; }
        .signin-corner.tr::before { top:0; right:0; width:2px; height:40px; }
        .signin-corner.tr::after  { top:0; right:0; width:40px; height:2px; }
        .signin-corner.bl { bottom: 24px; left: 24px; }
        .signin-corner.bl::before { bottom:0; left:0; width:2px; height:40px; }
        .signin-corner.bl::after  { bottom:0; left:0; width:40px; height:2px; }
        .signin-corner.br { bottom: 24px; right: 24px; }
        .signin-corner.br::before { bottom:0; right:0; width:2px; height:40px; }
        .signin-corner.br::after  { bottom:0; right:0; width:40px; height:2px; }
        .signin-page {
          position: relative;
          z-index: 5;
          height: 100vh;
          display: grid;
          grid-template-rows: 1fr 48px;
          background: #0a0c0f;
          color: #e4eaf2;
          font-family: 'IBM Plex Sans', sans-serif;
          overflow: hidden;
        }
        .signin-center {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 24px;
        }
        .signin-card {
          width: 100%;
          max-width: 420px;
          background: #111418;
          border: 1px solid #2d3a4a;
          position: relative;
          overflow: hidden;
          opacity: 0;
          animation: fadeUp 0.5s ease 0.1s forwards;
        }
        .signin-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #ff4e1a, transparent);
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .signin-card-body { padding: 28px 36px 32px; }
        .signin-field { margin-bottom: 18px; }
        .signin-field label {
          display: block;
          font-family: 'Space Mono', monospace;
          font-size: 9px;
          color: #5a6a7e;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .signin-field-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .signin-field-row label { margin-bottom: 0; }
        .signin-forgot {
          font-family: 'Space Mono', monospace;
          font-size: 9px;
          color: #5a6a7e;
          letter-spacing: 0.1em;
          text-decoration: none;
          transition: color 0.2s;
        }
        .signin-forgot:hover { color: #1e8fff; }
        .signin-input-wrap { position: relative; }
        .signin-input-wrap svg {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #5a6a7e;
          pointer-events: none;
          z-index: 2;
          transition: color 0.2s;
        }
        .signin-input-wrap:focus-within svg { color: #1e8fff; }
        .signin-input {
          width: 100%;
          background: #0a0c0f;
          border: 1px solid #2d3a4a;
          color: #e4eaf2;
          font-family: 'Space Mono', monospace;
          font-size: 12px;
          letter-spacing: 0.05em;
          padding: 12px 14px 12px 40px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          position: relative;
          z-index: 1;
        }
        .signin-input::placeholder { color: #5a6a7e; font-size: 11px; }
        .signin-input:focus {
          border-color: #1e8fff;
          box-shadow: 0 0 0 3px rgba(30,143,255,0.1);
        }
        .signin-remember {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 24px;
          cursor: pointer;
          user-select: none;
        }
        .signin-checkbox {
          width: 14px; height: 14px;
          border: 1px solid #2d3a4a;
          background: #0a0c0f;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: border-color 0.2s, background 0.2s;
          flex-shrink: 0;
        }
        .signin-checkbox.checked {
          border-color: #ff4e1a;
          background: rgba(255,78,26,0.12);
        }
        .signin-checkbox.checked::after {
          content: '';
          width: 6px; height: 6px;
          background: #ff4e1a;
          display: block;
        }
        .signin-remember span {
          font-family: 'Space Mono', monospace;
          font-size: 9px;
          color: #5a6a7e;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .signin-btn {
          width: 100%;
          background: #ff4e1a;
          border: none;
          color: #fff;
          font-family: 'Space Mono', monospace;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          padding: 15px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: background 0.2s, transform 0.1s;
        }
        .signin-btn:hover { background: #ff6636; }
        .signin-btn:active { transform: scale(0.99); }
        .signin-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 20px 0;
        }
        .signin-divider-line { flex:1; height:1px; background:#1e2530; }
        .signin-divider-text {
          font-family: 'Space Mono', monospace;
          font-size: 9px;
          color: #5a6a7e;
          letter-spacing: 0.1em;
        }
        .signin-sso {
          width: 100%;
          background: transparent;
          border: 1px solid #2d3a4a;
          color: #8a9ab0;
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: border-color 0.2s, color 0.2s;
        }
        .signin-sso:hover { border-color: #1e8fff; color: #1e8fff; }
        .signin-card-footer {
          padding: 16px 36px;
          border-top: 1px solid #1e2530;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .signin-clearance { display:flex; align-items:center; gap:8px; }
        .signin-clearance-dot {
          width:6px; height:6px;
          background:#2ecf7e;
          border-radius:50%;
          animation: pulse 2s ease-in-out infinite;
          box-shadow: 0 0 6px #2ecf7e;
        }
        @keyframes pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:0.5; transform:scale(0.8); }
        }
        .signin-clearance-text {
          font-family: 'Space Mono', monospace;
          font-size: 9px; color: #5a6a7e; letter-spacing: 0.1em;
        }
        .signin-version {
          font-family: 'Space Mono', monospace;
          font-size: 9px; color: #2d3a4a; letter-spacing: 0.1em;
        }
        .signin-bottom-bar {
          border-top: 1px solid #1e2530;
          display: flex;
          align-items: center;
          padding: 0 24px;
          gap: 24px;
        }
        .signin-bottom-item {
          font-family: 'Space Mono', monospace;
          font-size: 9px; color: #5a6a7e; letter-spacing: 0.1em;
          display: flex; align-items: center; gap: 6px;
        }
        .signin-bottom-item::before {
          content: ''; width:4px; height:4px; background:#2d3a4a;
        }
        .signin-bottom-item:first-child::before { display: none; }
      `}</style>

      <div className="signin-bg-grid" />
      <div className="signin-scanlines" />
      <div className="signin-corner tl" />
      <div className="signin-corner tr" />
      <div className="signin-corner bl" />
      <div className="signin-corner br" />

      <div className="signin-page">
        <div className="signin-center">
          <div className="signin-card">
            <form className="signin-card-body" onSubmit={handleSubmit}>

              <div className="signin-field">
                <label>Operator ID / Email</label>
                <div className="signin-input-wrap">
                  <input className="signin-input" type="email" placeholder="operator@agency.gov" autoComplete="email" required />
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3,5 12,13 21,5"/>
                  </svg>
                </div>
              </div>

              <div className="signin-field">
                <div className="signin-field-row">
                  <label>Access Code</label>
                  <a href="#" className="signin-forgot">Reset code →</a>
                </div>
                <div className="signin-input-wrap">
                  <input className="signin-input" type="password" placeholder="••••••••••••" autoComplete="current-password" required />
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
              </div>

              <div className="signin-remember" onClick={() => setRemember(r => !r)}>
                <div className={`signin-checkbox ${remember ? 'checked' : ''}`} />
                <span>Keep me signed in on this terminal</span>
              </div>

              <button type="submit" className="signin-btn">Authenticate →</button>

              <div className="signin-divider">
                <div className="signin-divider-line" />
                <div className="signin-divider-text">or</div>
                <div className="signin-divider-line" />
              </div>

              <button type="button" className="signin-sso">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                </svg>
                Continue with Agency SSO
              </button>

            </form>

            <div className="signin-card-footer">
              <div className="signin-clearance">
                <div className="signin-clearance-dot" />
                <div className="signin-clearance-text">Secure connection verified</div>
              </div>
              <div className="signin-version">v4.1.2 — FEMA-CERT</div>
            </div>
          </div>
        </div>

        <div className="signin-bottom-bar">
          <div className="signin-bottom-item">DisasterSight Platform</div>
          <div className="signin-bottom-item">FEMA Certified</div>
          <div className="signin-bottom-item">AES-256 Encrypted</div>
          <div className="signin-bottom-item">SOC 2 Type II</div>
          <div className="signin-bottom-item">Privacy Policy</div>
          <div className="signin-bottom-item">Terms of Use</div>
        </div>
      </div>
    </>
  );
};