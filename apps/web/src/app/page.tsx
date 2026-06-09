export default function Home(): JSX.Element {
  return (
    <main style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>🚀 Orbitchat</h1>
      <p>Welcome to Orbitchat - A learning project for modern full-stack TypeScript development</p>

      <h2>Phase 0: Foundation</h2>
      <p>Currently setting up the basic infrastructure and development standards.</p>

      <h3>Getting Started</h3>
      <ul>
        <li>📚 Read AGENTS.md - AI Agent guide</li>
        <li>📚 Read docs/product.md - Product overview</li>
        <li>📚 Read docs/architecture.md - System design</li>
        <li>📚 Read docs/coding-rules.md - Coding standards</li>
      </ul>

      <h3>Next Steps</h3>
      <ul>
        <li>✅ Backend initialized (Bun + Hono)</li>
        <li>✅ Frontend initialized (Next.js)</li>
        <li>✅ Shared packages setup</li>
        <li>✅ Development toolchain</li>
      </ul>

      <p>For more information, see the documentation in the docs/ directory.</p>
    </main>
  );
}
