import { authSession } from '../../auth/auth-session';

export default function CitizenDashboard() {
  const session = authSession.get();

  return (
    <main style={{ padding: '40px', fontFamily: 'DM Sans, sans-serif' }}>
      <p style={{ color: '#80651f', fontWeight: 700, letterSpacing: '.08em' }}>G-0NE · CITIZEN</p>
      <h1 style={{ marginBottom: 8 }}>Citizen Dashboard</h1>
      <p style={{ color: '#6f6254' }}>
        Signed in as {session?.user.name ?? 'Citizen'}.
      </p>
      <section style={{ marginTop: 28, padding: 24, border: '1px solid #ded2c2', borderRadius: 12, maxWidth: 680 }}>
        <h2 style={{ marginTop: 0 }}>Next build target</h2>
        <p>Flood warning status, nearby safe zones, evacuation route guidance, and emergency SOS.</p>
      </section>
    </main>
  );
}
