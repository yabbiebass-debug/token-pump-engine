import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import '@/App.css';
import { AuthProvider } from '@/lib/auth';
import { SolanaProviders } from '@/lib/solana';
import { SiteNav } from '@/components/site/SiteNav';
import { TokenTicker } from '@/components/site/TokenTicker';
import { SiteFooter } from '@/components/site/SiteFooter';
import HomePage from '@/pages/HomePage';
import PricingPage from '@/pages/PricingPage';
import MissionPage from '@/pages/MissionPage';
import FlywheelPage from '@/pages/FlywheelPage';
import PulsePage from '@/pages/PulsePage';
import LoginPage from '@/pages/LoginPage';
import TransparencyPage from '@/pages/TransparencyPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SolanaProviders>
        <div className="min-h-screen bg-void text-ink font-mono flex flex-col">
          <SiteNav />
          <TokenTicker />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/mission" element={<MissionPage />} />
              <Route path="/flywheel" element={<FlywheelPage />} />
              <Route path="/transparency" element={<TransparencyPage />} />
              <Route path="/pulse" element={<PulsePage />} />
              <Route path="/login" element={<LoginPage />} />
            </Routes>
          </main>
          <SiteFooter />
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{ className: 'font-mono text-[11.5px] !bg-panel2 !border !border-green/40 !text-ink' }}
          />
        </div>
        </SolanaProviders>
      </AuthProvider>
    </BrowserRouter>
  );
}
