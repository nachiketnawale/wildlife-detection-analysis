import React, { useEffect, useState } from 'react';
import {
  Database,
  Layers,
  Image as ImageIcon,
  Tag,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  FolderTree,
  Crosshair,
  GraduationCap
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
    <div className="space-y-8 animate-fadeIn">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-forest-900 tracking-tight">
            Wildlife Intelligence Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitoring YOLOv8 dataset splits, target species categories, and active annotations.
          </p>
        </div>
        <button
          onClick={fetchDataset}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-forest-600 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Error notification */}
      {error && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Dataset Status Warning</p>
            <p className="text-amber-800 mt-0.5">{error}</p>
            <p className="text-xs text-amber-700 mt-2">
              Ensure Flask is running on <code className="bg-amber-100 px-1 py-0.5 rounded">http://127.0.0.1:5000</code>.
            </p>
          </div>
        </div>
      )}

      {/* Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Images */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Images</span>
            <div className="w-10 h-10 rounded-xl bg-forest-50 text-forest-600 flex items-center justify-center">
              <ImageIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-900">
              {loading ? '...' : (data?.total_images ?? 0).toLocaleString()}
            </span>
            <p className="text-xs text-slate-500 mt-1">Across train, val & test partitions</p>
          </div>
        </div>

        {/* Total Boxes */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bounding Boxes</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-900">
              {loading ? '...' : (data?.total_boxes ?? 0).toLocaleString()}
            </span>
            <p className="text-xs text-slate-500 mt-1">Annotated bounding instances</p>
          </div>
        </div>

        {/* Registered Species */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Target Species</span>
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Tag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-900">
              {loading ? '...' : (data?.species?.length ?? 0)}
            </span>
            <p className="text-xs text-slate-500 mt-1">Configured model categories</p>
          </div>
        </div>

        {/* Readiness Status */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dataset Health</span>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              data?.dataset_ready ? 'bg-forest-100 text-forest-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {data?.dataset_ready ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
          </div>
          <div className="mt-4">
            <span className="text-xl font-bold text-slate-900 flex items-center gap-2">
              {loading ? 'Checking...' : data?.dataset_ready ? 'Dataset Ready' : 'Pending Verification'}
            </span>
            <p className="text-xs text-slate-500 mt-1">
              {data?.error ? data.error : 'data.yaml structure valid'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Splits & Species Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Split Distribution */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderTree className="w-5 h-5 text-forest-600" />
              <h2 className="text-lg font-bold text-slate-900">Dataset Splits Distribution</h2>
            </div>
            <span className="text-xs text-slate-500 font-medium">YOLO Format</span>
          </div>

          <div className="space-y-4">
            {['train', 'val', 'test'].map((split) => {
              const splitData = data?.splits?.[split] || { images: 0, boxes: 0 };
              const totalImgs = data?.total_images || 1;
              const imgPercent = Math.round((splitData.images / totalImgs) * 100) || 0;

              return (
                <div key={split} className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-forest-900 uppercase tracking-wide">
                      {split} partition
                    </span>
                    <span className="text-xs font-semibold text-slate-600">
                      {imgPercent}% of total images
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
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
              className="flex items-center justify-between p-4 rounded-xl bg-forest-900 text-white hover:bg-forest-800 transition shadow-sm group"
            >
              <div className="flex items-center gap-3">
                <Crosshair className="w-5 h-5 text-forest-300" />
                <div className="text-left">
                  <p className="text-sm font-semibold">Test Detector</p>
                  <p className="text-xs text-forest-200/70">Inference on test images</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-forest-300 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => onNavigate('teach')}
              className="flex items-center justify-between p-4 rounded-xl bg-forest-50 border border-forest-200 text-forest-900 hover:bg-forest-100 transition shadow-sm group"
            >
              <div className="flex items-center gap-3">
                <GraduationCap className="w-5 h-5 text-forest-700" />
                <div className="text-left">
                  <p className="text-sm font-semibold">Teach AI Annotator</p>
                  <p className="text-xs text-forest-600">Interactive Canvas labeling</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-forest-700 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Species Roster */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-forest-600" />
              <h2 className="text-lg font-bold text-slate-900">Target Species</h2>
            </div>
            <span className="text-xs bg-forest-100 text-forest-800 font-semibold px-2 py-0.5 rounded-full">
              {data?.species?.length || 0} classes
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Current taxonomic categories classified by the trained YOLO checkpoint:
          </p>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {data?.species && data.species.length > 0 ? (
              data.species.map((sp, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-forest-50/50 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-forest-600/10 text-forest-700 font-mono text-xs flex items-center justify-center font-bold">
                      {idx}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-800 capitalize">
                        {sp.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-slate-400 italic">Class #{idx}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/60">
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
