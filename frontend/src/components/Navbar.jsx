import React from 'react';
import { LayoutDashboard, Crosshair, GraduationCap, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, backendStatus }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'detect', label: 'Detection View', icon: Crosshair },
    { id: 'teach', label: 'Teach AI View', icon: GraduationCap },
  ];

  return (
    <header className="sticky top-0 z-50 bg-forest-900 border-b border-forest-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-forest-600 flex items-center justify-center shadow-inner">
              <Sparkles className="w-5 h-5 text-forest-100" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">WildVision</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-forest-700 text-forest-200 uppercase tracking-wider">
                  YOLOv8
                </span>
              </div>
              <p className="text-xs text-forest-200/70 hidden sm:block">Wildlife Intelligence & Active Learning</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex space-x-1 sm:space-x-2 bg-forest-950/60 p-1.5 rounded-xl border border-forest-800">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-forest-600 text-white shadow-sm'
                      : 'text-forest-200/80 hover:text-white hover:bg-forest-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Backend Health Badge */}
          <div className="flex items-center space-x-2 text-xs">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium border ${
                backendStatus === 'online'
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                  : backendStatus === 'checking'
                  ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                  : 'bg-rose-950/80 text-rose-300 border-rose-800'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  backendStatus === 'online'
                    ? 'bg-emerald-400 animate-pulse'
                    : backendStatus === 'checking'
                    ? 'bg-amber-400'
                    : 'bg-rose-400'
                }`}
              />
              <span className="hidden sm:inline">Flask API:</span>
              <span className="capitalize">{backendStatus}</span>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
