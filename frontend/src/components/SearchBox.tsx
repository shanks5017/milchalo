import React, { useState, useEffect, useRef } from 'react';
import { Train, Bus, Plane, Car, ArrowRight, ArrowLeftRight, Calendar, User, ShieldCheck, Map, Headset, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { saveSearchQuery } from '../lib/supabase';

interface SearchBoxProps {
  activeMode: 'stitched' | 'train' | 'bus' | 'flight' | 'cab';
  onSearchStart?: () => void;
  onSearchResults?: (results: any) => void;
}

interface Location {
  erailCode: string;
  name: string;
  searchStrings?: string[];
}

export default function SearchBox({ activeMode, onSearchStart, onSearchResults }: SearchBoxProps) {
  const [from, setFrom] = useState('Bengaluru');
  const [to, setTo] = useState('Belagavi');
  const [fromCode, setFromCode] = useState('SBC');
  const [toCode, setToCode] = useState('BGM');
  const [depart, setDepart] = useState('');
  const [travellers, setTravellers] = useState('2 Adults');
  const navigate = useNavigate();

  const [locations, setLocations] = useState<Location[]>([]);
  const [fromDropdown, setFromDropdown] = useState(false);
  const [toDropdown, setToDropdown] = useState(false);
  const fromRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Default to tomorrow
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setDepart(d.toISOString().split('T')[0]);

    // Fetch locations
    fetch('http://localhost:3002/api/locations')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setLocations(data.data);
        }
      })
      .catch(err => console.error('Failed to fetch locations:', err));
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (fromRef.current && !fromRef.current.contains(e.target as Node)) {
        setFromDropdown(false);
      }
      if (toRef.current && !toRef.current.contains(e.target as Node)) {
        setToDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSwap = () => {
    const tempF = from;
    const tempFC = fromCode;
    setFrom(to);
    setFromCode(toCode);
    setTo(tempF);
    setToCode(tempFC);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    saveSearchQuery({
      origin: from,
      destination: to,
      date: depart,
      mode: activeMode,
      travellers,
    });

    // Formatting date as expected by backend (dd-mm-yyyy)
    const [yyyy, mm, dd] = depart.split('-');
    const formattedDate = `${dd}-${mm}-${yyyy}`;

    const payload = {
      from: fromCode,
      to: toCode,
      date: formattedDate,
      mode: activeMode,
      maxLegs: activeMode === 'stitched' ? 3 : 1,
      sessionId: Math.random().toString(36).substring(7)
    };
    
    console.log('Sending search request to backend:', payload);
    if (onSearchStart) onSearchStart();
    try {
      const res = await fetch('http://localhost:3002/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      console.log('Search Results:', data);
      if (onSearchResults) onSearchResults(data);
    } catch (err) {
      console.error('Search request failed', err);
      if (onSearchResults) onSearchResults({ success: false, error: 'Failed to connect to backend' });
    }
  };

  const getFilteredLocations = (query: string) => {
    const q = query.toLowerCase();
    if (q.length < 2) return [];
    return locations.filter(loc => 
      loc.name.toLowerCase().includes(q) || 
      loc.erailCode.toLowerCase().includes(q) || 
      (loc.searchStrings && loc.searchStrings.some(s => s.toLowerCase().includes(q)))
    ).slice(0, 8); // limit to 8
  };

  return (
    <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl mt-4">
      {/* Tabs */}
      <div className="flex border-b border-gray-100 p-2 gap-2 overflow-x-auto">
        <button
          onClick={() => navigate('/stitched')}
          className={`whitespace-nowrap flex items-center space-x-2 px-6 py-3 rounded-xl font-medium text-sm transition-colors ${
            activeMode === 'stitched' ? 'bg-[#006039] text-white' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <div className="flex -space-x-1"><Train className="w-4 h-4"/><Bus className="w-4 h-4"/></div>
          <span>Stitched</span>
        </button>
        <button
          onClick={() => navigate('/train')}
          className={`whitespace-nowrap flex items-center space-x-2 px-6 py-3 rounded-xl font-medium text-sm transition-colors ${
            activeMode === 'train' ? 'bg-[#006039] text-white' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Train className="w-5 h-5" />
          <span>Train</span>
        </button>
        <button
          onClick={() => navigate('/bus')}
          className={`whitespace-nowrap flex items-center space-x-2 px-6 py-3 rounded-xl font-medium text-sm transition-colors ${
            activeMode === 'bus' ? 'bg-[#006039] text-white' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Bus className="w-5 h-5" />
          <span>Bus</span>
        </button>
        <button
          onClick={() => navigate('/flight')}
          className={`whitespace-nowrap flex items-center space-x-2 px-6 py-3 rounded-xl font-medium text-sm transition-colors ${
            activeMode === 'flight' ? 'bg-[#006039] text-white' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Plane className="w-5 h-5" />
          <span>Flight</span>
        </button>
        <button
          onClick={() => navigate('/cab')}
          className={`whitespace-nowrap flex items-center space-x-2 px-6 py-3 rounded-xl font-medium text-sm transition-colors ${
            activeMode === 'cab' ? 'bg-[#006039] text-white' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Car className="w-5 h-5" />
          <span>Cab</span>
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSearch} className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4 relative mb-6">
          <div className="flex flex-col relative" ref={fromRef}>
             <span className="text-gray-500 text-sm font-medium mb-1">From</span>
             <div className="relative">
               <input 
                 type="text" 
                 value={from}
                 onChange={(e) => {
                   setFrom(e.target.value);
                   setFromDropdown(true);
                 }}
                 onFocus={() => setFromDropdown(true)}
                 className="w-full text-xl md:text-3xl font-bold text-gray-900 border-none outline-none focus:ring-0 p-0 bg-transparent" 
                 placeholder="Origin Hub"
               />
               <span className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-semibold bg-gray-100 px-2 py-1 rounded">{fromCode}</span>
             </div>
             {/* Dropdown */}
             {fromDropdown && getFilteredLocations(from).length > 0 && (
               <div className="absolute top-full left-0 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
                 <div className="text-xs font-semibold text-gray-400 p-3 bg-gray-50 uppercase tracking-wider">Primary Indian Transit Hubs</div>
                 {getFilteredLocations(from).map(loc => (
                   <div 
                     key={loc.erailCode} 
                     onClick={() => {
                       setFrom(loc.name);
                       setFromCode(loc.erailCode);
                       setFromDropdown(false);
                     }}
                     className="p-3 hover:bg-green-50 cursor-pointer flex items-center justify-between border-b border-gray-50 last:border-0"
                   >
                     <div className="flex flex-col">
                       <span className="font-semibold text-gray-800 flex items-center gap-2"><MapPin className="w-4 h-4 text-green-600"/> {loc.name}</span>
                       <span className="text-xs text-gray-500 ml-6">India ({loc.erailCode})</span>
                     </div>
                     <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">{loc.erailCode}</span>
                   </div>
                 ))}
               </div>
             )}
          </div>
          
          <button type="button" onClick={handleSwap} className="mx-auto w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-[#006039] hover:text-white transition-colors z-10 shrink-0 shadow-sm border border-gray-200">
            <ArrowLeftRight className="w-5 h-5" />
          </button>

          <div className="flex flex-col relative" ref={toRef}>
             <span className="text-gray-500 text-sm font-medium mb-1">To</span>
             <div className="relative">
               <input 
                 type="text" 
                 value={to}
                 onChange={(e) => {
                   setTo(e.target.value);
                   setToDropdown(true);
                 }}
                 onFocus={() => setToDropdown(true)}
                 className="w-full text-xl md:text-3xl font-bold text-gray-900 border-none outline-none focus:ring-0 p-0 bg-transparent" 
                 placeholder="Destination Hub"
               />
               <span className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-semibold bg-gray-100 px-2 py-1 rounded">{toCode}</span>
             </div>
             {/* Dropdown */}
             {toDropdown && getFilteredLocations(to).length > 0 && (
               <div className="absolute top-full left-0 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
                 <div className="text-xs font-semibold text-gray-400 p-3 bg-gray-50 uppercase tracking-wider">Popular Destination Terminals</div>
                 {getFilteredLocations(to).map(loc => (
                   <div 
                     key={loc.erailCode} 
                     onClick={() => {
                       setTo(loc.name);
                       setToCode(loc.erailCode);
                       setToDropdown(false);
                     }}
                     className="p-3 hover:bg-green-50 cursor-pointer flex items-center justify-between border-b border-gray-50 last:border-0"
                   >
                     <div className="flex flex-col">
                       <span className="font-semibold text-gray-800 flex items-center gap-2"><MapPin className="w-4 h-4 text-green-600"/> {loc.name}</span>
                       <span className="text-xs text-gray-500 ml-6">India ({loc.erailCode})</span>
                     </div>
                     <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">{loc.erailCode}</span>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>

        <div className="w-full h-px bg-gray-100 mb-6"></div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <div className="flex flex-col">
             <span className="text-gray-500 text-sm font-medium mb-1">Depart</span>
             <div className="flex items-center space-x-2 text-gray-900 font-semibold text-lg cursor-pointer">
               <Calendar className="w-5 h-5 text-gray-500" />
               <input type="date" value={depart} onChange={(e) => setDepart(e.target.value)} className="border-none outline-none font-semibold p-0 text-gray-900 cursor-pointer bg-transparent" />
             </div>
          </div>
          <div className="flex flex-col">
             <span className="text-gray-500 text-sm font-medium mb-1">Return (Optional)</span>
             <div className="flex items-center space-x-2 text-gray-400 font-semibold text-lg cursor-pointer">
               <Calendar className="w-5 h-5 text-gray-300" />
               <span>Add return</span>
             </div>
          </div>
          <div className="flex flex-col">
             <span className="text-gray-500 text-sm font-medium mb-1">Travellers</span>
             <div className="flex items-center space-x-2 text-gray-900 font-semibold text-lg cursor-pointer">
               <User className="w-5 h-5 text-gray-500" />
               <input type="text" value={travellers} onChange={(e) => setTravellers(e.target.value)} className="border-none outline-none font-semibold p-0 text-gray-900 bg-transparent w-full" />
             </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button type="submit" className="bg-[#006039] hover:bg-[#004b2c] text-white px-8 py-4 rounded-xl font-semibold text-lg flex items-center space-x-2 transition-colors shadow-lg shadow-green-900/20">
            <span>Search journeys</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
