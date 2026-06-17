'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, Upload, Sparkles, Shield, ChevronRight, RotateCcw, Droplets, Sun, Wind, Eye,
  ScanFace, Heart, Star, AlertCircle, Loader2, CheckCircle2, ArrowRight, Zap, RefreshCw,
  Palette, Paintbrush, CircleDot, Layers, Gem, SwatchBook, Activity, Dna, Brain, Flame,
  TrendingUp, Clock, Timer, ArrowDownRight, ArrowUpRight, Minus, FlaskConical, Beaker,
  Microscope, ShieldCheck, Share2, Mail, History, Download, X, ChevronDown, ChevronUp,
  Calendar, Bell, BarChart3, Target, Grid3X3, Ruler, Triangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { SkinAnalysisResult } from './api/analyze/route';
import type { CosmeticsAnalysisResult } from './api/analyze-cosmetics/route';
import type { LongevityAnalysisResult } from './api/analyze-longevity/route';
import type { HeatmapResult } from './api/heatmap/route';
import type { FaceDetectionResult } from '@/lib/faceDetection';
import { detectFace as detectFaceClient } from '@/lib/faceDetection';
import { computeFaceGeometry } from '@/lib/faceGeometry';
import type { FaceGeometryResult } from '@/lib/faceGeometry';

// ─── Types ───────────────────────────────────────────────────
type AppState = 'landing' | 'age-input' | 'upload' | 'analyzing' | 'results' | 'cosmetics-results' | 'longevity-results' | 'history';
type AnalysisType = 'skin' | 'cosmetics' | 'longevity';

interface MetricConfig {
  key: keyof SkinAnalysisResult['metrics'];
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

interface ScanRecord {
  id: string;
  analysisType: string;
  overallScore: number;
  biologicalAge: number | null;
  chronologicalAge: number | null;
  ageGap: number | null;
  longevityScore: number | null;
  longevityCategory: string | null;
  skinType: string | null;
  createdAt: string;
  resultData: SkinAnalysisResult | CosmeticsAnalysisResult | LongevityAnalysisResult;
}

// ─── User ID (browser-persistent) ────────────────────────────
function getUserId(): string {
  if (typeof window === 'undefined') return '';
  let uid = localStorage.getItem('glowscan_uid');
  if (!uid) {
    uid = 'user_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
    localStorage.setItem('glowscan_uid', uid);
  }
  return uid;
}

// ─── Skin Metric Configurations ──────────────────────────────
const METRIC_CONFIGS: MetricConfig[] = [
  { key: 'pores', icon: <Eye className="w-4 h-4" />, color: 'text-rose-500', bgColor: 'bg-rose-50' },
  { key: 'texture', icon: <Wind className="w-4 h-4" />, color: 'text-amber-500', bgColor: 'bg-amber-50' },
  { key: 'redness', icon: <Heart className="w-4 h-4" />, color: 'text-red-500', bgColor: 'bg-red-50' },
  { key: 'hydration', icon: <Droplets className="w-4 h-4" />, color: 'text-sky-500', bgColor: 'bg-sky-50' },
  { key: 'pigmentation', icon: <Sun className="w-4 h-4" />, color: 'text-orange-500', bgColor: 'bg-orange-50' },
  { key: 'radiance', icon: <Sparkles className="w-4 h-4" />, color: 'text-yellow-500', bgColor: 'bg-yellow-50' },
  { key: 'oiliness', icon: <Droplets className="w-4 h-4" />, color: 'text-teal-500', bgColor: 'bg-teal-50' },
  { key: 'fineLines', icon: <ScanFace className="w-4 h-4" />, color: 'text-purple-500', bgColor: 'bg-purple-50' },
  { key: 'firmness', icon: <Zap className="w-4 h-4" />, color: 'text-emerald-500', bgColor: 'bg-emerald-50' },
  { key: 'ageing', icon: <Star className="w-4 h-4" />, color: 'text-pink-500', bgColor: 'bg-pink-50' },
];

// ─── Cosmetics Quality Metrics ──────────────────────────────
const COSMETICS_QUALITY_CONFIGS = [
  { key: 'blending' as const, icon: <Paintbrush className="w-4 h-4" />, color: 'text-violet-500', bgColor: 'bg-violet-50' },
  { key: 'colorMatch' as const, icon: <Palette className="w-4 h-4" />, color: 'text-fuchsia-500', bgColor: 'bg-fuchsia-50' },
  { key: 'symmetry' as const, icon: <CircleDot className="w-4 h-4" />, color: 'text-cyan-500', bgColor: 'bg-cyan-50' },
  { key: 'longevity' as const, icon: <Layers className="w-4 h-4" />, color: 'text-amber-500', bgColor: 'bg-amber-50' },
  { key: 'overallFinish' as const, icon: <Gem className="w-4 h-4" />, color: 'text-rose-500', bgColor: 'bg-rose-50' },
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Face: <Layers className="w-4 h-4" />, Eyes: <Eye className="w-4 h-4" />,
  Lips: <Sparkles className="w-4 h-4" />, Brows: <Paintbrush className="w-4 h-4" />,
};
const CATEGORY_COLORS: Record<string, { color: string; bgColor: string }> = {
  Face: { color: 'text-amber-600', bgColor: 'bg-amber-50' },
  Eyes: { color: 'text-violet-600', bgColor: 'bg-violet-50' },
  Lips: { color: 'text-rose-600', bgColor: 'bg-rose-50' },
  Brows: { color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
};

// ─── Longevity Biomarker Configurations ──────────────────────
const BIOMARKER_CONFIGS = [
  { key: 'collagenIntegrity' as const, icon: <Dna className="w-4 h-4" />, color: 'text-rose-500', bgColor: 'bg-rose-50' },
  { key: 'cellularTurnover' as const, icon: <FlaskConical className="w-4 h-4" />, color: 'text-amber-500', bgColor: 'bg-amber-50' },
  { key: 'oxidativeStress' as const, icon: <Flame className="w-4 h-4" />, color: 'text-orange-500', bgColor: 'bg-orange-50' },
  { key: 'glycationSigns' as const, icon: <Beaker className="w-4 h-4" />, color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
  { key: 'inflammationMarkers' as const, icon: <Activity className="w-4 h-4" />, color: 'text-red-500', bgColor: 'bg-red-50' },
  { key: 'hormonalBalance' as const, icon: <Brain className="w-4 h-4" />, color: 'text-purple-500', bgColor: 'bg-purple-50' },
  { key: 'telomereProxy' as const, icon: <Microscope className="w-4 h-4" />, color: 'text-cyan-600', bgColor: 'bg-cyan-50' },
  { key: 'mitochondrialFunction' as const, icon: <Zap className="w-4 h-4" />, color: 'text-emerald-500', bgColor: 'bg-emerald-50' },
];

// Skin metric to bio age impact mapping
const SKIN_BIO_AGE_MAP: Record<string, { factor: number; label: string }> = {
  pores: { factor: 0.08, label: 'Pore enlargement correlates with collagen loss' },
  texture: { factor: 0.10, label: 'Uneven texture indicates slower cell turnover' },
  redness: { factor: 0.06, label: 'Chronic inflammation accelerates biological aging' },
  hydration: { factor: 0.12, label: 'Dehydration is linked to cellular senescence' },
  pigmentation: { factor: 0.10, label: 'Age spots reflect oxidative DNA damage' },
  radiance: { factor: 0.08, label: 'Dullness indicates mitochondrial decline' },
  oiliness: { factor: 0.04, label: 'Hormonal aging affects sebum production' },
  fineLines: { factor: 0.18, label: 'Wrinkles are the strongest visible aging proxy' },
  firmness: { factor: 0.14, label: 'Loss of firmness = collagen/elastin degradation' },
  ageing: { factor: 0.10, label: 'Overall ageing signs correlate with epigenetic age' },
};

// ─── Helpers ─────────────────────────────────────────────────
function getScoreLevel(score: number): { label: string; color: string } {
  if (score >= 86) return { label: 'Excellent', color: 'text-emerald-600' };
  if (score >= 71) return { label: 'Very Good', color: 'text-green-600' };
  if (score >= 51) return { label: 'Good', color: 'text-yellow-600' };
  if (score >= 31) return { label: 'Fair', color: 'text-orange-600' };
  return { label: 'Needs Attention', color: 'text-red-600' };
}
function getScoreColor(score: number): string {
  if (score >= 86) return '#059669'; if (score >= 71) return '#16a34a';
  if (score >= 51) return '#ca8a04'; if (score >= 31) return '#ea580c'; return '#dc2626';
}

// ─── Score Ring ──────────────────────────────────────────────
function ScoreRing({ score, size = 80, strokeWidth = 6 }: { score: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;
  const color = getScoreColor(score);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#f1f5f9" strokeWidth={strokeWidth} fill="none" />
        <motion.circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round"
          strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

// ─── Score Bar ──────────────────────────────────────────────
function ScoreBar({ score, delay = 0 }: { score: number; delay?: number }) {
  const color = getScoreColor(score);
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
      <motion.div className="h-full rounded-full" style={{ backgroundColor: color }}
        initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 0.8, ease: 'easeOut', delay }} />
    </div>
  );
}

// ─── Age Gap Display ────────────────────────────────────────
function AgeGapDisplay({ gap }: { gap: number }) {
  const isYounger = gap < -3;
  const isOlder = gap > 3;
  const isAppropriate = !isYounger && !isOlder;
  let color = 'text-emerald-600'; let bgColor = 'bg-emerald-50'; let borderColor = 'border-emerald-200';
  let icon = <ArrowDownRight className="w-5 h-5" />; let label = 'Look Younger';
  if (isOlder) { color = 'text-orange-600'; bgColor = 'bg-orange-50'; borderColor = 'border-orange-200'; icon = <ArrowUpRight className="w-5 h-5" />; label = 'Look Older'; }
  else if (isAppropriate) { color = 'text-sky-600'; bgColor = 'bg-sky-50'; borderColor = 'border-sky-200'; icon = <Minus className="w-5 h-5" />; label = 'Age-Appropriate'; }
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border ${bgColor} ${borderColor}`}>
      <div className={color}>{icon}</div>
      <div>
        <p className={`text-2xl font-bold ${color}`}>{gap > 0 ? '+' : ''}{gap} years</p>
        <p className={`text-xs font-medium ${color}`}>{label}</p>
      </div>
    </div>
  );
}

// ─── Hook: measure an image's real aspect ratio so overlays line up 1:1 ──
// The whole "chin/eyes in the wrong place" bug came from forcing every photo
// into a fixed 3/4 box with object-cover (which crops + rescales axes unevenly)
// while landmark coords are %-of-original-image. By sizing the container to the
// image's true ratio and using object-cover (no crop, since ratios match) plus
// an SVG with preserveAspectRatio="none", % coords map exactly onto pixels.
function useImageAspect(src: string | null): number {
  const [ratio, setRatio] = useState(3 / 4);
  useEffect(() => {
    if (!src) return;
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (alive && img.naturalWidth && img.naturalHeight) {
        setRatio(img.naturalWidth / img.naturalHeight);
      }
    };
    img.src = src;
    return () => { alive = false; };
  }, [src]);
  return ratio;
}

// ─── Calculate face zones from detected face data ───────────
function calculateZonesFromFace(face: FaceDetectionResult | null) {
  // Default centered zones (fallback when no face detected)
  const defaultZones = [
    { id: 'forehead', x: 30, y: 8, w: 40, h: 18 },
    { id: 'left-eye', x: 25, y: 26, w: 18, h: 12 },
    { id: 'right-eye', x: 57, y: 26, w: 18, h: 12 },
    { id: 'nose', x: 42, y: 36, w: 16, h: 20 },
    { id: 'left-cheek', x: 20, y: 38, w: 22, h: 22 },
    { id: 'right-cheek', x: 58, y: 38, w: 22, h: 22 },
    { id: 'mouth', x: 36, y: 58, w: 28, h: 12 },
    { id: 'chin', x: 38, y: 70, w: 24, h: 14 },
    { id: 'jawline-left', x: 18, y: 55, w: 14, h: 25 },
    { id: 'jawline-right', x: 68, y: 55, w: 14, h: 25 },
  ];

  if (!face || !face.detected) return defaultZones;

  const { boundingBox: bb, landmarks: lm } = face;

  // Calculate zones dynamically from face bounding box and landmarks
  // Each zone is positioned relative to the actual detected face
  const faceLeft = bb.x;
  const faceRight = bb.x + bb.width;
  const faceTop = bb.y;
  const faceWidth = bb.width;
  const faceHeight = bb.height;
  const faceCenterX = bb.x + bb.width / 2;
  const eyeY = (lm.leftEye.y + lm.rightEye.y) / 2;
  const eyeSpan = Math.abs(lm.rightEye.x - lm.leftEye.x);
  const noseToChin = lm.chinBottom.y - lm.noseTip.y;
  const faceMidY = (eyeY + lm.mouthCenter.y) / 2;

  return [
    // Forehead: from top of face to eye level
    { id: 'forehead', x: faceLeft + faceWidth * 0.1, y: faceTop, w: faceWidth * 0.8, h: eyeY - faceTop },
    // Left eye: centered on left eye landmark
    { id: 'left-eye', x: lm.leftEye.x - eyeSpan * 0.25, y: eyeY - faceHeight * 0.06, w: eyeSpan * 0.5, h: faceHeight * 0.12 },
    // Right eye: centered on right eye landmark
    { id: 'right-eye', x: lm.rightEye.x - eyeSpan * 0.25, y: eyeY - faceHeight * 0.06, w: eyeSpan * 0.5, h: faceHeight * 0.12 },
    // Nose: from between eyes to nose tip
    { id: 'nose', x: lm.noseTip.x - faceWidth * 0.12, y: eyeY + faceHeight * 0.02, w: faceWidth * 0.24, h: lm.noseTip.y - eyeY + faceHeight * 0.04 },
    // Left cheek: between left eye and left jaw
    { id: 'left-cheek', x: faceLeft + faceWidth * 0.02, y: faceMidY - faceHeight * 0.08, w: faceWidth * 0.28, h: faceHeight * 0.22 },
    // Right cheek: between right eye and right jaw
    { id: 'right-cheek', x: faceRight - faceWidth * 0.30, y: faceMidY - faceHeight * 0.08, w: faceWidth * 0.28, h: faceHeight * 0.22 },
    // Mouth: centered on mouth landmark
    { id: 'mouth', x: lm.mouthCenter.x - faceWidth * 0.22, y: lm.mouthCenter.y - faceHeight * 0.05, w: faceWidth * 0.44, h: faceHeight * 0.1 },
    // Chin: from mouth to chin bottom
    { id: 'chin', x: lm.chinBottom.x - faceWidth * 0.18, y: lm.mouthCenter.y + faceHeight * 0.05, w: faceWidth * 0.36, h: lm.chinBottom.y - lm.mouthCenter.y + faceHeight * 0.03 },
    // Left jawline: from cheek to left jaw
    { id: 'jawline-left', x: lm.leftJaw.x - faceWidth * 0.06, y: lm.leftJaw.y - faceHeight * 0.1, w: faceWidth * 0.16, h: noseToChin * 0.85 },
    // Right jawline: from cheek to right jaw
    { id: 'jawline-right', x: lm.rightJaw.x - faceWidth * 0.1, y: lm.rightJaw.y - faceHeight * 0.1, w: faceWidth * 0.16, h: noseToChin * 0.85 },
  ];
}

// ─── Futuristic Scan Overlay (shows during analysis) ────────
function FuturisticScanOverlay({ imageUrl, analysisType, progress, faceData }: { imageUrl: string; analysisType: AnalysisType; progress: number; faceData: FaceDetectionResult | null }) {
  const themeColor = analysisType === 'longevity' ? '#10b981' : analysisType === 'cosmetics' ? '#8b5cf6' : '#f43f5e';
  const aspect = useImageAspect(imageUrl);
  const hasFace = !!(faceData && faceData.detected);

  // Dynamically calculate face zones from detected face data
  const gridZones = useMemo(() => calculateZonesFromFace(faceData), [faceData]);

  const visibleZones = Math.floor((progress / 100) * gridZones.length);

  return (
    <div className="relative w-full max-w-sm mx-auto rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: aspect }}>
      {/* Base image — container matches the photo's real ratio so nothing is cropped */}
      <img src={imageUrl} alt="Scanning" className="w-full h-full object-cover" />

      {/* Scan line animation */}
      <motion.div
        className="absolute left-0 right-0 h-0.5 z-20"
        style={{ background: `linear-gradient(90deg, transparent, ${themeColor}, ${themeColor}, transparent)`, boxShadow: `0 0 20px ${themeColor}, 0 0 60px ${themeColor}40` }}
        animate={{ top: ['0%', '100%'] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
      />

      {/* Grid overlay with detection boxes — preserveAspectRatio="none" makes
          the 0..100 viewBox map exactly onto the (non-square) container. */}
      <svg className="absolute inset-0 w-full h-full z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* Dynamic face bounding box from detection (only when a face is real) */}
        {hasFace && (() => {
          const bb = faceData.boundingBox;
          const bracketLen = 4;
          return (
            <>
              {/* Face bounding box */}
              <motion.rect x={bb.x} y={bb.y} width={bb.width} height={bb.height} fill="none" stroke={themeColor} strokeWidth="0.3" strokeDasharray="2,2" opacity={0.3}
                initial={{ opacity: 0 }} animate={{ opacity: progress > 5 ? 0.3 : 0 }} />
              {/* Corner brackets */}
              <motion.path d={`M ${bb.x},${bb.y + bracketLen} L ${bb.x},${bb.y} L ${bb.x + bracketLen},${bb.y}`} fill="none" stroke={themeColor} strokeWidth="0.5" initial={{ opacity: 0 }} animate={{ opacity: progress > 10 ? 1 : 0 }} />
              <motion.path d={`M ${bb.x + bb.width - bracketLen},${bb.y} L ${bb.x + bb.width},${bb.y} L ${bb.x + bb.width},${bb.y + bracketLen}`} fill="none" stroke={themeColor} strokeWidth="0.5" initial={{ opacity: 0 }} animate={{ opacity: progress > 10 ? 1 : 0 }} />
              <motion.path d={`M ${bb.x},${bb.y + bb.height - bracketLen} L ${bb.x},${bb.y + bb.height} L ${bb.x + bracketLen},${bb.y + bb.height}`} fill="none" stroke={themeColor} strokeWidth="0.5" initial={{ opacity: 0 }} animate={{ opacity: progress > 10 ? 1 : 0 }} />
              <motion.path d={`M ${bb.x + bb.width - bracketLen},${bb.y + bb.height} L ${bb.x + bb.width},${bb.y + bb.height} L ${bb.x + bb.width},${bb.y + bb.height - bracketLen}`} fill="none" stroke={themeColor} strokeWidth="0.5" initial={{ opacity: 0 }} animate={{ opacity: progress > 10 ? 1 : 0 }} />
            </>
          );
        })()}

        {/* Zone detection boxes that appear progressively (only on real detection) */}
        {hasFace && gridZones.map((zone, i) => (
          <motion.g key={zone.id} initial={{ opacity: 0 }} animate={{ opacity: i < visibleZones ? 1 : 0 }} transition={{ duration: 0.3 }}>
            <rect x={zone.x} y={zone.y} width={zone.w} height={zone.h} fill={themeColor + '10'} stroke={themeColor} strokeWidth="0.4" strokeDasharray="1,1" rx="0.5" />
            {/* Detection label */}
            <text x={zone.x + 1} y={zone.y + 3} fill={themeColor} fontSize="2" fontFamily="monospace">{zone.id}</text>
            {/* Corner markers */}
            <line x1={zone.x} y1={zone.y} x2={zone.x + 3} y2={zone.y} stroke={themeColor} strokeWidth="0.4" />
            <line x1={zone.x} y1={zone.y} x2={zone.x} y2={zone.y + 3} stroke={themeColor} strokeWidth="0.4" />
          </motion.g>
        ))}

        {/* Cross-hair at face center */}
        <motion.g initial={{ opacity: 0 }} animate={{ opacity: progress > 20 ? 0.6 : 0 }}>
          {faceData && faceData.detected ? (() => {
            const cx = faceData.boundingBox.x + faceData.boundingBox.width / 2;
            const cy = faceData.boundingBox.y + faceData.boundingBox.height / 2;
            return (
              <>
                <line x1={cx - 2} y1={cy} x2={cx + 2} y2={cy} stroke={themeColor} strokeWidth="0.3" />
                <line x1={cx} y1={cy - 2} x2={cx} y2={cy + 2} stroke={themeColor} strokeWidth="0.3" />
                <circle cx={cx} cy={cy} r="2" fill="none" stroke={themeColor} strokeWidth="0.3" />
              </>
            );
          })() : (
            <>
              <line x1="48" y1="48" x2="52" y2="48" stroke={themeColor} strokeWidth="0.3" />
              <line x1="50" y1="46" x2="50" y2="54" stroke={themeColor} strokeWidth="0.3" />
              <circle cx="50" cy="50" r="2" fill="none" stroke={themeColor} strokeWidth="0.3" />
            </>
          )}
        </motion.g>
      </svg>

      {/* Scan progress overlay text */}
      <div className="absolute top-3 left-3 z-20">
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 text-xs font-mono" style={{ color: themeColor }}>
          <div className="flex items-center gap-1"><Grid3X3 className="w-3 h-3" /> {hasFace ? 'FACE LOCKED' : 'LOCATING FACE'}</div>
          <div>ZONES: {hasFace ? visibleZones : 0}/{gridZones.length}</div>
        </div>
      </div>
      <div className="absolute bottom-3 right-3 z-20">
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 text-xs font-mono" style={{ color: themeColor }}>
          SCAN {Math.round(progress)}%
        </div>
      </div>

      {/* Vignette effect */}
      <div className="absolute inset-0 z-5 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.3) 100%)' }} />
    </div>
  );
}

// ─── Heatmap Overlay (shows on results) ─────────────────────
function HeatmapOverlay({ imageUrl, heatmap, show }: { imageUrl: string; heatmap: HeatmapResult | null; show: boolean }) {
  const aspect = useImageAspect(imageUrl);
  if (!heatmap || !show) return null;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative w-full max-w-sm mx-auto rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: aspect }}>
      <img src={imageUrl} alt="Heatmap" className="w-full h-full object-cover" />
      {/* Heatmap zones */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {heatmap.zones.map((zone) => (
          <g key={zone.id}>
            <rect x={zone.x} y={zone.y} width={zone.width} height={zone.height} fill={zone.color} stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" rx="1">
              <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" />
            </rect>
            <text x={zone.x + zone.width / 2} y={zone.y + zone.height / 2} fill="white" fontSize="2" textAnchor="middle" dominantBaseline="middle" fontWeight="bold" style={{ textShadow: '0 0 2px rgba(0,0,0,0.8)' }}>
              {zone.label.split(' ').pop()}
            </text>
          </g>
        ))}
      </svg>
      {/* Legend */}
      <div className="absolute bottom-2 left-2 right-2 bg-black/70 backdrop-blur-sm rounded-lg p-2">
        <div className="flex items-center justify-between text-white text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: 'rgba(34,197,94,0.7)' }} /><span>Healthy</span>
            <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: 'rgba(234,179,8,0.7)' }} /><span>Mild</span>
            <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: 'rgba(249,115,22,0.7)' }} /><span>Moderate</span>
            <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: 'rgba(239,68,68,0.7)' }} /><span>Concern</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Facial Geometry Overlay (novel: draws real measured guides) ────
function FaceGeometryOverlay({ imageUrl, geometry, show }: { imageUrl: string; geometry: FaceGeometryResult | null; show: boolean }) {
  const aspect = useImageAspect(imageUrl);
  if (!geometry || !geometry.guides || !show) return null;
  const g = geometry.guides;
  const accent = '#22d3ee';
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative w-full max-w-sm mx-auto rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: aspect }}>
      <img src={imageUrl} alt="Facial geometry" className="w-full h-full object-cover" />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* facial thirds (horizontal) */}
        {g.thirds.map((y, i) => (
          <line key={`t${i}`} x1="8" y1={y} x2="92" y2={y} stroke={accent} strokeWidth="0.25" strokeDasharray="1.5,1.5" opacity="0.7" />
        ))}
        {/* facial fifths (vertical) */}
        {g.fifths.map((x, i) => (
          <line key={`f${i}`} x1={x} y1="14" x2={x} y2="92" stroke="#a78bfa" strokeWidth="0.2" strokeDasharray="1,1.5" opacity="0.55" />
        ))}
        {/* symmetry midline */}
        <line x1={g.midline.x1} y1={g.midline.y1} x2={g.midline.x2} y2={g.midline.y2} stroke="#f472b6" strokeWidth="0.4" opacity="0.9" />
        {/* eye axes (canthal tilt) */}
        <line x1={g.leftEyeAxis.x1} y1={g.leftEyeAxis.y1} x2={g.leftEyeAxis.x2} y2={g.leftEyeAxis.y2} stroke={accent} strokeWidth="0.5" />
        <line x1={g.rightEyeAxis.x1} y1={g.rightEyeAxis.y1} x2={g.rightEyeAxis.x2} y2={g.rightEyeAxis.y2} stroke={accent} strokeWidth="0.5" />
        {[g.leftEyeAxis, g.rightEyeAxis].flatMap((a, i) => [
          <circle key={`p${i}a`} cx={a.x1} cy={a.y1} r="0.7" fill={accent} />,
          <circle key={`p${i}b`} cx={a.x2} cy={a.y2} r="0.7" fill={accent} />,
        ])}
      </svg>
      <div className="absolute top-2 left-2 bg-black/65 backdrop-blur-sm rounded-lg px-2 py-1 text-[10px] font-mono text-cyan-300">
        <div className="flex items-center gap-1"><Ruler className="w-3 h-3" /> GEOMETRY MAP</div>
        <div>HARMONY {geometry.overallHarmony}/100</div>
      </div>
    </motion.div>
  );
}

// ─── Facial Harmony Card (deterministic geometry breakdown) ─────────
function FacialHarmonyCard({ geometry, accentFrom, accentTo }: { geometry: FaceGeometryResult; accentFrom: string; accentTo: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const scoreColor = (s: number) => s >= 80 ? 'text-emerald-500' : s >= 60 ? 'text-cyan-500' : s >= 40 ? 'text-amber-500' : 'text-rose-500';
  const barColor = (s: number) => s >= 80 ? 'bg-emerald-400' : s >= 60 ? 'bg-cyan-400' : s >= 40 ? 'bg-amber-400' : 'bg-rose-400';
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Triangle className={`w-4 h-4 bg-gradient-to-br ${accentFrom} ${accentTo} bg-clip-text`} style={{ color: '#06b6d4' }} />
          <span className="font-semibold text-gray-800 text-sm">Facial Geometry &amp; Harmony</span>
        </div>
        <span className={`text-lg font-bold ${scoreColor(geometry.overallHarmony)}`}>{geometry.overallHarmony}<span className="text-xs text-gray-400">/100</span></span>
      </div>
      <p className="text-[11px] text-gray-400 -mt-1">Measured directly from your facial landmarks — reproducible, not an AI guess.</p>
      <div className="space-y-2">
        {geometry.metrics.map((m) => (
          <div key={m.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <button className="w-full flex items-center gap-3 p-2.5 text-left" onClick={() => setOpen(open === m.id ? null : m.id)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-gray-700 truncate">{m.label}</span>
                  <span className="text-xs font-mono text-gray-500 shrink-0">{m.value}{m.unit === 'deg' ? '°' : m.unit === '%' ? '%' : m.unit === 'ratio' ? '' : ''}</span>
                </div>
                <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${barColor(m.score)}`} style={{ width: `${m.score}%` }} />
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-300 transition-transform shrink-0 ${open === m.id ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {open === m.id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="px-2.5 pb-2.5 text-[11px] text-gray-500 space-y-1">
                    <p>{m.insight}</p>
                    <p className="text-gray-400">Reference: <span className="font-medium text-gray-600">{m.ideal}</span></p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShareableBioAgeCard({ result, onDownload }: { result: LongevityAnalysisResult; onDownload: () => void }) {
  const isYounger = result.ageGap < 0;
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative">
      <div ref={cardRef} className="w-[360px] mx-auto rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}>
        {/* Top accent bar */}
        <div className="h-1" style={{ background: 'linear-gradient(90deg, #10b981, #14b8a6, #06b6d4)' }} />
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #10b981, #14b8a6)' }}>
                <Dna className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-bold text-sm">GlowScan AI</span>
            </div>
            <span className="text-slate-500 text-xs font-mono">BIO AGE REPORT</span>
          </div>

          {/* Age display */}
          <div className="flex items-center justify-center gap-8 mb-4">
            <div className="text-center">
              <p className="text-slate-500 text-xs mb-1">Chronological</p>
              <p className="text-slate-400 text-3xl font-bold">{result.chronologicalAge}</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center border-2" style={{ borderColor: isYounger ? '#10b981' : result.ageGap <= 3 ? '#0ea5e9' : '#f97316', background: isYounger ? '#10b98115' : result.ageGap <= 3 ? '#0ea5e915' : '#f9731615' }}>
                <span className="text-2xl font-bold" style={{ color: isYounger ? '#10b981' : result.ageGap <= 3 ? '#0ea5e9' : '#f97316' }}>{result.biologicalAge}</span>
              </div>
              <p className="text-xs mt-1" style={{ color: isYounger ? '#10b981' : result.ageGap <= 3 ? '#0ea5e9' : '#f97316' }}>
                Bio Age
              </p>
            </div>
            <div className="text-center">
              <p className="text-slate-500 text-xs mb-1">Age Gap</p>
              <p className="text-2xl font-bold" style={{ color: isYounger ? '#10b981' : result.ageGap <= 3 ? '#0ea5e9' : '#f97316' }}>
                {result.ageGap > 0 ? '+' : ''}{result.ageGap}yr
              </p>
            </div>
          </div>

          {/* Longevity Score bar */}
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Longevity Score</span>
              <span style={{ color: isYounger ? '#10b981' : '#0ea5e9' }}>{result.longevityScore}/100</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${result.longevityScore}%`, background: 'linear-gradient(90deg, #10b981, #14b8a6, #06b6d4)' }} />
            </div>
          </div>

          {/* Top 3 biomarkers */}
          <div className="grid grid-cols-4 gap-1 mb-4">
            {Object.entries(result.biomarkers).slice(0, 4).map(([key, bm]) => (
              <div key={key} className="text-center bg-slate-800/50 rounded-lg py-1.5 px-1">
                <p className="text-xs font-bold" style={{ color: getScoreColor(bm.score) }}>{bm.score}</p>
                <p className="text-slate-500 text-[9px] leading-tight">{bm.label.split(' ').slice(0, 2).join(' ')}</p>
              </div>
            ))}
          </div>

          {/* Category badge */}
          <div className="flex items-center justify-between">
            <Badge className="text-xs" style={{ backgroundColor: isYounger ? '#10b98120' : '#0ea5e920', color: isYounger ? '#10b981' : '#0ea5e9', border: `1px solid ${isYounger ? '#10b98140' : '#0ea5e940'}` }}>
              {result.longevityCategory}
            </Badge>
            <span className="text-slate-600 text-[10px] font-mono">glowscan.ai</span>
          </div>
        </div>
      </div>
      <Button variant="outline" size="sm" className="mt-3 gap-2 w-full rounded-xl" onClick={onDownload}>
        <Download className="w-4 h-4" /> Save Card as Image
      </Button>
    </div>
  );
}

// ─── Email Reminder Dialog ──────────────────────────────────
function EmailReminderDialog({ scanId, userId }: { scanId: string; userId: string }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSave = async () => {
    if (!email) return;
    setLoading(true);
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, email, scanId, monthsAhead: 3 }),
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
        toast.success(data.message || 'Reminder set!');
      } else {
        toast.error(data.error || 'Failed to set reminder');
      }
    } catch {
      toast.error('Failed to set reminder');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50">
          <Bell className="w-4 h-4" /> Remind Me
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Calendar className="w-5 h-5 text-emerald-500" /> Set a Re-check Reminder</DialogTitle>
        </DialogHeader>
        {done ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <p className="font-semibold text-gray-900 mb-1">Reminder Set!</p>
            <p className="text-sm text-gray-500">We&apos;ll email you in 3 months to re-check your bio age.</p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-500">Enter your email and we&apos;ll remind you to re-check your biological age in 3 months. Track how your lifestyle changes affect your visible aging.</p>
            <div>
              <Label htmlFor="reminder-email" className="text-sm font-medium">Email address</Label>
              <Input id="reminder-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 h-11 rounded-xl border-emerald-200 focus:border-emerald-400 focus:ring-emerald-400" />
            </div>
            <Button className="w-full gap-2 h-11 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl" onClick={handleSave} disabled={!email || loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
              Set 3-Month Reminder
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Scan History Page ──────────────────────────────────────
function ScanHistoryPage({ userId, onBack, onLoadResult }: { userId: string; onBack: () => void; onLoadResult: (type: AnalysisType, result: SkinAnalysisResult | CosmeticsAnalysisResult | LongevityAnalysisResult) => void }) {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchScans = async () => {
      try {
        const res = await fetch(`/api/scans?userId=${userId}`);
        const data = await res.json();
        if (res.ok) setScans(data.scans);
      } catch (err) {
        console.error('Failed to load scan history:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchScans();
  }, [userId]);

  const longevityScans = scans.filter((s) => s.analysisType === 'longevity');

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white via-emerald-50/20 to-white">
      <header className="w-full px-6 py-4 sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-gray-500"><RotateCcw className="w-4 h-4" /> Back</Button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center"><Dna className="w-4 h-4 text-white" /></div>
              <span className="font-bold bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">Scan History</span>
            </div>
          </div>
          <Badge className="px-3 py-1 bg-emerald-50 text-emerald-600 border-emerald-200">{scans.length} Scans</Badge>
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-5xl mx-auto">
          {loading ? (
            <div className="text-center py-20"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-4" /><p className="text-gray-500">Loading your scan history...</p></div>
          ) : scans.length === 0 ? (
            <div className="text-center py-20">
              <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">No Scans Yet</h3>
              <p className="text-gray-500 mb-6">Start your first scan to begin tracking your progress over time.</p>
              <Button onClick={onBack} className="gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white"><ArrowRight className="w-4 h-4" /> Start First Scan</Button>
            </div>
          ) : (
            <>
              {/* Bio Age Timeline (if longevity scans exist) */}
              {longevityScans.length >= 2 && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-500" /> Biological Age Timeline</h3>
                  <Card className="border-0 shadow-sm rounded-2xl">
                    <CardContent className="p-6">
                      <div className="flex items-end justify-between gap-2 h-40">
                        {longevityScans.reverse().map((scan, i) => {
                          const bioAge = scan.biologicalAge || 0;
                          const chronoAge = scan.chronologicalAge || 0;
                          const maxAge = Math.max(bioAge, chronoAge) + 5;
                          const bioHeight = (bioAge / maxAge) * 100;
                          const chronoHeight = (chronoAge / maxAge) * 100;
                          return (
                            <div key={scan.id} className="flex-1 flex flex-col items-center gap-1">
                              <div className="w-full flex items-end justify-center gap-1 h-32">
                                <div className="w-4 bg-gray-200 rounded-t" style={{ height: `${chronoHeight}%` }} title={`Chronological: ${chronoAge}`} />
                                <div className="w-4 rounded-t" style={{ height: `${bioHeight}%`, backgroundColor: bioAge <= chronoAge ? '#10b981' : '#f97316' }} title={`Biological: ${bioAge}`} />
                              </div>
                              <p className="text-[10px] text-gray-400">{new Date(scan.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</p>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><span className="w-3 h-2 bg-gray-200 rounded" /> Chronological</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-2 bg-emerald-500 rounded" /> Biological</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* All Scans List */}
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-emerald-500" /> All Scans</h3>
              <div className="space-y-3">
                {scans.map((scan, i) => (
                  <motion.div key={scan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Card className="border-0 shadow-sm rounded-xl cursor-pointer hover:shadow-md transition-shadow" onClick={() => onLoadResult(scan.analysisType as AnalysisType, scan.resultData)}>
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${scan.analysisType === 'longevity' ? 'bg-emerald-50 text-emerald-500' : scan.analysisType === 'cosmetics' ? 'bg-violet-50 text-violet-500' : 'bg-rose-50 text-rose-500'}`}>
                          {scan.analysisType === 'longevity' ? <Dna className="w-5 h-5" /> : scan.analysisType === 'cosmetics' ? <Palette className="w-5 h-5" /> : <ScanFace className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm text-gray-900 capitalize">{scan.analysisType} Analysis</p>
                            {scan.biologicalAge && <Badge className="text-xs bg-emerald-50 text-emerald-600 border-emerald-200">Bio Age: {scan.biologicalAge}</Badge>}
                            {scan.skinType && <Badge className="text-xs bg-rose-50 text-rose-600 border-rose-200">{scan.skinType}</Badge>}
                          </div>
                          <p className="text-xs text-gray-400">{new Date(scan.createdAt).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-xl font-bold ${getScoreLevel(scan.overallScore).color}`}>{scan.overallScore}</p>
                          <p className="text-xs text-gray-400">Score</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Landing Page ───────────────────────────────────────────
function LandingPage({ onStart, onHistory }: { onStart: (type: AnalysisType) => void; onHistory: () => void }) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white via-rose-50/30 to-white">
      <header className="w-full px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-rose-500 to-pink-600 bg-clip-text text-transparent">GlowScan AI</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onHistory} className="gap-1 text-gray-500 hover:text-emerald-600"><History className="w-4 h-4" /> History</Button>
            <Badge variant="secondary" className="text-xs font-medium px-3 py-1 bg-rose-50 text-rose-600 border-rose-200">Free Analysis</Badge>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-3xl mx-auto text-center">
          <Badge className="mb-6 px-4 py-1.5 bg-rose-50 text-rose-600 border-rose-200 text-sm">AI-Powered Beauty &amp; Longevity Analysis</Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 mb-6">
            Know Your Skin,{' '}
            <span className="bg-gradient-to-r from-violet-500 to-fuchsia-600 bg-clip-text text-transparent">Makeup</span>
            {' '}&amp;{' '}
            <span className="bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">Biological Age</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 mb-10 max-w-xl mx-auto leading-relaxed">
            Upload a selfie for skin health scores, cosmetics analysis, or a cutting-edge biological age assessment using facial longevity biomarkers.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Card className="border-2 border-rose-200 shadow-md hover:shadow-lg transition-shadow cursor-pointer rounded-2xl bg-gradient-to-br from-white to-rose-50/50 h-full" onClick={() => onStart('skin')}>
                <CardContent className="p-5 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center mx-auto mb-3">
                    <ScanFace className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1">Skin Analysis</h3>
                  <p className="text-xs text-gray-500 mb-3">10 skin health metrics + heatmap</p>
                  <Button className="w-full gap-1 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-xl text-sm">
                    Scan Skin <ArrowRight className="w-3 h-3" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Card className="border-2 border-violet-200 shadow-md hover:shadow-lg transition-shadow cursor-pointer rounded-2xl bg-gradient-to-br from-white to-violet-50/50 h-full" onClick={() => onStart('cosmetics')}>
                <CardContent className="p-5 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-400 to-fuchsia-500 flex items-center justify-center mx-auto mb-3">
                    <Palette className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1">Cosmetics</h3>
                  <p className="text-xs text-gray-500 mb-3">Detect &amp; rate makeup</p>
                  <Button className="w-full gap-1 bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:from-violet-600 hover:to-fuchsia-700 text-white rounded-xl text-sm">
                    Analyze <ArrowRight className="w-3 h-3" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Card className="border-2 border-emerald-200 shadow-md hover:shadow-lg transition-shadow cursor-pointer rounded-2xl bg-gradient-to-br from-white to-emerald-50/50 h-full" onClick={() => onStart('longevity')}>
                <CardContent className="p-5 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mx-auto mb-3">
                    <Dna className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1">Bio Age</h3>
                  <p className="text-xs text-gray-500 mb-3">Epigenetic clock + heatmap</p>
                  <Button className="w-full gap-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-sm">
                    Check Age <ArrowRight className="w-3 h-3" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <p className="text-xs text-gray-400 mt-6 flex items-center justify-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            Cosmetic analysis only &bull; Not a medical diagnosis &bull; Your photo stays private
          </p>
        </motion.div>
      </main>

      <footer className="px-6 py-6 text-center">
        <p className="text-xs text-gray-400">GlowScan AI &mdash; Cosmetic skin, makeup &amp; longevity assessment.</p>
      </footer>
    </div>
  );
}

// ─── Age Input Page (Longevity only) ────────────────────────
function AgeInputPage({ onSubmit, onBack }: { onSubmit: (age: number) => void; onBack: () => void }) {
  const [age, setAge] = useState('');

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white via-emerald-50/30 to-white">
      <header className="w-full px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-gray-500"><RotateCcw className="w-4 h-4" /> Back</Button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center"><Dna className="w-4 h-4 text-white" /></div>
            <span className="font-bold bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">GlowScan AI</span>
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mx-auto mb-4"><Dna className="w-8 h-8 text-white" /></div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Biological Age Analysis</h2>
            <p className="text-gray-500">We need your actual age to calculate your biological age gap</p>
          </div>
          <Card className="border-0 shadow-md rounded-2xl">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="age" className="text-sm font-medium text-gray-700 mb-2 block">How old are you?</Label>
                  <Input id="age" type="number" placeholder="Enter your age" min={10} max={120} value={age} onChange={(e) => setAge(e.target.value)}
                    className="h-12 text-lg rounded-xl border-emerald-200 focus:border-emerald-400 focus:ring-emerald-400" />
                  <p className="text-xs text-gray-400 mt-2">This is used only to calculate your age gap and is not stored</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-emerald-800 mb-2">How it works</h4>
                  <ul className="space-y-1.5 text-xs text-emerald-700">
                    <li className="flex items-start gap-1.5"><Dna className="w-3 h-3 mt-0.5 shrink-0" />AI analyzes 8 facial longevity biomarkers (collagen, oxidative stress, glycation, etc.)</li>
                    <li className="flex items-start gap-1.5"><FlaskConical className="w-3 h-3 mt-0.5 shrink-0" />Estimates your epigenetic biological age from visible facial proxies</li>
                    <li className="flex items-start gap-1.5"><TrendingUp className="w-3 h-3 mt-0.5 shrink-0" />Calculates your age gap — whether you look younger or older than your years</li>
                  </ul>
                </div>
                <Button className="w-full h-12 gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-base font-semibold"
                  disabled={!age || Number(age) < 10 || Number(age) > 120} onClick={() => onSubmit(Number(age))}>
                  Continue to Upload <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-400 flex items-center justify-center gap-1"><ShieldCheck className="w-3 h-3" />Based on visible facial proxies only. Not a substitute for clinical epigenetic testing (Horvath clock, GrimAge, etc.)</p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

// ─── Upload Page ────────────────────────────────────────────
function UploadPage({ analysisType, onImageSelected, onBack, onFaceDetected }: { analysisType: AnalysisType; onImageSelected: (dataUrl: string) => void; onBack: () => void; onFaceDetected: (face: FaceDetectionResult) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [faceStatus, setFaceStatus] = useState<'idle' | 'detecting' | 'detected' | 'not-found'>('idle');
  const previewAspect = useImageAspect(preview);

  const themeMap = {
    skin: { from: 'from-rose-500', to: 'to-pink-600', border: 'border-rose-200', text: 'text-rose-600', bg: 'bg-rose-50', hoverBg: 'hover:bg-rose-50/30', hoverBorder: 'hover:border-rose-300', activeBorder: 'border-rose-400', activeBg: 'bg-rose-50/50', icon: <ScanFace className="w-9 h-9 text-rose-400" />, color: '#f43f5e' },
    cosmetics: { from: 'from-violet-500', to: 'to-fuchsia-600', border: 'border-violet-200', text: 'text-violet-600', bg: 'bg-violet-50', hoverBg: 'hover:bg-violet-50/30', hoverBorder: 'hover:border-violet-300', activeBorder: 'border-violet-400', activeBg: 'bg-violet-50/50', icon: <Upload className="w-9 h-9 text-violet-400" />, color: '#8b5cf6' },
    longevity: { from: 'from-emerald-500', to: 'to-teal-600', border: 'border-emerald-200', text: 'text-emerald-600', bg: 'bg-emerald-50', hoverBg: 'hover:bg-emerald-50/30', hoverBorder: 'hover:border-emerald-300', activeBorder: 'border-emerald-400', activeBg: 'bg-emerald-50/50', icon: <Upload className="w-9 h-9 text-emerald-400" />, color: '#10b981' },
  };
  const t = themeMap[analysisType];
  const titles = { skin: 'Upload Your Selfie', cosmetics: 'Upload Your Makeup Selfie', longevity: 'Upload Your Selfie' };
  const subtitles = { skin: 'Use a clear, front-facing photo with natural lighting', cosmetics: 'A clear photo with your makeup visible works best', longevity: 'No makeup, natural lighting — best for biological age analysis' };
  const btnText = { skin: 'Analyze My Skin', cosmetics: 'Analyze My Makeup', longevity: 'Estimate Bio Age' };
  const btnIcon = { skin: <Sparkles className="w-4 h-4" />, cosmetics: <Palette className="w-4 h-4" />, longevity: <Dna className="w-4 h-4" /> };
  const tips = {
    skin: [{ icon: '☀️', tip: 'Use natural daylight' }, { icon: '📱', tip: 'Front-facing camera' }, { icon: '🧹', tip: 'Clean face, no makeup' }, { icon: '📏', tip: 'Center your face' }],
    cosmetics: [{ icon: '💡', tip: 'Good lighting shows makeup' }, { icon: '📱', tip: 'Front-facing camera' }, { icon: '🎨', tip: 'Wear your full makeup' }, { icon: '📏', tip: 'Center your face' }],
    longevity: [{ icon: '☀️', tip: 'Natural daylight only' }, { icon: '🧹', tip: 'No makeup at all' }, { icon: '😊', tip: 'Neutral expression' }, { icon: '📏', tip: 'Full face, straight on' }],
  };

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      // Run face detection immediately on the uploaded image
      setFaceStatus('detecting');
      setDetecting(true);
      try {
        const faceResult = await detectFaceClient(dataUrl);
        if (faceResult && faceResult.detected) {
          setFaceStatus('detected');
          onFaceDetected(faceResult);
        } else {
          setFaceStatus('not-found');
        }
      } catch {
        setFaceStatus('not-found');
      } finally {
        setDetecting(false);
      }
    };
    reader.readAsDataURL(file);
  }, [onFaceDetected]);

  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }, [handleFile]);
  const handleDrag = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true); else if (e.type === 'dragleave') setDragActive(false); }, []);
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) handleFile(f); }, [handleFile]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white via-rose-50/30 to-white">
      <header className="w-full px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-gray-500"><RotateCcw className="w-4 h-4" /> Back</Button>
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${t.from} ${t.to} flex items-center justify-center`}><Sparkles className="w-4 h-4 text-white" /></div>
            <span className={`font-bold bg-gradient-to-r ${t.from} ${t.to} bg-clip-text text-transparent`}>GlowScan AI</span>
          </div>
          <Badge className={`ml-auto px-3 py-1 ${t.bg} ${t.text} ${t.border}`}>{analysisType === 'longevity' ? 'Bio Age' : analysisType === 'cosmetics' ? 'Cosmetics' : 'Skin'} Analysis</Badge>
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{titles[analysisType]}</h2>
            <p className="text-gray-500">{subtitles[analysisType]}</p>
          </div>
          {!preview ? (
            <div onDrop={handleDrop} onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag}
              className={`relative border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer ${dragActive ? `${t.activeBorder} ${t.activeBg} scale-[1.02]` : `border-gray-200 bg-white ${t.hoverBorder} ${t.hoverBg}`}`}
              onClick={() => fileInputRef.current?.click()}>
              <div className={`w-20 h-20 rounded-2xl ${t.bg} flex items-center justify-center mx-auto mb-6`}>{t.icon}</div>
              <p className="text-lg font-semibold text-gray-700 mb-1">Drag &amp; drop your selfie here</p>
              <p className="text-sm text-gray-400 mb-6">or click to browse &bull; JPG, PNG, WebP</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button type="button" variant="outline" className={`gap-2 rounded-xl ${t.border} ${t.text} ${analysisType === 'cosmetics' ? 'hover:bg-violet-50' : analysisType === 'longevity' ? 'hover:bg-emerald-50' : 'hover:bg-rose-50'}`}
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}><Upload className="w-4 h-4" /> Upload Photo</Button>
                <Button type="button" className={`gap-2 rounded-xl bg-gradient-to-r ${t.from} ${t.to} text-white`}
                  onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}><Camera className="w-4 h-4" /> Take Selfie</Button>
              </div>
              <p className="text-xs text-gray-400 mt-3 flex items-center justify-center gap-1"><ScanFace className="w-3 h-3" /> AI will automatically detect and map your facial zones</p>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
              <div className="relative rounded-3xl overflow-hidden bg-gray-100 max-w-sm mx-auto" style={{ aspectRatio: previewAspect }}>
                <img src={preview} alt="Selfie preview" className="w-full h-full object-cover" />
                <div className="absolute top-3 right-3">
                  <Button size="icon" variant="secondary" className="rounded-full w-8 h-8 bg-white/80 backdrop-blur hover:bg-white" onClick={() => { setPreview(null); setFaceStatus('idle'); }}><RotateCcw className="w-4 h-4" /></Button>
                </div>
                {/* Face detection status badge */}
                <div className="absolute top-3 left-3">
                  {faceStatus === 'detecting' && (
                    <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-xs font-mono">
                      <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                      <span className="text-amber-400">Detecting face...</span>
                    </div>
                  )}
                  {faceStatus === 'detected' && (
                    <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-xs font-mono">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Face detected</span>
                    </div>
                  )}
                  {faceStatus === 'not-found' && (
                    <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-xs font-mono">
                      <AlertCircle className="w-3 h-3 text-amber-400" />
                      <span className="text-amber-400">Face not found</span>
                    </div>
                  )}
                </div>
              </div>
              {faceStatus === 'not-found' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                  <p className="text-sm text-amber-700">No face detected. Try a clearer, front-facing photo with good lighting.</p>
                </div>
              )}
              <div className="flex gap-3 justify-center">
                <Button variant="outline" className="gap-2 rounded-xl" onClick={() => { setPreview(null); setFaceStatus('idle'); }}><RotateCcw className="w-4 h-4" /> Retake</Button>
                <Button className={`gap-2 rounded-xl bg-gradient-to-r ${t.from} ${t.to} text-white px-8`}
                  onClick={() => onImageSelected(preview)}>{btnIcon[analysisType]} {btnText[analysisType]}</Button>
              </div>
            </motion.div>
          )}
          {!preview && (
            <div className="mt-8 grid grid-cols-2 gap-3">
              {tips[analysisType].map((item, i) => (
                <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-white border border-gray-100 text-sm">
                  <span>{item.icon}</span><span className="text-gray-600">{item.tip}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleInputChange} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleInputChange} />
    </div>
  );
}

// ─── Analyzing Page (with futuristic overlay) ───────────────
function AnalyzingPage({ analysisType, progress, imageUrl, faceData }: { analysisType: AnalysisType; progress: number; imageUrl: string; faceData: FaceDetectionResult | null }) {
  const themeMap = { skin: { from: 'from-rose-400', to: 'to-pink-500', bg: 'bg-rose-100', text: 'text-rose-500', dashed: 'border-pink-300', icon: <ScanFace className="w-12 h-12 text-rose-500" /> },
    cosmetics: { from: 'from-violet-400', to: 'to-fuchsia-500', bg: 'bg-violet-100', text: 'text-violet-500', dashed: 'border-fuchsia-300', icon: <Palette className="w-12 h-12 text-violet-500" /> },
    longevity: { from: 'from-emerald-400', to: 'to-teal-500', bg: 'bg-emerald-100', text: 'text-emerald-500', dashed: 'border-teal-300', icon: <Dna className="w-12 h-12 text-emerald-500" /> } };
  const t = themeMap[analysisType];

  const stepsMap = {
    skin: [{ label: 'Detecting face landmarks', threshold: 20 }, { label: 'Analyzing skin texture', threshold: 40 }, { label: 'Evaluating pore visibility', threshold: 55 }, { label: 'Measuring hydration signs', threshold: 70 }, { label: 'Generating heatmap', threshold: 85 }, { label: 'Generating your report', threshold: 95 }],
    cosmetics: [{ label: 'Detecting face & makeup', threshold: 15 }, { label: 'Identifying cosmetic products', threshold: 30 }, { label: 'Evaluating application quality', threshold: 50 }, { label: 'Analyzing color matching', threshold: 70 }, { label: 'Generating your report', threshold: 90 }],
    longevity: [{ label: 'Detecting facial landmarks', threshold: 15 }, { label: 'Analyzing collagen & elasticity', threshold: 30 }, { label: 'Evaluating epigenetic indicators', threshold: 50 }, { label: 'Assessing longevity biomarkers', threshold: 70 }, { label: 'Generating heatmap', threshold: 85 }, { label: 'Calculating biological age', threshold: 95 }],
  };
  const steps = stepsMap[analysisType];
  const currentStep = steps.findIndex((s) => progress < s.threshold) ?? steps.length;
  const titles = { skin: 'Analyzing Your Skin', cosmetics: 'Analyzing Your Makeup', longevity: 'Estimating Biological Age' };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-8">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">{titles[analysisType]}</h2>

        {/* Futuristic scan overlay on the image */}
        <FuturisticScanOverlay imageUrl={imageUrl} analysisType={analysisType} progress={progress} faceData={faceData} />

        {/* Progress bar */}
        <div className="w-full max-w-xs mx-auto mt-6 mb-4">
          <Progress value={progress} className={`h-2 ${analysisType === 'longevity' ? 'bg-emerald-900' : analysisType === 'cosmetics' ? 'bg-violet-900' : 'bg-rose-900'}`} />
          <p className="text-xs text-slate-500 mt-2 text-center">{Math.round(progress)}% complete</p>
        </div>

        {/* Step list */}
        <div className="space-y-2 mt-4">
          {steps.map((step, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.2 }}
              className={`flex items-center gap-2 text-sm ${i < currentStep ? 'text-emerald-400' : i === currentStep ? `${t.text} font-medium` : 'text-slate-600'}`}>
              {i < currentStep ? <CheckCircle2 className="w-4 h-4" /> : i === currentStep ? <Loader2 className="w-4 h-4 animate-spin" /> : <div className="w-4 h-4 rounded-full border border-slate-700" />}
              {step.label}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Skin Results Page (with bio age integration + heatmap) ──
function SkinResultsPage({ result, onNewScan, heatmap, imageUrl, userId, faceData }: {
  result: SkinAnalysisResult; onNewScan: () => void; heatmap: HeatmapResult | null; imageUrl: string; userId: string; faceData: FaceDetectionResult | null;
}) {
  const [activeMetric, setActiveMetric] = useState<keyof SkinAnalysisResult['metrics'] | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showGeometry, setShowGeometry] = useState(false);
  const geometry = useMemo(() => computeFaceGeometry(faceData), [faceData]);

  // Calculate a rough bio age estimate from skin metrics
  const bioAgeEstimate = useMemo(() => {
    const metricKeys = Object.keys(result.metrics) as Array<keyof typeof result.metrics>;
    let weightedSum = 0;
    let totalFactor = 0;
    for (const key of metricKeys) {
      const factor = SKIN_BIO_AGE_MAP[key]?.factor || 0.1;
      const score = result.metrics[key].score;
      weightedSum += (100 - score) * factor;
      totalFactor += factor;
    }
    const avgAging = weightedSum / totalFactor;
    const ageOffset = Math.round(avgAging * 0.4 - 5);
    return 30 + ageOffset;
  }, [result]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white via-rose-50/20 to-white">
      <header className="w-full px-6 py-4 sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center"><Sparkles className="w-4 h-4 text-white" /></div>
            <span className="font-bold bg-gradient-to-r from-rose-500 to-pink-600 bg-clip-text text-transparent">GlowScan AI</span></div>
          <Button variant="outline" size="sm" onClick={onNewScan} className="gap-2 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50"><RefreshCw className="w-4 h-4" /> New Scan</Button>
        </div>
      </header>
      <main className="flex-1 px-6 py-8"><div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-4"><Badge className="px-3 py-1 bg-rose-50 text-rose-600 border-rose-200">{result.skinType} Skin</Badge><Badge className="px-3 py-1 bg-gray-50 text-gray-600 border-gray-200">Skin Analysis</Badge></div>
          <div className="flex justify-center mb-4"><ScoreRing score={result.overallScore} size={140} strokeWidth={10} /></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Skin Score: {result.overallScore}/100</h2>
          <p className={`text-lg font-medium ${getScoreLevel(result.overallScore).color}`}>{getScoreLevel(result.overallScore).label}</p>

          {/* Bio Age Estimate from Skin */}
          {bioAgeEstimate && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-6 inline-block">
              <Card className="border-0 shadow-sm rounded-2xl bg-gradient-to-r from-rose-50 to-emerald-50 inline-block">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center"><Dna className="w-5 h-5 text-white" /></div>
                  <div className="text-left">
                    <p className="text-xs text-gray-500">Estimated Bio Age from Skin</p>
                    <p className="text-2xl font-bold text-emerald-600">{bioAgeEstimate} <span className="text-sm font-normal text-gray-400">years</span></p>
                    <p className="text-xs text-gray-400">Based on your skin metric scores</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <p className="text-gray-500 mt-4 max-w-md mx-auto">{result.summary}</p>
        </motion.div>

        {/* Facial Geometry (deterministic, novel) */}
        {geometry && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Ruler className="w-5 h-5 text-cyan-500" /> Facial Geometry</h3>
              <Button variant="outline" size="sm" className="gap-1 rounded-xl" onClick={() => setShowGeometry(!showGeometry)}>
                {showGeometry ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showGeometry ? 'Hide' : 'Show'} Map
              </Button>
            </div>
            <AnimatePresence>
              {showGeometry && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="grid md:grid-cols-2 gap-5 items-start">
                    <FaceGeometryOverlay imageUrl={imageUrl} geometry={geometry} show={true} />
                    <FacialHarmonyCard geometry={geometry} accentFrom="from-cyan-400" accentTo="to-sky-500" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Heatmap Toggle + Display */}
        {heatmap && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Target className="w-5 h-5 text-rose-500" /> Skin Health Heatmap</h3>
              <Button variant="outline" size="sm" className="gap-1 rounded-xl" onClick={() => setShowHeatmap(!showHeatmap)}>
                {showHeatmap ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showHeatmap ? 'Hide' : 'Show'} Heatmap
              </Button>
            </div>
            <AnimatePresence>
              {showHeatmap && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <HeatmapOverlay imageUrl={imageUrl} heatmap={heatmap} show={true} />
                  {/* Zone details */}
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {heatmap.zones.map((zone) => (
                      <div key={zone.id} className="bg-white rounded-xl p-2 border border-gray-100">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-700">{zone.label}</span>
                          <span className={`text-xs font-bold ${zone.intensity < 0.3 ? 'text-emerald-500' : zone.intensity < 0.5 ? 'text-yellow-500' : zone.intensity < 0.7 ? 'text-orange-500' : 'text-red-500'}`}>
                            {Math.round(zone.intensity * 100)}%
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 line-clamp-1">{zone.description}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Skin Metrics with Bio Age Impact */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-10">
          <h3 className="text-lg font-bold text-gray-900 mb-2">Skin Metrics</h3>
          <p className="text-sm text-gray-500 mb-4">Click any metric to see how it impacts your biological age</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {METRIC_CONFIGS.map((config, i) => {
              const metric = result.metrics[config.key];
              const bioImpact = SKIN_BIO_AGE_MAP[config.key];
              const ageContribution = Math.round((100 - metric.score) * (bioImpact?.factor || 0.1) * 0.4);
              return (
                <motion.div key={config.key} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.04 }}>
                  <Card className={`border-0 shadow-sm rounded-2xl cursor-pointer transition-all hover:shadow-md ${activeMetric === config.key ? 'ring-2 ring-rose-300' : ''}`}
                    onClick={() => setActiveMetric(activeMetric === config.key ? null : config.key)}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center ${config.color}`}>{config.icon}</div>
                          <div>
                            <p className="font-semibold text-sm text-gray-900">{metric.label}</p>
                            <p className="text-xs text-emerald-600 flex items-center gap-0.5"><Dna className="w-3 h-3" />+{ageContribution}yr bio age</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-xl font-bold ${getScoreLevel(metric.score).color}`}>{metric.score}</span>
                          <span className="text-xs text-gray-400">/100</span>
                        </div>
                      </div>
                      <ScoreBar score={metric.score} delay={0.2 + i * 0.04} />
                      <AnimatePresence>
                        {activeMetric === config.key && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                            <p className="text-sm text-gray-600 mt-2">{metric.description}</p>
                            <p className="text-xs text-emerald-600 mt-1 flex items-start gap-1"><FlaskConical className="w-3 h-3 mt-0.5 shrink-0" />{bioImpact?.label}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Recommendations */}
        {result.recommendations?.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Skincare Recommendations</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {result.recommendations.map((rec, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.1 }}>
                  <Card className="border-0 shadow-sm rounded-2xl h-full"><CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3"><ChevronRight className="w-4 h-4 text-rose-500" /><h4 className="font-semibold text-gray-900">{rec.category}</h4></div>
                    <ul className="space-y-2">{rec.tips.map((tip, j) => <li key={j} className="flex items-start gap-2 text-sm text-gray-600"><span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />{tip}</li>)}</ul>
                  </CardContent></Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="text-center py-8 border-t border-gray-100">
          <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 mb-3"><Shield className="w-3.5 h-3.5" />Cosmetic analysis only. Not a medical diagnosis.</div>
          <Button onClick={onNewScan} className="gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white px-8"><RefreshCw className="w-4 h-4" /> Scan Again</Button>
        </motion.div>
      </div></main>
    </div>
  );
}

// ─── Cosmetics Results Page ─────────────────────────────────
function CosmeticsResultsPage({ result, onNewScan }: { result: CosmeticsAnalysisResult; onNewScan: () => void }) {
  const detectedProducts = result.detectedProducts?.filter((p) => p.detected) || [];
  const undetectedProducts = result.detectedProducts?.filter((p) => !p.detected) || [];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white via-violet-50/20 to-white">
      <header className="w-full px-6 py-4 sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-400 to-fuchsia-500 flex items-center justify-center"><Sparkles className="w-4 h-4 text-white" /></div>
            <span className="font-bold bg-gradient-to-r from-violet-500 to-fuchsia-600 bg-clip-text text-transparent">GlowScan AI</span></div>
          <Button variant="outline" size="sm" onClick={onNewScan} className="gap-2 rounded-xl border-violet-200 text-violet-600 hover:bg-violet-50"><RefreshCw className="w-4 h-4" /> New Scan</Button>
        </div>
      </header>
      <main className="flex-1 px-6 py-8"><div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-4"><Badge className="px-3 py-1 bg-violet-50 text-violet-600 border-violet-200">{result.makeupStyle || 'Makeup'}</Badge><Badge className="px-3 py-1 bg-fuchsia-50 text-fuchsia-600 border-fuchsia-200">Cosmetics</Badge></div>
          <div className="flex justify-center mb-4"><ScoreRing score={result.overallScore} size={140} strokeWidth={10} /></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Cosmetics Score: {result.overallScore}/100</h2>
          <p className={`text-lg font-medium ${getScoreLevel(result.overallScore).color}`}>{getScoreLevel(result.overallScore).label}</p>
          <p className="text-gray-500 mt-3 max-w-md mx-auto">{result.summary}</p>
        </motion.div>

        {/* Color Profile */}
        {result.colorProfile && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
            <Card className="border-0 shadow-sm rounded-2xl bg-gradient-to-r from-violet-50 to-fuchsia-50">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4"><SwatchBook className="w-5 h-5 text-violet-500" /><h3 className="font-semibold text-gray-900">Color Profile</h3></div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[{ label: 'Undertone', value: result.colorProfile.undertone }, { label: 'Foundation', value: result.colorProfile.foundationMatch }, { label: 'Lip Color', value: result.colorProfile.lipColor }, { label: 'Blush', value: result.colorProfile.blushColor }, { label: 'Eye Colors', value: result.colorProfile.eyeMakeupColors?.join(', ') || 'N/A' }, { label: 'Harmony', value: result.colorProfile.overallColorHarmony }].map((item, i) => (
                    <div key={i} className="bg-white/70 rounded-xl p-3"><p className="text-xs text-gray-400 mb-0.5">{item.label}</p><p className="text-sm font-medium text-gray-800 line-clamp-2">{item.value}</p></div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Detected Products */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Detected Products</h3>
          {detectedProducts.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              {detectedProducts.map((product, i) => {
                const catStyle = CATEGORY_COLORS[product.category] || { color: 'text-gray-600', bgColor: 'bg-gray-50' };
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.04 }}>
                    <Card className="border-0 shadow-sm rounded-2xl"><CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2"><div className={`w-8 h-8 rounded-lg ${catStyle.bgColor} flex items-center justify-center ${catStyle.color}`}>{CATEGORY_ICONS[product.category] || <Layers className="w-4 h-4" />}</div>
                          <div><p className="font-semibold text-sm text-gray-900">{product.name}</p><p className="text-xs text-gray-400">{product.category}</p></div></div>
                        <div className="text-right"><span className={`text-lg font-bold ${getScoreLevel(product.score).color}`}>{product.score}</span><span className="text-xs text-gray-400">/100</span></div>
                      </div>
                      <ScoreBar score={product.score} delay={0.2 + i * 0.04} />
                      {product.colorDescription && <p className="text-xs text-violet-500 mt-2 flex items-center gap-1"><SwatchBook className="w-3 h-3" />{product.colorDescription}</p>}
                      {product.notes && <p className="text-xs text-gray-500 mt-1">{product.notes}</p>}
                    </CardContent></Card>
                  </motion.div>
                );
              })}
            </div>
          )}
          {undetectedProducts.length > 0 && (
            <div className="bg-gray-50 rounded-2xl p-4"><p className="text-xs text-gray-400 mb-2 font-medium">Not Detected</p>
              <div className="flex flex-wrap gap-2">{undetectedProducts.map((product, i) => <Badge key={i} variant="secondary" className="text-xs text-gray-400 bg-gray-100 border-0 rounded-lg">{product.name}</Badge>)}</div>
            </div>
          )}
        </motion.div>

        {/* Application Quality */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mb-10">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Application Quality</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {COSMETICS_QUALITY_CONFIGS.map((config, i) => {
              const metric = result.applicationQuality[config.key];
              return (
                <motion.div key={config.key} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }}>
                  <Card className="border-0 shadow-sm rounded-2xl"><CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2"><div className={`w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center ${config.color}`}>{config.icon}</div><p className="font-semibold text-sm text-gray-900">{metric.label}</p></div>
                      <div className="text-right"><span className={`text-xl font-bold ${getScoreLevel(metric.score).color}`}>{metric.score}</span><span className="text-xs text-gray-400">/100</span></div>
                    </div>
                    <ScoreBar score={metric.score} delay={0.3 + i * 0.05} />
                    <p className="text-sm text-gray-500 mt-2">{metric.description}</p>
                  </CardContent></Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Suggestions */}
        {result.suggestions?.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Makeup Recommendations</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {result.suggestions.map((rec, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.1 }}>
                  <Card className="border-0 shadow-sm rounded-2xl h-full"><CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3"><ChevronRight className="w-4 h-4 text-violet-500" /><h4 className="font-semibold text-gray-900">{rec.category}</h4></div>
                    <ul className="space-y-2 mb-3">{rec.tips.map((tip, j) => <li key={j} className="flex items-start gap-2 text-sm text-gray-600"><span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />{tip}</li>)}</ul>
                    {rec.productTypes?.length > 0 && (<div className="pt-3 border-t border-gray-100"><p className="text-xs text-gray-400 mb-2">Products to Try</p><div className="flex flex-wrap gap-1.5">{rec.productTypes.map((pt, j) => <Badge key={j} variant="secondary" className="text-xs bg-violet-50 text-violet-600 border-violet-200 rounded-lg">{pt}</Badge>)}</div></div>)}
                  </CardContent></Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="text-center py-8 border-t border-gray-100">
          <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 mb-3"><Shield className="w-3.5 h-3.5" />Cosmetic analysis only. Not a medical diagnosis.</div>
          <Button onClick={onNewScan} className="gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:from-violet-600 hover:to-fuchsia-700 text-white px-8"><RefreshCw className="w-4 h-4" /> Scan Again</Button>
        </motion.div>
      </div></main>
    </div>
  );
}

// ─── Longevity Results Page (with heatmap, shareable card, email reminder) ──
function LongevityResultsPage({ result, onNewScan, heatmap, imageUrl, userId, scanId, faceData }: {
  result: LongevityAnalysisResult; onNewScan: () => void; heatmap: HeatmapResult | null; imageUrl: string; userId: string; scanId: string | null; faceData: FaceDetectionResult | null;
}) {
  const [activeBiomarker, setActiveBiomarker] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showGeometry, setShowGeometry] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const geometry = useMemo(() => computeFaceGeometry(faceData), [faceData]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white via-emerald-50/20 to-white">
      <header className="w-full px-6 py-4 sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center"><Dna className="w-4 h-4 text-white" /></div>
            <span className="font-bold bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">GlowScan AI</span></div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowShareCard(!showShareCard)} className="gap-1 rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50"><Share2 className="w-4 h-4" /> Share</Button>
            <Button variant="outline" size="sm" onClick={onNewScan} className="gap-2 rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50"><RefreshCw className="w-4 h-4" /> New Scan</Button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-8"><div className="max-w-5xl mx-auto">

        {/* Hero: Age Gap */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-4">
            <Badge className="px-3 py-1 bg-emerald-50 text-emerald-600 border-emerald-200">{result.longevityCategory}</Badge>
            <Badge className="px-3 py-1 bg-teal-50 text-teal-600 border-teal-200">Biological Age</Badge>
          </div>
          <div className="flex items-center justify-center gap-6 sm:gap-10 mb-6 flex-wrap">
            <div className="text-center"><p className="text-sm text-gray-400 mb-1">Chronological Age</p><p className="text-4xl font-bold text-gray-400">{result.chronologicalAge}</p></div>
            <div className="flex flex-col items-center"><ScoreRing score={result.longevityScore} size={120} strokeWidth={8} /><p className="text-xs text-gray-400 mt-1">Longevity Score</p></div>
            <div className="text-center"><p className="text-sm text-gray-400 mb-1">Biological Age</p><p className={`text-4xl font-bold ${result.ageGap <= -3 ? 'text-emerald-600' : result.ageGap <= 3 ? 'text-sky-600' : 'text-orange-600'}`}>{result.biologicalAge}</p></div>
          </div>
          <AgeGapDisplay gap={result.ageGap} />
          <p className="text-gray-500 mt-4 max-w-md mx-auto">{result.summary}</p>
          <p className="text-xs text-gray-400 mt-2 flex items-center justify-center gap-1"><ShieldCheck className="w-3 h-3" />Facial proxy estimation. Not a substitute for clinical epigenetic testing.</p>
        </motion.div>

        {/* Shareable Card + Email Reminder */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <EmailReminderDialog scanId={scanId || ''} userId={userId} />
          <Button variant="outline" size="sm" className="gap-2 rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50" onClick={() => setShowShareCard(!showShareCard)}>
            <Share2 className="w-4 h-4" /> {showShareCard ? 'Hide' : 'Show'} Share Card
          </Button>
        </motion.div>

        <AnimatePresence>
          {showShareCard && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-10 overflow-hidden">
              <ShareableBioAgeCard result={result} onDownload={() => {
                // Use html2canvas-like approach via Canvas API
                const card = document.querySelector('.share-card-canvas');
                if (card) toast.info('Right-click the card image to save, or take a screenshot!');
                else toast.info('Take a screenshot of the card to share!');
              }} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Facial Geometry (deterministic, novel) */}
        {geometry && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Ruler className="w-5 h-5 text-cyan-500" /> Facial Geometry</h3>
              <Button variant="outline" size="sm" className="gap-1 rounded-xl" onClick={() => setShowGeometry(!showGeometry)}>
                {showGeometry ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showGeometry ? 'Hide' : 'Show'} Map
              </Button>
            </div>
            <AnimatePresence>
              {showGeometry && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="grid md:grid-cols-2 gap-5 items-start">
                    <FaceGeometryOverlay imageUrl={imageUrl} geometry={geometry} show={true} />
                    <FacialHarmonyCard geometry={geometry} accentFrom="from-cyan-400" accentTo="to-sky-500" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Heatmap */}
        {heatmap && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Target className="w-5 h-5 text-emerald-500" /> Longevity Heatmap</h3>
              <Button variant="outline" size="sm" className="gap-1 rounded-xl" onClick={() => setShowHeatmap(!showHeatmap)}>
                {showHeatmap ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showHeatmap ? 'Hide' : 'Show'} Heatmap
              </Button>
            </div>
            <AnimatePresence>
              {showHeatmap && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <HeatmapOverlay imageUrl={imageUrl} heatmap={heatmap} show={true} />
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {heatmap.zones.map((zone) => (
                      <div key={zone.id} className="bg-white rounded-xl p-2 border border-gray-100">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-700">{zone.label}</span>
                          <span className={`text-xs font-bold ${zone.intensity < 0.3 ? 'text-emerald-500' : zone.intensity < 0.5 ? 'text-yellow-500' : zone.intensity < 0.7 ? 'text-orange-500' : 'text-red-500'}`}>
                            {Math.round(zone.intensity * 100)}%
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 line-clamp-1">{zone.description}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* 8 Biomarkers */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-10">
          <h3 className="text-lg font-bold text-gray-900 mb-2">Longevity Biomarkers</h3>
          <p className="text-sm text-gray-500 mb-4">8 facial proxy indicators of biological aging processes</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {BIOMARKER_CONFIGS.map((config, i) => {
              const bm = result.biomarkers[config.key];
              return (
                <motion.div key={config.key} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.04 }}>
                  <Card className={`border-0 shadow-sm rounded-2xl cursor-pointer transition-all hover:shadow-md ${activeBiomarker === config.key ? 'ring-2 ring-emerald-300' : ''}`}
                    onClick={() => setActiveBiomarker(activeBiomarker === config.key ? null : config.key)}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2"><div className={`w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center ${config.color}`}>{config.icon}</div>
                          <p className="font-semibold text-xs text-gray-900 leading-tight">{bm.label}</p></div>
                        <div className="text-right"><span className={`text-lg font-bold ${getScoreLevel(bm.score).color}`}>{bm.score}</span></div>
                      </div>
                      <ScoreBar score={bm.score} delay={0.2 + i * 0.04} />
                      <AnimatePresence>
                        {activeBiomarker === config.key && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                            <p className="text-xs text-gray-600 mt-2">{bm.description}</p>
                            <p className="text-xs text-emerald-600 mt-1 flex items-start gap-1"><FlaskConical className="w-3 h-3 mt-0.5 shrink-0" />{bm.biologicalInsight}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Epigenetic Clock */}
        {result.epigeneticClock && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mb-10">
            <Card className="border-0 shadow-sm rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4"><Timer className="w-5 h-5 text-emerald-500" /><h3 className="font-semibold text-gray-900">Epigenetic Clock Estimation</h3>
                  <Badge className="text-xs bg-white/70 text-emerald-600 border-emerald-200">{result.epigeneticClock.clockConfidence} Confidence</Badge></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {result.epigeneticClock.clockIndicators?.map((ind, i) => (
                    <div key={i} className="bg-white/70 rounded-xl p-3"><p className="text-xs font-semibold text-emerald-700 mb-0.5">{ind.name}</p><p className="text-sm text-gray-700">{ind.observed}</p><p className="text-xs text-gray-400">Typical: {ind.typicalAgeRange}</p></div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Facial Age Signs */}
        {result.facialAgeSigns?.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Facial Age Signs by Area</h3>
            <div className="space-y-2">
              {result.facialAgeSigns.map((sign, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + i * 0.05 }}>
                  <Card className="border-0 shadow-sm rounded-xl"><CardContent className="p-3 flex items-center justify-between">
                    <div className="flex-1"><div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-gray-900">{sign.area}</p>
                      <Badge className={`text-xs ${sign.reversibility === 'High' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : sign.reversibility === 'Moderate' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>{sign.reversibility} reversibility</Badge>
                    </div><p className="text-xs text-gray-500 mt-0.5">{sign.observedSign}</p></div>
                    <div className={`text-lg font-bold ${sign.estimatedAgeImpact > 0 ? 'text-orange-500' : 'text-emerald-500'}`}>{sign.estimatedAgeImpact > 0 ? '+' : ''}{sign.estimatedAgeImpact}yr</div>
                  </CardContent></Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Recommendations */}
        {result.recommendations?.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Longevity Interventions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {result.recommendations.map((rec, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.1 }}>
                  <Card className="border-0 shadow-sm rounded-2xl h-full"><CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2"><ChevronRight className="w-4 h-4 text-emerald-500" /><h4 className="font-semibold text-gray-900">{rec.category}</h4></div>
                      <Badge className={`text-xs ${rec.impactLevel === 'High' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : rec.impactLevel === 'Moderate' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>{rec.impactLevel} Impact</Badge>
                    </div>
                    <ul className="space-y-2 mb-3">{rec.interventions.map((iv, j) => <li key={j} className="flex items-start gap-2 text-sm text-gray-600"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />{iv}</li>)}</ul>
                    <div className="pt-3 border-t border-gray-100 flex items-center gap-1.5 text-xs text-gray-400"><Clock className="w-3 h-3" /> Results in ~{rec.timeToEffect}</div>
                  </CardContent></Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="text-center py-8 border-t border-gray-100">
          <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 mb-3"><ShieldCheck className="w-3.5 h-3.5" />Facial proxy estimation only. Not a substitute for DNA methylation epigenetic clock testing (Horvath, GrimAge, etc.)</div>
          <Button onClick={onNewScan} className="gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-8"><RefreshCw className="w-4 h-4" /> Scan Again</Button>
        </motion.div>
      </div></main>
    </div>
  );
}

// ─── Main App ───────────────────────────────────────────────
export default function Home() {
  const [appState, setAppState] = useState<AppState>('landing');
  const [analysisType, setAnalysisType] = useState<AnalysisType>('skin');
  const [chronologicalAge, setChronologicalAge] = useState<number>(30);
  const [skinResult, setSkinResult] = useState<SkinAnalysisResult | null>(null);
  const [cosmeticsResult, setCosmeticsResult] = useState<CosmeticsAnalysisResult | null>(null);
  const [longevityResult, setLongevityResult] = useState<LongevityAnalysisResult | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapResult | null>(null);
  const [faceData, setFaceData] = useState<FaceDetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [lastImage, setLastImage] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [lastScanId, setLastScanId] = useState<string | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setUserId(getUserId()); }, []);

  const saveScan = useCallback(async (type: AnalysisType, result: SkinAnalysisResult | CosmeticsAnalysisResult | LongevityAnalysisResult) => {
    try {
      const body: Record<string, unknown> = {
        userId,
        analysisType: type,
        overallScore: result.overallScore || (result as LongevityAnalysisResult).longevityScore || 0,
        resultData: result,
      };
      if (type === 'longevity') {
        const lr = result as LongevityAnalysisResult;
        body.biologicalAge = lr.biologicalAge;
        body.chronologicalAge = lr.chronologicalAge;
        body.ageGap = lr.ageGap;
        body.longevityScore = lr.longevityScore;
        body.longevityCategory = lr.longevityCategory;
      } else if (type === 'skin') {
        body.skinType = (result as SkinAnalysisResult).skinType;
      } else if (type === 'cosmetics') {
        body.makeupStyle = (result as CosmeticsAnalysisResult).makeupStyle;
      }
      const res = await fetch('/api/scans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok && data.scan?.id) setLastScanId(data.scan.id);
    } catch (err) {
      console.error('Failed to save scan:', err);
    }
  }, [userId]);

  const fetchHeatmap = useCallback(async (image: string, faceBoundingBox?: { x: number; y: number; width: number; height: number }): Promise<HeatmapResult | null> => {
    try {
      const res = await fetch('/api/heatmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, faceBoundingBox }),
      });
      if (res.ok) return await res.json();
      return null;
    } catch {
      return null;
    }
  }, []);

  const fetchFaceDetection = useCallback(async (image: string): Promise<FaceDetectionResult | null> => {
    try {
      // Use client-side face-api.js for accurate landmark detection
      return await detectFaceClient(image);
    } catch {
      return null;
    }
  }, []);

  const startAnalysis = useCallback(async (imageDataUrl: string) => {
    setAppState('analyzing');
    setProgress(0);
    setError(null);
    setLastImage(imageDataUrl);
    setHeatmap(null);
    setFaceData(null);

    progressRef.current = setInterval(() => {
      setProgress((prev) => { if (prev >= 90) return prev; return prev + Math.random() * 8 + 2; });
    }, 500);

    try {
      // Face detection already ran in UploadPage, but re-run if needed
      if (!faceData) {
        const faceDetectionResult = await fetchFaceDetection(imageDataUrl);
        if (faceDetectionResult) setFaceData(faceDetectionResult);
      }
      const faceBB = faceData?.detected ? faceData.boundingBox : undefined;

      // Start main analysis
      const endpoint = analysisType === 'longevity' ? '/api/analyze-longevity' : analysisType === 'cosmetics' ? '/api/analyze-cosmetics' : '/api/analyze';
      const body: Record<string, unknown> = { image: imageDataUrl };
      if (analysisType === 'longevity') body.chronologicalAge = chronologicalAge;
      const mainAnalysisPromise = fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

      // Fetch heatmap with face bounding box for accurate zone placement
      let heatmapPromise: Promise<HeatmapResult | null> = Promise.resolve(null);
      if (analysisType === 'skin' || analysisType === 'longevity') {
        heatmapPromise = fetchHeatmap(imageDataUrl, faceBB);
      }

      // Wait for main analysis + heatmap in parallel
      const [response, heatmapResult] = await Promise.all([mainAnalysisPromise, heatmapPromise]);
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Analysis failed');

      if (progressRef.current) clearInterval(progressRef.current);
      setProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 600));

      if (heatmapResult) setHeatmap(heatmapResult);

      if (analysisType === 'longevity') {
        const lr = data as LongevityAnalysisResult;
        setLongevityResult(lr);
        setAppState('longevity-results');
        saveScan('longevity', lr);
      } else if (analysisType === 'cosmetics') {
        const cr = data as CosmeticsAnalysisResult;
        setCosmeticsResult(cr);
        setAppState('cosmetics-results');
        saveScan('cosmetics', cr);
      } else {
        const sr = data as SkinAnalysisResult;
        setSkinResult(sr);
        setAppState('results');
        saveScan('skin', sr);
      }
    } catch (err) {
      if (progressRef.current) clearInterval(progressRef.current);
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setAppState('landing');
    }
  }, [analysisType, chronologicalAge, fetchHeatmap, fetchFaceDetection, saveScan]);

  const resetApp = useCallback(() => {
    setAppState('landing'); setSkinResult(null); setCosmeticsResult(null); setLongevityResult(null); setHeatmap(null); setFaceData(null); setError(null); setProgress(0); setLastImage('');
  }, []);

  const handleStart = useCallback((type: AnalysisType) => {
    setAnalysisType(type);
    if (type === 'longevity') setAppState('age-input');
    else setAppState('upload');
  }, []);

  const handleLoadResult = useCallback((type: AnalysisType, result: SkinAnalysisResult | CosmeticsAnalysisResult | LongevityAnalysisResult) => {
    if (type === 'longevity') { setLongevityResult(result as LongevityAnalysisResult); setAppState('longevity-results'); }
    else if (type === 'cosmetics') { setCosmeticsResult(result as CosmeticsAnalysisResult); setAppState('cosmetics-results'); }
    else { setSkinResult(result as SkinAnalysisResult); setAppState('results'); }
  }, []);

  return (
    <>
      <AnimatePresence mode="wait">
        {appState === 'landing' && (
          <motion.div key="landing" exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <LandingPage onStart={handleStart} onHistory={() => setAppState('history')} />
            {error && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 max-w-md w-full px-4 z-50">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div><p className="text-sm font-medium text-red-800">Analysis Error</p><p className="text-sm text-red-600">{error}</p></div>
                </motion.div>
              </div>
            )}
          </motion.div>
        )}

        {appState === 'history' && (
          <motion.div key="history" exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <ScanHistoryPage userId={userId} onBack={resetApp} onLoadResult={handleLoadResult} />
          </motion.div>
        )}

        {appState === 'age-input' && (
          <motion.div key="age-input" exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <AgeInputPage onSubmit={(age) => { setChronologicalAge(age); setAppState('upload'); }} onBack={resetApp} />
          </motion.div>
        )}

        {appState === 'upload' && (
          <motion.div key="upload" exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <UploadPage analysisType={analysisType} onImageSelected={startAnalysis} onBack={() => analysisType === 'longevity' ? setAppState('age-input') : resetApp()} onFaceDetected={setFaceData} />
          </motion.div>
        )}

        {appState === 'analyzing' && (
          <motion.div key="analyzing" exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <AnalyzingPage analysisType={analysisType} progress={progress} imageUrl={lastImage} faceData={faceData} />
          </motion.div>
        )}

        {appState === 'results' && skinResult && (
          <motion.div key="results" exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <SkinResultsPage result={skinResult} onNewScan={resetApp} heatmap={heatmap} imageUrl={lastImage} userId={userId} faceData={faceData} />
          </motion.div>
        )}

        {appState === 'cosmetics-results' && cosmeticsResult && (
          <motion.div key="cosmetics-results" exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <CosmeticsResultsPage result={cosmeticsResult} onNewScan={resetApp} />
          </motion.div>
        )}

        {appState === 'longevity-results' && longevityResult && (
          <motion.div key="longevity-results" exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <LongevityResultsPage result={longevityResult} onNewScan={resetApp} heatmap={heatmap} imageUrl={lastImage} userId={userId} scanId={lastScanId} faceData={faceData} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
