import { Globe, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export default function Header() {
  const location = useLocation();
  const isHomePage = ['/', '/stitched', '/train', '/bus', '/flight', '/cab'].includes(location.pathname);

  const headerClass = "absolute top-0 w-full z-50 pr-8 pl-0 py-6 flex items-center justify-between pointer-events-none";

  return (
    <header className={headerClass}>
      <div className="relative z-10 flex items-center bg-white rounded-r-full shadow-md overflow-hidden h-[3.5rem] pointer-events-auto">
        <Link to="/stitched" className="flex items-center space-x-2 pl-6 pr-8 h-full">
          <img src="/favicon.png" alt="MilChalo Logo" className="h-10 object-contain" />
          <span className="text-2xl font-medium tracking-tight text-[#006039]">milChalo</span>
        </Link>
        <nav className="hidden md:flex items-center space-x-8 bg-[#006039] rounded-l-[3rem] px-10 h-full">
          <a href="#" className="text-white hover:text-green-100 font-light text-[15px] transition-colors">Explore</a>
          <a href="#" className="text-white hover:text-green-100 font-light text-[15px] transition-colors">Trips</a>
          <a href="#" className="text-white hover:text-green-100 font-light text-[15px] transition-colors">Offers</a>
          <a href="#" className="text-white hover:text-green-100 font-light text-[15px] transition-colors">Help</a>
        </nav>
      </div>

      <div className="relative z-10 flex items-center space-x-6 pointer-events-auto">
        <button className="flex items-center space-x-1 text-gray-800 hover:text-black text-sm font-medium">
          <Globe className="w-4 h-4" />
          <span>EN</span>
          <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </button>
        <Link to="/login" className="flex items-center space-x-2 text-gray-800 hover:text-black text-sm font-medium">
          <div className="w-8 h-8 bg-gray-200 rounded-full overflow-hidden border border-gray-300">
            <div className="w-full h-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
              S
            </div>
          </div>
          <span>Shashank</span>
          <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </Link>
      </div>
    </header>
  );
}
