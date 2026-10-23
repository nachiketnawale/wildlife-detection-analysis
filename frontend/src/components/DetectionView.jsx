import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  Crosshair,
  AlertCircle,
  CheckCircle,
  FileImage,
  RefreshCw,
  Eye,
  Sliders,
  ShieldCheck,
  Zap
} from 'lucide-react';

export default function DetectionView() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (file) => {
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please select a JPG, JPEG, PNG, or WEBP image.');
      return;
    }
    setError(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
  };

  const onDragOver = (e) => {
    e.preventDefault();
  };

  const onDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const runDetection = async (e) => {
    e?.preventDefault();
    if (!selectedFile) {
      setError('Please choose an image file first.');
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      const response = await fetch('/detect', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok && response.status !== 200) {
        throw new Error(`Inference server returned status ${response.status}`);
      }

      const htmlText = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');

      // Check for errors returned in the template
      const errorEl = doc.querySelector('.error');
      if (errorEl && errorEl.textContent.trim() && !doc.querySelector('img[src*="/uploads/"]')) {
        throw new Error(errorEl.textContent.trim());
      }

      // Extract generated output image URL
      const imgEl = doc.querySelector('img[src*="/uploads/"]');
      const annotatedImageUrl = imgEl ? imgEl.getAttribute('src') : null;

      // Extract detection table rows
      const detections = [];
      const rows = doc.querySelectorAll('table tbody tr');
      rows.forEach((tr) => {
        const tds = tr.querySelectorAll('td');
        if (tds.length >= 2) {
          detections.push({
            species: tds[0].textContent.trim(),
            confidence: parseFloat(tds[1].textContent.replace('%', '').trim()) || 0,
          });
        }
      });

      // Extract count or detection message
      const resultMsgEl = doc.querySelector('.result-message');
      const message = resultMsgEl ? resultMsgEl.textContent.trim() : '';

      setResult({
        imageUrl: annotatedImageUrl,
        detections,
        count: detections.length,
        message,
      });
    } catch (err) {
      setError(err.message || 'Detection failed. Please check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-5xl mx-auto">
      {/* View Header */}
      <div className="border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-forest-100 text-forest-700">
            <Crosshair className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-forest-900 tracking-tight">
              Wildlife Image Detection
            </h1>
            <p className="text-sm text-slate-500">
              Run YOLOv8 inference with multi-species bounding box prediction and confidence scoring.
            </p>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Detection Error</p>
            <p className="text-rose-800 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Upload & Inference Panel */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm">
        <form onSubmit={runDetection} className="space-y-6">
          <div
            onDragOver={onDragOver}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              selectedFile
                ? 'border-forest-500 bg-forest-50/40'
                : 'border-slate-300 hover:border-forest-600 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              onChange={(e) => handleFileChange(e.target.files?.[0])}
              className="hidden"
            />

            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-forest-100 text-forest-700 flex items-center justify-center shadow-inner">
                <UploadCloud className="w-7 h-7" />
              </div>
              <div>
                <p className="text-base font-semibold text-slate-800">
                  {selectedFile ? selectedFile.name : 'Click to select or drag & drop an image'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Supported formats: JPG, JPEG, PNG, WEBP (Max 20MB)
                </p>
              </div>
            </div>
          </div>

          {/* Quick Preview & Actions */}
          {previewUrl && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-3">
                <img
                  src={previewUrl}
                  alt="Thumbnail"
                  className="w-16 h-16 object-cover rounded-lg border border-slate-300"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-800 truncate max-w-xs">
                    {selectedFile?.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for inference
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 sm:flex-none px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-forest-600 hover:bg-forest-700 rounded-xl transition shadow-sm disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Detecting...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-emerald-200" />
                      <span>Run Detection</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Detection Results Section */}
      {result && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-forest-600" />
                Detection Results
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Processed via backend YOLO checkpoint (`wildlife_yolo_pretrained_best.pt`)
              </p>
            </div>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                result.count > 0
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {result.count > 0 ? `${result.count} Wildlife Detected` : 'No Detections'}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Annotated Output Image */}
            <div className="lg:col-span-7 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Annotated Inference Output
              </span>
              <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 shadow-inner flex items-center justify-center group relative">
                {result.imageUrl ? (
                  <img
                    src={result.imageUrl}
                    alt="Detection Inference Result"
                    className="w-full h-auto max-h-[520px] object-contain"
                  />
                ) : (
                  <div className="p-12 text-slate-400 text-center text-sm">
                    No visual prediction rendered.
                  </div>
                )}
              </div>
              <p className="text-[11px] text-slate-400 text-center">
                Visualized with YOLO bounding boxes and confidence flags (saved to <code>/uploads/</code>).
              </p>
            </div>

            {/* Metrics & Predictions Table */}
            <div className="lg:col-span-5 space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Confidence Metrics
              </span>

              {result.detections && result.detections.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Predicted Species</th>
                        <th className="py-3 px-4 text-right">Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.detections.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-4 font-semibold text-slate-800 capitalize">
                            {item.species.replace(/_/g, ' ')}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-20 bg-slate-100 h-2 rounded-full overflow-hidden hidden sm:block">
                                <div
                                  className={`h-full rounded-full ${
                                    item.confidence >= 70
                                      ? 'bg-forest-600'
                                      : item.confidence >= 40
                                      ? 'bg-amber-500'
                                      : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${Math.min(item.confidence, 100)}%` }}
                                />
                              </div>
                              <span className="font-mono text-xs font-bold text-slate-700">
                                {item.confidence}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center text-slate-600 space-y-2">
                  <p className="font-semibold text-sm">No objects detected above threshold.</p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    The model did not find any targets matching known wildlife species with sufficient confidence.
                    You can verify or add missing boxes via the Teach AI View.
                  </p>
                </div>
              )}

              {/* Tips Note */}
              <div className="p-3.5 rounded-xl bg-forest-50/80 border border-forest-100 text-xs text-forest-900 leading-relaxed">
                <strong>Species Verification:</strong> Automated detections should always be inspected by an ecologist before ingestion into ecological datasets.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
