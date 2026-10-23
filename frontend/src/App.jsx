import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import DashboardView from './components/DashboardView';
import DetectionView from './components/DetectionView';
import TeachView from './components/TeachView';
import TimeInsights from './components/TimeInsights';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [backendStatus, setBackendStatus] = useState('checking');

  const checkBackendHealth = async () => {
    try {
      const res = await fetch('/health');
      if (res.ok) {
        setBackendStatus('online');
      } else {
        setBackendStatus('offline');
      }
    } catch {
      setBackendStatus('offline');
    }
  };

  useEffect(() => {
    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        backendStatus={backendStatus}
      />

      {/* Main App Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && <DashboardView onNavigate={setActiveTab} />}
        {activeTab === 'time' && <TimeInsights />}
        {activeTab === 'detect' && <DetectionView />}
        {activeTab === 'teach' && <TeachView />}
      </main>

      {/* Friendly, realistic footer */}
      <footer className="bg-white border-t border-slate-200/80 py-5 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <p className="font-medium text-slate-600">
            WildVision • Camera Trap Wildlife Tracking & Active Learning (Idea Lab Project)
          </p>
          <p className="text-slate-400">
            Built with React, Tailwind & Ultralytics YOLO
          </p>
        </div>
      </footer>
    </div>
  );
}
