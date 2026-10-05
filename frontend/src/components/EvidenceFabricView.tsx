"use client";

import React, { useState } from "react";
import {
  Video,
  Eye,
  Camera,
  Clock,
  Cpu,
  Scale,
  RefreshCw,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ArrowDown,
  Lock,
  Binary,
  HardDrive,
  Database,
  Radio,
  FileCheck,
  Zap,
  Info,
  ShieldAlert
} from "lucide-react";
import { SufficiencyVerdict } from "@/lib/api";

interface EvidenceFabricViewProps {
  liveVerdict: SufficiencyVerdict | null;
  demoScenario: "normal" | "occlusion" | "transient" | "conflict" | "spoof";
  onSelectScenario: (scenario: "normal" | "occlusion" | "transient" | "conflict" | "spoof") => void;
  onNavigateToTab: (tab: any) => void;
}

export default function EvidenceFabricView({
  liveVerdict,
  demoScenario,
  onSelectScenario,
  onNavigateToTab
}: EvidenceFabricViewProps) {
  const [selectedStage, setSelectedStage] = useState<number>(5);

  const stages = [
    {
      id: 1,
      name: "1. VIDEO / INGESTION",
      icon: Video,
      color: "blue",
      tagline: "Local ring buffering, zero continuous cloud streaming",
      items: [
        "RTSP Camera Stream Ingest",
        "Local Circular RAM Buffer (10s)",
        "Adaptive Frame Sampling (1-3 fps)",
        "Keyframe Extraction & Hashing",
        "Store-and-Forward on Network Drop"
      ],
      details: {
        engine: "OpenCV + FFmpeg Edge Daemon",
        latency: "< 45ms pipeline ingest delay",
        privacy: "Raw video frames remain in local RAM buffer; discarded after cryptographic keyframe hashing."
      }
    },
    {
      id: 2,
      name: "2. DETECTION QUALITY",
      icon: Eye,
      color: "cyan",
      tagline: "Lightweight, anonymous bounding boxes (w = 0.15)",
      items: [
        "Anonymous Person Detection (YOLOv8n)",
        "Equipment Detection (Workstations, Sewing Units)",
        "Configurable Zone Polygons (GeoJSON)",
        "Anonymous Presence Estimation (No Biometrics)",
        "Centroid Seating Mapping"
      ],
      details: {
        engine: "ONNX Runtime / TensorRT",
        model: "YOLOv8n-pose / YOLOv8n (3.2M params)",
        privacy: "Strictly NO facial recognition, emotion analysis, or biological identification."
      }
    },
    {
      id: 3,
      name: "3. CAMERA TRUST",
      icon: Camera,
      color: "emerald",
      tagline: "Sensor reliability & optical verification (w = 0.15, Veto < 0.20)",
      items: [
        "Stream Cadence & FPS Continuity",
        "Optical Blur (Laplacian Variance check)",
        "Histogram Exposure & Illumination Floor",
        "Camera Obstruction / Cover Detection",
        "Freeze & Video Loop Detection (Pixel Entropy)",
        "Field of View Coverage Verification"
      ],
      details: {
        engine: "SensorTrustModule (Laplacian + Frame Entropy)",
        hard_veto: "Laplacian < 22 or Entropy < 0.05 triggers immediate Camera Trust Veto -> ABSTAIN."
      }
    },
    {
      id: 4,
      name: "4. OBSERVABILITY",
      icon: Eye,
      color: "purple",
      tagline: "Target zone visibility & line-of-sight (w = 0.15, Veto < 0.30)",
      items: [
        "Classroom Line-of-Sight Geometry",
        "Partition Obstruction Evaluation",
        "Glare & Extreme Contrast Analysis",
        "Blindspot Detection vs Seating Zone",
        "Veto Gate: Observability < 30% -> ABSTAIN"
      ],
      details: {
        engine: "ObservabilityModule (Zone Coverage)",
        hard_veto: "Target zone occlusion > 70% (Observability < 30%) triggers hard veto -> ABSTAIN."
      }
    },
    {
      id: 5,
      name: "5. TEMPORAL PERSISTENCE",
      icon: Clock,
      color: "indigo",
      tagline: "Dwell time verification separating passersby (w = 0.20)",
      items: [
        "Continuous 10-Minute Dwell Tracking",
        "Occlusion Handling via ByteTrack Kalman",
        "State Transition: ENTER -> DWELL -> EXIT",
        "Fleeting Transit Suppression",
        "10-Minute Epoch Evidence Window"
      ],
      details: {
        engine: "ByteTrack Tracker + TemporalValidator",
        rule: "A person passing through the room for 45 seconds does NOT satisfy mandatory training dwell requirement."
      }
    },
    {
      id: 6,
      name: "6. SCENE STABILITY",
      icon: Layers,
      color: "cyan",
      tagline: "Background coherence & lighting stability (w = 0.10)",
      items: [
        "Static Background Modelling",
        "Sudden Illumination Fluctuation Check",
        "Lens Shake & Vibration Detection",
        "Environmental Noise Filter"
      ],
      details: {
        engine: "SceneStabilityEvaluator",
        rule: "Detects erratic camera motion or flickering lighting that disrupts automated perception."
      }
    },
    {
      id: 7,
      name: "7. RECORD AGREEMENT",
      icon: Scale,
      color: "amber",
      tagline: "Cross-referencing vs official biometric rosters (w = 0.10)",
      items: [
        "CCTV Attendance Estimate vs Biometric AEBAS Roster",
        "Ghost Batch Detection (Zero CCTV vs Full Roster)",
        "Equipment Inventory vs MSDE Sanctions",
        "Contradiction Alerting -> REVIEW"
      ],
      details: {
        engine: "AuthoritativeRecordReconciliation",
        rule: "Discrepancy between CCTV headcount and biometric register automatically triggers REVIEW."
      }
    },
    {
      id: 8,
      name: "8. ANTI-SPOOF SIGNALS",
      icon: ShieldAlert,
      color: "rose",
      tagline: "Replay & stream freeze protection (w = 0.15, Veto < 0.50)",
      items: [
        "Temporal Frame Entropy Analysis",
        "Static Frame Detection (Freeze Trip)",
        "Video Replay Loop Pattern Scanning",
        "Veto Gate: Anti-Spoof < 50% -> ABSTAIN"
      ],
      details: {
        engine: "AntiSpoofSignalEvaluator",
        hard_veto: "Zero temporal pixel entropy indicates video loop or camera freeze -> Hard Veto -> ABSTAIN."
      }
    },
    {
      id: 9,
      name: "9. EVIDENCE SUFFICIENCY",
      icon: Cpu,
      color: "emerald",
      isCore: true,
      tagline: "Deterministic weighted epistemic fusion (Tau_Ver >= 0.75, Tau_Rev >= 0.45)",
      items: [
        "Arithmetic Weighted Sum (Weights sum to 1.00)",
        "Hard Integrity Veto Evaluation",
        "Threshold: VERIFIED >= 0.75",
        "Threshold: REVIEW 0.45 .. 0.74",
        "Threshold: ABSTAIN < 0.45 (or Veto)"
      ],
      details: {
        engine: "Deterministic Mathematical Weighted Fusion",
        thresholds: "VERIFIED >= 0.75 | REVIEW 0.45..0.74 | ABSTAIN < 0.45",
        governance: "Outputs explainable causal reasons and stores immutable decision record."
      }
    },
    {
      id: 10,
      name: "10. FINAL VERDICT & ACTION",
      icon: FileCheck,
      color: "blue",
      tagline: "Epistemic decision & closed-loop acquisition strategy",
      items: [
        "VERIFIED: Seal Cryptographic Passport",
        "REVIEW: Escalate to Human Governance Queue",
        "ABSTAIN: Insufficient Evidence Strategy",
        "Wait Next Window / Alternate Camera",
        "Immutable Audit Chain Appending"
      ],
      details: {
        engine: "Active Evidence Acquisition Controller",
        purpose: "Prevents wrongful penalties on noisy feeds; dynamically requests additional observations."
      }
    }
  ];

  return (
    <div className="space-y-6">
      {/* 1. TOP SIMULATION / ARCHITECTURE BANNER */}
      <section className="glass-panel p-5 border border-[#1e2e46] relative overflow-hidden bg-gradient-to-r from-[#0c1322] via-[#09101c] to-[#070b14]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-[11px] font-mono text-cyan-400 font-bold uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5" />
              <span>SIH26245 ARCHITECTURAL BLUEPRINT — 10-STAGE EPISTEMIC PIPELINE</span>
            </div>
            <h2 className="text-xl font-black tracking-tight text-white uppercase">
              Evidence Intelligence & Compliance Fabric
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Real-time compliance monitoring cannot rely on raw object detections alone. Our 10-stage epistemic fabric
              evaluates whether observational evidence is <em>epistemically trustworthy</em> before taking any regulatory action.
            </p>
          </div>

          {/* Explicit Label: Simulated Evidence */}
          <div className="p-3 rounded-lg bg-[#070b12] border border-cyan-500/30 text-xs font-mono space-y-1 shrink-0">
            <div className="text-cyan-300 font-bold flex items-center space-x-1.5">
              <Info className="w-4 h-4 text-cyan-400" />
              <span>DEMO / SIMULATED EVIDENCE</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Live edge video ingestion pipeline connects in Phase 6.
            </div>
          </div>
        </div>
      </section>

      {/* 2. LOW-BANDWIDTH EVENT TELEMETRY CALLOUT BAR */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-950/40 via-cyan-950/30 to-[#080d16] border border-cyan-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center space-x-2.5">
          <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
            <Radio className="w-4 h-4 animate-pulse" />
          </span>
          <div>
            <div className="text-white font-bold flex items-center space-x-2">
              <span>LOW-BANDWIDTH EVENT TELEMETRY</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                ✓ 99.8% Bandwidth Reduction
              </span>
            </div>
            <div className="text-slate-400 text-[11px] font-sans">
              All video frames are processed on premise at the Edge. Only ~4.2 KB signed JSON Evidence Passports are transmitted.
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-[11px] shrink-0">
          <div className="px-2.5 py-1 rounded bg-[#0b1019] border border-[#1e2e46] flex items-center space-x-1.5 text-rose-400 font-bold">
            <XCircle className="w-3.5 h-3.5" />
            <span>Continuous Cloud Streaming Avoided</span>
          </div>
          <div className="px-2.5 py-1 rounded bg-[#0b1019] border border-[#1e2e46] text-cyan-300 font-bold">
            Payload: ~4.2 KB / Event
          </div>
        </div>
      </div>

      {/* 3. 10-STAGE ARCHITECTURAL PIPELINE GRID */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center space-x-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>10-Stage End-to-End Epistemic Pipeline</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">Click any stage to inspect mathematical specifications</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {stages.map((stage) => {
            const Icon = stage.icon;
            const isSelected = selectedStage === stage.id;
            return (
              <div
                key={stage.id}
                onClick={() => setSelectedStage(stage.id)}
                className={`cursor-pointer rounded-xl p-3.5 transition-all duration-200 border relative flex flex-col justify-between ${
                  isSelected
                    ? "bg-[#0e1726] border-cyan-400/80 shadow-lg shadow-cyan-950/50 -translate-y-0.5"
                    : "bg-[#090f1a] hover:bg-[#0c1422] border-[#1e2e46] hover:border-[#2c4263]"
                }`}
              >
                {stage.isCore && (
                  <span className="absolute -top-2 right-2 text-[8px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-amber-500 text-black uppercase tracking-wider">
                    CORE
                  </span>
                )}

                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <div
                      className={`p-1.5 rounded-lg ${
                        isSelected
                          ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="truncate">
                      <h4 className="text-xs font-bold text-white tracking-tight truncate">{stage.name}</h4>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 mb-2 leading-tight line-clamp-2">{stage.tagline}</p>

                  <ul className="space-y-0.5 text-[10px] font-mono text-slate-300">
                    {stage.items.slice(0, 3).map((item, idx) => (
                      <li key={idx} className="flex items-start space-x-1">
                        <span className="text-cyan-400 shrink-0">•</span>
                        <span className="truncate">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-3 pt-1.5 border-t border-[#1e2e46]/60 flex items-center justify-between text-[10px] font-mono">
                  <span className={isSelected ? "text-cyan-400 font-bold" : "text-slate-500"}>
                    {isSelected ? "Inspecting" : "Select"}
                  </span>
                  <ArrowRight className={`w-3 h-3 ${isSelected ? "text-cyan-400" : "text-slate-500"}`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. ACTIVE STAGE DEEP-DIVE INSPECTION DRAWER */}
      {selectedStage && (
        <div className="glass-panel p-5 border border-cyan-500/40 bg-[#080d17] space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#1e2e46] pb-3 gap-2">
            <div className="flex items-center space-x-3">
              <span className="text-xs px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono font-bold">
                STAGE {selectedStage} SPECIFICATION
              </span>
              <h3 className="text-base font-bold text-white uppercase">{stages[selectedStage - 1].name}</h3>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Component: <strong className="text-white">{stages[selectedStage - 1].details.engine || "Native Subsystem"}</strong>
            </div>
          </div>

          {/* STAGE 9: EVIDENCE SUFFICIENCY ENGINE (The Core Invention) */}
          {selectedStage === 9 ? (
            <div className="p-4 rounded-xl bg-[#0b111c] border border-amber-500/40 space-y-4">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                <span>Core Epistemic Decision Engine: 7 Mathematical Factors & Decision Thresholds</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">Deterministic Fusion</span>
              </div>

              {/* 7 Factors Display with Exact Weights and Vetoes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-xs font-mono">
                {[
                  { label: "1. Cam Trust", score: liveVerdict?.contributing_factors.camera_trust ?? 0.95, weight: "15%", veto: "< 20%" },
                  { label: "2. Observability", score: liveVerdict?.contributing_factors.observability ?? 0.94, weight: "15%", veto: "< 30%" },
                  { label: "3. Detect Qual", score: liveVerdict?.contributing_factors.detection_quality ?? 0.92, weight: "15%", veto: "None" },
                  { label: "4. Persistence", score: liveVerdict?.contributing_factors.temporal_persistence ?? 0.95, weight: "20%", veto: "None" },
                  { label: "5. Stability", score: liveVerdict?.contributing_factors.scene_stability ?? 0.90, weight: "10%", veto: "None" },
                  { label: "6. Record Agrmt", score: liveVerdict?.contributing_factors.record_agreement ?? 0.12, weight: "10%", veto: "None" },
                  { label: "7. Anti-Spoof", score: liveVerdict?.contributing_factors.anti_spoof ?? 1.00, weight: "15%", veto: "< 50%" }
                ].map((item, idx) => (
                  <div key={idx} className="p-2.5 rounded bg-[#101726] border border-[#1e2e46] text-center">
                    <div className="text-[10px] text-slate-400 uppercase truncate">{item.label}</div>
                    <div
                      className={`text-base font-bold my-1 ${
                        item.score >= 0.75 ? "text-emerald-400" : item.score >= 0.45 ? "text-amber-400" : "text-rose-400"
                      }`}
                    >
                      {item.score.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">w = {item.weight}</div>
                    <div className="text-[9px] text-slate-600 font-mono">Veto: {item.veto}</div>
                  </div>
                ))}
              </div>

              {/* Decision Rules & Thresholds Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
                <div className="p-3 rounded bg-[#0a0f18] border border-emerald-500/30">
                  <div className="text-emerald-400 font-bold">VERIFIED (S &gt;= 0.75)</div>
                  <div className="text-[11px] text-slate-400 mt-1 font-sans">
                    All 7 factors acceptable. Authoritative match confirmed. Sealed directly into cryptographic vault.
                  </div>
                </div>

                <div className="p-3 rounded bg-[#0a0f18] border border-amber-500/30">
                  <div className="text-amber-400 font-bold">REVIEW (0.45 &lt;= S &lt; 0.75)</div>
                  <div className="text-[11px] text-slate-400 mt-1 font-sans">
                    Contradiction detected (e.g. Ghost Batch: 4 visual vs 25 registered). Escrowed to Officer Review Queue.
                  </div>
                </div>

                <div className="p-3 rounded bg-[#0a0f18] border border-rose-500/30">
                  <div className="text-rose-400 font-bold">ABSTAIN (S &lt; 0.45 or Veto)</div>
                  <div className="text-[11px] text-slate-400 mt-1 font-sans">
                    Insufficient evidence due to optical blur, occlusion, or freeze. NOT a violation. Closed-loop re-evaluation.
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded bg-[#080d16] border border-[#1e2e46] text-xs font-mono">
                <div>
                  <span className="text-slate-400">Current Computed Evidence Score: </span>
                  <strong className="text-cyan-400 text-sm">{liveVerdict?.evidence_score.toFixed(3) ?? "0.000"}</strong>
                  <span className="text-slate-500 ml-2">
                    (Verdict:{" "}
                    <strong
                      className={
                        liveVerdict?.decision === "VERIFIED"
                          ? "text-emerald-400"
                          : liveVerdict?.decision === "REVIEW"
                          ? "text-amber-400"
                          : "text-rose-400"
                      }
                    >
                      {liveVerdict?.decision || "EVALUATING"}
                    </strong>
                    )
                  </span>
                </div>
                <button
                  onClick={() => onNavigateToTab("passports")}
                  className="px-3 py-1.5 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40 text-xs font-bold shrink-0"
                >
                  Inspect Sealed Passports Vault ➔
                </button>
              </div>
            </div>
          ) : selectedStage === 7 ? (
            /* STAGE 7: RECORD AGREEMENT & EVIDENCE LADDER */
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#0b111c] border border-[#1e2e46] space-y-3 font-mono text-xs">
                  <div className="text-slate-300 font-bold uppercase tracking-wider flex items-center justify-between">
                    <span>Attendance & Asset Reconciliation</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">UIDAI / AEBAS</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded bg-[#101726] border border-[#1e2e46]">
                      <div className="text-[10px] text-slate-400 uppercase">CCTV Visual Trainees</div>
                      <div className="text-lg font-bold text-cyan-300">
                        {liveVerdict?.compliance_reasoning?.cctv_attendance_estimate ?? (demoScenario === "conflict" ? 4 : 20)} Trainees
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Seated in student zone</div>
                    </div>
                    <div className="p-2.5 rounded bg-[#101726] border border-[#1e2e46]">
                      <div className="text-[10px] text-slate-400 uppercase">Official NSDC Roster</div>
                      <div className="text-lg font-bold text-emerald-400">
                        {liveVerdict?.compliance_reasoning?.authoritative_attendance_record ?? 20} Trainees
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Authoritative registered batch</div>
                    </div>
                  </div>
                </div>

                {/* Evidence Ladder Display with Mandatory Limitation */}
                <div className="p-4 rounded-xl bg-[#0b111c] border border-cyan-500/30 space-y-3 font-mono text-xs">
                  <div className="text-cyan-300 font-bold uppercase tracking-wider flex items-center justify-between">
                    <span>THE EVIDENCE LADDER (Epistemic Hierarchy)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400">4 Rungs</span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 flex justify-between">
                      <span>4. APPARENTLY USABLE</span>
                      <span className="text-[10px]">Workstations powered & occupied</span>
                    </div>
                    <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/40 text-cyan-300 flex justify-between">
                      <span>3. APPARENTLY AVAILABLE</span>
                      <span className="text-[10px]">Unblocked workbenches in layout</span>
                    </div>
                    <div className="p-2 rounded bg-slate-800 border border-slate-700 text-slate-300 flex justify-between">
                      <span>2. VISIBLE</span>
                      <span className="text-[10px]">Un-occluded camera line of sight</span>
                    </div>
                    <div className="p-2 rounded bg-slate-800 border border-slate-700 text-slate-400 flex justify-between">
                      <span>1. PRESENT</span>
                      <span className="text-[10px]">Registered in centre inventory</span>
                    </div>
                  </div>

                  {/* Mandatory Epistemic Limitation (Requirement 7) */}
                  <div className="p-2.5 rounded bg-[#080d16] border border-amber-500/30 text-[11px] text-amber-300/90 italic flex items-start space-x-2">
                    <Info className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                    <span>
                      <strong>Epistemic Limitation:</strong> CCTV evidence cannot independently prove true machine functionality.
                      Additional IoT or manual inspection evidence may be required.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : selectedStage === 10 ? (
            /* STAGE 10: EVIDENCE ACQUISITION & ACTION */
            <div className="p-4 rounded-xl bg-[#0b111c] border border-orange-500/40 space-y-4 text-xs font-mono">
              <div className="flex items-center justify-between text-orange-400 font-bold uppercase tracking-wider">
                <span>EVIDENCE ACQUISITION LOOP (Closed-Loop Autonomous Governance)</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-orange-500/20 text-orange-300">Dynamic Remediation</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-sans">
                <div className="p-3 rounded-lg bg-[#101726] border border-[#1e2e46] space-y-1">
                  <div className="text-[10px] text-cyan-400 font-bold font-mono">ACTION 1</div>
                  <div className="text-white font-bold">Wait for Next Window</div>
                  <div className="text-[11px] text-slate-400">
                    Triggered on transient motion. System awaits the subsequent 10-minute training epoch before certifying attendance.
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#101726] border border-[#1e2e46] space-y-1">
                  <div className="text-[10px] text-cyan-400 font-bold font-mono">ACTION 2</div>
                  <div className="text-white font-bold">Check Alternate Camera</div>
                  <div className="text-[11px] text-slate-400">
                    Triggered on occlusion or low trust. Automatically queries secondary camera (CAM-02) to overcome blindspots.
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#101726] border border-[#1e2e46] space-y-1">
                  <div className="text-[10px] text-cyan-400 font-bold font-mono">ACTION 3</div>
                  <div className="text-white font-bold">Collect More Temporal Data</div>
                  <div className="text-[11px] text-slate-400">
                    Increases keyframe sampling density from 1 fps to 5 fps across a 15-minute sliding window to resolve ambiguity.
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#101726] border border-[#1e2e46] space-y-1">
                  <div className="text-[10px] text-cyan-400 font-bold font-mono">ACTION 4</div>
                  <div className="text-white font-bold">Human Verification</div>
                  <div className="text-[11px] text-slate-400">
                    When contradiction persists (e.g. Ghost Batch breach), passport is queued for official human vigilance adjudication.
                  </div>
                </div>
              </div>

              <div className="p-3 rounded bg-[#080d16] border border-[#1e2e46] flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Current Scenario Recommendation:</span>
                <span className="text-orange-300 font-bold">
                  {liveVerdict?.evidence_acquisition?.action_label || "Awaiting live verdict"}
                </span>
                <button
                  onClick={() => onNavigateToTab("queue")}
                  className="px-3 py-1 rounded bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 border border-orange-500/40 text-[11px] font-bold"
                >
                  View Human Governance Queue ➔
                </button>
              </div>
            </div>
          ) : (
            /* DEFAULT STAGE DETAILS */
            <div className="p-4 rounded-xl bg-[#0b111c] border border-[#1e2e46] space-y-3 text-xs font-mono">
              <div className="text-slate-300 font-bold uppercase">{stages[selectedStage - 1].tagline}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-300">
                <div className="space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Standard Operational Procedures:</div>
                  {stages[selectedStage - 1].items.map((item, idx) => (
                    <div key={idx} className="flex items-center space-x-1.5 text-slate-300">
                      <span className="text-cyan-400 font-bold">✓</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 p-3 rounded bg-[#101726] border border-[#1e2e46]">
                  <div className="text-[10px] text-cyan-400 uppercase font-bold">Implementation Safeguards:</div>
                  <div className="text-slate-300 font-sans text-xs leading-relaxed">
                    {stages[selectedStage - 1].details.privacy ||
                      stages[selectedStage - 1].details.hard_veto ||
                      stages[selectedStage - 1].details.rule ||
                      stages[selectedStage - 1].details.engine}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
