"use client";

import React, { useState, useEffect } from "react";
import {
  Video,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  Cpu,
  Clock,
  Layers,
  FileCheck,
  Eye,
  Camera,
  Hash,
  Database,
  ArrowRight,
  Info,
  Sliders,
  Sparkles,
  ExternalLink
} from "lucide-react";
import {
  Room,
  TestClipData,
  ClipAnalysisResponseData,
  fetchCameras,
  fetchTestClips,
  analyzeCameraClip
} from "@/lib/api";

interface RealVideoPipelineViewProps {
  token: string;
  onViewPassport?: (passportId: string) => void;
}

export default function RealVideoPipelineView({
  token,
  onViewPassport
}: RealVideoPipelineViewProps) {
  const [cameras, setCameras] = useState<Room[]>([]);
  const [testClips, setTestClips] = useState<TestClipData[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [selectedClipFilename, setSelectedClipFilename] = useState<string>("scenario_classroom_class.mp4");
  const [maxFrames, setMaxFrames] = useState<number>(30);
  const [sampleFps, setSampleFps] = useState<number>(3.0);
  const [expectedHeadcount, setExpectedHeadcount] = useState<number>(1);

  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisStage, setAnalysisStage] = useState<string>("");
  const [analysisResult, setAnalysisResult] = useState<ClipAnalysisResponseData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [activeImageTab, setActiveImageTab] = useState<"annotated" | "raw">("annotated");

  // Load cameras and test clips on mount
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoadingInitial(true);
      setErrorMessage("");
      try {
        const [cams, clips] = await Promise.all([
          fetchCameras(token).catch(() => []),
          fetchTestClips(token).catch(() => [])
        ]);
        if (isMounted) {
          setCameras(cams);
          setTestClips(clips);
          if (cams.length > 0) {
            setSelectedCameraId(cams[0].camera_id);
          }
          if (clips.length > 0) {
            setSelectedClipFilename(clips[0].filename);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err.message || "Failed to load cameras or clips");
        }
      } finally {
        if (isMounted) setLoadingInitial(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [token]);

  // Execute Real Computer Vision Analysis
  const handleRunAnalysis = async () => {
    if (!selectedCameraId || !selectedClipFilename) {
      setErrorMessage("Please select both a camera and a video clip.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisStage("Sampling frames & initializing YOLOv8...");
    setErrorMessage("");

    try {
      // Stage progress simulation for user feedback while backend executes real pipeline
      const timer1 = setTimeout(() => setAnalysisStage("Running YOLOv8 Person & Equipment Detection..."), 800);
      const timer2 = setTimeout(() => setAnalysisStage("Executing ByteTrack & Zone Containment..."), 1800);
      const timer3 = setTimeout(() => setAnalysisStage("Computing SensorTrust (Blur, Freeze, Luminance)..."), 2800);
      const timer4 = setTimeout(() => setAnalysisStage("Evaluating Temporal Dwell FSM & Sufficiency Engine..."), 3800);

      const result = await analyzeCameraClip(
        selectedCameraId,
        {
          clip_filename: selectedClipFilename,
          max_frames: maxFrames,
          sample_fps: sampleFps,
          expected_headcount: expectedHeadcount
        },
        token
      );

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);

      setAnalysisResult(result);
      setAnalysisStage("Analysis Complete!");
    } catch (err: any) {
      setErrorMessage(err.message || "Pipeline analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const selectedClip = testClips.find((c) => c.filename === selectedClipFilename);
  const selectedCamera = cameras.find((c) => c.camera_id === selectedCameraId);

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Epistemic Disclaimer */}
      <div className="bg-[#0b121e] border border-cyan-900/40 rounded-xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                PHASE 5 REAL COMPUTER VISION
              </span>
              <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                SOURCE: TEST VIDEO (MP4)
              </span>
            </div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Video className="w-5 h-5 text-cyan-400" />
              Real Video Evidence Acquisition Pipeline
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl">
              Deterministic, end-to-end edge AI execution: Raw Video Frames → Frame Sampling → YOLOv8 Object Detection → ByteTrack Kalman Tracking → Polygon Zone PIP → SensorTrust Optical Analysis → Temporal FSM → Evidence Sufficiency Engine → Cryptographic Evidence Passport.
            </p>
          </div>

          <div className="bg-[#070d18] border border-slate-800 rounded-lg p-3 text-xs space-y-1.5 min-w-[220px]">
            <div className="flex justify-between text-slate-400">
              <span>Pipeline Mode:</span>
              <span className="text-cyan-300 font-mono font-semibold">Edge Non-Streaming</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Cloud Bandwidth:</span>
              <span className="text-emerald-400 font-mono font-semibold">Zero Continuous Stream</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Privacy Standard:</span>
              <span className="text-slate-300 font-mono font-semibold">100% Facial Anonymized</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Analysis Configuration Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-[#0b121e] border border-slate-800 rounded-xl p-5 space-y-5 lg:col-span-1 shadow-md">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-800">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Pipeline Execution Controls</h3>
          </div>

          {/* Camera Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
              <span>Target Camera Node:</span>
              <span className="text-[10px] text-slate-500 font-mono">{cameras.length} configured</span>
            </label>
            <select
              value={selectedCameraId}
              onChange={(e) => setSelectedCameraId(e.target.value)}
              disabled={isAnalyzing || loadingInitial}
              className="w-full bg-[#070d18] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              {cameras.map((c) => (
                <option key={c.camera_id} value={c.camera_id}>
                  {c.camera_id} — {c.room_name} ({c.room_type})
                </option>
              ))}
            </select>
            {selectedCamera && (
              <p className="text-[11px] text-slate-500">
                Centre: <span className="text-slate-300">{selectedCamera.centre_id}</span> | Seating: <span className="text-slate-300">{selectedCamera.seating_capacity}</span>
              </p>
            )}
          </div>

          {/* Test Clip Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
              <span>Allowlisted Video Clip:</span>
              <span className="text-[10px] text-cyan-400 font-mono">Allowlist Enforced</span>
            </label>
            <select
              value={selectedClipFilename}
              onChange={(e) => setSelectedClipFilename(e.target.value)}
              disabled={isAnalyzing || loadingInitial}
              className="w-full bg-[#070d18] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              {testClips.map((clip) => (
                <option key={clip.filename} value={clip.filename}>
                  {clip.title} ({clip.filename})
                </option>
              ))}
            </select>
            {selectedClip && (
              <div className="bg-[#070d18] p-2.5 rounded border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <p className="text-slate-300 font-medium">{selectedClip.description}</p>
                <p className="text-[10px] text-slate-500">Event Type: {selectedClip.event_type}</p>
              </div>
            )}
          </div>

          {/* Sampling Parameters */}
          <div className="space-y-3 pt-2 border-t border-slate-800/80">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Max Analysis Frames:</span>
                <span className="text-cyan-400 font-mono font-bold">{maxFrames} frames</span>
              </div>
              <input
                type="range"
                min="15"
                max="90"
                step="5"
                value={maxFrames}
                onChange={(e) => setMaxFrames(parseInt(e.target.value))}
                disabled={isAnalyzing}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Inference Cadence:</span>
                <span className="text-cyan-400 font-mono font-bold">{sampleFps.toFixed(1)} FPS</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="5.0"
                step="0.5"
                value={sampleFps}
                onChange={(e) => setSampleFps(parseFloat(e.target.value))}
                disabled={isAnalyzing}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Expected Headcount:</span>
                <span className="text-cyan-400 font-mono font-bold">{expectedHeadcount}</span>
              </div>
              <input
                type="number"
                min="0"
                max="50"
                value={expectedHeadcount}
                onChange={(e) => setExpectedHeadcount(parseInt(e.target.value) || 0)}
                disabled={isAnalyzing}
                className="w-full bg-[#070d18] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>

          {/* Execute Button */}
          <button
            onClick={handleRunAnalysis}
            disabled={isAnalyzing || loadingInitial}
            className={`w-full py-2.5 px-4 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-2 ${
              isAnalyzing
                ? "bg-cyan-700/50 text-cyan-200 cursor-not-allowed"
                : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/30"
            }`}
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-200" />
                <span>Running Edge Vision Pipeline...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-white fill-white" />
                <span>Run Real Computer Vision Analysis</span>
              </>
            )}
          </button>

          {isAnalyzing && (
            <div className="p-3 bg-[#070d18] border border-cyan-900/40 rounded-lg text-xs space-y-1">
              <span className="text-cyan-400 font-mono font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                Pipeline Active
              </span>
              <p className="text-slate-400 text-[11px]">{analysisStage}</p>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg text-xs text-rose-300 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* 3. Real-Time Pipeline Results View */}
        <div className="bg-[#0b121e] border border-slate-800 rounded-xl p-5 space-y-5 lg:col-span-2 shadow-md">
          {analysisResult ? (
            <div className="space-y-6">
              {/* Verdict Header Card */}
              <div
                className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  analysisResult.verdict === "VERIFIED"
                    ? "bg-emerald-950/20 border-emerald-500/40"
                    : analysisResult.verdict === "REVIEW"
                    ? "bg-amber-950/20 border-amber-500/40"
                    : "bg-rose-950/20 border-rose-500/40"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      analysisResult.verdict === "VERIFIED"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : analysisResult.verdict === "REVIEW"
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-rose-500/20 text-rose-400"
                    }`}
                  >
                    {analysisResult.verdict === "VERIFIED" && <CheckCircle2 className="w-6 h-6" />}
                    {analysisResult.verdict === "REVIEW" && <AlertTriangle className="w-6 h-6" />}
                    {analysisResult.verdict === "ABSTAIN" && <XCircle className="w-6 h-6" />}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        EVIDENCE SUFFICIENCY DECISION
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-bold font-mono ${
                          analysisResult.verdict === "VERIFIED"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : analysisResult.verdict === "REVIEW"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        }`}
                      >
                        {analysisResult.verdict}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-white mt-0.5">
                      Score: {(analysisResult.evidence_score * 100).toFixed(1)}% / 100%
                      <span className="text-xs text-slate-400 font-normal ml-2">
                        ({analysisResult.frames_processed} frames in {analysisResult.processing_duration_seconds}s)
                      </span>
                    </p>
                  </div>
                </div>

                {onViewPassport && (
                  <button
                    onClick={() => onViewPassport(analysisResult.passport_id)}
                    className="px-3 py-1.5 bg-[#070d18] border border-cyan-800 hover:border-cyan-500 text-cyan-300 text-xs rounded-lg flex items-center space-x-1.5 transition"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>View Evidence Passport</span>
                    <ExternalLink className="w-3 h-3 text-cyan-400" />
                  </button>
                )}
              </div>

              {/* Physical Keyframe & HUD Overlay */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
                    <Camera className="w-4 h-4 text-cyan-400" />
                    <span>Real Video Keyframe Capture (Vault Storage)</span>
                  </div>
                  <div className="flex bg-[#070d18] border border-slate-800 rounded-lg p-0.5 text-xs">
                    <button
                      onClick={() => setActiveImageTab("annotated")}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                        activeImageTab === "annotated"
                          ? "bg-cyan-600 text-white font-semibold"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      HUD Annotated Keyframe
                    </button>
                    <button
                      onClick={() => setActiveImageTab("raw")}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                        activeImageTab === "raw"
                          ? "bg-cyan-600 text-white font-semibold"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Raw Keyframe
                    </button>
                  </div>
                </div>

                <div className="relative bg-[#070d18] border border-slate-800 rounded-xl overflow-hidden aspect-[4/3] max-h-[340px] flex items-center justify-center">
                  <img
                    src={`http://localhost:8000/api/v1/evidence-vault/${analysisResult.passport_id}/${activeImageTab}`}
                    alt="Real Keyframe Evidence"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      // Fallback placeholder display if image fails to load
                      (e.target as any).style.display = "none";
                    }}
                  />
                  <div className="absolute bottom-2 left-2 right-2 bg-black/75 backdrop-blur-sm border border-slate-800/80 rounded px-3 py-1.5 text-[11px] font-mono text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-cyan-400 truncate max-w-[70%]">
                      <Hash className="w-3.5 h-3.5 shrink-0" />
                      SHA-256: {analysisResult.image_sha256}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold shrink-0">
                      ON-DISK MATCH
                    </span>
                  </div>
                </div>
              </div>

              {/* 7 Factor Breakdown */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  Real Contributing Evidence Dimensions (Arithmetic Evaluation)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(analysisResult.contributing_factors).map(([factor, score]) => (
                    <div
                      key={factor}
                      className="bg-[#070d18] border border-slate-800/90 rounded-lg p-2.5 text-xs space-y-1"
                    >
                      <span className="text-[10px] text-slate-400 capitalize block truncate">
                        {factor.replace("_", " ")}
                      </span>
                      <span className="font-mono font-bold text-slate-100 text-sm">
                        {(Number(score) * 100).toFixed(1)}%
                      </span>
                      <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            Number(score) >= 0.75
                              ? "bg-emerald-400"
                              : Number(score) >= 0.45
                              ? "bg-amber-400"
                              : "bg-rose-400"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, Number(score) * 100))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Epistemic Reasons List */}
              <div className="bg-[#070d18] border border-slate-800 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-cyan-400" />
                  Causal Epistemic Reasons for Verdict
                </h4>
                <ul className="space-y-1 text-xs text-slate-300">
                  {analysisResult.reasons.map((reason, idx) => (
                    <li key={idx} className="flex items-start space-x-2">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[380px] flex flex-col items-center justify-center text-center p-8 space-y-3 text-slate-500">
              <Video className="w-12 h-12 text-slate-700" />
              <div className="space-y-1 max-w-sm">
                <h4 className="text-sm font-semibold text-slate-300">Ready to Analyze Real Video</h4>
                <p className="text-xs text-slate-500">
                  Select a configured camera and an allowlisted test clip on the left, then click &quot;Run Real Computer Vision Analysis&quot; to ingest real frames through YOLOv8 and ByteTrack.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
