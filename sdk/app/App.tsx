import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { WalletProvider } from './context/WalletContext';
import Layout from './components/Layout';

const CredentialWallet = lazy(() => import('./views/CredentialWallet'));
const ProofGenerator = lazy(() => import('./views/ProofGenerator'));
const VerificationDashboard = lazy(() => import('./views/VerificationDashboard'));

const LoadingFallback = () => (
  <div className="flex items-center justify-center py-20 text-gray-400">Loading...</div>
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
