import React, { useEffect, useState } from 'react';
import {
  Layers,
  Image as ImageIcon,
  Tag,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  FolderTree,
  Crosshair,
  GraduationCap,
  Sparkles
} from 'lucide-react';

export default function DashboardView({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDataset = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dataset');
      if (!res.ok) {
        throw new Error(`Failed to load dataset stats (Status: ${res.status})`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message || 'Unable to connect to dataset API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDataset();
  }, []);

  return (
    <div className="space-y-7 animate-fadeIn">
      {/* Friendly Welcoming Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Wildlife Activity Dashboard
            </h1>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-forest-50 text-forest-700 border border-forest-200/70">
              <Sparkles className="w-3 h-3 text-forest-600" />
              Idea Lab
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Welcome to WildVision! Track your camera-trap photo dataset, check detected species, and manage model labels.
          </p>
        </div>

        <button
          onClick={fetchDataset}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-xs disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-forest-600 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Graceful notification banner if API warning */}
      {error && (
        <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-amber-900">Dataset Sync Notice</p>
            <p className="text-amber-800 mt-0.5">{error}</p>
            <p className="text-amber-700 mt-1">
              Backend server expected on <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">http://127.0.0.1:5000</code>.
            </p>
          </div>
        </div>
      )}

      {/* High-Level Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Images */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Captured Photos</span>
            <div className="w-9 h-9 rounded-xl bg-forest-50 text-forest-600 flex items-center justify-center">
              <ImageIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {loading ? '...' : (data?.total_images ?? 0).toLocaleString()}
            </span>
            <p className="text-xs text-slate-500 mt-0.5">Images across all splits</p>
          </div>
        </div>

        {/* Total Boxes */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Animal Instances</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {loading ? '...' : (data?.total_boxes ?? 0).toLocaleString()}
            </span>
            <p className="text-xs text-slate-500 mt-0.5">Identified wildlife boxes</p>
          </div>
        </div>

        {/* Target Species */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Species Monitored</span>
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {loading ? '...' : (data?.species?.length ?? 5)}
            </span>
            <p className="text-xs text-slate-500 mt-0.5">Recognized animal classes</p>
          </div>
        </div>

        {/* System Readiness */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">System Status</span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              data?.dataset_ready ? 'bg-forest-100 text-forest-700' : 'bg-emerald-50 text-emerald-600'
            }`}>
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-lg font-bold text-slate-900 flex items-center gap-1.5">
              {loading ? 'Checking...' : data?.dataset_ready ? 'Dataset Active' : 'Ready for Analysis'}
            </span>
            <p className="text-xs text-slate-500 mt-0.5">
              YOLO model & dataset operational
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Splits & Species Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Split Distribution */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Dataset Splits Distribution</h2>
              <p className="text-xs text-slate-500">Breakdown of training, validation, and test subsets</p>
            </div>
            <span className="text-xs text-forest-700 bg-forest-50 border border-forest-200 px-2.5 py-1 rounded-lg font-medium self-start sm:self-auto">
              YOLO Dataset Standard
            </span>
          </div>

          <div className="space-y-4">
            {['train', 'val', 'test'].map((split) => {
              const splitData = data?.splits?.[split] || { images: 0, boxes: 0 };
              const totalImgs = data?.total_images || 1;
              const imgPercent = Math.round((splitData.images / totalImgs) * 100) || 0;

              return (
                <div key={split} className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-forest-900 uppercase tracking-wide">
                      {split} split
                    </span>
                    <span className="text-xs font-semibold text-slate-600">
                      {imgPercent}% of total images
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-forest-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${imgPercent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                    <span><strong>{splitData.images.toLocaleString()}</strong> images</span>
                    <span><strong>{splitData.boxes.toLocaleString()}</strong> bounding boxes</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Action CTAs */}
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => onNavigate('detect')}
              className="flex items-center justify-between p-4 rounded-xl bg-forest-900 text-white hover:bg-forest-800 transition shadow-xs group"
            >
              <div className="flex items-center gap-3">
                <Crosshair className="w-5 h-5 text-forest-300" />
                <div className="text-left">
                  <p className="text-sm font-semibold">Test Detector</p>
                  <p className="text-xs text-forest-200/70">Run YOLO inference on camera images</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-forest-300 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => onNavigate('teach')}
              className="flex items-center justify-between p-4 rounded-xl bg-forest-50 border border-forest-200 text-forest-900 hover:bg-forest-100 transition shadow-xs group"
            >
              <div className="flex items-center gap-3">
                <GraduationCap className="w-5 h-5 text-forest-700" />
                <div className="text-left">
                  <p className="text-sm font-semibold">Teach AI Annotator</p>
                  <p className="text-xs text-forest-600">Interactive Canvas bounding-box tool</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-forest-700 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Species Roster */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Target Wildlife Species</h2>
              <p className="text-xs text-slate-500">Taxonomic categories configured for object recognition</p>
            </div>
            <span className="text-xs bg-forest-50 text-forest-700 border border-forest-200 font-semibold px-2.5 py-1 rounded-lg self-start sm:self-auto">
              {data?.species?.length || 5} active classes
            </span>
          </div>

          <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
            {data?.species && data.species.length > 0 ? (
              data.species.map((sp, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 hover:bg-forest-50/40 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-forest-600/10 text-forest-700 font-mono text-xs flex items-center justify-center font-bold">
                      {idx}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 capitalize">
                        {sp.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-slate-400">YOLO Class #{idx}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    Active
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center">No species data loaded.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
