import { FormEvent, useState } from 'react';

const ShieldMark = ({ large = false }: { large?: boolean }) => (
  <svg className={large ? 'shield-mark shield-mark--large' : 'shield-mark'} viewBox="0 0 64 64" aria-hidden="true">
    <path d="M32 5 51 12v15c0 13.4-7.8 24.8-19 31C20.8 51.8 13 40.4 13 27V12L32 5Z" fill="none" stroke="currentColor" strokeWidth="3"/>
    <path d="M21 31c4.5 0 7.4-2.1 9.3-6.4 2.7 4.8 6.5 7.2 11.7 7.2 2.1 0 4.1-.4 6-1.2-2.1 8.8-7.7 15.8-16 20-6.2-3.2-11-8.6-13.4-15.3 1 .2 1.8.3 2.4.3Z" fill="currentColor" opacity=".84"/>
  </svg>
);

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <main className="login-page">
      <section className="hero-panel">
        <header className="brand-row">
          <div className="brand"><span className="brand-mark"><ShieldMark /></span><span>G-0ne</span></div>
          <button className="language" type="button" aria-label="Change language"><span>◉</span> English <span className="chevron">⌄</span></button>
        </header>

        <div className="hero-content">
          <p className="eyebrow"><span className="eyebrow-dot"/>AI-POWERED FLOOD INTELLIGENCE</p>
          <h1>Safer<br/>Communities<br/><span>Stronger<br/>Tomorrows.</span></h1>
          <p className="hero-description">Real-time risk mapping, intelligent evacuation guidance, and emergency coordination for communities affected by floods.</p>
          <div className="benefits">
            <span><b>⌖</b> Real-time Alerts</span>
            <span><b>◫</b> Faster Response</span>
            <span><b>◇</b> Safer Communities</span>
          </div>
        </div>

        <div className="hero-watermark"><ShieldMark large /></div>
        <div className="mountains" aria-hidden="true"><i/><i/><i/><i/></div>
      </section>

      <section className="form-panel">
        <div className="form-wrap">
          <h2>Welcome Back</h2>
          <p className="subtitle">Sign in to continue to G-0ne</p>

          <form onSubmit={submit} noValidate>
            <label className="field">
              <span className="field-icon">✉</span>
              <input type="email" placeholder="Email address" autoComplete="email" aria-label="Email address" required />
            </label>
            <label className="field">
              <span className="field-icon">♙</span>
              <input type={showPassword ? 'text' : 'password'} placeholder="Password" autoComplete="current-password" aria-label="Password" required/>
              <button className="field-action" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(v => !v)}>{showPassword ? '◉' : '◎'}</button>
            </label>

            <div className="form-options">
              <label className="remember"><input type="checkbox"/> <span>Remember me</span></label>
              <button type="button" className="link-button">Forgot password?</button>
            </div>

            <button className="sign-in" type="submit">Sign in <span>→</span></button>
          </form>

          <div className="divider"><span/><small>or continue with</small><span/></div>
          <div className="socials">
            <button type="button" className="google"><span className="google-g">G</span><span>Continue with<br/>Google</span></button>
            <button type="button" className="github"><span className="github-dot">●</span><span>Continue with<br/>GitHub</span></button>
          </div>
          <p className="contact">Don't have an account? <strong>Contact your administrator</strong></p>
        </div>
      </section>
    </main>
  );
}
