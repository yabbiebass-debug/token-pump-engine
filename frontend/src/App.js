import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import '@/App.css';
import { SiteNav } from '@/components/site/SiteNav';
import { TokenTicker } from '@/components/site/TokenTicker';
import { SiteFooter } from '@/components/site/SiteFooter';
import HomePage from '@/pages/HomePage';
import PricingPage from '@/pages/PricingPage';
import MissionPage from '@/pages/MissionPage';
import FlywheelPage from '@/pages/FlywheelPage';
import PulsePage from '@/pages/PulsePage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-void text-ink font-mono flex flex-col">
        <SiteNav />
        <TokenTicker />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/mission" element={<MissionPage />} />
            <Route path="/flywheel" element={<FlywheelPage />} />
            <Route path="/pulse" element={<PulsePage />} />
          </Routes>
        </main>
        <SiteFooter />
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{ className: 'font-mono text-[11.5px] !bg-panel2 !border !border-green/40 !text-ink' }}
        />
      </div>
    </BrowserRouter>
  );
}
