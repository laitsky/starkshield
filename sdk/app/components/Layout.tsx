import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import WalletButton from './WalletButton';

const navLinks = [
  { to: '/', label: 'Credentials', end: true },
  { to: '/prove', label: 'Prove' },
  { to: '/dashboard', label: 'Dashboard' },
];

export default function Layout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 header-brutal">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          {/* Logo + Nav */}
          <div className="flex items-center gap-8">
            <NavLink to="/" className="flex items-center gap-0">
              <span className="text-lg font-extrabold tracking-tight text-[var(--color-text)]">
                STARK<span className="text-[var(--color-accent)]">//</span>SHIELD
              </span>
            </NavLink>

            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-1">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    `nav-link ${isActive ? 'nav-link-active' : ''}`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Wallet + Mobile toggle */}
          <div className="flex items-center gap-3">
            <WalletButton />
            {/* Mobile nav toggle */}
            <button
              onClick={() => setMobileNavOpen((o) => !o)}
              className="sm:hidden p-2 text-[var(--color-text-2)] hover:text-[var(--color-text)] transition-colors"
              aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileNavOpen ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile nav dropdown */}
        {mobileNavOpen && (
          <nav className="sm:hidden border-t-2 border-[var(--color-border)] bg-[var(--color-surface)] animate-fade-in">
            <div className="mx-auto max-w-5xl px-6 py-3 flex flex-col gap-1">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    `nav-link block !px-0 !py-2.5 ${isActive ? 'nav-link-active' : ''}`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="footer-brutal mt-16">
        <div className="mx-auto max-w-5xl px-6 py-8">
          {/* Top row: brand + tech stack */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8">
            {/* Brand block */}
            <div className="space-y-3">
              <span className="text-base font-extrabold tracking-tight text-[var(--color-text)]">
                STARK<span className="text-[var(--color-accent)]">//</span>SHIELD
              </span>
              <p className="text-xs text-[var(--color-text-3)] font-mono max-w-xs leading-relaxed">
                Zero-knowledge identity verification on Starknet. Prove attributes without revealing data.
              </p>
            </div>

            {/* Link columns */}
            <div className="flex gap-12">
              <div className="space-y-3">
                <span className="section-label">// Protocol</span>
                <ul className="space-y-2">
                  <li>
                    <a
                      href="https://www.starknet.io/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-2)] transition-colors duration-150 hover:text-[var(--color-cyan)]"
                    >
                      Starknet
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://noir-lang.org/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-2)] transition-colors duration-150 hover:text-[var(--color-cyan)]"
                    >
                      Noir
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://sepolia.starkscan.co/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-2)] transition-colors duration-150 hover:text-[var(--color-cyan)]"
                    >
                      Starkscan
                    </a>
                  </li>
                </ul>
              </div>
              <div className="space-y-3">
                <span className="section-label">// Project</span>
                <ul className="space-y-2">
                  <li>
                    <a
                      href="https://github.com/anthropics"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-2)] transition-colors duration-150 hover:text-[var(--color-cyan)]"
                    >
                      GitHub
                    </a>
                  </li>
                  <li>
                    <NavLink
                      to="/"
                      className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-2)] transition-colors duration-150 hover:text-[var(--color-cyan)]"
                    >
                      Credentials
                    </NavLink>
                  </li>
                  <li>
                    <NavLink
                      to="/prove"
                      className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-2)] transition-colors duration-150 hover:text-[var(--color-cyan)]"
                    >
                      Prove
                    </NavLink>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="separator my-6" />

          {/* Bottom row: copyright */}
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-3)]">
              &copy; {new Date().getFullYear()} StarkShield. Built for Starknet.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
