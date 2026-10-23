import React, { useState, useEffect } from 'react';
import {
  Sun,
  Sunset,
  Moon,
  Search,
  Award,
  Clock,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

export default function TimeInsights() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAnimal, setSelectedAnimal] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const loadFrequencyData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/animal_frequency_data.json');
      if (!res.ok) {
        throw new Error(`Data file status: ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError('animal_frequency_data.json is still generating or not found yet.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFrequencyData();
  }, []);

  // Compute Top Insights
  const insights = (() => {
    if (!data) return null;

    let maxMorning = { animal: 'None', count: -1 };
    let maxEvening = { animal: 'None', count: -1 };
    let maxNight = { animal: 'None', count: -1 };
    let maxOverall = { animal: 'None', count: -1 };

    Object.entries(data).forEach(([animal, buckets]) => {
      const m = buckets.Morning || 0;
      const e = buckets.Evening || 0;
      const n = buckets.Night || 0;
      const total = m + e + n;

      if (m > maxMorning.count) maxMorning = { animal, count: m };
      if (e > maxEvening.count) maxEvening = { animal, count: e };
      if (n > maxNight.count) maxNight = { animal, count: n };
      if (total > maxOverall.count) maxOverall = { animal, count: total };
    });

    return { maxMorning, maxEvening, maxNight, maxOverall };
  })();

  // Filtered animals list for search and table
  const animalsList = data ? Object.keys(data).sort() : [];
  const filteredAnimals = animalsList.filter((a) =>
    a.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Active counts for selected species (or combined)
  const currentCounts = (() => {
    if (!data) return { morning: 0, evening: 0, night: 0, total: 0 };

    if (selectedAnimal === 'ALL') {
      let morning = 0,
        evening = 0,
        night = 0;
      Object.values(data).forEach((b) => {
        morning += b.Morning || 0;
        evening += b.Evening || 0;
        night += b.Night || 0;
      });
      return { morning, evening, night, total: morning + evening + night };
    }

    const b = data[selectedAnimal] || { Morning: 0, Evening: 0, Night: 0 };
    const morning = b.Morning || 0;
    const evening = b.Evening || 0;
    const night = b.Night || 0;
    return { morning, evening, night, total: morning + evening + night };
  })();

  const mPct = currentCounts.total > 0 ? Math.round((currentCounts.morning / currentCounts.total) * 100) : 0;
  const ePct = currentCounts.total > 0 ? Math.round((currentCounts.evening / currentCounts.total) * 100) : 0;
  const nPct = currentCounts.total > 0 ? Math.round((currentCounts.night / currentCounts.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-slate-100 text-slate-700">
              <Clock className="w-4 h-4" />
            </span>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Wildlife Activity by Time of Day
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Sightings grouped into Morning (06:00–11:59), Evening (12:00–17:59), and Night (18:00–05:59).
          </p>
        </div>

        <button
          onClick={loadFrequencyData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-xs disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Insights</span>
        </button>
      </div>

      {/* Graceful Warning banner if file is still generating */}
      {error && (
        <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-amber-900">Frequency Data Notice</p>
            <p className="text-amber-800 mt-0.5">
              <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900">animal_frequency_data.json</code> is still generating.
            </p>
            <p className="text-slate-600 mt-1">
              Run <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono">python merge_stats.py</code> in the terminal to generate the data, then click Refresh.
            </p>
          </div>
        </div>
      )}

      {/* Top Insights Section - Clean, Neutral Professional Styling */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Highest Night Activity */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Highest Night Activity</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <Moon className="w-4 h-4 text-slate-600" />
            </div>
          </div>
          <div className="text-lg font-bold text-slate-900 truncate">
            {insights?.maxNight.count > 0 ? insights.maxNight.animal : 'None recorded'}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {insights?.maxNight.count > 0 ? `${insights.maxNight.count} sightings (18:00 - 05:59)` : 'No night sightings'}
          </p>
        </div>

        {/* Highest Morning Activity */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Highest Morning Activity</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <Sun className="w-4 h-4 text-slate-600" />
            </div>
          </div>
          <div className="text-lg font-bold text-slate-900 truncate">
            {insights?.maxMorning.count > 0 ? insights.maxMorning.animal : 'None recorded'}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {insights?.maxMorning.count > 0 ? `${insights.maxMorning.count} sightings (06:00 - 11:59)` : 'No morning sightings'}
          </p>
        </div>

        {/* Highest Evening Activity */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Highest Evening Activity</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <Sunset className="w-4 h-4 text-slate-600" />
            </div>
          </div>
          <div className="text-lg font-bold text-slate-900 truncate">
            {insights?.maxEvening.count > 0 ? insights.maxEvening.animal : 'None recorded'}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {insights?.maxEvening.count > 0 ? `${insights.maxEvening.count} sightings (12:00 - 17:59)` : 'No evening sightings'}
          </p>
        </div>

        {/* Most Seen Overall */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Most Seen Overall</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <Award className="w-4 h-4 text-slate-600" />
            </div>
          </div>
          <div className="text-lg font-bold text-slate-900 truncate">
            {insights?.maxOverall.count > 0 ? insights.maxOverall.animal : 'None recorded'}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {insights?.maxOverall.count > 0 ? `${insights.maxOverall.count} total sightings` : 'No sightings recorded'}
          </p>
        </div>
      </div>

      {/* Interactive Search & Filter Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Species Activity Filter</h3>
            <p className="text-xs text-slate-500">Select an animal or search by name to view its time distribution</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search animal..."
                className="w-full sm:w-48 pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400 text-slate-800 transition"
              />
            </div>

            {/* Dropdown Select */}
            <select
              value={selectedAnimal}
              onChange={(e) => setSelectedAnimal(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
            >
              <option value="ALL">All Species (Combined)</option>
              {animalsList.map((animal) => (
                <option key={animal} value={animal}>
                  {animal}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Animal Counts */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">
              Active Selection: <span className="font-bold text-slate-900">{selectedAnimal === 'ALL' ? 'All Species Combined' : selectedAnimal}</span>
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200/60">
              Total Sightings: {currentCounts.total}
            </span>
          </div>

          {/* Three Main Summary Cards: Neutral Text, Preserved Sun/Sunset/Moon Icons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Morning Card */}
            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80">
              <div className="flex items-center justify-between text-slate-700">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Morning (06:00 - 11:59)</span>
                <Sun className="w-4 h-4 text-slate-600" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 mt-2">{currentCounts.morning}</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">{mPct}% of sightings</div>
            </div>

            {/* Evening Card */}
            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80">
              <div className="flex items-center justify-between text-slate-700">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Evening (12:00 - 17:59)</span>
                <Sunset className="w-4 h-4 text-slate-600" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 mt-2">{currentCounts.evening}</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">{ePct}% of sightings</div>
            </div>

            {/* Night Card */}
            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80">
              <div className="flex items-center justify-between text-slate-700">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Night (18:00 - 05:59)</span>
                <Moon className="w-4 h-4 text-slate-600" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 mt-2">{currentCounts.night}</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">{nPct}% of sightings</div>
            </div>
          </div>

          {/* Sighting Distribution Proportion Bar - EXCEPTION 2: Keep amber, orange, indigo colors exactly as they are */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-500 font-medium">
              <span>Time-of-Day Proportion</span>
              <span className="font-mono text-[11px] text-slate-600">Morning: {mPct}% | Evening: {ePct}% | Night: {nPct}%</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
              <div className="bg-amber-400 transition-all duration-300" style={{ width: `${mPct}%` }} />
              <div className="bg-orange-500 transition-all duration-300" style={{ width: `${ePct}%` }} />
              <div className="bg-indigo-600 transition-all duration-300" style={{ width: `${nPct}%` }} />
            </div>
          </div>
        </div>

        {/* Sighting Table - Clean Neutral Colors, NO Emojis in Peak Period */}
        <div className="pt-2 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-2.5 px-3">Species</th>
                <th className="py-2.5 px-3 text-center">Morning</th>
                <th className="py-2.5 px-3 text-center">Evening</th>
                <th className="py-2.5 px-3 text-center">Night</th>
                <th className="py-2.5 px-3 text-center">Total</th>
                <th className="py-2.5 px-3 text-right">Peak Period</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredAnimals.length > 0 ? (
                filteredAnimals.map((animal) => {
                  const b = data[animal] || {};
                  const m = b.Morning || 0;
                  const e = b.Evening || 0;
                  const n = b.Night || 0;
                  const tot = m + e + n;

                  let peak = 'None';
                  if (tot > 0) {
                    if (m >= e && m >= n) {
                      peak = 'Morning';
                    } else if (e >= m && e >= n) {
                      peak = 'Evening';
                    } else {
                      peak = 'Night';
                    }
                  }

                  const isSelected = animal === selectedAnimal;

                  return (
                    <tr
                      key={animal}
                      onClick={() => setSelectedAnimal(animal)}
                      className={`cursor-pointer transition ${
                        isSelected ? 'bg-slate-100/90 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-medium text-slate-900 flex items-center gap-1.5">
                        <span>{animal}</span>
                        {isSelected && <span className="text-[10px] text-slate-500">● Selected</span>}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-800 font-mono">{m}</td>
                      <td className="py-2.5 px-3 text-center text-slate-800 font-mono">{e}</td>
                      <td className="py-2.5 px-3 text-center text-slate-800 font-mono">{n}</td>
                      <td className="py-2.5 px-3 text-center font-bold font-mono text-slate-900">{tot}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/60">
                          {peak}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="py-4 text-center text-slate-400">
                    No matching animals found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
