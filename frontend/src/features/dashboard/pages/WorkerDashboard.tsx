import { authSession } from '../../auth/auth-session';

export default function WorkerDashboard() {
  const session = authSession.get();

  return (
    <main style={{ padding: '40px', fontFamily: 'DM Sans, sans-serif' }}>
      <p style={{ color: '#80651f', fontWeight: 700, letterSpacing: '.08em' }}>G-0NE · E-WORKER</p>
      <h1 style={{ marginBottom: 8 }}>Emergency Operations Dashboard</h1>
      <p style={{ color: '#6f6254' }}>
        Signed in as {session?.user.name ?? 'E-Worker'}.
      </p>
      <section style={{ marginTop: 28, padding: 24, border: '1px solid #ded2c2', borderRadius: 12, maxWidth: 680 }}>
        <h2 style={{ marginTop: 0 }}>Next build target</h2>
        <p>Live incident map, emergency queue, flood-risk intelligence, safe-zone allocation, and responder coordination.</p>
      </section>
    </main>
  );
}
