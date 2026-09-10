import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Clock, ArrowRight, ChevronDown,
  ChevronUp, MapPin, Calendar, Users, AlertCircle, Zap,
  Share2, Radio, Search, CheckCircle2, Loader2, Database,
  Star, ShieldCheck, Tag, Headset, CheckCircle, Bookmark, Info, Sparkles
} from 'lucide-react';
import { CustomTrain as Train, CustomBus as Bus } from '../components/CustomIcons';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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
  scores?: { fastest: number; cheapest: number; reliable: number };
  rankLabel?: string;
  // direct route fields
  mode?: string;
  from?: string;
  to?: string;
  departure?: string;
  arrivalTime?: string;
  travelTime?: string;
  trainNo?: string;
  trainName?: string;
  operator?: string;
  availability?: Availability[];
  lowestFare?: number | null;
  deepLink?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDuration(mins?: number | null) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatPrice(p?: number | string | null) {
  if (!p) return '—';
  if (typeof p === 'string' && p.includes('₹')) return p;
  return `₹${p}`;
}

function statusColor(status: string) {
  const s = status.toUpperCase();
  if (s === 'AVAILABLE' || s === 'AVL') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (s.startsWith('WL') || s === 'WAITLIST') return 'text-amber-700 bg-amber-50 border-amber-200';
  if (s === 'REGRET' || s === 'FULL') return 'text-red-700 bg-red-50 border-red-200';
  return 'text-gray-600 bg-gray-50 border-gray-200';
}

function runningDaysDisplay(days?: string) {
  if (!days) return null;
  const map: Record<string, string> = { Mon: 'M', Tue: 'T', Wed: 'W', Thu: 'T', Fri: 'F', Sat: 'S', Sun: 'S' };
  return days.split(',').map(d => map[d.trim()] || d.trim()).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function AvailabilityRow({ availability }: { availability: Availability[] }) {
  if (!availability || availability.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
      {availability.map((a, i) => (
        <div key={i} className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded border ${statusColor(a.status)}`}>
          <span className="font-bold">{a.class}</span>
          <span className="font-medium opacity-80">·</span>
          <span>{a.price}</span>
          <span className={`ml-1 text-[10px] font-normal ${a.status.toUpperCase() === 'AVAILABLE' || a.status.toUpperCase() === 'AVL'
            ? 'text-emerald-600' : a.status.toUpperCase().startsWith('WL')
              ? 'text-amber-600' : 'text-red-600'
            }`}>{a.status}</span>
        </div>
      ))}
    </div>
  );
}

function JourneyTimeline({ departure, arrivalTime, from, to, duration }: {
  departure: string; arrivalTime: string; from: string; to: string; duration?: string;
}) {
  return (
    <div className="flex items-center gap-4 flex-1 min-w-0">
      {/* Departure */}
      <div className="text-left min-w-[72px]">
        <p className="text-[20px] font-medium text-gray-900 leading-none tracking-tight">{departure || '—'}</p>
        <p className="text-[12px] text-gray-600 mt-1">{from}</p>
      </div>

      {/* Line */}
      <div className="flex-1 flex flex-col items-center gap-1 min-w-[80px]">
        {duration && (
          <span className="text-[11px] text-gray-400">{duration}</span>
        )}
        <div className="w-full flex items-center gap-0">
          <div className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
          <div className="flex-1 h-[1px] bg-gray-300" />
          <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0 -mx-0.5" />
        </div>
      </div>

      {/* Arrival */}
      <div className="text-right min-w-[72px]">
        <p className="text-[20px] font-medium text-gray-900 leading-none tracking-tight">{arrivalTime || '—'}</p>
        <p className="text-[12px] text-gray-600 mt-1">{to}</p>
      </div>
    </div>
  );
}

function ModeTag({ mode, className = '' }: { key?: React.Key; mode: string; className?: string }) {
  const isTrainMode = mode === 'train';
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border ${isTrainMode
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : 'bg-orange-50 text-orange-700 border-orange-200'
      } ${className}`}>
      {isTrainMode ? <Train className="w-3 h-3" /> : <Bus className="w-3 h-3" />}
      {isTrainMode ? 'Train' : 'Bus'}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Direct Route Card
// ─────────────────────────────────────────────────────────────────────────────

function DirectCard({ route, fromName, toName, isFirst }: {
  key?: React.Key; route: Route; fromName: string; toName: string; isFirst: boolean;
}) {
  const leg = route.legs?.[0] || (route as any);
  const price = leg.lowestFare ?? route.lowestFare;

  return (
    <div className="bg-white rounded-2xl border border-[#006039] overflow-hidden hover:shadow-md transition-all duration-200 mb-4 p-5">
      <div className="flex flex-col md:flex-row gap-6 md:gap-4 justify-between">
        
        {/* Left Column: Operator & Details */}
        <div className="flex flex-col flex-1 min-w-[280px]">
          <h3 className="text-[17px] font-semibold text-gray-900 tracking-tight">
            {leg.operator || leg.trainName || 'IntrCity SmartBus'}
          </h3>
          <p className="text-[13px] text-gray-500 mt-0.5">
            {leg.busType || 'AC Seater/Sleeper (2 + 1)'}
          </p>
          <p className="text-[13px] text-gray-500">
            Starts from {leg.from || fromName}
          </p>
        </div>

        {/* Center Column: Timeline */}
        <div className="flex items-start justify-center flex-1 min-w-[250px] pt-0.5">
          <div className="flex items-start w-full max-w-[320px]">
            <div className="flex flex-col text-center">
              <span className="text-[17px] font-bold text-[#374151]">{leg.departure || '19:55'}</span>
              <span className="text-[13px] text-gray-400 mt-0.5">{leg.from || fromName}</span>
            </div>
            
            <div className="flex-1 flex items-center justify-center relative mx-3 mt-[11px]">
              <div className="w-full h-[1px] bg-gray-200 absolute top-1/2 left-0 right-0 z-0"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-gray-200 absolute left-0 top-1/2 -translate-y-1/2 z-0"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-gray-200 absolute right-0 top-1/2 -translate-y-1/2 z-0"></div>
              <span className="relative z-10 bg-white border border-gray-200 text-gray-500 text-[11px] font-medium px-3 py-0.5 rounded-full">
                {leg.travelTime || formatDuration(route.totalDurationMins) || '09h.55m'}
              </span>
            </div>

            <div className="flex flex-col text-center">
              <span className="text-[17px] font-bold text-[#374151]">{leg.arrivalTime || '05:50'}</span>
              <span className="text-[13px] text-gray-400 mt-0.5">{leg.to || toName}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Price & Action */}
        <div className="flex flex-col items-center justify-center min-w-[140px] md:border-l border-gray-100 md:pl-6 pt-2 md:pt-0">
          <p className="text-[13px] text-gray-700 font-medium">
            From <span className="text-[20px] font-bold text-gray-900 ml-0.5">{formatPrice(price)}</span>
          </p>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Direct Train Card
// ─────────────────────────────────────────────────────────────────────────────

function DirectTrainCard({ route }: { key?: React.Key; route: Route; }) {
  const leg = route.legs?.[0] || (route as any);
  const avail = leg.availability || [];

  return (
    <div className="bg-white rounded-2xl border border-[#006039] overflow-hidden mb-4 hover:shadow-md transition-all duration-200">
      <div className="p-4 border-b border-gray-100 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[17px] font-medium text-gray-900 tracking-tight">
              {leg.trainNo} {leg.trainName}
            </span>
          </div>
        </div>

        {/* Schedule Row */}
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-3">
            <span className="text-[15px] font-bold text-gray-900">{leg.departure} <span className="font-semibold tracking-wide ml-0.5">{leg.from}</span></span>
            <span className="flex items-center gap-2 text-[12px] text-gray-400 font-medium">
              <div className="w-1.5 h-1.5 bg-gray-300 rounded-full shrink-0" />
              <div className="h-[2px] w-8 bg-gray-200 shrink-0" />
              {leg.travelTime || formatDuration(route.totalDurationMins)}
              <div className="h-[2px] w-8 bg-gray-200 shrink-0" />
              <ArrowRight className="w-3.5 h-3.5 text-gray-300 shrink-0 -ml-1" />
            </span>
            <span className="text-[15px] font-bold text-gray-900">{leg.arrivalTime} <span className="font-semibold tracking-wide ml-0.5">{leg.to}</span></span>
          </div>
        </div>
      </div>

      {/* Availability Row */}
      <div className="p-4 bg-white overflow-x-auto scrollbar-hide">
        <div className="flex gap-3 w-max">
          {avail.map((a: any, i: number) => {
            const isAvailable = a.status.toUpperCase() === 'AVAILABLE' || a.status.toUpperCase() === 'AVL';
            const isWaitlist = a.status.toUpperCase().startsWith('WL') || a.status.toUpperCase() === 'WAITLIST';
            const isRegret = a.status.toUpperCase() === 'REGRET' || a.status.toUpperCase() === 'FULL' || a.status.toUpperCase() === 'NOT AVAILABLE' || a.status.includes('Not Available');

            // Box styling
            let boxColor = '';
            if (isAvailable || isWaitlist) boxColor = 'bg-[#f4fdf6] border-[#bbf7d0]'; 
            else boxColor = 'bg-[#fef2f2] border-[#fecaca]'; 

            return (
              <div key={i} className="flex flex-col gap-1.5 min-w-[145px]">
                <div className={`relative border rounded-xl p-3.5 pt-4 ${boxColor} flex flex-col gap-2 min-h-[95px] shadow-sm`}>
                  
                  {/* Class and Price */}
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-gray-900 text-[15px]">{a.class}</span>
                    </div>
                    <span className="font-bold text-gray-900 text-[15px]">{formatPrice(a.price)}</span>
                  </div>

                  {/* Status */}
                  <div className="mt-auto flex flex-col">
                    {isRegret ? (
                      <span className="text-[#dc2626] font-bold text-[15px]">Not Available</span>
                    ) : (
                      <>
                        <div className="flex items-center gap-1">
                          {(!isAvailable || (a.status.toUpperCase() !== 'AVAILABLE' && a.status.toUpperCase() !== 'AVL')) && (
                            <span className={`font-bold text-[15px] ${isAvailable ? 'text-[#166534]' : 'text-[#b45309]'}`}>
                              {a.status}
                            </span>
                          )}
                          <ShieldCheck className={`w-4 h-4 ${isAvailable ? 'text-[#166534]' : 'text-[#b45309]'}`} />
                        </div>
                        {!isAvailable && (
                          <span className="text-[12px] font-medium text-[#d97706]">
                            Waitlist
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stitched Route Card
// ─────────────────────────────────────────────────────────────────────────────

function StitchedCard({ route, fromName, toName, isFirst }: {
  key?: React.Key; route: Route; fromName: string; toName: string; isFirst: boolean;
}) {
  const navigate = useNavigate();
  const legs = route.legs || [];
  const interchange = route.interchangeDetails?.[0];

  const calcDuration = (dep: string, arr: string, travelTime?: string) => {
    if (travelTime) return travelTime;
    if (!dep || !arr) return '';
    const parseMins = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
    let d = parseMins(dep), a = parseMins(arr);
    if (a < d) a += 1440;
    return formatDuration(a - d);
  };

  const rankText = route.rankLabel === 'fastest' ? 'Fastest' : route.rankLabel === 'cheapest' ? 'Cheapest' : 'Best Value';

  return (
    <div className="bg-white rounded-2xl border border-[#006039] shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden mb-5">

      {/* ── Header (dark green bar) ── */}
      <div className="bg-[#006039] px-5 py-3.5">
        <div className="flex items-center justify-between">

          {/* Left: badges + route path */}
          <div className="flex items-center gap-3 min-w-0">
            {isFirst && (
              <span className="flex items-center gap-1 text-[10px] font-medium tracking-wide bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                <Star className="w-3 h-3 fill-current" /> Best Route
              </span>
            )}
            <span className="flex items-center gap-1.5 text-white/70 text-xs font-medium">
              {legs.map((l, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <ArrowRight className="w-3 h-3 opacity-40" />}
                  {l.mode === 'train' ? <Train className="w-3.5 h-3.5 text-white/80" /> : <Bus className="w-3.5 h-3.5 text-white/80" />}
                </React.Fragment>
              ))}
            </span>
            {/* Station codes */}
            <div className="flex items-center gap-2 text-white font-normal text-sm">
              <div className="flex flex-col items-center leading-tight">
                <span className="text-base">{legs[0]?.from || fromName}</span>
                <span className="text-[10px] font-normal text-white/60 truncate max-w-[80px] text-center">{fromName}</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-white/50 shrink-0" />
              {interchange?.city && (
                <>
                  <div className="flex flex-col items-center leading-tight">
                    <span className="text-base">{interchange.city}</span>
                    <span className="text-[10px] font-normal text-white/60">{interchange.city}</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-white/50 shrink-0" />
                </>
              )}
              <div className="flex flex-col items-center leading-tight">
                <span className="text-base">{legs[legs.length - 1]?.to || toName}</span>
                <span className="text-[10px] font-normal text-white/60 truncate max-w-[80px] text-center">{toName}</span>
              </div>
            </div>
          </div>

          {/* Right: fare + meta pills */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-3 text-white/80 text-xs">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatDuration(route.totalDurationMins)}
              </span>
              <span className="w-px h-4 bg-white/20" />
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" />
                {legs.length - 1} change
              </span>
              <span className="w-px h-4 bg-white/20" />
              <span className="flex items-center gap-1 text-emerald-300">
                <ShieldCheck className="w-3.5 h-3.5" />
                Safe
              </span>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-white/60 font-medium">Total Fare</div>
              <div className="text-xl font-medium text-white leading-tight">{formatPrice(route.totalCostMin)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body (timeline + fare panel) ── */}
      <div className="flex items-start">

        {/* Left: Journey Timeline */}
        <div className="flex-1 px-5 py-3 relative">
          {/* Vertical thread */}
          <div className="absolute left-[34px] top-5 bottom-5 w-px bg-gray-200" />

          {legs.map((leg, idx) => {
            const isLastLeg = idx === legs.length - 1;
            const legInterchange = route.interchangeDetails?.[idx];

            return (
              <React.Fragment key={idx}>
                {/* Leg row */}
                <div className="flex items-start gap-3 relative">
                  {/* Mode dot */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 mt-0.5 ${leg.mode === 'train' ? 'bg-[#006039]' : 'bg-[#66BB6A]'} text-white`}>
                    {leg.mode === 'train' ? <Train className="w-3.5 h-3.5" /> : <Bus className="w-3.5 h-3.5" />}
                  </div>

                  {/* Content */}
                  <div className={`flex-1 ${isLastLeg ? '' : 'pb-2'}`}>
                    {/* Mask for the extra line below the last node */}
                    {isLastLeg && (
                      <div className="absolute left-[13px] top-[16px] bottom-[-200px] w-[3px] bg-white z-0" />
                    )}
                    <div className="flex items-start justify-between gap-4">
                      {/* Departure */}
                      <div className="min-w-0">
                        <span className="text-base font-medium text-gray-900 tabular-nums">{leg.departure}</span>
                        <div className="text-xs text-gray-600 mt-0.5">{leg.from}</div>
                        {idx === 0 && <div className="text-[11px] text-gray-400">{fromName}</div>}
                      </div>

                      {/* Duration line */}
                      <div className="flex flex-col items-center flex-1 min-w-[80px] pt-1 px-2">
                        <span className="text-[11px] text-gray-400 mb-1">{calcDuration(leg.departure, leg.arrivalTime, leg.travelTime)}</span>
                        <div className="w-full flex items-center gap-0.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${leg.mode === 'train' ? 'bg-[#006039]' : 'bg-[#66BB6A]'}`} />
                          <div className={`flex-1 h-px ${leg.mode === 'train' ? 'bg-[#006039]' : 'bg-[#66BB6A]'}`} />
                          <div className={`w-1.5 h-1.5 border-t border-r ${leg.mode === 'train' ? 'border-[#006039]' : 'border-[#66BB6A]'} rotate-45`} />
                        </div>
                      </div>

                      {/* Arrival */}
                      <div className="min-w-0 text-right">
                        <span className="text-base font-medium text-gray-900 tabular-nums">{leg.arrivalTime}</span>
                        <div className="text-xs text-gray-600 mt-0.5">{leg.to}</div>
                        {isLastLeg && <div className="text-[11px] text-gray-400">{toName}</div>}
                      </div>
                    </div>

                    {/* Service badges */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {leg.trainName && (
                        <span className="text-[11px] text-white bg-[#006039] px-2 py-0.5 rounded-full">
                          {leg.trainName}{leg.trainNo ? ` #${leg.trainNo}` : ''}
                        </span>
                      )}
                      {leg.operator && !leg.trainName && (
                        <span className="text-[11px] text-white bg-[#66BB6A] px-2 py-0.5 rounded-full">
                          {leg.operator}
                        </span>
                      )}
                      {leg.busType && (
                        <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {leg.busType}
                        </span>
                      )}
                      {leg.mode === 'train' && leg.availability?.[0] && (
                        <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {leg.availability[0].class}
                        </span>
                      )}
                      {leg.seatsLeft != null && (
                        <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                          {leg.seatsLeft} seats
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Interchange connector */}
                {!isLastLeg && legInterchange && (
                  <div className="flex items-center gap-3 ml-3.5 mb-2 pl-6 relative">
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] -ml-[1px] bg-[#f4f6f5] z-10" />
                    <div className="absolute left-0 top-0 bottom-0 border-l border-dashed border-gray-400 z-20" />
                    
                    <div className="flex items-center gap-2 bg-orange-50 border border-orange-200/60 rounded-full px-3 py-1.5 relative z-30">
                      <Zap className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      <span className="text-[12px] text-gray-700">Change at {legInterchange.city}</span>
                      <span className="text-[11px] text-orange-500">{formatDuration(legInterchange.slackMins)}</span>
                      <span className="w-px h-3.5 bg-orange-200" />
                      <span className="flex items-center gap-1 text-[11px] text-[#006039]">
                        <ShieldCheck className="w-3 h-3" /> Safe
                      </span>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Right: Fare panel */}
        <div className="w-56 shrink-0 border-l border-gray-100 bg-gray-50/50 px-4 py-3 flex flex-col justify-between">
          <div>
            <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-3">Fare Breakdown</div>
            <div className="space-y-2">
              {legs.map((leg, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[12px] text-gray-600 min-w-0">
                    {leg.mode === 'train' ? <Train className="w-3.5 h-3.5 text-[#006039] shrink-0" /> : <Bus className="w-3.5 h-3.5 text-[#66BB6A] shrink-0" />}
                    <span className="truncate">{leg.from} → {leg.to}</span>
                  </div>
                  <span className="text-[12px] text-gray-700 shrink-0 tabular-nums">{formatPrice(leg.lowestFare)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
              <span className="text-xs text-gray-500">Total</span>
              <span className="text-base font-medium text-[#006039] tabular-nums">{formatPrice(route.totalCostMin)}</span>
            </div>

            <div className="mt-4 flex items-center gap-1.5 text-[11px] text-gray-500 bg-[#f0fdf4] border border-[#d1fae5] rounded-full px-2.5 py-1.5">
              <Tag className="w-3 h-3 text-[#006039] shrink-0" />
              <span className="text-[#006039]">{rankText}</span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <button
              onClick={() => navigate('/journey-details', { state: { route, fromName, toName } })}
              className="w-full bg-[#0B5D39] hover:bg-[#004b2c] text-white text-[13px] font-medium py-2.5 rounded-full transition-colors flex items-center justify-center gap-1.5"
            >
              View Details <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button className="w-full border border-gray-200 hover:bg-gray-100 text-gray-600 text-[12px] font-medium py-2 rounded-full transition-colors flex items-center justify-center gap-1.5">
              <Bookmark className="w-3 h-3" /> Save
            </button>
          </div>
        </div>
      </div>

      {/* ── Footer note ── */}
      <div className="px-5 py-2 bg-[#f6fdf9] border-t border-[#d1fae5]/70 flex items-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5 text-[#006039] shrink-0" />
        <span className="text-[11px] text-[#006039]/80 font-medium">Connections include realistic buffer times based on Indian traffic & tier-aware data.</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Live Rolling Log — shows each SSE message as it arrives, 1 by 1
// ─────────────────────────────────────────────────────────────────────────────

function translateLog(raw: string, fromName: string, toName: string): string {
  const r = raw.toLowerCase();

  if (r.includes('finding geometry') || r.includes('interchange candidates')) {
    return `Finding interchange hubs between ${fromName} and ${toName}…`;
  }
  if (r.includes('found') && r.includes('candidate interchange')) {
    const match = raw.match(/hubs?:\s*(.+)$/i);
    if (match) {
      const hubs = [...new Set(match[1].split(',').map(h => h.trim()).filter(Boolean))];
      return `Found ${hubs.length} connection hub${hubs.length !== 1 ? 's' : ''}: ${hubs.join(', ')}`;
    }
    return 'Found interchange hubs along the corridor';
  }
  if (r.includes('building subgraph') || r.includes('parallel')) {
    return 'Fetching transport options across all segments simultaneously…';
  }
  // Pre-scrape "Checking direct route X → Y…" message
  if (r.startsWith('checking direct route')) {
    const match = raw.match(/checking direct route (.+?)\s*[→\-]\s*(.+?)…/i);
    if (match) return `Checking direct ${match[1].trim()} → ${match[2].trim()}…`;
    return 'Checking direct route…';
  }
  // Pre-scrape "Checking X → Y…" message (before result arrives)
  if (r.startsWith('checking') && (r.includes('→') || r.includes('->'))) {
    return raw; // already human-friendly, show as-is
  }
  // Post-scrape: "Scraped direct route X → Y: N trains, M buses"
  if (r.includes('direct route') && (r.includes('train') || r.includes('bus'))) {
    const match = raw.match(/(\d+)\s+trains?,\s*(\d+)\s+buses?/i);
    if (match) {
      const trains = parseInt(match[1]);
      const buses = parseInt(match[2]);
      const parts: string[] = [];
      if (trains > 0) parts.push(`${trains} train${trains !== 1 ? 's' : ''}`);
      if (buses > 0) parts.push(`${buses} bus${buses !== 1 ? 'ses' : ''}`);
      return `Direct ${fromName} → ${toName}: ${parts.length ? parts.join(', ') : 'no services found'}`;
    }
  }
  // Post-scrape: "Scraped leg X → Y: N trains, M buses"
  if (r.includes('leg') && (r.includes('train') || r.includes('bus'))) {
    const legMatch = raw.match(/leg\s+(.+?)\s*[→\-]\s*(.+?):\s*(.*)/i);
    const countMatch = raw.match(/(\d+)\s+trains?,\s*(\d+)\s+buses?/i);
    const trains = countMatch ? parseInt(countMatch[1]) : 0;
    const buses = countMatch && countMatch[2] ? parseInt(countMatch[2]) : 0;
    const parts: string[] = [];
    if (trains > 0) parts.push(`${trains} train${trains !== 1 ? 's' : ''}`);
    if (buses > 0) parts.push(`${buses} bus${buses !== 1 ? 'ses' : ''}`);
    if (legMatch) {
      const origin = legMatch[1].trim();
      const dest = legMatch[2].trim();
      return `${origin} → ${dest}: ${parts.length ? parts.join(', ') : 'no options'}`;
    }
    return `Route segment: ${parts.join(', ') || 'checking…'}`;
  }
  if (r.includes('ranking') || r.includes('scoring')) {
    return 'Ranking all combinations by duration, price and reliability…';
  }
  if (r.includes('search complete')) {
    const directMatch = raw.match(/direct:(\d+)/);
    const stitchedMatch = raw.match(/stitched:(\d+)/);
    const direct = directMatch ? parseInt(directMatch[1]) : 0;
    const stitched = stitchedMatch ? parseInt(stitchedMatch[1]) : 0;
    const total = direct + stitched;
    return `Done — found ${total} journey${total !== 1 ? 's' : ''} (${stitched} stitched, ${direct} direct)`;
  }
  if (r.includes('error')) {
    return 'Encountered an edge case, continuing…';
  }
  return raw;
}

function ThinkingLoader({ logs, fromName, toName }: {
  logs: string[];
  fromName: string;
  toName: string;
}) {
  // `displayed` is what's actually shown — messages drip in one-by-one
  const [displayed, setDisplayed] = React.useState<string[]>([]);
  const queueRef = React.useRef<string[]>([]);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const lastLogCountRef = React.useRef(0);

  const [elapsed, setElapsed] = React.useState(0);

  const stats = React.useMemo(() => {
    let hubs = 0;
    let routes = 0;

    displayed.forEach(line => {
      const hubMatch = line.match(/Found (\d+) connection hub/i);
      if (hubMatch) hubs = parseInt(hubMatch[1], 10);

      const trainMatch = line.match(/(\d+)\s+train/i);
      const busMatch = line.match(/(\d+)\s+bus/i);
      if (trainMatch) routes += parseInt(trainMatch[1], 10);
      if (busMatch) routes += parseInt(busMatch[1], 10);
    });

    return { hubs, routes };
  }, [displayed]);

  // Stable drip function stored in a ref so closures never go stale
  const dripRef = React.useRef<() => void>();
  dripRef.current = () => {
    if (queueRef.current.length === 0) {
      timerRef.current = null;
      return;
    }
    const next = queueRef.current.shift()!;
    setDisplayed(prev => [...prev, next]);
    timerRef.current = setTimeout(() => dripRef.current?.(), 500);
  };

  // When new raw logs arrive, translate and enqueue
  React.useEffect(() => {
    const newLogs = logs.slice(lastLogCountRef.current);
    lastLogCountRef.current = logs.length;
    newLogs.forEach(raw => queueRef.current.push(translateLog(raw, fromName, toName)));
    // Kick off drip if not already running
    if (!timerRef.current && queueRef.current.length > 0) {
      dripRef.current?.();
    }
  }, [logs]);

  // Cleanup
  React.useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Scroll to bottom whenever a new line is revealed
  React.useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [displayed]);

  const isDone = displayed.some(l => l.toLowerCase().startsWith('done'));

  React.useEffect(() => {
    if (isDone) return;
    const timer = setInterval(() => setElapsed(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [isDone]);

  const getIconForLine = (line: string) => {
    const l = line.toLowerCase();
    if (l.includes('interchange hubs')) return <Share2 className="w-5 h-5" />;
    if (l.includes('found')) return <MapPin className="w-5 h-5" />;
    if (l.includes('fetching') || l.includes('transport options')) return <Radio className="w-5 h-5" />;
    if (l.includes('checking direct') || l.includes('route')) return <Search className="w-5 h-5" />;
    if (l.includes('train')) return <Train className="w-5 h-5" />;
    if (l.includes('bus') || l.includes('checking')) return <Bus className="w-5 h-5" />;
    return <Search className="w-5 h-5" />;
  };

  return (
    <div className="flex-1 relative flex flex-col items-center justify-center pt-24 pb-12 w-full mt-10">

      {/* Left side image with blurred edges */}
      <div className="hidden lg:block absolute -left-16 xl:-left-10 top-1/2 -translate-y-1/2 w-[260px] opacity-90 pointer-events-none">
        <img
          src="/loading_left.png"
          alt="Loading illustration"
          className="w-full h-auto object-contain"
          style={{
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 45%, transparent 75%)',
            maskImage: 'radial-gradient(ellipse at center, black 45%, transparent 75%)'
          }}
        />
      </div>

      {/* Right side stats panel */}
      <div className="hidden lg:flex absolute -right-16 xl:-right-10 top-[55%] -translate-y-1/2 w-[240px] bg-white rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex-col gap-6 z-20">
        <h3 className="text-[15px] text-gray-700">Search overview</h3>

        <div className="flex flex-col gap-5">
          {/* Hubs */}
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#f4faf6] flex items-center justify-center shrink-0">
              <Share2 className="w-[18px] h-[18px] text-[#006039]" />
            </div>
            <div className="flex flex-col">
              <span className="text-[16px] text-[#006039] leading-tight">{stats.hubs}</span>
              <span className="text-[13px] text-gray-500 leading-tight mt-0.5">Hubs identified</span>
            </div>
          </div>

          {/* Routes */}
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#f4faf6] flex items-center justify-center shrink-0">
              <Bus className="w-[18px] h-[18px] text-[#006039]" />
            </div>
            <div className="flex flex-col">
              <span className="text-[16px] text-[#006039] leading-tight">
                {stats.routes > 0 ? stats.routes.toLocaleString() : '0'}
              </span>
              <span className="text-[13px] text-gray-500 leading-tight mt-0.5">Routes scanning</span>
            </div>
          </div>

          {/* Data sources */}
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#f4faf6] flex items-center justify-center shrink-0">
              <Database className="w-[18px] h-[18px] text-[#006039]" />
            </div>
            <div className="flex flex-col">
              <span className="text-[16px] text-[#006039] leading-tight">12+</span>
              <span className="text-[13px] text-gray-500 leading-tight mt-0.5">Data sources</span>
            </div>
          </div>

          {/* Elapsed */}
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#f4faf6] flex items-center justify-center shrink-0">
              <Clock className="w-[18px] h-[18px] text-[#006039]" />
            </div>
            <div className="flex flex-col">
              <span className="text-[16px] text-[#006039] leading-tight">
                {`00:${String(elapsed).padStart(2, '0')}`}
              </span>
              <span className="text-[13px] text-gray-500 leading-tight mt-0.5">Elapsed time</span>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-2xl relative z-10">

        {/* Status pill */}
        {isDone && (
          <div className="flex items-center justify-center mb-6">
            <span className="inline-flex items-center gap-2 bg-[#e9f2eb] text-[#006039] text-[13px] font-semibold px-4 py-1.5 rounded-full">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Done
            </span>
          </div>
        )}

        {/* Route + title */}
        <div className="text-center mb-6 flex flex-col items-center">
          <div className="inline-flex items-center justify-center bg-[#006039] px-7 py-2.5 rounded-full shadow-sm mb-3">
            <h2 className="text-[20px] font-normal text-white tracking-tight">
              {fromName} → {toName}
            </h2>
          </div>
          <p className="text-sm text-gray-500">Searching for the best journeys…</p>
        </div>

        {/* Rolling log */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mb-6">
          <div
            ref={containerRef}
            className="px-6 py-6 h-[320px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] log-scroll relative"
          >
            {/* Vertical connector line */}
            <div className="absolute left-[43.5px] top-10 bottom-10 w-[2px] bg-[#e9f2eb] z-0"></div>

            <div className="relative z-10 space-y-4">
              {displayed.length === 0 ? (
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#f4faf6] shadow-[0_0_0_4px_white] flex items-center justify-center text-[#006039] shrink-0 z-10">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                  <span className="text-[13px] text-gray-400 font-medium">Initialising…</span>
                </div>
              ) : (
                displayed.map((line, i) => {
                  const isLatest = i === displayed.length - 1;
                  const isDoneLine = line.toLowerCase().startsWith('done');
                  const isCompleted = !isLatest || isDoneLine;

                  return (
                    <div
                      key={i}
                      className="flex items-center gap-4 animate-[fadeSlideIn_0.35s_ease_forwards]"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#f4faf6] shadow-[0_0_0_4px_white] flex items-center justify-center text-[#006039] shrink-0 z-10">
                        {getIconForLine(line)}
                      </div>

                      <span className={`text-[13px] flex-1 leading-relaxed font-medium ${isDoneLine ? 'text-gray-900 font-semibold' : 'text-gray-800'
                        }`}>
                        {line}
                      </span>

                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        {isCompleted ? (
                          <CheckCircle2 className="w-[18px] h-[18px] text-[#006039]" />
                        ) : (
                          <Loader2 className="w-[18px] h-[18px] text-[#006039] animate-[spin_2s_linear_infinite]" />
                        )}
                        <span className="text-[11px] text-gray-400 font-medium w-8 text-right font-mono">
                          {`00:${String(i + 1).padStart(2, '0')}`}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <span className="inline-flex items-center gap-2 bg-[#e9f2eb] text-[#006039] text-[12px] font-medium px-4 py-2 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            We're checking 1000+ routes to find you the best options
          </span>
        </div>

      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────


export default function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const from = searchParams.get('from') || 'SBC';
  const to = searchParams.get('to') || 'BGM';
  const fromName = searchParams.get('fromName') || from;
  const toName = searchParams.get('toName') || to;
  const date = searchParams.get('date') || '';
  const mode = searchParams.get('mode') || 'stitched';
  const travellers = searchParams.get('travellers') || '1 Adult';

  const [isLoading, setIsLoading] = useState(true);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedVia, setSelectedVia] = useState<string | null>(null);

  useEffect(() => {
    // Generate a stable session ID for this search
    const sessionId = Math.random().toString(36).substring(2, 9);
    setLogs([]);
    setIsLoading(true);
    setError(null);

    // 1. Connect to SSE log stream BEFORE starting the search
    const sse = new EventSource(`http://localhost:3002/api/search/logs/${sessionId}`);
    sse.onmessage = (e) => {
      try {
        const { message } = JSON.parse(e.data);
        if (message) setLogs(prev => [...prev, message]);
      } catch { /* ignore parse errors */ }
    };

    // 2. Fire the search POST only AFTER SSE is confirmed open — no race condition
    const fetchResults = async () => {
      // Wait for SSE connection to open before sending the POST
      await new Promise<void>((resolve) => {
        if (sse.readyState === EventSource.OPEN) {
          resolve();
        } else {
          sse.addEventListener('open', () => resolve(), { once: true });
          // Fallback: if SSE doesn't open in 300ms, proceed anyway
          setTimeout(resolve, 300);
        }
      });

      try {
        const payload = {
          from, to, date, mode,
          maxLegs: mode === 'stitched' ? 3 : 1,
          sessionId,
        };
        const res = await fetch('http://localhost:3002/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          setResults(data.data);
        } else {
          const errMsg = typeof data.error === 'object' ? data.error.message : data.error;
          setError(errMsg || 'Failed to fetch results');
        }
      } catch (err: any) {
        setError(err.message || 'Network error');
      } finally {
        setIsLoading(false);
        sse.close(); // Clean up SSE connection when done
      }
    };

    fetchResults();

    return () => { sse.close(); };
  }, [from, to, date, mode]);

  const directRoutes: Route[] = results?.direct || [];
  const stitchedRoutes: Route[] = results?.stitched || [];

  // Normalize direct routes so they always have a `legs` array
  const normalizedDirect: Route[] = directRoutes.map(r => ({
    ...r,
    legs: r.legs?.length ? r.legs : [r as unknown as Leg],
  }));

  const viaCities = Array.from(
    new Set(
      stitchedRoutes
        .filter((r: any) => r.viaCities && r.viaCities.length > 0)
        .flatMap((r: any) => r.viaCities)
    )
  ) as string[];

  const filteredStitchedRoutes = stitchedRoutes.filter((route: any) => {
    if (!selectedVia) return true;
    if (route.viaCities && route.viaCities.includes(selectedVia)) return true;
    return false;
  });

  const stitchedCount = filteredStitchedRoutes.length;
  const directCount = normalizedDirect.length;
  const totalCount = stitchedRoutes.length + directCount;

  return (
    <div className="flex-1 flex flex-col bg-[#f4f6f5] font-sans">

      {/* ── Header ─────────────────────────────────────────────────── */}
      {!isLoading && (
        <>
          <div
            className="sticky top-0 w-full h-28 -mb-28 pointer-events-none bg-transparent backdrop-blur-sm z-40"
            style={{
              WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
              maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)'
            }}
          />
          <div className="pt-28 px-4 md:px-6 relative z-10">
            <header className="max-w-5xl mx-auto bg-white rounded-2xl border border-gray-200/60 overflow-hidden relative shadow-sm">
              {/* Background image */}
              <div className="absolute top-0 right-0 h-full w-2/3 md:w-1/2 pointer-events-none flex justify-end">
                <img
                  src="/result_page_banner.png"
                  alt=""
                  className="w-full h-full object-cover object-right opacity-80 mix-blend-multiply"
                  style={{
                    WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 30%)',
                    maskImage: 'linear-gradient(to right, transparent 0%, black 30%)'
                  }}
                />
              </div>

              <div className="relative z-10 px-6 py-6 md:py-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-1.5 text-[#006039] hover:text-[#004b2c] transition-colors text-[13px] font-semibold mb-4"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Modify search
                  </button>
                  <h1 className="text-2xl md:text-3xl font-semibold tracking-tight leading-tight text-gray-900">
                    {fromName} <ArrowRight className="inline w-5 h-5 mx-1 text-[#006039]" /> {toName}
                  </h1>
                  <div className="flex items-center gap-5 mt-3 text-[#006039] text-sm font-medium">
                    <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {date}</span>
                    <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> {travellers}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-gray-100 shadow-sm px-4 py-2.5 rounded-full text-[#006039] text-sm font-bold">
                    <Sparkles className="w-4 h-4" />
                    {`${totalCount} journey${totalCount !== 1 ? 's' : ''} found`}
                  </div>
                </div>
              </div>
            </header>
          </div>
        </>
      )}

      {/* ── Content ────────────────────────────────────────────────── */}
      <div className={`mx-auto w-full px-4 md:px-6 flex-1 flex flex-col ${isLoading ? 'max-w-7xl' : 'max-w-5xl py-8'}`}>

        {isLoading ? (
          <>
            <img
              src="/loading_page_top.png"
              alt=""
              className="fixed -top-16 right-0 w-auto h-[300px] object-contain object-right-top z-0 pointer-events-none opacity-90"
              style={{
                WebkitMaskImage: 'radial-gradient(110% 110% at top right, black 80%, transparent 100%)',
                maskImage: 'radial-gradient(110% 110% at top right, black 80%, transparent 100%)'
              }}
            />
            <ThinkingLoader logs={logs} fromName={fromName} toName={toName} />
          </>
        ) : error ? (
          <div className="bg-white rounded-2xl border border-red-200 p-10 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-gray-700 font-semibold">Could not fetch results</p>
            <p className="text-gray-500 text-sm mt-1">{error}</p>
            <button onClick={() => navigate(-1)} className="mt-4 text-[#006039] font-semibold text-sm hover:underline">
              ← Back to search
            </button>
          </div>
        ) : totalCount === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-14 text-center">
            <p className="text-gray-600 font-semibold text-lg">No journeys found</p>
            <p className="text-gray-400 text-sm mt-2">Try a different route or date.</p>
            <button onClick={() => navigate(-1)} className="mt-4 text-[#006039] font-semibold text-sm hover:underline">
              ← Modify search
            </button>
          </div>
        ) : (
          <div className="space-y-8">

            {/* ── Filter by Via City ── */}
            {viaCities.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                <button
                  onClick={() => setSelectedVia(null)}
                  className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${!selectedVia
                    ? 'bg-[#006039] text-white shadow-md'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                >
                  All Routes
                </button>
                {viaCities.map(city => (
                  <button
                    key={city}
                    onClick={() => setSelectedVia(city)}
                    className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${selectedVia === city
                      ? 'bg-[#006039] text-white shadow-md'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                  >
                    Via {city}
                  </button>
                ))}
              </div>
            )}

            {/* ── Stitched Routes ── */}
            {stitchedCount > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[15px] font-bold text-gray-900 uppercase tracking-wider">
                    Stitched Journeys
                    <span className="ml-2 text-[12px] font-normal text-gray-500 normal-case tracking-normal">
                      ({stitchedCount})
                    </span>
                  </h2>
                </div>
                <div className="space-y-4">
                  {filteredStitchedRoutes.map((route, idx) => (
                    <StitchedCard
                      key={idx}
                      route={route}
                      fromName={fromName}
                      toName={toName}
                      isFirst={idx === 0}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ── Direct Routes ── */}
            {directCount > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[15px] font-bold text-gray-900 uppercase tracking-wider">
                    Direct Routes
                    <span className="ml-2 text-[12px] font-normal text-gray-500 normal-case tracking-normal">
                      ({directCount})
                    </span>
                  </h2>
                </div>
                <div className="space-y-3">
                  {normalizedDirect.map((route, idx) => {
                    const isTrain = route.mode === 'train' || route.legs?.[0]?.mode === 'train';
                    if (isTrain) {
                      return <DirectTrainCard key={idx} route={route} />;
                    }
                    return (
                      <DirectCard
                        key={idx}
                        route={route}
                        fromName={fromName}
                        toName={toName}
                        isFirst={idx === 0}
                      />
                    );
                  })}
                </div>
              </section>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
