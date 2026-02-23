import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { WalletProvider } from './context/WalletContext';
import Layout from './components/Layout';

const CredentialWallet = lazy(() => import('./views/CredentialWallet'));
const ProofGenerator = lazy(() => import('./views/ProofGenerator'));
const VerificationDashboard = lazy(() => import('./views/VerificationDashboard'));
const HowItWorks = lazy(() => import('./views/HowItWorks'));

const LoadingFallback = () => (
  <div className="flex flex-col items-center justify-center py-24 gap-4">
    <div className="h-8 w-8 border-3 border-[var(--color-border-hard)] border-t-[var(--color-accent)] animate-spin" />
    <span className="text-xs font-mono uppercase tracking-widest text-[var(--color-text-3)]">Loading...</span>
  </div>
);

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <CredentialWallet />
          </Suspense>
        ),
      },
      {
        path: 'prove',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <ProofGenerator />
          </Suspense>
        ),
      },
      {
        path: 'dashboard',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <VerificationDashboard />
          </Suspense>
        ),
      },
      {
        path: 'how-it-works',
        element: (
          <Suspense fallback={<LoadingFallback />}>
            <HowItWorks />
          </Suspense>
        ),
      },
    ],
  },
]);

export default function App() {
  return (
    <WalletProvider>
      <RouterProvider router={router} />
    </WalletProvider>
  );
}
