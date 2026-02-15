import { NavLink, Outlet } from 'react-router-dom';
import WalletButton from './WalletButton';

const navLinks = [
  { to: '/', label: 'Credentials', end: true },
  { to: '/prove', label: 'Prove' },
  { to: '/dashboard', label: 'Dashboard' },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-8">
            <h1 className="text-lg font-bold text-violet-400">StarkShield</h1>
            <nav className="flex gap-4">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    `text-sm transition ${
                      isActive
                        ? 'text-violet-400 font-medium'
                        : 'text-gray-400 hover:text-gray-200'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <WalletButton />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
