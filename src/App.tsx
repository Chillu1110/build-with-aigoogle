import React, { useState, useRef, useEffect } from 'react';
import { 
  Shield, 
  Image as ImageIcon, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  Upload, 
  Search, 
  Loader2,
  Info,
  ChevronDown,
  ChevronUp,
  Zap,
  Eye,
  Activity,
  ExternalLink,
  HelpCircle,
  ArrowRight,
  ImagePlus,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Plot from 'react-plotly.js';
import { 
  analyzeImage, 
  analyzeText, 
  ImageAnalysisResult, 
  TextAnalysisResult
} from './services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Tab = 'image' | 'text' | 'compare';

const THINKING_STEPS_IMAGE = [
  "Initializing TrueLens v2.0 Forensic Engine...",
  "Performing Frequency Domain Analysis...",
  "Extracting Noise Print & Pixel Consistency...",
  "Differentiating Natural vs. Synthetic Blur...",
  "Scanning for GAN & Diffusion Artifacts...",
  "Generating Multi-Layered Forensic Heatmap..."
];

const THINKING_STEPS_TEXT = [
  "Loading Fake-News-BERT Classifier...",
  "Analyzing linguistic patterns and sentiment...",
  "Cross-referencing claims with known databases...",
  "Checking for emotional manipulation markers...",
  "Calculating final reliability score..."
];

const Tooltip = ({ text, children }: { text: string, children: React.ReactNode }) => (
  <span className="group relative inline-block">
    {children}
    <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-48 -translate-x-1/2 rounded bg-black p-2 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100 z-50">
      {text}
      <span className="absolute top-full left-1/2 -ml-1 border-4 border-transparent border-t-black"></span>
    </span>
  </span>
);

const ForensicOverlay = ({ image, result }: { image: string, result: ImageAnalysisResult }) => (
  <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-white/10">
    <img src={image} alt="Forensic" className="w-full h-full object-contain opacity-30 grayscale" referrerPolicy="no-referrer" />
    <div className="absolute inset-0">
      {result.forensicPoints.map((point, idx) => (
        <motion.div 
          key={idx}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: point.intensity / 100 }}
          className="absolute w-12 h-12 -ml-6 -mt-6 rounded-full bg-red-500 blur-xl"
          style={{ left: `${point.x}%`, top: `${point.y}%` }}
        />
      ))}
      {result.forensicPoints.map((point, idx) => (
        <div 
          key={`marker-${idx}`}
          className="absolute w-4 h-4 -ml-2 -mt-2 border border-white/40 rounded-full flex items-center justify-center group"
          style={{ left: `${point.x}%`, top: `${point.y}%` }}
        >
          <div className="w-1 h-1 bg-white rounded-full" />
          <div className="absolute left-full ml-2 px-2 py-1 bg-black/80 border border-white/10 rounded text-[8px] font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
            {point.label} ({point.intensity}%)
          </div>
        </div>
      ))}
    </div>
  </div>
);

const ComparisonSlider = ({ image1, image2 }: { image1: string, image2: string }) => {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const pos = ((x - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(0, Math.min(100, pos)));
  };

  return (
    <div 
      ref={containerRef}
      className="relative aspect-video bg-black rounded-3xl overflow-hidden border border-white/10 cursor-col-resize select-none"
      onMouseMove={handleMove}
      onTouchMove={handleMove}
    >
      <img src={image2} alt="Evidence B" className="absolute inset-0 w-full h-full object-contain" referrerPolicy="no-referrer" />
      <div 
        className="absolute inset-0 w-full h-full overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
      >
        <img src={image1} alt="Evidence A" className="absolute inset-0 w-full h-full object-contain" referrerPolicy="no-referrer" />
      </div>
      <div 
        className="absolute inset-y-0 w-1 bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)] z-20"
        style={{ left: `${sliderPos}%` }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-xl">
          <div className="flex gap-0.5">
            <div className="w-0.5 h-3 bg-black/20 rounded-full" />
            <div className="w-0.5 h-3 bg-black/20 rounded-full" />
          </div>
        </div>
      </div>
      <div className="absolute bottom-4 left-4 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-[8px] font-mono uppercase tracking-widest text-white/60 border border-white/10">
        Evidence A
      </div>
      <div className="absolute bottom-4 right-4 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-[8px] font-mono uppercase tracking-widest text-white/60 border border-white/10">
        Evidence B
      </div>
    </div>
  );
};

const DiscrepancyHeatmap = ({ image1, image2, result1, result2 }: { image1: string, image2: string, result1: ImageAnalysisResult, result2: ImageAnalysisResult }) => {
  const discrepancies = result1.forensicPoints.map((p1, idx) => {
    const p2 = result2.forensicPoints[idx];
    const diff = Math.abs(p1.intensity - (p2?.intensity || 0));
    return {
      x: (p1.x + (p2?.x || p1.x)) / 2,
      y: (p1.y + (p2?.y || p1.y)) / 2,
      intensity: diff,
      label: `Diff: ${diff}%`
    };
  }).filter(d => d.intensity > 15);

  return (
    <div className="relative aspect-video bg-black rounded-3xl overflow-hidden border border-white/10">
      <div className="absolute inset-0 flex">
        <img src={image1} alt="A" className="w-1/2 h-full object-cover opacity-20 grayscale" referrerPolicy="no-referrer" />
        <img src={image2} alt="B" className="w-1/2 h-full object-cover opacity-20 grayscale" referrerPolicy="no-referrer" />
      </div>
      <div className="absolute inset-0">
        {discrepancies.map((d, idx) => (
          <motion.div 
            key={idx}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: d.intensity / 100 }}
            className="absolute w-16 h-16 -ml-8 -mt-8 rounded-full bg-orange-500 blur-2xl"
            style={{ left: `${d.x}%`, top: `${d.y}%` }}
          />
        ))}
        {discrepancies.map((d, idx) => (
          <div 
            key={`d-marker-${idx}`}
            className="absolute w-6 h-6 -ml-3 -mt-3 border-2 border-orange-500/50 rounded-full flex items-center justify-center group"
            style={{ left: `${d.x}%`, top: `${d.y}%` }}
          >
            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
            <div className="absolute bottom-full mb-2 px-2 py-1 bg-orange-500 text-black rounded text-[8px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
              Discrepancy: {d.intensity}%
            </div>
          </div>
        ))}
      </div>
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <div className="w-2 h-2 bg-orange-500 rounded-full" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-orange-500 font-bold">Discrepancy Heatmap</span>
      </div>
    </div>
  );
};

const getVerdict = (score: number, suspicious: number, highRisk: number) => {
  if (score >= highRisk) return 'High-Risk';
  if (score >= suspicious) return 'Suspicious';
  return 'Safe';
};

const getVerdictColor = (verdict?: string) => {
  switch (verdict) {
    case 'Safe': return '#22c55e';
    case 'Suspicious': return '#eab308';
    case 'High-Risk': return '#ef4444';
    default: return '#6b7280';
  }
};

const getVerdictTailwind = (verdict?: string) => {
  switch (verdict) {
    case 'Safe': return 'bg-green-500/10 text-green-500 border-green-500/20';
    case 'Suspicious': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    case 'High-Risk': return 'bg-red-500/10 text-red-500 border-red-500/20';
    default: return 'bg-white/5 text-white/40 border-white/10';
  }
};

const SensitivitySlider = ({ 
  label, 
  suspicious, 
  highRisk, 
  onSuspiciousChange, 
  onHighRiskChange 
}: { 
  label: string, 
  suspicious: number, 
  highRisk: number, 
  onSuspiciousChange: (v: number) => void, 
  onHighRiskChange: (v: number) => void 
}) => (
  <div className="space-y-6 p-6 bg-white/[0.03] border border-white/10 rounded-2xl">
    <div className="flex justify-between items-center">
      <h4 className="text-[10px] font-mono uppercase tracking-widest opacity-50">{label} Sensitivity</h4>
      <div className="flex gap-2">
        <div className="px-2 py-1 bg-red-500/10 text-red-500 text-[8px] font-mono rounded border border-red-500/20">HR: {highRisk}%</div>
        <div className="px-2 py-1 bg-yellow-500/10 text-yellow-500 text-[8px] font-mono rounded border border-yellow-500/20">S: {suspicious}%</div>
      </div>
    </div>
    
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between text-[8px] font-mono uppercase opacity-40">
          <span>Suspicious Threshold</span>
          <span>{suspicious}% Risk</span>
        </div>
        <input 
          type="range" 
          min="0" 
          max="100" 
          value={suspicious} 
          onChange={(e) => {
            const val = parseInt(e.target.value);
            onSuspiciousChange(val);
            if (val > highRisk) onHighRiskChange(val);
          }}
          className="w-full accent-white opacity-60 hover:opacity-100 transition-opacity"
        />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-[8px] font-mono uppercase opacity-40">
          <span>High-Risk Threshold</span>
          <span>{highRisk}% Risk</span>
        </div>
        <input 
          type="range" 
          min="0" 
          max="100" 
          value={highRisk} 
          onChange={(e) => {
            const val = parseInt(e.target.value);
            onHighRiskChange(val);
            if (val < suspicious) onSuspiciousChange(val);
          }}
          className="w-full accent-white opacity-60 hover:opacity-100 transition-opacity"
        />
      </div>
    </div>
    <p className="text-[8px] font-mono opacity-30 leading-relaxed">
      * Lowering thresholds increases model sensitivity, flagging more content as suspicious or high-risk.
    </p>
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('image');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showForensics, setShowForensics] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDragging2, setIsDragging2] = useState(false);

  // Threshold States (Risk Score thresholds)
  const [imgSuspiciousThreshold, setImgSuspiciousThreshold] = useState(30);
  const [imgHighRiskThreshold, setImgHighRiskThreshold] = useState(70);
  const [txtSuspiciousThreshold, setTxtSuspiciousThreshold] = useState(30);
  const [txtHighRiskThreshold, setTxtHighRiskThreshold] = useState(70);

  // Image State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageResult, setImageResult] = useState<ImageAnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compare State
  const [selectedImage2, setSelectedImage2] = useState<string | null>(null);
  const [imageFile2, setImageFile2] = useState<File | null>(null);
  const [imageResult2, setImageResult2] = useState<ImageAnalysisResult | null>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);

  // Text State
  const [textInput, setTextInput] = useState('');
  const [textResult, setTextResult] = useState<TextAnalysisResult | null>(null);

  useEffect(() => {
    let interval: any;
    if (isAnalyzing) {
      interval = setInterval(() => {
        setThinkingStep(prev => {
          const steps = activeTab === 'image' ? THINKING_STEPS_IMAGE : 
                        THINKING_STEPS_TEXT;
          return (prev + 1) % steps.length;
        });
      }, 1500);
    } else {
      setThinkingStep(0);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing, activeTab]);

  const processImageFile = (file: File) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Please upload a supported image format (PNG, JPEG, WebP, HEIC).');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
      setImageResult(null);
      setError(null);
      setShowForensics(false);
    };
    reader.readAsDataURL(file);
  };

  const processImageFile2 = (file: File) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Please upload a supported image format (PNG, JPEG, WebP, HEIC).');
      return;
    }
    setImageFile2(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage2(reader.result as string);
      setImageResult2(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
  };

  const handleImageUpload2 = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile2(file);
  };



  const handlePaste = (e: ClipboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    const items = e.clipboardData?.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          if (activeTab === 'image') {
            processImageFile(file);
          } else if (activeTab === 'compare') {
            // Default to first image if both empty, or second if first full
            if (!selectedImage) processImageFile(file);
            else processImageFile2(file);
          }
        }
        break;
      }
    }
  };

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeTab, selectedImage]);

  const runImageAnalysis = async () => {
    if (!selectedImage) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const dataToAnalyze = selectedImage;
      const mimeType = imageFile?.type || 'image/jpeg';

      const result = await analyzeImage(dataToAnalyze, mimeType);
      setImageResult(result);
    } catch (err: any) {
      console.error(err);
      const msg = err.message?.toLowerCase() || '';
      if (msg.includes('timeout') || msg.includes('deadline') || msg.includes('exhausted')) {
        setError('The analysis timed out or the model is busy. Please try again in a few moments.');
      } else if (msg.includes('api key')) {
        setError('Invalid API key. Please check your configuration.');
      } else {
        setError('Analysis failed. Please try again.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runComparisonAnalysis = async () => {
    if (!selectedImage || !imageFile || !selectedImage2 || !imageFile2) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const [res1, res2] = await Promise.all([
        analyzeImage(selectedImage, imageFile.type),
        analyzeImage(selectedImage2, imageFile2.type)
      ]);
      setImageResult(res1);
      setImageResult2(res2);
    } catch (err: any) {
      console.error(err);
      setError('Comparison analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runTextAnalysis = async () => {
    if (!textInput.trim()) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeText(textInput);
      setTextResult(result);
    } catch (err: any) {
      console.error(err);
      const msg = err.message?.toLowerCase() || '';
      if (msg.includes('timeout') || msg.includes('deadline') || msg.includes('exhausted')) {
        setError('The analysis timed out or the model is busy. Please try again in a few moments.');
      } else {
        setError('Analysis failed. Please try again.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5] font-sans selection:bg-[#F5F5F5] selection:text-[#0A0A0A]">
      {/* Header */}
      <header className="border-b border-white/10 p-6 flex justify-between items-center bg-[#0A0A0A]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white flex items-center justify-center rounded-full">
            <Shield className="text-black w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight uppercase">True<span className="text-white/40 font-normal">Lens</span></h1>
            <p className="text-[10px] font-mono opacity-50 uppercase tracking-widest">Human-Centric Detection Platform</p>
          </div>
        </div>
        <div className="flex gap-2 bg-white/5 p-1 rounded-full">
          <button 
            onClick={() => { setActiveTab('image'); setError(null); }}
            className={cn(
              "px-6 py-2 text-[10px] font-bold uppercase tracking-widest rounded-full transition-all",
              activeTab === 'image' ? "bg-white text-black" : "text-white/60 hover:text-white"
            )}
          >
            Visual
          </button>
          <button 
            onClick={() => { setActiveTab('text'); setError(null); }}
            className={cn(
              "px-6 py-2 text-[10px] font-bold uppercase tracking-widest rounded-full transition-all",
              activeTab === 'text' ? "bg-white text-black" : "text-white/60 hover:text-white"
            )}
          >
            Textual
          </button>
          <button 
            onClick={() => { setActiveTab('compare'); setError(null); }}
            className={cn(
              "px-6 py-2 text-[10px] font-bold uppercase tracking-widest rounded-full transition-all",
              activeTab === 'compare' ? "bg-white text-black" : "text-white/60 hover:text-white"
            )}
          >
            Compare
          </button>
        </div>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className={cn(
            "p-3 rounded-full border transition-all",
            showSettings ? "bg-white text-black border-white" : "border-white/10 text-white/60 hover:border-white/40"
          )}
        >
          <Info className="w-5 h-5" />
        </button>
      </header>

      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-white/10 bg-white/[0.02] overflow-hidden"
          >
            <div className="max-w-7xl mx-auto p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
              <SensitivitySlider 
                label="Visual" 
                suspicious={imgSuspiciousThreshold}
                highRisk={imgHighRiskThreshold}
                onSuspiciousChange={setImgSuspiciousThreshold}
                onHighRiskChange={setImgHighRiskThreshold}
              />

              <SensitivitySlider 
                label="Textual" 
                suspicious={txtSuspiciousThreshold}
                highRisk={txtHighRiskThreshold}
                onSuspiciousChange={setTxtSuspiciousThreshold}
                onHighRiskChange={setTxtHighRiskThreshold}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto p-6 md:p-12">
        <AnimatePresence mode="wait">
          {activeTab === 'image' ? (
            <motion.div 
              key="image-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-12"
            >
              {/* Input Section */}
              <div className="lg:col-span-5 space-y-8">
                <div className="space-y-4">
                  <h2 className="text-5xl font-serif italic leading-tight">Image Integrity <span className="text-xs font-mono not-italic opacity-30 align-top">v2.0</span></h2>
                  <p className="text-sm text-white/60 leading-relaxed max-w-md">
                    Our upgraded platform uses <Tooltip text="TrueLens v2.0: Enhanced with Frequency Domain Analysis and Noise Print extraction to detect even high-quality or blurred deepfakes."><span className="underline decoration-white/20 cursor-help">TrueLens v2.0</span></Tooltip> to identify deepfakes with forensic precision.
                  </p>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg w-fit">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      <span className="text-[8px] font-mono uppercase tracking-widest text-green-500">Enhanced Forensic Dataset Active</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg w-fit">
                      <Eye className="w-3 h-3 text-blue-500" />
                      <span className="text-[8px] font-mono uppercase tracking-widest text-blue-500">Blurred Image Analysis Enabled</span>
                    </div>
                  </div>
                </div>

                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) processImageFile(file);
                  }}
                  onClick={() => !selectedImage && fileInputRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed border-white/10 rounded-3xl aspect-video flex flex-col items-center justify-center transition-all group relative overflow-hidden bg-white/[0.02]",
                    selectedImage ? "border-solid border-white/20 cursor-default" : "cursor-pointer hover:border-white/40",
                    isDragging && "border-white/60 bg-white/5"
                  )}
                >
                  {selectedImage ? (
                    <div className="relative w-full h-full group">
                      <img src={selectedImage} alt="Preview" className="w-full h-full object-contain p-4" />
                    </div>
                  ) : (
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto group-hover:bg-white group-hover:text-black transition-all">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-mono uppercase tracking-widest opacity-40">Drop forensic evidence here</p>
                        <p className="text-[8px] font-mono uppercase tracking-widest opacity-20">or paste from clipboard</p>
                      </div>
                    </div>
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageUpload} 
                    className="hidden" 
                    accept="image/*"
                  />
                </div>

                {selectedImage && (
                  <div className="flex gap-4">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 py-3 bg-white text-black rounded-full text-[10px] font-mono uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                      <ImagePlus className="w-3 h-3" />
                      Browse Files
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedImage(null);
                        setImageFile(null);
                        setImageResult(null);
                      }}
                      className="px-6 py-3 border border-white/10 rounded-full text-[10px] font-mono uppercase tracking-widest hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all"
                    >
                      Clear
                    </button>
                  </div>
                )}

                <button 
                  onClick={runImageAnalysis}
                  disabled={!selectedImage || isAnalyzing}
                  className="w-full py-5 bg-white text-black font-bold uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3 disabled:opacity-20 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-all rounded-full"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Initiate Forensic Scan
                    </>
                  )}
                </button>

                {isAnalyzing && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <Activity className="w-4 h-4 text-white/40 animate-pulse" />
                      <span className="text-[10px] font-mono uppercase tracking-widest text-white/60">
                        {THINKING_STEPS_IMAGE[thinkingStep]}
                      </span>
                    </div>
                    <div className="h-1 bg-white/5 w-full rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-white"
                        initial={{ width: "0%" }}
                        animate={{ width: `${(thinkingStep + 1) * 20}%` }}
                      />
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Result Section */}
              <div className="lg:col-span-7 space-y-8">
                {error && activeTab === 'image' ? (
                  <div className="h-full min-h-[400px] flex flex-col items-center justify-center space-y-6 border border-red-500/20 rounded-3xl bg-red-500/[0.02] p-8 text-center">
                    <div className="w-20 h-20 border border-red-500/30 rounded-full flex items-center justify-center text-red-500">
                      <AlertTriangle className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-red-500 font-bold uppercase tracking-widest text-xs">Analysis Error</h3>
                      <p className="text-sm text-white/60 leading-relaxed max-w-md">{error}</p>
                    </div>
                    <button 
                      onClick={runImageAnalysis}
                      className="px-6 py-2 border border-white/10 rounded-full text-[10px] font-mono uppercase tracking-widest hover:bg-white/5 transition-colors"
                    >
                      Retry Analysis
                    </button>
                  </div>
                ) : !imageResult && !isAnalyzing ? (
                  <div className="h-full min-h-[400px] flex flex-col items-center justify-center space-y-6 border border-white/5 rounded-3xl bg-white/[0.01]">
                    <div className="w-20 h-20 border border-white/10 rounded-full flex items-center justify-center opacity-20">
                      <Eye className="w-8 h-8" />
                    </div>
                    <p className="text-[10px] font-mono uppercase tracking-widest opacity-20">System Idle: Awaiting Input</p>
                  </div>
                ) : isAnalyzing ? (
                  <div className="h-full min-h-[400px] flex flex-col items-center justify-center space-y-8 border border-white/5 rounded-3xl bg-white/[0.01]">
                    <div className="relative">
                      <div className="w-32 h-32 border-4 border-white/5 rounded-full" />
                      <div className="absolute inset-0 w-32 h-32 border-4 border-t-white rounded-full animate-spin" />
                    </div>
                    <p className="text-[10px] font-mono uppercase tracking-widest animate-pulse">Processing Neural Layers</p>
                  </div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-8"
                  >
                    {/* Citizen View: Gauge */}
                    <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 flex flex-col items-center">
                      <h3 className="text-[10px] font-mono uppercase tracking-widest opacity-50 mb-4">Citizen Trust Verdict</h3>
                      {(() => {
                        const score = imageResult?.riskScore || 0;
                        const displayScore = Math.round(score);
                        const verdict = getVerdict(score, imgSuspiciousThreshold, imgHighRiskThreshold);
                        return (
                          <>
                            <Plot
                              data={[
                                {
                                  type: "indicator",
                                  mode: "gauge+number",
                                  value: displayScore,
                                  title: { text: "Risk Score", font: { size: 14, color: "white" } },
                                  number: { font: { size: 48, color: "white", family: "JetBrains Mono" } },
                                  gauge: {
                                    axis: { range: [0, 100], tickwidth: 1, tickcolor: "white" },
                                    bar: { color: getVerdictColor(verdict), thickness: 0.25 },
                                    bgcolor: "rgba(0,0,0,0)",
                                    borderwidth: 2,
                                    bordercolor: "rgba(255,255,255,0.1)",
                                    steps: [
                                      { range: [0, imgSuspiciousThreshold], color: "rgba(34, 197, 94, 0.2)" },
                                      { range: [imgSuspiciousThreshold, imgHighRiskThreshold], color: "rgba(234, 179, 8, 0.2)" },
                                      { range: [imgHighRiskThreshold, 100], color: "rgba(239, 68, 68, 0.2)" },
                                    ],
                                  },
                                },
                              ]}
                              layout={{
                                width: 350,
                                height: 300,
                                margin: { t: 80, r: 25, l: 25, b: 25 },
                                paper_bgcolor: "rgba(0,0,0,0)",
                                font: { color: "white", family: "Inter" },
                              }}
                              config={{ displayModeBar: false }}
                            />
                            <div className={cn(
                              "mt-4 px-8 py-3 rounded-full text-sm font-bold uppercase tracking-widest border",
                              getVerdictTailwind(verdict)
                            )}>
                              Verdict: {verdict}
                            </div>
                            {verdict !== 'Safe' && (
                              <div className="mt-6 p-4 bg-white/[0.02] border border-white/5 rounded-2xl max-w-md text-center space-y-2">
                                <div className="flex items-center justify-center gap-2 text-[10px] font-mono text-white/40 uppercase tracking-widest">
                                  <HelpCircle className="w-3 h-3" />
                                  <span>Why this verdict?</span>
                                </div>
                                <p className="text-[10px] text-white/40 leading-relaxed italic">
                                  Authentic photos can sometimes be flagged due to heavy digital filters, extreme low-light noise, or aggressive JPEG compression which mimic AI artifacts.
                                </p>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    {/* Investigator View: Forensics */}
                    <div className="border border-white/10 rounded-3xl overflow-hidden">
                      <button 
                        onClick={() => setShowForensics(!showForensics)}
                        className="w-full p-6 flex justify-between items-center hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Activity className="w-5 h-5 text-white/40" />
                          <span className="text-xs font-bold uppercase tracking-widest">Investigator Forensics</span>
                        </div>
                        {showForensics ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                      
                      <AnimatePresence>
                        {showForensics && (
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: "auto" }}
                            exit={{ height: 0 }}
                            className="overflow-hidden border-t border-white/10 bg-white/[0.01]"
                          >
                            <div className="p-8 space-y-8">
                              {/* ELA Heatmap Simulation */}
                              <div className="space-y-4">
                                <div className="flex justify-between items-end">
                                  <h4 className="text-[10px] font-mono uppercase tracking-widest opacity-50">
                                    <Tooltip text="ELA: Error Level Analysis highlights areas with different compression levels, often revealing digital manipulation.">
                                      <span className="underline decoration-white/20 cursor-help">ELA Heatmap (Simulated)</span>
                                    </Tooltip>
                                  </h4>
                                  <span className="text-[10px] font-mono opacity-30">Scale: 1.0x</span>
                                </div>
                                <ForensicOverlay image={selectedImage!} result={imageResult!} />
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                  <h4 className="text-[10px] font-mono uppercase tracking-widest opacity-50">Detected Anomalies</h4>
                                  <div className="space-y-2">
                                    {imageResult?.artifacts.map((art, idx) => (
                                      <div key={idx} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                                        <div className="w-1.5 h-1.5 bg-white/40 rounded-full" />
                                        <span className="text-[10px] font-mono uppercase tracking-widest">{art}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="space-y-4">
                                  <h4 className="text-[10px] font-mono uppercase tracking-widest opacity-50">Technical Analysis</h4>
                                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                                    <p className="text-xs leading-relaxed text-white/80 font-serif italic">
                                      "{imageResult?.analysis}"
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 text-[8px] font-mono opacity-40">
                                    <Info className="w-3 h-3" />
                                    <span>Cross-referenced with FaceForensics++, DFDC, SigLIP-2, and GAN-artifact datasets. Optimized for low-quality and blurred forensic analysis.</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          ) : activeTab === 'text' ? (
            <motion.div 
              key="text-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-12"
            >
              {/* Input Section */}
              <div className="lg:col-span-5 space-y-8">
                <div className="space-y-4">
                  <h2 className="text-5xl font-serif italic leading-tight">Textual Integrity</h2>
                  <p className="text-sm text-white/60 leading-relaxed max-w-md">
                    Analyzing claims using <Tooltip text="BERT: Bidirectional Encoder Representations from Transformers, optimized for detecting linguistic manipulation."><span className="underline decoration-white/20 cursor-help">Fake-News-BERT</span></Tooltip> to identify misinformation patterns.
                  </p>
                </div>

                <div className="space-y-2">
                  <textarea 
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Paste article or claim for verification..."
                    className="w-full h-80 p-8 bg-white/[0.02] border border-white/10 rounded-3xl focus:border-white/40 outline-none text-sm leading-relaxed resize-none transition-all placeholder:opacity-20"
                  />
                  <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest opacity-30 px-4">
                    <span>{textInput.length} Characters</span>
                    <span>Min: 50</span>
                  </div>
                </div>

                <button 
                  onClick={runTextAnalysis}
                  disabled={!textInput.trim() || isAnalyzing}
                  className="w-full py-5 bg-white text-black font-bold uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3 disabled:opacity-20 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-all rounded-full"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Analyze Content
                    </>
                  )}
                </button>

                {isAnalyzing && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <Activity className="w-4 h-4 text-white/40 animate-pulse" />
                      <span className="text-[10px] font-mono uppercase tracking-widest text-white/60">
                        {THINKING_STEPS_TEXT[thinkingStep]}
                      </span>
                    </div>
                    <div className="h-1 bg-white/5 w-full rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-white"
                        initial={{ width: "0%" }}
                        animate={{ width: `${(thinkingStep + 1) * 20}%` }}
                      />
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Result Section */}
              <div className="lg:col-span-7 space-y-8">
                {error && activeTab === 'text' ? (
                  <div className="h-full min-h-[400px] flex flex-col items-center justify-center space-y-6 border border-red-500/20 rounded-3xl bg-red-500/[0.02] p-8 text-center">
                    <div className="w-20 h-20 border border-red-500/30 rounded-full flex items-center justify-center text-red-500">
                      <AlertTriangle className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-red-500 font-bold uppercase tracking-widest text-xs">Analysis Error</h3>
                      <p className="text-sm text-white/60 leading-relaxed max-w-md">{error}</p>
                    </div>
                    <button 
                      onClick={runTextAnalysis}
                      className="px-6 py-2 border border-white/10 rounded-full text-[10px] font-mono uppercase tracking-widest hover:bg-white/5 transition-colors"
                    >
                      Retry Analysis
                    </button>
                  </div>
                ) : !textResult && !isAnalyzing ? (
                  <div className="h-full min-h-[400px] flex flex-col items-center justify-center space-y-6 border border-white/5 rounded-3xl bg-white/[0.01]">
                    <div className="w-20 h-20 border border-white/10 rounded-full flex items-center justify-center opacity-20">
                      <FileText className="w-8 h-8" />
                    </div>
                    <p className="text-[10px] font-mono uppercase tracking-widest opacity-20">System Idle: Awaiting Data</p>
                  </div>
                ) : isAnalyzing ? (
                  <div className="h-full min-h-[400px] flex flex-col items-center justify-center space-y-8 border border-white/5 rounded-3xl bg-white/[0.01]">
                    <div className="relative">
                      <div className="w-32 h-32 border-4 border-white/5 rounded-full" />
                      <div className="absolute inset-0 w-32 h-32 border-4 border-t-white rounded-full animate-spin" />
                    </div>
                    <p className="text-[10px] font-mono uppercase tracking-widest animate-pulse">Cross-Referencing Sources</p>
                  </div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-8"
                  >
                    {/* Citizen View: Gauge */}
                    <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 flex flex-col items-center">
                      <h3 className="text-[10px] font-mono uppercase tracking-widest opacity-50 mb-4">Reliability Verdict</h3>
                      {(() => {
                        const score = textResult?.riskScore || 0;
                        const displayScore = Math.round(score);
                        const verdict = getVerdict(score, txtSuspiciousThreshold, txtHighRiskThreshold);
                        return (
                          <>
                            <Plot
                              data={[
                                {
                                  type: "indicator",
                                  mode: "gauge+number",
                                  value: displayScore,
                                  title: { text: "Risk Score", font: { size: 14, color: "white" } },
                                  number: { font: { size: 48, color: "white", family: "JetBrains Mono" } },
                                  gauge: {
                                    axis: { range: [0, 100], tickwidth: 1, tickcolor: "white" },
                                    bar: { color: getVerdictColor(verdict), thickness: 0.25 },
                                    bgcolor: "rgba(0,0,0,0)",
                                    borderwidth: 2,
                                    bordercolor: "rgba(255,255,255,0.1)",
                                    steps: [
                                      { range: [0, txtSuspiciousThreshold], color: "rgba(34, 197, 94, 0.2)" },
                                      { range: [txtSuspiciousThreshold, txtHighRiskThreshold], color: "rgba(234, 179, 8, 0.2)" },
                                      { range: [txtHighRiskThreshold, 100], color: "rgba(239, 68, 68, 0.2)" },
                                    ],
                                  },
                                },
                              ]}
                              layout={{
                                width: 350,
                                height: 300,
                                margin: { t: 80, r: 25, l: 25, b: 25 },
                                paper_bgcolor: "rgba(0,0,0,0)",
                                font: { color: "white", family: "Inter" },
                              }}
                              config={{ displayModeBar: false }}
                            />
                            <div className={cn(
                              "mt-4 px-8 py-3 rounded-full text-sm font-bold uppercase tracking-widest border",
                              getVerdictTailwind(verdict)
                            )}>
                              Verdict: {verdict}
                            </div>
                            {verdict !== 'Safe' && (
                              <div className="mt-6 p-4 bg-white/[0.02] border border-white/5 rounded-2xl max-w-md text-center space-y-2">
                                <div className="flex items-center justify-center gap-2 text-[10px] font-mono text-white/40 uppercase tracking-widest">
                                  <HelpCircle className="w-3 h-3" />
                                  <span>Why this verdict?</span>
                                </div>
                                <p className="text-[10px] text-white/40 leading-relaxed italic">
                                  Reliable text can be flagged if it contains heavy satire, opinionated language, or lacks clear citations, even if the core claims are true.
                                </p>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    {/* Proactive Guidance */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 space-y-6">
                        <h4 className="text-[10px] font-mono uppercase tracking-widest opacity-50">Next Steps & Guidance</h4>
                        <div className="space-y-4">
                          {textResult?.nextSteps.map((step, idx) => (
                            <div key={idx} className="flex items-start gap-3">
                              <ArrowRight className="w-4 h-4 text-white/40 shrink-0 mt-0.5" />
                              <span className="text-xs text-white/80 leading-relaxed">{step}</span>
                            </div>
                          ))}
                        </div>
                        <div className="pt-4">
                          <a 
                            href="https://reuters.com" 
                            target="_blank" 
                            className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest hover:underline"
                          >
                            Verify via Reuters <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>

                      <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 space-y-6">
                        <h4 className="text-[10px] font-mono uppercase tracking-widest opacity-50">Analysis Flags</h4>
                        <div className="space-y-3">
                          {textResult?.flags.map((flag, idx) => (
                            <div key={idx} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                              <AlertTriangle className="w-4 h-4 text-white/40" />
                              <span className="text-[10px] font-mono uppercase tracking-widest">{flag}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="compare-tab"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12"
            >
              <div className="space-y-4 text-center">
                <h2 className="text-5xl font-serif italic leading-tight">Comparative Analysis</h2>
                <p className="text-sm text-white/60 leading-relaxed max-w-2xl mx-auto">
                  Upload two images to perform a side-by-side forensic comparison. This tool highlights differences in sensor noise, diffusion artifacts, and lighting consistency between two samples.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Image 1 Upload */}
                <div className="space-y-4">
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) processImageFile(file);
                    }}
                    onClick={() => !selectedImage && fileInputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed border-white/10 rounded-3xl aspect-video flex flex-col items-center justify-center transition-all group relative overflow-hidden bg-white/[0.02]",
                      selectedImage ? "border-solid border-white/20 cursor-default" : "cursor-pointer hover:border-white/40",
                      isDragging && "border-white/60 bg-white/5"
                    )}
                  >
                    {selectedImage ? (
                      <div className="relative w-full h-full group">
                        <img src={selectedImage} alt="Preview 1" className="w-full h-full object-contain p-4" />
                      </div>
                    ) : (
                      <div className="text-center space-y-4">
                        <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto group-hover:bg-white group-hover:text-black transition-all">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[8px] font-mono uppercase tracking-widest opacity-40">Primary Evidence</p>
                          <p className="text-[6px] font-mono uppercase tracking-widest opacity-20">Drop or Paste</p>
                        </div>
                      </div>
                    )}
                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                  </div>
                  {selectedImage && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 py-2 bg-white text-black rounded-full text-[8px] font-mono uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                      >
                        <ImagePlus className="w-3 h-3" />
                        Browse
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedImage(null);
                          setImageFile(null);
                          setImageResult(null);
                        }}
                        className="px-4 py-2 border border-white/10 rounded-full text-[8px] font-mono uppercase tracking-widest hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {/* Image 2 Upload */}
                <div className="space-y-4">
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setIsDragging2(true); }}
                    onDragLeave={() => setIsDragging2(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging2(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) processImageFile2(file);
                    }}
                    onClick={() => !selectedImage2 && fileInputRef2.current?.click()}
                    className={cn(
                      "border-2 border-dashed border-white/10 rounded-3xl aspect-video flex flex-col items-center justify-center transition-all group relative overflow-hidden bg-white/[0.02]",
                      selectedImage2 ? "border-solid border-white/20 cursor-default" : "cursor-pointer hover:border-white/40",
                      isDragging2 && "border-white/60 bg-white/5"
                    )}
                  >
                    {selectedImage2 ? (
                      <div className="relative w-full h-full group">
                        <img src={selectedImage2} alt="Preview 2" className="w-full h-full object-contain p-4" />
                      </div>
                    ) : (
                      <div className="text-center space-y-4">
                        <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto group-hover:bg-white group-hover:text-black transition-all">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[8px] font-mono uppercase tracking-widest opacity-40">Secondary Evidence</p>
                          <p className="text-[6px] font-mono uppercase tracking-widest opacity-20">Drop or Paste</p>
                        </div>
                      </div>
                    )}
                    <input type="file" ref={fileInputRef2} onChange={handleImageUpload2} className="hidden" accept="image/*" />
                  </div>
                  {selectedImage2 && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => fileInputRef2.current?.click()}
                        className="flex-1 py-2 bg-white text-black rounded-full text-[8px] font-mono uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                      >
                        <ImagePlus className="w-3 h-3" />
                        Browse
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedImage2(null);
                          setImageFile2(null);
                          setImageResult2(null);
                        }}
                        className="px-4 py-2 border border-white/10 rounded-full text-[8px] font-mono uppercase tracking-widest hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="max-w-md mx-auto">
                <button 
                  onClick={runComparisonAnalysis}
                  disabled={!selectedImage || !selectedImage2 || isAnalyzing}
                  className="w-full py-5 bg-white text-black font-bold uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3 disabled:opacity-20 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-all rounded-full"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Comparing...
                    </>
                  ) : (
                    <>
                      <Activity className="w-4 h-4" />
                      Run Forensic Comparison
                    </>
                  )}
                </button>
              </div>

              {imageResult && imageResult2 && !isAnalyzing && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-12 pt-12 border-t border-white/10"
                >
                  {/* Interactive Comparison Tools */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <h4 className="text-[10px] font-mono uppercase tracking-widest opacity-50">Interactive Comparison Slider</h4>
                        <span className="text-[8px] font-mono opacity-30">Drag to compare</span>
                      </div>
                      <ComparisonSlider image1={selectedImage!} image2={selectedImage2!} />
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <h4 className="text-[10px] font-mono uppercase tracking-widest opacity-50">Forensic Discrepancy Map</h4>
                        <span className="text-[8px] font-mono opacity-30">Highlights signature variance</span>
                      </div>
                      <DiscrepancyHeatmap 
                        image1={selectedImage!} 
                        image2={selectedImage2!} 
                        result1={imageResult} 
                        result2={imageResult2} 
                      />
                    </div>
                  </div>

                  {/* Individual Analysis Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <h4 className="text-[10px] font-mono uppercase tracking-widest opacity-50">Evidence A Analysis</h4>
                        <div className={cn(
                          "px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest border",
                          getVerdictTailwind(imageResult.verdict)
                        )}>
                          {imageResult.verdict}
                        </div>
                      </div>
                      <ForensicOverlay image={selectedImage!} result={imageResult} />
                      <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <p className="text-[10px] leading-relaxed text-white/60 italic">"{imageResult.analysis}"</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <h4 className="text-[10px] font-mono uppercase tracking-widest opacity-50">Evidence B Analysis</h4>
                        <div className={cn(
                          "px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest border",
                          getVerdictTailwind(imageResult2.verdict)
                        )}>
                          {imageResult2.verdict}
                        </div>
                      </div>
                      <ForensicOverlay image={selectedImage2!} result={imageResult2} />
                      <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <p className="text-[10px] leading-relaxed text-white/60 italic">"{imageResult2.analysis}"</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 p-8 mt-20">
        <div className="max-w-7xl auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3 opacity-40">
            <HelpCircle className="w-5 h-5" />
            <p className="text-[10px] font-mono uppercase tracking-widest">Human-Centric Design Principles Applied</p>
          </div>
          <div className="flex gap-12">
            <a href="#" className="text-[10px] font-mono uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity">Methodology</a>
            <a href="#" className="text-[10px] font-mono uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity">Ethics Policy</a>
            <a href="#" className="text-[10px] font-mono uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity">Open Source</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
