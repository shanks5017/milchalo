import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Clock, MapPin, Share2, Bookmark, ExternalLink,
  ArrowRightLeft, ShieldCheck, Zap, Info, Plus, Minus, Settings, CheckCircle2, Shield, Headphones
} from 'lucide-react';
import { CustomTrain as Train, CustomBus as Bus } from '../components/CustomIcons';
import { getBookingLinksForLeg } from '../lib/bookingLinks';

interface Availability {
  class: string;
  price: string;
  status: string;
}

interface Leg {
  mode: 'train' | 'bus';
  from: string;
  to: string;
  departure: string;
  arrivalTime: string;
  travelTime?: string;
  trainNo?: string;
  trainName?: string;
  operator?: string;
  busType?: string;
  trainType?: string;
  runningDays?: string;
  availability: Availability[];
  lowestFare?: number | null;
  seatsLeft?: number | null;
  ratings?: string | number | null;
  departureDate?: string;
  arrivalDate?: string;
  dataSource?: string;
  deepLink?: string;
}

interface InterchangeDetail {
  city: string;
  state?: string;
  bufferMins: number;
  slackMins: number;
}

interface Route {
  legs?: Leg[];
  totalDurationMins?: number;
  totalCostMin?: number;
  buffers?: number[];
  viaCities?: string[];
  interchangeDetails?: InterchangeDetail[];
}

function formatDuration(mins?: number) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

function formatPrice(p?: number | string | null) {
  if (!p) return '—';
  if (typeof p === 'string' && p.includes('₹')) return p;
  return `₹${p}`;
}

export default function JourneyDetailsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const state = location.state as { route?: Route; fromName?: string; toName?: string } | null;
  const { route, fromName, toName } = state || {};

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (!route) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-4">No journey details available.</p>
          <button onClick={() => navigate(-1)} className="text-emerald-700 font-medium">← Go Back</button>
        </div>
      </div>
    );
  }

  const legs = route.legs || [];
  const totalPrice = formatPrice(route.totalCostMin);
  const totalSeats = legs.reduce((acc, leg) => acc + (leg.seatsLeft || 0), 0);
  
  // Calculate total distance approx (mocked for UI if not available)
  const totalDistance = "853 km"; 

  let mapUrl = `https://maps.google.com/maps?saddr=${encodeURIComponent(fromName || legs[0]?.from)}`;
  if (route.viaCities && route.viaCities.length > 0) {
    const vias = route.viaCities.map(v => encodeURIComponent(v)).join('+to:');
    mapUrl += `&daddr=${vias}+to:${encodeURIComponent(toName || legs[legs.length - 1]?.to)}`;
  } else {
    mapUrl += `&daddr=${encodeURIComponent(toName || legs[legs.length - 1]?.to)}`;
  }
  mapUrl += `&output=embed`;

  return (
    <div className="min-h-screen bg-[#f4f6f5] font-sans text-slate-800 relative">
      
      {/* ── Glass Blur Effect & Header Spacer ── */}
      <div
        className="sticky top-0 w-full h-[104px] pointer-events-none bg-transparent backdrop-blur-md z-40"
        style={{
          WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)'
        }}
      />

      {/* ── Top Stats Bar ──────────────────────────────────────────────────────── */}
      <div className="w-full max-w-[1500px] mx-auto px-6 md:px-8 shrink-0">
        <div className="w-full bg-[#006039] rounded-[24px] relative overflow-hidden shadow-sm">
          
          {/* Background Image (Dissolved) */}
          <div className="absolute top-0 right-0 h-full w-1/2 md:w-1/3 pointer-events-none flex justify-end z-0">
            <img
              src="/journey-detail-mockup.png"
              alt=""
              className="w-full h-full object-cover object-right opacity-50 mix-blend-overlay"
              style={{
                WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 60%)',
                maskImage: 'linear-gradient(to right, transparent 0%, black 60%)'
              }}
            />
          </div>

          <div className="relative z-10 w-full flex items-center py-5 px-6 md:px-10 overflow-x-auto whitespace-nowrap hide-scrollbar">
            
            <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2.5 -ml-2 rounded-full hover:bg-white/10 transition-colors mr-2 shrink-0">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          
          {/* Stat Item: Total Duration */}
          <div className="flex items-center gap-4 pr-10 border-r border-white/10">
            <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-emerald-100/70 font-medium tracking-wide">Total Duration</span>
              <span className="text-[15px] font-medium text-white leading-tight mt-0.5">{formatDuration(route.totalDurationMins)}</span>
              <span className="text-[11px] text-emerald-100/50 mt-0.5">Including transfers</span>
            </div>
          </div>

          {/* Stat Item: Changes */}
          <div className="flex items-center gap-4 px-10 border-r border-white/10">
            <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-emerald-100/70 font-medium tracking-wide">{route.interchangeDetails?.length || 0} Change</span>
              <span className="text-[15px] font-medium text-white leading-tight mt-0.5">
                {route.interchangeDetails?.[0]?.city || 'Direct'}
              </span>
              <span className="text-[11px] text-emerald-100/50 mt-0.5">
                {route.interchangeDetails?.[0] ? `${formatDuration(route.interchangeDetails[0].slackMins)} connection` : 'Non-stop'}
              </span>
            </div>
          </div>

          {/* Stat Item: Total Distance */}
          <div className="flex items-center gap-4 px-10 border-r border-white/10">
            <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-emerald-100/70 font-medium tracking-wide">Total Distance</span>
              <span className="text-[15px] font-medium text-white leading-tight mt-0.5">{totalDistance}</span>
              <span className="text-[11px] text-emerald-100/50 mt-0.5">Travelled</span>
            </div>
          </div>

          {/* Stat Item: Price */}
          <div className="flex items-center gap-4 px-10 border-r border-white/10">
            <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center font-medium text-white text-lg">
              ₹
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-emerald-100/70 font-medium tracking-wide">Starting from</span>
              <span className="text-[15px] font-medium text-white leading-tight mt-0.5">{totalPrice}</span>
              <span className="text-[11px] text-emerald-100/50 mt-0.5">Per adult</span>
            </div>
          </div>

          {/* Stat Item: Seats */}
          <div className="flex items-center gap-4 pl-10">
            <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                <path d="M19 13V8a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v5" />
                <path d="M4 19v-4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" />
                <path d="M2 19h20" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-emerald-100/70 font-medium tracking-wide">Seats Available</span>
              <span className="text-[15px] font-medium text-white leading-tight mt-0.5">{totalSeats > 0 ? `${totalSeats}+ seats` : 'Limited'}</span>
              <span className="text-[11px] text-emerald-100/50 mt-0.5">Across modes</span>
            </div>
          </div>
          
        </div>
      </div>
      </div>
      </div>

      {/* ── Main Layout ──────────────────────────────────────────────────────── */}
      <div className="max-w-[1500px] mx-auto w-full flex-1 flex flex-col lg:flex-row p-6 md:p-8 gap-8">
        
        {/* Left Column: Map */}
        <div className="w-full lg:w-[45%] h-[600px] lg:h-[calc(100vh-140px)] sticky top-[128px] rounded-[32px] overflow-hidden bg-gray-100 shadow-sm border border-gray-200/50 relative">
          
          <iframe 
            src={mapUrl}
            className="w-full h-full border-0 absolute inset-0 mix-blend-multiply opacity-80"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="absolute inset-0 bg-[#add8e6]/10 pointer-events-none"></div> {/* Subtle blue tint for water areas if visible */}

          {/* Route Map • LIVE Badge */}
          <div className="absolute top-6 left-6 bg-white/95 backdrop-blur-sm rounded-full py-2.5 px-4 shadow-sm border border-gray-100 flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-[#1b6b47] flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white"></div>
            </div>
            <span className="text-[13px] font-medium text-gray-800">Route Map</span>
            <div className="w-[1px] h-3 bg-gray-200"></div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#1b6b47]"></div>
              <span className="text-[11px] font-medium text-[#1b6b47] uppercase tracking-wide">LIVE</span>
            </div>
          </div>

          {/* Journey Overview Legend */}
          <div className="absolute bottom-6 left-6 bg-white/95 backdrop-blur-sm rounded-[20px] p-4 shadow-md border border-gray-100 w-56">
            <h4 className="text-[13px] font-medium text-gray-900 mb-3">Journey Overview</h4>
            
            {legs.map((leg, i) => (
              <div key={`legend-${i}`} className="flex items-center justify-between mb-2 last:mb-0 text-[12px] font-medium text-gray-600">
                <div className="flex items-center gap-2.5">
                  {leg.mode === 'train' ? <Train className="w-4 h-4 text-[#1b6b47]" /> : <Bus className="w-4 h-4 text-[#4f86f7]" />}
                  <span className="capitalize">{leg.mode}</span>
                </div>
                <div className="flex-1 border-b-[3px] mx-3" style={{ borderColor: leg.mode === 'train' ? '#1b6b47' : '#4f86f7', borderStyle: 'solid' }}></div>
                <span className="text-gray-500 tabular-nums">{leg.travelTime}</span>
              </div>
            ))}
            
            {route.interchangeDetails && route.interchangeDetails.length > 0 && (
              <div className="flex items-center justify-between mb-2 text-[12px] font-medium text-gray-600 mt-2">
                <div className="flex items-center gap-2.5">
                  <ArrowRightLeft className="w-4 h-4 text-[#e07f35]" />
                  <span>Transfer</span>
                </div>
                <div className="flex-1 border-b-[3px] mx-3 border-[#e07f35] border-dashed"></div>
                <span className="text-gray-500 tabular-nums">{formatDuration(route.interchangeDetails[0].slackMins)}</span>
              </div>
            )}
          </div>

          {/* Zoom Controls */}
          <div className="absolute bottom-6 right-6 flex flex-col gap-2">
            <div className="bg-white rounded-[14px] shadow-md border border-gray-100 overflow-hidden flex flex-col">
              <button className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-50 border-b border-gray-100">
                <Plus className="w-5 h-5" />
              </button>
              <button className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-50 border-b border-gray-100">
                <Minus className="w-5 h-5" />
              </button>
              <button className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-50">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Details List */}
        <div className="w-full lg:w-[55%] flex flex-col pt-2 relative pb-[160px]">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[22px] font-medium text-gray-900">Journey Details</h2>
            <div className="flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <Share2 className="w-4 h-4" /> Share
              </button>
              <button className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                <Bookmark className="w-4 h-4" /> Save
              </button>
            </div>
          </div>

          {/* Timeline Cards */}
          <div className="flex flex-col gap-6">
            {legs.map((leg, idx) => {
              const isTrain = leg.mode === 'train';
              const modeColor = isTrain ? '#1b6b47' : '#4f86f7';
              const legPillBg = isTrain ? 'bg-[#1b6b47]' : 'bg-[#4f86f7]';
              const modePillBg = isTrain ? 'bg-[#e5f3eb] text-[#1b6b47]' : 'bg-[#e6f0ff] text-[#4f86f7]';
              
              const interchange = route.interchangeDetails?.[idx];

              return (
                <React.Fragment key={idx}>
                  {/* Leg Card */}
                  <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-6 lg:p-8 relative">
                    
                    {/* Header (Pills + Price) */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <div className={`${legPillBg} text-white px-3 py-1 rounded-full text-[11px] font-medium uppercase tracking-wider`}>
                          LEG {idx + 1}
                        </div>
                        <div className={`${modePillBg} px-3 py-1 rounded-full text-[11px] font-medium uppercase tracking-wider`}>
                          {leg.mode}
                        </div>
                      </div>
                      {leg.lowestFare && (
                        <div className="text-[18px] text-gray-900 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-1.5">
                          <span className="text-[11px] text-gray-500 uppercase tracking-wider mt-0.5">Starting at</span>
                          {formatPrice(leg.lowestFare)}
                        </div>
                      )}
                    </div>

                    {/* Times & Stations */}
                    <div className="flex items-center justify-between mb-6">
                      {/* Origin */}
                      <div className="w-[30%]">
                        <div className="text-[26px] font-medium text-gray-900 leading-none mb-2">{leg.departure}</div>
                        <div className="text-[15px] font-medium text-gray-800 mb-0.5">{leg.from.split(' ')[0] || 'SBC'}</div>
                        <div className="text-[12px] text-gray-500 leading-tight">{leg.from}</div>
                      </div>

                      {/* Center Connector */}
                      <div className="flex-1 flex flex-col items-center px-4 relative mt-[-20px]">
                        <span className="text-[12px] font-medium text-gray-500 mb-2">{leg.travelTime}</span>
                        <div className="w-full flex items-center">
                          <div className="flex-1 h-[2px] bg-gray-300"></div>
                          <div className="mx-3 text-gray-400">
                            {isTrain ? <Train className="w-5 h-5" /> : <Bus className="w-5 h-5" />}
                          </div>
                          <div className="flex-1 h-[2px] bg-gray-300 relative">
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 border-t-[2px] border-r-[2px] border-gray-300 rotate-45"></div>
                          </div>
                        </div>
                      </div>

                      {/* Destination */}
                      <div className="w-[30%] text-right">
                        <div className="text-[26px] font-medium text-gray-900 leading-none mb-2">{leg.arrivalTime}</div>
                        <div className="text-[15px] font-medium text-gray-800 mb-0.5">{leg.to.split(' ')[0] || 'UBL'}</div>
                        <div className="text-[12px] text-gray-500 leading-tight">{leg.to}</div>
                      </div>
                    </div>

                    {/* Train/Bus Details */}
                    <div className="flex flex-col gap-3 mt-6">
                      <div className="flex items-center gap-3">
                        <span className="text-[14px] font-medium text-gray-900">{leg.trainName || leg.operator || 'KSRTC Rapid'}</span>
                        <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">#{leg.trainNo || 'KA32F1234'}</span>
                      </div>
                      <div className="text-[12px] text-gray-600">
                        {leg.trainType || leg.busType || 'Sleeper (SL)'} <span className="mx-1 text-gray-300">|</span> {isTrain ? 'Indian Railways' : 'State Transport'}
                      </div>
                      
                      {/* Feature Badges */}
                      <div className="flex flex-wrap gap-2 mt-1">
                        {!isTrain && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#e6f0ff] text-[#4f86f7] text-[11px] font-medium">
                            AC
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#f0f9f4] text-[#1b6b47] text-[11px] font-medium border border-[#d1ebd9]">
                          <Zap className="w-3 h-3" /> Live Tracking
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-gray-50 text-gray-600 text-[11px] font-medium border border-gray-200">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/><line x1="6" y1="17" x2="18" y2="17"/></svg>
                          Charging Point
                        </div>
                        {isTrain && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-gray-50 text-gray-600 text-[11px] font-medium border border-gray-200">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                            Pantry Car
                          </div>
                        )}
                        {!isTrain && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#e6f0ff]/50 text-[#4f86f7] text-[11px] font-medium border border-[#4f86f7]/20">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3h4"/><path d="M12 3v4"/><path d="M8 12a4 4 0 0 1 8 0v8H8v-8z"/></svg>
                            Water Bottle
                          </div>
                        )}
                      </div>

                      {/* ── Train Seat Availability ──────────────────────── */}
                      {isTrain && leg.availability && leg.availability.length > 0 && (
                        <div className="mt-5 pt-5 border-t border-gray-100">
                          <h4 className="text-[11px] font-semibold text-gray-400 mb-3 uppercase tracking-wider">Class & Availability</h4>
                          <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
                            {leg.availability.map((avail, i) => {
                              const statusLower = avail.status.toLowerCase();
                              const isAvailable = statusLower.includes('avl') || statusLower.includes('available');
                              const isWaitlisted = statusLower.includes('wl') || statusLower.includes('wait') || statusLower.includes('rac');
                              
                              const displayStatus = avail.status.replace(/available|avl/gi, '').replace(/^-/, '').trim();

                              let styleClass = 'text-gray-500 bg-gray-50 border-gray-100';
                              if (isAvailable) styleClass = 'text-emerald-700 bg-emerald-50 border-emerald-100';
                              else if (isWaitlisted) styleClass = 'text-amber-700 bg-amber-50 border-amber-100';

                              return (
                                <div key={i} className={`flex-shrink-0 min-w-[110px] rounded-xl border p-3 flex flex-col gap-1 ${styleClass}`}>
                                  <div className="flex justify-between items-center w-full gap-3">
                                    <span className="font-bold text-[14px]">{avail.class}</span>
                                    <span className="font-medium text-[13px]">{formatPrice(avail.price)}</span>
                                  </div>
                                  {displayStatus && (
                                    <span className="text-[11px] font-medium mt-0.5 truncate">{displayStatus}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* ── Book on Platform ─────────────────────────────── */}
                      {(() => {
                        const bookLinks = getBookingLinksForLeg({
                          mode: leg.mode,
                          from: leg.from,
                          to: leg.to,
                          trainNo: leg.trainNo,
                          trainName: leg.trainName,
                          departureDate: leg.departureDate,
                        });
                        const hasSpecific = bookLinks.some(l => l.type === 'specific');
                        return (
                          <div className="mt-5 pt-5 border-t border-gray-100">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                Book Your {leg.mode === 'train' ? 'Train' : 'Bus'} Ticket
                              </span>
                              {hasSpecific && (
                                <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                  Pre-filled with your {leg.mode === 'train' ? 'train' : ''} details
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {bookLinks.map((link) => (
                                <a
                                  key={link.platform}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={link.type === 'specific' ? `Opens ${link.platform} with your ${leg.mode} details pre-filled` : `Search on ${link.platform}`}
                                  className="group flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium border transition-all duration-150 hover:shadow-md hover:-translate-y-px active:scale-[0.97] select-none"
                                  style={{
                                    borderColor: '#006039',
                                    color: '#006039',
                                    backgroundColor: '#00603910',
                                  }}
                                >
                                  {link.logoUrl ? (
                                    <img src={link.logoUrl} alt={link.platform} className="w-6 h-6 rounded-full shadow-sm bg-white" />
                                  ) : (
                                    <span className="text-[18px] leading-none">{link.logo}</span>
                                  )}
                                  <span>{link.platform}</span>
                                  {link.type === 'specific' && (
                                    <span
                                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: '#006039' }}
                                    />
                                  )}
                                  <ExternalLink
                                    className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity -ml-0.5"
                                  />
                                </a>
                              ))}
                            </div>
                            {!hasSpecific && (
                              <p className="text-[10px] text-gray-400 mt-2">
                                Opens the search results page — select your preferred {leg.mode} from the list.
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Interchange Box */}
                  {interchange && (
                    <div className="bg-[#fff9f0] border border-[#f5e6d3] rounded-[24px] p-6 relative overflow-hidden">
                      <div className="flex items-center justify-between mb-4 relative z-10">
                        <div className="flex items-center gap-2">
                          <ArrowRightLeft className="w-5 h-5 text-[#d97c36]" />
                          <h3 className="text-[14px] font-medium text-[#b35914] tracking-wide">
                            CHANGE AT {interchange.city.toUpperCase()}
                          </h3>
                        </div>
                        <div className="text-[15px] font-medium text-[#b35914]">
                          {formatDuration(interchange.slackMins)}
                        </div>
                      </div>

                      <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-white flex items-center justify-between relative z-10">
                        <div className="max-w-[70%]">
                          <h4 className="text-[13px] font-medium text-[#1b6b47] flex items-center gap-2 mb-1.5">
                            <ShieldCheck className="w-4 h-4" /> Safe Connection
                          </h4>
                          <p className="text-[12px] text-gray-600 leading-relaxed">
                            You have a comfortable buffer time to change and reach the next boarding point.
                          </p>
                        </div>
                        {/* Abstract station illustration made with CSS/Lucide */}
                        <div className="flex items-end gap-1 opacity-60">
                           <div className="flex flex-col items-center">
                              <div className="w-16 h-12 border-2 border-emerald-700/40 rounded-t-lg relative flex justify-center">
                                <div className="absolute -top-3 w-0 h-0 border-l-[36px] border-r-[36px] border-b-[12px] border-l-transparent border-r-transparent border-b-emerald-700/40"></div>
                                <div className="w-6 h-8 border-2 border-emerald-700/40 border-b-0 mt-4 rounded-t"></div>
                              </div>
                           </div>
                           <div className="flex flex-col items-center ml-2">
                             <div className="w-6 h-6 rounded-full border-2 border-emerald-700/40 flex items-center justify-center">
                               <div className="w-1 h-1 bg-emerald-700/40 rounded-full"></div>
                             </div>
                             <div className="w-0.5 h-6 bg-emerald-700/40"></div>
                           </div>
                        </div>
                      </div>
                    </div>
                  )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Fare Breakdown */}
            {legs.some(leg => leg.lowestFare) && (
              <div className="mt-8 bg-white rounded-[24px] border border-gray-100 shadow-sm p-6 lg:p-8">
                <h3 className="text-[18px] text-gray-900 mb-4">Fare Breakdown</h3>
                <div className="flex flex-col gap-3">
                  {legs.map((leg, idx) => (
                    <div key={`fare-${idx}`} className="flex flex-col gap-2 pb-3 mb-1 border-b border-gray-50 last:border-0 last:pb-0 last:mb-0">
                      <div className="flex items-center justify-between text-[14px] text-gray-700">
                        <span className="font-medium">{leg.from.split(' ')[0]} → {leg.to.split(' ')[0]} <span className="text-[12px] text-gray-400 font-normal ml-1 capitalize">({leg.mode})</span></span>
                        <span>{formatPrice(leg.lowestFare)} <span className="text-[11px] text-gray-400 ml-0.5">(starting)</span></span>
                      </div>
                      
                      {/* Detailed Train Prices */}
                      {leg.mode === 'train' && leg.availability && leg.availability.length > 0 && (
                        <div className="flex flex-col gap-1.5 pl-3 border-l-[2px] border-emerald-100/50 ml-1 mt-0.5">
                          {leg.availability.map((avail, i) => {
                            const displayStatus = avail.status.replace(/available|avl/gi, '').replace(/^-/, '').trim();
                            return (
                              <div key={`class-${i}`} className="flex items-center justify-between text-[12.5px] text-gray-500">
                                <span>
                                  Class {avail.class} 
                                  {displayStatus && (
                                    <span className="opacity-60 ml-1.5 text-[11px] truncate max-w-[120px] inline-block align-bottom">({displayStatus})</span>
                                  )}
                                </span>
                                <span>{formatPrice(avail.price)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="border-t border-gray-100 mt-2 pt-3 flex items-center justify-between text-[16px] text-gray-900">
                    <span>Total Fare</span>
                    <span className="text-emerald-700">{totalPrice}</span>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
  );
}
