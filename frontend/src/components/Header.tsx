import { Globe, User } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Header() {
  return (
    <header className="absolute top-0 w-full z-50 px-8 py-6 flex items-center justify-between">
      <div className="flex items-center space-x-12">
        <Link to="/stitched" className="flex items-center space-x-2 text-[#006039]">
          {/* Logo icon representation */}
          <div className="w-8 h-8 relative flex items-center justify-center">
            <div className="absolute inset-0 bg-[#006039] rounded-sm transform rotate-45"></div>
            <div className="absolute inset-0 border-2 border-white rounded-sm transform -rotate-45 scale-75"></div>
            <div className="absolute inset-1 bg-white rounded-sm"></div>
            <div className="absolute w-2 h-2 bg-[#006039] rounded-full"></div>
          </div>
          <span className="text-xl font-bold tracking-tight">TripWeaver</span>
        </Link>
        <nav className="hidden md:flex items-center space-x-8">
          <a href="#" className="text-gray-800 hover:text-black font-medium text-sm">Explore</a>
          <a href="#" className="text-gray-800 hover:text-black font-medium text-sm">Trips</a>
          <a href="#" className="text-gray-800 hover:text-black font-medium text-sm">Offers</a>
          <a href="#" className="text-gray-800 hover:text-black font-medium text-sm">Help</a>
        </nav>
      </div>
      
      <div className="flex items-center space-x-6">
        <button className="flex items-center space-x-1 text-gray-800 hover:text-black text-sm font-medium">
          <Globe className="w-4 h-4" />
          <span>EN</span>
          <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </button>
        <button className="flex items-center space-x-2 text-gray-800 hover:text-black text-sm font-medium">
          <div className="w-8 h-8 bg-gray-200 rounded-full overflow-hidden border border-gray-300">
             <div className="w-full h-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
               S
             </div>
          </div>
          <span>Shashank</span>
          <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </button>
      </div>
    </header>
  );
}
