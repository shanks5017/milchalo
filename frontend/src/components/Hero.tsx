import React from 'react';
import { ShieldCheck, Map, Headset } from 'lucide-react';
import SearchBox from './SearchBox';

interface HeroProps {
  activeMode?: 'stitched' | 'train' | 'bus' | 'flight' | 'cab';
  onSearchStart?: () => void;
  onSearchResults?: (results: any) => void;
}

export default function Hero({ activeMode = 'stitched', onSearchStart, onSearchResults }: HeroProps) {
  return (
    <div className="relative min-h-screen w-full bg-[#f8faf9] overflow-hidden">
      {/* Background Image Container */}
      <div className="absolute top-0 right-0 w-full md:w-[70%] h-full">
        <div className="absolute inset-0 bg-gradient-to-r from-[#f8faf9] via-[#f8faf9]/80 to-transparent z-10 md:w-1/2"></div>
        <img 
          src="/hero_bg_train.png" 
          alt="Scenic train journey through green mountains" 
          className="w-full h-full object-cover object-[70%_center]"
        />
      </div>

      {/* Hero Content */}
      <div className="relative z-20 pt-20 pb-16 px-8 max-w-7xl mx-auto h-full flex flex-col justify-center min-h-[calc(100vh-80px)]">
        
        <div className="max-w-2xl mt-4 md:mt-10">
          <h1 className="text-5xl md:text-6xl font-extrabold text-[#112a1f] tracking-tight leading-[1.1] mb-4 font-sans">
            Travel better.<br/>One journey, simply.
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            Search trains, buses, flights and cabs<br/>across India in one place.
          </p>
        </div>

        <SearchBox activeMode={activeMode} onSearchStart={onSearchStart} onSearchResults={onSearchResults} />

        {/* Badges below search box */}
        <div className="mt-8 flex flex-wrap gap-8 items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
              <Map className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Best options</p>
              <p className="text-xs text-gray-500">AI-powered recommendations</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Secure bookings</p>
              <p className="text-xs text-gray-500">Trusted by millions</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
              <Headset className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">24/7 support</p>
              <p className="text-xs text-gray-500">We're here to help</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
