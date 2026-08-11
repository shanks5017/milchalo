/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Hero from './components/Hero';
// @ts-ignore - explicitly ignoring since TS server hasn't picked up the new file yet
import Results from './components/Results';

function AppLayout({ activeMode }: { activeMode: 'stitched' | 'train' | 'bus' | 'flight' | 'cab' }) {
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        <Hero 
          activeMode={activeMode} 
          onSearchStart={() => setIsSearching(true)}
          onSearchResults={(results) => {
            setSearchResults(results);
            setIsSearching(false);
          }}
        />
        {(isSearching || searchResults) && (
          <Results isLoading={isSearching} data={searchResults} />
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/stitched" replace />} />
        <Route path="/stitched" element={<AppLayout activeMode="stitched" />} />
        <Route path="/train" element={<AppLayout activeMode="train" />} />
        <Route path="/bus" element={<AppLayout activeMode="bus" />} />
        <Route path="/flight" element={<AppLayout activeMode="flight" />} />
        <Route path="/cab" element={<AppLayout activeMode="cab" />} />
        {/* Fallback to stitched if route not found */}
        <Route path="*" element={<Navigate to="/stitched" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
