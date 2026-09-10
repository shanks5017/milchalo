/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Hero from './components/Hero';
import SearchResultsPage from './pages/SearchResultsPage';
import JourneyDetailsPage from './pages/JourneyDetailsPage';
import LoginPage from './pages/LoginPage';

function AppLayout({ activeMode }: { activeMode: 'stitched' | 'train' | 'bus' | 'flight' | 'cab' }) {
  return (
    <div className="flex-1 bg-white relative flex flex-col">
      <Hero activeMode={activeMode} />
    </div>
  );
}

function AppContent() {
  const location = useLocation();
  const isLogin = location.pathname === '/login';

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#f4f6f5]">
      {!isLogin && <Header />}
      <main className="flex-1 overflow-y-auto relative min-h-0 flex flex-col">
        <Routes>
          <Route path="/" element={<Navigate to="/stitched" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/search" element={<SearchResultsPage />} />
          <Route path="/journey-details" element={<JourneyDetailsPage />} />
          <Route path="/stitched" element={<AppLayout activeMode="stitched" />} />
          <Route path="/train" element={<AppLayout activeMode="train" />} />
          <Route path="/bus" element={<AppLayout activeMode="bus" />} />
          <Route path="/flight" element={<AppLayout activeMode="flight" />} />
          <Route path="/cab" element={<AppLayout activeMode="cab" />} />
          {/* Fallback to stitched if route not found */}
          <Route path="*" element={<Navigate to="/stitched" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
