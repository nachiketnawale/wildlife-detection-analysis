import React, { useState, useRef, useEffect } from 'react';
import {
  GraduationCap,
  Upload,
  PlusCircle,
  XCircle,
  Save,
  Trash2,
  Tag,
  CheckCircle2,
  AlertCircle,
  MousePointer,
  HelpCircle,
  Layers,
  Sparkles
} from 'lucide-react';

export default function TeachView() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: 'Upload an image to start teaching the model.', type: 'info' });

  // Data from backend
  const [imageId, setImageId] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [classes, setClasses] = useState({});
  const [boxes, setBoxes] = useState([]); // array of { x1, y1, x2, y2, species, confidence? }

  // Canvas interaction states
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawSpecies, setDrawSpecies] = useState('');
  const [startPoint, setStartPoint] = useState(null);
  const [draftBox, setDraftBox] = useState(null);

  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const imageElementRef = useRef(null);
  const stageRef = useRef(null);

  // Redraw canvas whenever boxes or draftBox change
  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageElementRef.current;
    if (!canvas || !img || !img.complete || !img.naturalWidth) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw confirmed boxes
    boxes.forEach((b, idx) => {
      const x = b.x1 * canvas.width;
      const y = b.y1 * canvas.height;
      const w = (b.x2 - b.x1) * canvas.width;
      const h = (b.y2 - b.y1) * canvas.height;

      // Box border & fill
      ctx.lineWidth = Math.max(2, canvas.width / 400);
      ctx.strokeStyle = '#24734b';
      ctx.fillStyle = 'rgba(36, 115, 75, 0.15)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);

      // Label background & text
      const fontSize = Math.max(12, Math.round(canvas.width / 65));
      ctx.font = `600 ${fontSize}px sans-serif`;
      const labelText = `#${idx + 1} ${b.species} ${b.confidence ? `(${b.confidence}%)` : '(manual)'}`;
      const textMetrics = ctx.measureText(labelText);
      const textHeight = fontSize + 6;
      const labelY = Math.max(textHeight, y);

      ctx.fillStyle = '#183d2c';
      ctx.fillRect(x, labelY - textHeight, textMetrics.width + 10, textHeight);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, x + 5, labelY - 4);
    });

    // Draw active draft box while dragging
    if (draftBox) {
      const x = draftBox.x1 * canvas.width;
      const y = draftBox.y1 * canvas.height;
      const w = (draftBox.x2 - draftBox.x1) * canvas.width;
      const h = (draftBox.y2 - draftBox.y1) * canvas.height;

      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = Math.max(2, canvas.width / 400);
      ctx.strokeStyle = '#ea580c';
      ctx.fillStyle = 'rgba(234, 88, 12, 0.2)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }
  };

  const syncCanvasResolution = () => {
    const canvas = canvasRef.current;
    const img = imageElementRef.current;
    if (!canvas || !img || !img.naturalWidth) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    redrawCanvas();
  };

  useEffect(() => {
    redrawCanvas();
  }, [boxes, draftBox]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setStatusMsg({ text: 'Uploading image and generating suggested bounding boxes...', type: 'info' });

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch('/teach/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed.');
      }

      setImageId(data.image_id);
      setImageUrl(data.image_url);
      setClasses(data.classes || {});

      // Map suggested boxes to include human-readable species
      const initialBoxes = (data.boxes || []).map((b) => ({
        x1: b.x1,
        y1: b.y1,
        x2: b.x2,
        y2: b.y2,
        class_id: b.class_id,
        confidence: b.confidence,
        species: data.classes?.[String(b.class_id)] || 'unknown',
      }));

      setBoxes(initialBoxes);
      if (Object.values(data.classes || {}).length > 0) {
        setDrawSpecies(Object.values(data.classes)[0]);
      }

      setStatusMsg({
        text: `Loaded image with ${initialBoxes.length} AI suggestion(s). Review or draw new boxes.`,
        type: 'success',
      });
    } catch (err) {
      setStatusMsg({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Convert client pointer event to normalized image coords [0, 1]
  const getNormalizedPoint = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    return { x, y };
  };

  const handlePointerDown = (e) => {
    if (!isDrawing) return;
    canvasRef.current?.setPointerCapture(e.pointerId);
    const p = getNormalizedPoint(e);
    setStartPoint(p);
    setDraftBox({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
  };

  const handlePointerMove = (e) => {
    if (!isDrawing || !startPoint) return;
    const p = getNormalizedPoint(e);
    setDraftBox({
      x1: Math.min(startPoint.x, p.x),
      y1: Math.min(startPoint.y, p.y),
      x2: Math.max(startPoint.x, p.x),
      y2: Math.max(startPoint.y, p.y),
    });
  };

  const handlePointerUp = () => {
    if (!isDrawing || !startPoint || !draftBox) return;

    const w = draftBox.x2 - draftBox.x1;
    const h = draftBox.y2 - draftBox.y1;

    setStartPoint(null);
    setDraftBox(null);
    setIsDrawing(false);

    if (w < 0.01 || h < 0.01) {
      setStatusMsg({ text: 'Bounding box was too small. Drag to draw a clearer box.', type: 'warning' });
      return;
    }

    const speciesName = (drawSpecies.trim() || 'wildlife').toLowerCase();
    const newBox = {
      x1: draftBox.x1,
      y1: draftBox.y1,
      x2: draftBox.x2,
      y2: draftBox.y2,
      species: speciesName,
      confidence: undefined,
    };

    setBoxes((prev) => [...prev, newBox]);
    setStatusMsg({
      text: `Added manual box for "${speciesName}". Verify and click Save.`,
      type: 'success',
    });
  };

  const handleSpeciesChange = (index, newSpecies) => {
    setBoxes((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], species: newSpecies };
      return updated;
    });
  };

  const handleRemoveBox = (index) => {
    setBoxes((prev) => prev.filter((_, i) => i !== index));
    setStatusMsg({ text: `Removed bounding box #${index + 1}.`, type: 'info' });
  };

  const handleSaveVerified = async () => {
    if (!imageId) {
      setStatusMsg({ text: 'Please upload an image first.', type: 'warning' });
      return;
    }
    if (boxes.length === 0) {
      setStatusMsg({ text: 'Add at least one verified bounding box before saving.', type: 'warning' });
      return;
    }

    setSaving(true);
    setStatusMsg({ text: 'Submitting verified annotations to learning dataset...', type: 'info' });

    const payload = {
      image_id: imageId,
      boxes: boxes.map((b) => ({
        x1: b.x1,
        y1: b.y1,
        x2: b.x2,
        y2: b.y2,
        species: b.species,
      })),
    };

    try {
      const res = await fetch('/teach/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save annotations.');
      }

      setClasses(data.classes || classes);
      setStatusMsg({
        text: `Success: ${data.message} ${data.boxes_saved} box(es) verified. (${data.note})`,
        type: 'success',
      });
    } catch (err) {
      setStatusMsg({ text: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-6xl mx-auto">
      {/* View Header */}
      <div className="border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-forest-100 text-forest-700">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-forest-900 tracking-tight">
              Teach the AI (Human-in-the-Loop)
            </h1>
            <p className="text-sm text-slate-500">
              Inspect model proposals, correct classifications, draw missing bounding boxes, and save to verified training data.
            </p>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div
        className={`p-4 rounded-xl border flex items-center gap-3 text-sm transition-colors ${
          statusMsg.type === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-800'
            : statusMsg.type === 'warning'
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : statusMsg.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-forest-50 border-forest-200 text-forest-800'
        }`}
      >
        {statusMsg.type === 'error' && <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />}
        {statusMsg.type === 'warning' && <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />}
        {statusMsg.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />}
        {statusMsg.type === 'info' && <Sparkles className="w-5 h-5 shrink-0 text-forest-600" />}
        <span className="font-medium">{statusMsg.text}</span>
      </div>

      {/* Step 1: Upload */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-forest-600 text-white text-xs flex items-center justify-center font-bold">1</span>
            Upload Image for Active Learning
          </h2>
          <span className="text-xs text-slate-500">Inbox verification pipeline</span>
        </div>

        <form onSubmit={handleUpload} className="flex flex-col sm:flex-row items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-forest-50 file:text-forest-700 hover:file:bg-forest-100 cursor-pointer"
          />

          <button
            type="submit"
            disabled={!file || loading}
            className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-forest-600 hover:bg-forest-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            <span>{loading ? 'Processing...' : 'Upload & Suggest Boxes'}</span>
          </button>
        </form>
      </div>

      {/* Step 2: Canvas Annotation Stage */}
      {imageUrl && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Canvas Interactive View */}
          <div className="lg:col-span-8 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-forest-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                Interactive Bounding Box Canvas
              </h2>

              {/* Drawing Toolbar */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDrawing((prev) => !prev)}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition ${
                    isDrawing
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <MousePointer className="w-3.5 h-3.5" />
                  <span>{isDrawing ? 'Cancel Drawing' : 'Draw Missing Box'}</span>
                </button>
              </div>
            </div>

            {/* Instruction Tip */}
            <p className="text-xs text-slate-500">
              {isDrawing
                ? 'Drag with cursor across the animal in the image to add a bounding box.'
                : 'Click "Draw Missing Box" to manually label any missed wildlife instance.'}
            </p>

            {/* Canvas Stage */}
            <div
              ref={stageRef}
              className="relative w-full rounded-xl overflow-hidden border border-slate-300 bg-slate-950 select-none shadow-inner"
            >
              <img
                ref={imageElementRef}
                src={imageUrl}
                alt="Source for labeling"
                onLoad={syncCanvasResolution}
                className="w-full h-auto block"
              />
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className={`absolute inset-0 w-full h-full touch-none ${
                  isDrawing ? 'cursor-crosshair' : 'cursor-default'
                }`}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Green boxes: Verified / AI suggestions</span>
              <span>Coordinates automatically normalized to YOLO format (0.000 to 1.000)</span>
            </div>
          </div>

          {/* Step 3: Verified Boxes & Save Action */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-forest-600" />
                  Box Annotations ({boxes.length})
                </h3>
                <span className="text-xs font-semibold text-forest-700 bg-forest-50 px-2 py-0.5 rounded-full">
                  Editable
                </span>
              </div>

              {/* Box items list */}
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {boxes.map((b, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2 hover:border-forest-300 transition"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">Box #{idx + 1}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          b.confidence !== undefined
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {b.confidence !== undefined ? `AI ${b.confidence}%` : 'Manual'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={b.species}
                        onChange={(e) => handleSpeciesChange(idx, e.target.value)}
                        placeholder="Species name"
                        className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-forest-600"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveBox(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Delete box"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Quick species suggestions */}
                    {Object.values(classes).length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {Object.values(classes).map((clsName) => (
                          <button
                            key={clsName}
                            type="button"
                            onClick={() => handleSpeciesChange(idx, clsName)}
                            className={`text-[10px] px-2 py-0.5 rounded border transition ${
                              b.species.toLowerCase() === clsName.toLowerCase()
                                ? 'bg-forest-600 text-white border-forest-600 font-semibold'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {clsName}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {boxes.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6">
                    No boxes added yet. Click &quot;Draw Missing Box&quot; to create one.
                  </p>
                )}
              </div>

              {/* Save CTA */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleSaveVerified}
                  disabled={saving || boxes.length === 0}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-forest-600 hover:bg-forest-700 text-white rounded-xl text-sm font-semibold transition shadow-sm disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving Annotations...' : 'Save Verified Annotations'}</span>
                </button>
                <p className="text-[11px] text-slate-400 text-center mt-2">
                  Annotations are formatted directly to YOLO txt labels in <code>learning_data/verified/</code>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
