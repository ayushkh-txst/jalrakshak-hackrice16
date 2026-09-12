import { FormEvent, useState } from 'react';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <main className="login-page">
      <section className="hero-panel">
        <header className="brand-row">
          <div className="brand"><span className="shield">◇</span><span>G-0ne</span></div>
          <button className="language" type="button">◎ English⌄</button>
        </header>

        <div className="hero-content">
          <p className="eyebrow">● AI-POWERED FLOOD INTELLIGENCE</p>
          <h1>Safer<br/>Communities<br/><span>Stronger<br/>Tomorrows.</span></h1>
          <p className="hero-description">Real-time risk mapping, intelligent evacuation guidance, and emergency coordination for communities affected by floods.</p>
          <div className="benefits"><span>⌖ Real-time Alerts</span><span>♙ Faster Response</span><span>♢ Safer Communities</span></div>
        </div>

        <div className="watermark">◇</div>
        <div className="mountains"><i/><i/><i/></div>
      </section>

      <section className="form-panel">
        <div className="form-wrap">
          <h2>Welcome Back</h2>
          <p className="subtitle">Sign in to continue to G-0ne</p>

          <form onSubmit={submit}>
            <label className="field"><span>✉</span><input type="email" placeholder="Email address" autoComplete="email" required /></label>
            <label className="field"><span>♙</span><input type={showPassword ? 'text' : 'password'} placeholder="Password" autoComplete="current-password" required/><button type="button" onClick={() => setShowPassword(v => !v)}>{showPassword ? '◉' : '◎'}</button></label>

            <div className="form-options">
              <label><input type="checkbox"/> Remember me</label>
              <button type="button" className="link-button">Forgot password?</button>
            </div>

            <button className="sign-in" type="submit">Sign in →</button>
          </form>

          <div className="divider"><span/><small>or continue with</small><span/></div>
          <div className="socials">
            <button type="button" className="google"><b>G</b> Continue with<br/>Google</button>
            <button type="button" className="github"><b>●</b> Continue with<br/>GitHub</button>
          </div>
          <p className="contact">Don't have an account? <strong>Contact your administrator</strong></p>
        </div>
      </section>
    </main>
  );
}
