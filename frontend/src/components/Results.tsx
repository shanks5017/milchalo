import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import { CustomTrain as Train, CustomBus as Bus } from './CustomIcons';

export default function Results({ isLoading, data }: { isLoading: boolean, data: any }) {
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-8">
         <div className="animate-pulse space-y-6">
           {[1,2,3].map(i => (
             <div key={i} className="bg-gray-100 h-40 rounded-3xl w-full border border-gray-200"></div>
           ))}
         </div>
      </div>
    );
  }

  if (!data) return null;

  const directRoutes = data.data?.direct || [];
  const stitchedRoutes = data.data?.stitched || [];
  const allRoutes = [...stitchedRoutes, ...directRoutes];
  
  const [selectedVia, setSelectedVia] = useState<string | null>(null);

  const viaCities = Array.from(
    new Set(
      stitchedRoutes
        .filter((r: any) => r.viaCities && r.viaCities.length > 0)
        .flatMap((r: any) => r.viaCities)
    )
  ) as string[];

  const filteredRoutes = allRoutes.filter((route: any) => {
    if (!selectedVia) return true;
    if (route.viaCities && route.viaCities.includes(selectedVia)) return true;
    return false;
  });

  if (allRoutes.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-8 text-center text-gray-500 font-medium text-lg">
         No optimal routes found for this journey. Try adjusting the dates or transit hubs.
      </div>
    );
  }

  const formatDuration = (mins?: number) => {
    if (!mins) return 'N/A';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-8 relative z-20 bg-white">
      <div className="flex flex-col mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">{filteredRoutes.length} Optimal Routes Found</h2>
        
        {viaCities.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <button 
              onClick={() => setSelectedVia(null)}
              className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                !selectedVia 
                  ? 'bg-[#006039] text-white shadow-md' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Routes
            </button>
            {viaCities.map(city => (
              <button 
                key={city}
                onClick={() => setSelectedVia(city)}
                className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  selectedVia === city 
                    ? 'bg-[#006039] text-white shadow-md' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Via {city}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-6">
        {filteredRoutes.map((route, idx) => {
          const isDirect = route.legs ? route.legs.length === 1 : true;
          const price = route.totalCostMin || route.lowestFare || 0;
          const legs = route.legs || [route];
          
          return (
            <div key={idx} className="bg-white border border-gray-100 p-6 rounded-3xl shadow-sm hover:shadow-lg transition-all">
               <div className="flex justify-between items-center mb-6">
                 <div className="flex items-center gap-3">
                   <span className={`px-4 py-1 text-xs font-bold uppercase tracking-wider rounded-full ${isDirect ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                     {isDirect ? 'Direct' : 'Stitched'}
                   </span>
                 </div>
                 <div className="text-right">
                   <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Total Fare</p>
                   <p className="text-3xl font-extrabold text-[#006039]">₹{price}</p>
                 </div>
               </div>
               
               <div className="flex justify-between items-center border-t border-gray-50 pt-6">
                 <div className="text-center w-1/4">
                   <p className="text-3xl font-bold text-gray-900">{legs[0].departure || 'N/A'}</p>
                   <p className="text-sm text-gray-500 font-medium mt-1">{legs[0].from}</p>
                 </div>
                 
                 <div className="flex-1 flex flex-col items-center px-4">
                   <p className="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-1">
                     <Clock className="w-4 h-4"/> 
                     {route.totalDurationMins ? formatDuration(route.totalDurationMins) : (legs[0].travelTime || 'N/A')}
                   </p>
                   <div className="w-full relative flex items-center justify-center">
                     <div className="absolute w-full h-0.5 bg-gray-200"></div>
                     <div className="flex items-center justify-between w-full z-10 px-4">
                       <div className="w-3 h-3 rounded-full bg-gray-300 border-2 border-white"></div>
                       {legs.map((leg: any, i: number) => (
                         <div key={i} className="flex gap-2 bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100">
                           {leg.mode === 'train' ? <Train className="w-4 h-4 text-[#006039]" /> : <Bus className="w-4 h-4 text-[#006039]"/>}
                         </div>
                       ))}
                       <div className="w-3 h-3 rounded-full bg-gray-300 border-2 border-white"></div>
                     </div>
                   </div>
                   <p className="text-xs text-gray-400 mt-4 font-semibold uppercase tracking-wider">
                     {isDirect ? '0 Connections' : `${legs.length - 1} Connection(s)`}
                   </p>
                 </div>

                 <div className="text-center w-1/4">
                   <p className="text-3xl font-bold text-gray-900">{legs[legs.length - 1].arrivalTime || 'N/A'}</p>
                   <p className="text-sm text-gray-500 font-medium mt-1">{legs[legs.length - 1].to}</p>
                 </div>
               </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
