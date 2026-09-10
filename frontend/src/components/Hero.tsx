import React from 'react';
import { ShieldCheck, Zap, Users, ArrowRight } from 'lucide-react';
import SearchBox from './SearchBox';

interface HeroProps {
  activeMode?: 'stitched' | 'train' | 'bus' | 'flight' | 'cab';
  onSearchStart?: () => void;
  onSearchResults?: (results: any) => void;
}

export default function Hero({ activeMode = 'stitched', onSearchStart, onSearchResults }: HeroProps) {
  return (
    <div className="relative h-full flex-1 w-full bg-[#f8faf9] flex flex-col pt-24 overflow-hidden">
      
      {/* Curved Background Image Container */}
      <div className="absolute top-0 right-0 w-full md:w-[55%] lg:w-[45%] h-[85%] md:rounded-bl-[100%] overflow-hidden z-0 shadow-2xl">
        <img 
          src="/hero_bg_train.png" 
          alt="Scenic train journey through green mountains" 
          className="w-full h-full object-cover object-left-bottom scale-[1.25] translate-x-16 -translate-y-12"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-black/10 to-transparent z-10"></div>
        

      </div>



      {/* Hero Content */}
      <div className="relative z-20 px-8 max-w-7xl mx-auto flex-1 w-full flex flex-col justify-center mt-6">
        
        <div className="max-w-xl mb-8">
          <h1 className="text-5xl md:text-6xl lg:text-[72px] font-light text-[#112a1f] tracking-tight leading-[1.1] mb-6">
            No direct route?<br/>We’ll find a way.
          </h1>
          <p className="text-xl text-gray-600 font-normal">
            Find the best way to get there, even without a direct route.
          </p>
        </div>

        <SearchBox activeMode={activeMode} onSearchStart={onSearchStart} onSearchResults={onSearchResults} />


      </div>
    </div>
  );
}
