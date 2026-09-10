import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, Apple } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Temporary redirect to stitched homepage on successful login
    navigate('/stitched');
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Side: Visual/Branding */}
      <div className="hidden lg:flex w-1/2 relative flex-col justify-between overflow-hidden bg-[#001a0f]">
        <div className="absolute inset-0">
          <img 
            src="/login_bg.png" 
            alt="Scenic journey"
            className="w-full h-full object-cover opacity-70"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#000a06] via-transparent to-black/30 pointer-events-none" />
        
        <div className="relative z-10 p-12 lg:p-16">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={() => navigate('/stitched')}>
            <img src="/favicon.png" alt="MilChalo Logo" className="h-12 object-contain" />
            <span className="text-2xl font-medium tracking-tight text-white drop-shadow-md">MilChalo</span>
          </div>
        </div>

        <div className="relative z-10 p-12 lg:p-16 mb-12">
          <h1 className="text-4xl lg:text-5xl font-light text-white leading-tight mb-4 tracking-tight">
            Seamless journeys.<br/>One platform.
          </h1>
          <p className="text-white/80 text-lg max-w-md">
            Discover the most efficient ways to travel across India by combining flights, trains, and buses automatically.
          </p>
        </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-[440px]">
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-light text-gray-900 mb-2 tracking-tight">Welcome back</h2>
            <p className="text-gray-500">Please enter your details to sign in.</p>
          </div>

          {/* Social Logins */}
          <div className="flex gap-4 mb-8">
            <button className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold px-4 py-3 rounded-xl transition-colors shadow-sm">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 bg-black border border-black hover:bg-gray-900 text-white font-semibold px-4 py-3 rounded-xl transition-colors shadow-sm">
              <Apple className="w-5 h-5" />
              Apple
            </button>
          </div>

          <div className="relative mb-8 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative inline-block bg-white px-4">
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">or sign in with email</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="email">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-11 pr-3 py-3 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#006039]/20 focus:border-[#006039] transition-colors sm:text-sm"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-700" htmlFor="password">
                  Password
                </label>
                <button 
                  type="button" 
                  onClick={() => navigate('/stitched')}
                  className="text-sm font-semibold text-[#006039] hover:text-[#004b2c] cursor-pointer bg-transparent border-none p-0"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-11 pr-3 py-3 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#006039]/20 focus:border-[#006039] transition-colors sm:text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-[#006039] hover:bg-[#004b2c] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#006039] transition-colors"
              >
                Sign in
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          <p className="mt-8 text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <a href="#" className="font-semibold text-[#006039] hover:text-[#004b2c]">
              Sign up for free
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
