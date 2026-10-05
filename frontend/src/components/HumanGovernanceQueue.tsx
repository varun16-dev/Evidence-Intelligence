"use client";

import React, { useState } from "react";
import {
  Scale,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Eye,
  History,
  ShieldCheck,
  UserCheck,
  ArrowRight,
  RefreshCw,
  FileText,
  Lock,
  ChevronRight,
  Sparkles,
  Building2,
  Camera,
  Info
} from "lucide-react";
import {
  EvidencePassportData,
  ReviewQueueStatsData,
  executeGovernanceAction
} from "@/lib/api";

interface HumanGovernanceQueueProps {
  queueItems: EvidencePassportData[];
  stats: ReviewQueueStatsData | null;
  loading: boolean;
  verdictFilter: string;
  statusFilter: string;
  onFilterChange: (verdict: string, status: string) => void;
  onRefresh: () => void;
  currentUser: { username: string; role: string } | null;
  onActionComplete: () => void;
}

export default function HumanGovernanceQueue({
  queueItems,
  stats,
  loading,
  verdictFilter,
  statusFilter,
  onFilterChange,
  onRefresh,
  currentUser,
  onActionComplete
}: HumanGovernanceQueueProps) {
  // Priority sorting: 1. REVIEW, 2. ABSTAIN, 3. Newest timestamp
  const sortedQueue = [...queueItems].sort((a, b) => {
    if (a.verdict === "REVIEW" && b.verdict !== "REVIEW") return -1;
    if (a.verdict !== "REVIEW" && b.verdict === "REVIEW") return 1;
    if (a.verdict === "ABSTAIN" && b.verdict !== "ABSTAIN") return -1;
    if (a.verdict !== "ABSTAIN" && b.verdict === "ABSTAIN") return 1;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const [selectedCase, setSelectedCase] = useState<EvidencePassportData | null>(
    sortedQueue.length > 0 ? sortedQueue[0] : null
  );

  // Action form state
  const [actionType, setActionType] = useState<"CONFIRM" | "REJECT" | "REQUEST INSPECTION">("CONFIRM");
  const [reasonText, setReasonText] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string>("");
  const [actionErrorMessage, setActionErrorMessage] = useState<string>("");

  // Safety Confirmation Modal state
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);

  // Full inspector modal state
  const [inspectModalOpen, setInspectModalOpen] = useState<boolean>(false);

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    if (!reasonText || reasonText.trim().length < 3) {
      alert("A valid justification reason is required before taking a governance action.");
      return;
    }
    setActionErrorMessage("");
    setConfirmModalOpen(true);
  };

  const handleExecuteConfirmedAction = async () => {
    if (!selectedCase) return;
    setSubmitting(true);
    setActionSuccessMessage("");
    setActionErrorMessage("");
    try {
      const updated = await executeGovernanceAction(
        selectedCase.passport_id,
        actionType,
        reasonText.trim()
      );
      setActionSuccessMessage(
        `Action recorded! Decision: ${updated.governance_decision} | Reviewer: ${currentUser?.username || "Officer"} | Original AI Verdict (${updated.verdict}) remains immutable.`
      );
      setSelectedCase(updated);
      setReasonText("");
      setConfirmModalOpen(false);
      onActionComplete();
    } catch (err: any) {
      setActionErrorMessage(err.message || "Failed to execute governance action");
      setConfirmModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP TRIAGE STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-mono uppercase">Review Queue Total</span>
            <Scale className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {stats ? stats.total_in_queue : 0}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Pending Officer Intervention
          </div>
        </div>

        <div className="glass-panel p-4 border-l-4 border-l-amber-400">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-mono uppercase">Pending REVIEW Cases</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {stats ? stats.pending_review_count : 0}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Contradiction / roster discrepancy
          </div>
        </div>

        <div className="glass-panel p-4 border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-mono uppercase">Pending ABSTAIN Cases</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 mt-1">
            {stats ? stats.pending_abstain_count : 0}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Insufficient evidence (Not a violation)
          </div>
        </div>

        <div className="glass-panel p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-mono uppercase">Adjudicated Decisions</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {stats ? stats.adjudicated_count : 0}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Resolved with cryptographic ledger
          </div>
        </div>
      </div>

      {/* 2. FILTER & TRIAGE CONTROL BAR */}
      <div className="glass-panel p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400 font-mono">Filter by AI Verdict:</span>
          <div className="flex rounded-md bg-[#0a0f18] p-0.5 border border-[#1e2e46]">
            {["ALL", "REVIEW", "ABSTAIN"].map((v) => (
              <button
                key={v}
                onClick={() => onFilterChange(v, statusFilter)}
                className={`text-xs px-2.5 py-1 rounded transition font-medium ${
                  verdictFilter === v
                    ? "bg-[#1f3049] text-white font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400 font-mono">Queue Status:</span>
          <div className="flex rounded-md bg-[#0a0f18] p-0.5 border border-[#1e2e46]">
            {[
              { id: "PENDING", label: "Pending (Needs Action)" },
              { id: "ADJUDICATED", label: "Adjudicated" },
              { id: "ALL", label: "All Items" }
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => onFilterChange(verdictFilter, s.id)}
                className={`text-xs px-2.5 py-1 rounded transition font-medium ${
                  statusFilter === s.id
                    ? "bg-[#1f3049] text-cyan-300 font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <button
            onClick={onRefresh}
            className="p-1.5 rounded bg-[#162235] hover:bg-[#1f3049] text-slate-300 transition"
            title="Refresh Queue"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* 3. MAIN WORKBENCH: LIST + INSPECTOR & ADJUDICATION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Queue Items List (Prioritized) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>CASES IN REVIEW ({sortedQueue.length})</span>
            <span className="text-[10px]">Priority: REVIEW ➔ ABSTAIN ➔ Newest</span>
          </div>

          {loading ? (
            <div className="glass-panel p-8 text-center text-slate-400 text-xs space-y-2">
              <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin mx-auto" />
              <p>Loading review queue cases...</p>
            </div>
          ) : sortedQueue.length === 0 ? (
            <div className="glass-panel p-8 text-center text-slate-400 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mx-auto mb-2" />
              <p className="font-semibold text-slate-300">No pending governance reviews.</p>
              <p className="mt-1 text-[11px] text-slate-500">
                All training events either verified or already adjudicated.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
              {sortedQueue.map((item) => {
                const isSelected = selectedCase?.passport_id === item.passport_id;
                return (
                  <div
                    key={item.passport_id}
                    onClick={() => {
                      setSelectedCase(item);
                      setActionSuccessMessage("");
                      setActionErrorMessage("");
                    }}
                    className={`glass-panel p-3.5 cursor-pointer transition border relative ${
                      isSelected
                        ? "border-cyan-500/80 bg-[#0e1726] shadow-md shadow-cyan-950/40"
                        : "border-[#1e2e46] hover:border-slate-600 bg-[#0a0f18]/90"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs font-bold text-white">
                            {item.passport_id}
                          </span>
                          {/* Machine Verdict Badge */}
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${
                              item.verdict === "REVIEW"
                                ? "badge-review"
                                : item.verdict === "ABSTAIN"
                                ? "badge-abstain"
                                : "badge-verified"
                            }`}
                            title="Immutable Machine Verdict"
                          >
                            AI: {item.verdict}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center space-x-2">
                          <span>{item.centre_id}</span>
                          <span>•</span>
                          <span>{item.room_id}</span>
                        </div>
                      </div>

                      {/* Status / Governance Decision Badge */}
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                          item.review_status === "PENDING"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
                            : item.governance_decision === "CONFIRMED"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : item.governance_decision === "REJECTED"
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                            : "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                        }`}
                      >
                        {item.governance_decision
                          ? `GOV: ${item.governance_decision}`
                          : item.review_status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 mt-2 line-clamp-2 leading-relaxed">
                      {item.compliance_finding}
                    </p>

                    <div className="mt-3 pt-2 border-t border-[#1a2638] flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>Evidence Score: {item.final_evidence_score.toFixed(3)}</span>
                      <span>History: {item.decision_history?.length || 1} step(s)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Case Inspection & Adjudication Workbench */}
        <div className="lg:col-span-7 space-y-4">
          {selectedCase ? (
            <div className="space-y-4">
              {/* Case Header & Epistemic Invariant Reminder */}
              <div className="glass-panel p-4 border-l-4 border-l-cyan-500 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Scale className="w-5 h-5 text-cyan-400" />
                    <h2 className="text-sm font-bold text-white tracking-wide">
                      GOVERNANCE CASE: {selectedCase.passport_id}
                    </h2>
                  </div>
                  <button
                    onClick={() => setInspectModalOpen(true)}
                    className="flex items-center space-x-1 text-xs px-2.5 py-1 rounded bg-[#162235] hover:bg-[#20304a] text-cyan-300 border border-cyan-500/30 transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect Full Passport</span>
                  </button>
                </div>

                <div className="p-2.5 rounded bg-[#080d16] border border-[#1e2e46] flex items-start space-x-2 text-xs">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-slate-300 text-[11px] leading-relaxed">
                    <strong className="text-amber-400">Epistemic Guarantee:</strong> The original AI decision{" "}
                    (<span className="font-mono text-white font-bold">{selectedCase.verdict}</span>, Evidence Score:{" "}
                    <span className="font-mono text-white">{selectedCase.final_evidence_score.toFixed(3)}</span>) is{" "}
                    <strong>permanently immutable</strong>. Your human governance action is recorded as a separate
                    decision in the cryptographic audit trail without overwriting the AI findings.
                  </div>
                </div>

                {/* Explicit ABSTAIN Explanation Banner */}
                {selectedCase.verdict === "ABSTAIN" && (
                  <div className="p-2.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-mono space-y-1">
                    <div className="flex items-center space-x-2 font-bold uppercase text-blue-400">
                      <Info className="w-4 h-4 shrink-0" />
                      <span>INSUFFICIENT EVIDENCE (Not a Violation)</span>
                    </div>
                    <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                      An ABSTAIN verdict represents an inability to verify compliance due to compromised observation
                      (e.g., optical blur, occlusion, or zero temporal entropy). It must NOT be treated as a confirmed
                      compliance violation. Recommended action: Wait for next window or query alternate camera.
                    </p>
                  </div>
                )}
              </div>

              {/* 7 Contributing Evidence Factors Breakdown */}
              <div className="glass-panel p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span className="uppercase font-bold text-white flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>7 Evidence Factors (Deterministic Fusion)</span>
                  </span>
                  <span>Tau_Verified = 0.75 | Tau_Review = 0.45</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {/* Factor 1: Camera Trust */}
                  <div className="bg-[#080d16] p-2.5 rounded border border-[#1e2e46]">
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>1. CAM TRUST</span>
                      <span>w=15%</span>
                    </div>
                    <div className="font-bold text-white font-mono mt-0.5">
                      {selectedCase.camera_trust?.score !== undefined
                        ? (selectedCase.camera_trust.score * 100).toFixed(0) + "%"
                        : "N/A"}
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="bg-cyan-400 h-full rounded-full"
                        style={{ width: `${(selectedCase.camera_trust?.score || 0) * 100}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono mt-1">Veto &lt; 20%</div>
                  </div>

                  {/* Factor 2: Observability */}
                  <div className="bg-[#080d16] p-2.5 rounded border border-[#1e2e46]">
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>2. OBSERVABILITY</span>
                      <span>w=15%</span>
                    </div>
                    <div className="font-bold text-white font-mono mt-0.5">
                      {selectedCase.observability?.score !== undefined
                        ? (selectedCase.observability.score * 100).toFixed(0) + "%"
                        : "N/A"}
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="bg-cyan-400 h-full rounded-full"
                        style={{ width: `${(selectedCase.observability?.score || 0) * 100}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono mt-1">Veto &lt; 30%</div>
                  </div>

                  {/* Factor 3: Detection Quality */}
                  <div className="bg-[#080d16] p-2.5 rounded border border-[#1e2e46]">
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>3. DETECT QUAL</span>
                      <span>w=15%</span>
                    </div>
                    <div className="font-bold text-white font-mono mt-0.5">
                      {selectedCase.detection_quality?.score !== undefined
                        ? (selectedCase.detection_quality.score * 100).toFixed(0) + "%"
                        : "N/A"}
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="bg-cyan-400 h-full rounded-full"
                        style={{ width: `${(selectedCase.detection_quality?.score || 0) * 100}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono mt-1">YOLO Confidence</div>
                  </div>

                  {/* Factor 4: Temporal Persistence */}
                  <div className="bg-[#080d16] p-2.5 rounded border border-[#1e2e46]">
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>4. PERSISTENCE</span>
                      <span>w=20%</span>
                    </div>
                    <div className="font-bold text-white font-mono mt-0.5">
                      {selectedCase.temporal_evidence?.score !== undefined
                        ? (selectedCase.temporal_evidence.score * 100).toFixed(0) + "%"
                        : "N/A"}
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="bg-cyan-400 h-full rounded-full"
                        style={{ width: `${(selectedCase.temporal_evidence?.score || 0) * 100}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono mt-1">10-Min Dwell FSM</div>
                  </div>

                  {/* Factor 5: Scene Stability */}
                  <div className="bg-[#080d16] p-2.5 rounded border border-[#1e2e46]">
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>5. STABILITY</span>
                      <span>w=10%</span>
                    </div>
                    <div className="font-bold text-white font-mono mt-0.5">
                      {selectedCase.scene_stability?.score !== undefined
                        ? (selectedCase.scene_stability.score * 100).toFixed(0) + "%"
                        : "N/A"}
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="bg-cyan-400 h-full rounded-full"
                        style={{ width: `${(selectedCase.scene_stability?.score || 0) * 100}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono mt-1">Background Static</div>
                  </div>

                  {/* Factor 6: Record Agreement */}
                  <div className="bg-[#080d16] p-2.5 rounded border border-[#1e2e46]">
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>6. RECORD AGRMT</span>
                      <span>w=10%</span>
                    </div>
                    <div className="font-bold text-amber-400 font-mono mt-0.5">
                      {selectedCase.record_agreement?.score !== undefined
                        ? (selectedCase.record_agreement.score * 100).toFixed(0) + "%"
                        : "N/A"}
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="bg-amber-400 h-full rounded-full"
                        style={{ width: `${(selectedCase.record_agreement?.score || 0) * 100}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono mt-1">Biometric Roster</div>
                  </div>

                  {/* Factor 7: Anti-Spoof Signals */}
                  <div className="bg-[#080d16] p-2.5 rounded border border-[#1e2e46]">
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>7. ANTI-SPOOF</span>
                      <span>w=15%</span>
                    </div>
                    <div className="font-bold text-white font-mono mt-0.5">
                      {selectedCase.anti_spoof_signals?.score !== undefined
                        ? (selectedCase.anti_spoof_signals.score * 100).toFixed(0) + "%"
                        : "N/A"}
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-400 h-full rounded-full"
                        style={{ width: `${(selectedCase.anti_spoof_signals?.score || 0) * 100}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono mt-1">Veto &lt; 50%</div>
                  </div>
                </div>

                {/* Primary Reasons for Decision */}
                <div className="bg-[#080d16] p-3 rounded border border-[#1e2e46] space-y-1">
                  <div className="text-[10px] text-slate-400 font-mono uppercase">
                    AI Diagnostic Reasons:
                  </div>
                  {selectedCase.reasons_for_decision?.map((r, i) => (
                    <div key={i} className="text-xs text-slate-200 flex items-start space-x-1.5">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Decision History Timeline */}
              <div className="glass-panel p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span className="uppercase font-bold text-white flex items-center space-x-1.5">
                    <History className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Decision History ({selectedCase.decision_history?.length || 0} Events)</span>
                  </span>
                  <span>Unbroken Chain of Custody</span>
                </div>

                {(!selectedCase.decision_history || selectedCase.decision_history.length === 0) ? (
                  <div className="text-xs text-slate-400 italic p-3 bg-[#080d16] rounded border border-[#1e2e46]">
                    No human governance decision recorded yet. Pending initial officer action.
                  </div>
                ) : (
                  <div className="space-y-2 border-l-2 border-slate-700 ml-2 pl-3">
                    {selectedCase.decision_history.map((step, idx) => (
                      <div key={idx} className="relative space-y-1 text-xs">
                        <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-cyan-400 border border-slate-900" />
                        <div className="flex items-center justify-between font-mono">
                          <span className="font-bold text-slate-200">
                            Step #{step.step}: {step.action}
                          </span>
                          <span className="text-[10px] text-slate-400">{step.timestamp}</span>
                        </div>
                        <div className="text-[11px] text-slate-300">
                          {step.reviewer ? (
                            <span>
                              Reviewer: <strong className="text-cyan-300">{step.reviewer}</strong> (OFFICER)
                            </span>
                          ) : (
                            <span>
                              Actor: <strong className="text-slate-400">{step.actor}</strong> ({step.role})
                            </span>
                          )}
                          {step.previous_decision && (
                            <span className="ml-2">
                              Transition: <span className="font-mono text-amber-300">{step.previous_decision}</span> →{" "}
                              <span className="font-mono text-emerald-300 font-bold">{step.new_decision}</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 italic bg-[#080d16] p-1.5 rounded border border-[#1e2e46]/60">
                          "{step.reason}"
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reviewer Action Form */}
              <div className="glass-panel p-4 space-y-3 border-t-2 border-t-cyan-500">
                <div className="flex items-center space-x-2 text-xs font-bold text-white uppercase tracking-wider">
                  <UserCheck className="w-4 h-4 text-cyan-400" />
                  <span>Execute Human Governance Action</span>
                </div>

                {actionSuccessMessage && (
                  <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-xs flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{actionSuccessMessage}</span>
                  </div>
                )}

                {actionErrorMessage && (
                  <div className="p-3 rounded bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs flex items-center space-x-2">
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{actionErrorMessage}</span>
                  </div>
                )}

                {currentUser?.role === "ADMIN" ? (
                  <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1.5 font-mono">
                    <div className="flex items-center space-x-2 font-bold uppercase text-amber-400">
                      <Lock className="w-4 h-4 shrink-0" />
                      <span>ADMIN AUDIT VIEW — Compliance adjudication is restricted to authorized Officers.</span>
                    </div>
                    <p className="text-slate-300 font-sans leading-relaxed">
                      System Administrators maintain read-only audit oversight. Adjudication actions (CONFIRM, REJECT, REQUEST INSPECTION) are strictly reserved for verified Vigilance Officers.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleOpenConfirm} className="space-y-3">
                    <div className="flex items-center justify-between p-2.5 rounded bg-[#0a0f18] border border-[#1e2e46] text-xs font-mono">
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-400">Authenticated Reviewer:</span>
                        <strong className="text-cyan-400">{currentUser?.username || "Authorized Officer"}</strong>
                      </div>
                      <span className="text-[10px] bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800">
                        {currentUser?.role || "OFFICER"} (Verified via JWT)
                      </span>
                    </div>

                    <div>
                      <label className="text-xs text-slate-300 block mb-1">
                        Select Governance Action:
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setActionType("CONFIRM")}
                          className={`text-xs py-2 px-3 rounded font-bold transition flex items-center justify-center space-x-1.5 ${
                            actionType === "CONFIRM"
                              ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/50 border border-emerald-400"
                              : "bg-[#101826] text-slate-300 hover:bg-[#182436] border border-[#1e2e46]"
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>CONFIRM</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActionType("REJECT")}
                          className={`text-xs py-2 px-3 rounded font-bold transition flex items-center justify-center space-x-1.5 ${
                            actionType === "REJECT"
                              ? "bg-rose-600 text-white shadow-md shadow-rose-950/50 border border-rose-400"
                              : "bg-[#101826] text-slate-300 hover:bg-[#182436] border border-[#1e2e46]"
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>REJECT</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActionType("REQUEST INSPECTION")}
                          className={`text-xs py-2 px-3 rounded font-bold transition flex items-center justify-center space-x-1.5 ${
                            actionType === "REQUEST INSPECTION"
                              ? "bg-amber-600 text-white shadow-md shadow-amber-950/50 border border-amber-400"
                              : "bg-[#101826] text-slate-300 hover:bg-[#182436] border border-[#1e2e46]"
                          }`}
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>REQUEST INSPECTION</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-slate-300 block mb-1">
                        Mandatory Justification / Reviewer Reason:
                      </label>
                      <textarea
                        value={reasonText}
                        onChange={(e) => setReasonText(e.target.value)}
                        required
                        rows={3}
                        placeholder={
                          actionType === "CONFIRM"
                            ? "State evidence confirming the breach (e.g. Cross-verified CCTV with student biometric roster)."
                            : actionType === "REJECT"
                            ? "State reason for dismissing finding (e.g. Authorized maintenance scaffold created temporary obstruction)."
                            : "State rationale for on-site inspection (e.g. Camera partition exceeds tolerance; mandate State Flying Squad visit)."
                        }
                        className="w-full bg-[#0a0f18] border border-[#2c4263] rounded p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 leading-relaxed"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-400 font-mono">
                        Chained Hash: SHA256(prev_hash || reviewer || action || timestamp)
                      </span>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex items-center space-x-1.5 px-4 py-2 rounded bg-cyan-500 hover:bg-cyan-600 text-black font-bold text-xs transition"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>Review & Sign Decision...</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          ) : (
            <div className="glass-panel p-12 text-center text-slate-400 text-xs">
              <Scale className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p>Select a case from the review queue to inspect evidence and execute governance.</p>
            </div>
          )}
        </div>
      </div>

      {/* SAFETY CONFIRMATION MODAL */}
      {confirmModalOpen && selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="glass-panel-elevated p-6 w-full max-w-md space-y-4 border border-amber-500/50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#2c4263] pb-3">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Confirm Governance Decision</h3>
              </div>
              <button
                onClick={() => setConfirmModalOpen(false)}
                className="text-slate-400 hover:text-white font-mono"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 text-xs font-mono space-y-2 text-slate-300">
              <p className="text-amber-300 font-bold">
                ⚠️ Permanent Compliance Record Notice:
              </p>
              <p>
                You are about to record a human governance decision:{" "}
                <strong className="text-white uppercase">{actionType}</strong>.
              </p>
              <p>
                The original AI verdict (
                <strong className="text-cyan-300">{selectedCase.verdict}</strong>) is permanently immutable and will
                remain preserved in the audit chain.
              </p>
            </div>

            <div className="text-xs space-y-1 bg-[#080d16] p-3 rounded border border-[#1e2e46] font-mono">
              <div>Reviewer: <strong className="text-cyan-400">{currentUser?.username}</strong> (JWT Verified)</div>
              <div>Passport ID: <strong className="text-white">{selectedCase.passport_id}</strong></div>
              <div className="text-slate-400 mt-1 italic">"{reasonText}"</div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                disabled={submitting}
                className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteConfirmedAction}
                disabled={submitting}
                className="px-4 py-2 rounded bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-black font-bold text-xs"
              >
                {submitting ? "Signing & Committing..." : "Confirm & Sign Decision"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL EVIDENCE PASSPORT INSPECTOR MODAL */}
      {inspectModalOpen && selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="glass-panel-elevated p-6 w-full max-w-3xl space-y-4 max-h-[90vh] overflow-y-auto border border-cyan-500/50">
            <div className="flex items-center justify-between border-b border-[#2c4263] pb-3">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  Evidence Passport Inspector: {selectedCase.passport_id}
                </h3>
              </div>
              <button
                onClick={() => setInspectModalOpen(false)}
                className="text-slate-400 hover:text-white font-mono text-sm px-2 py-1 rounded bg-slate-800"
              >
                ✕ Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-[#080d16] p-3 rounded border border-[#1e2e46] font-mono">
              <div>
                <span className="text-slate-400">Event ID:</span>{" "}
                <span className="text-white">{selectedCase.event_id}</span>
              </div>
              <div>
                <span className="text-slate-400">Timestamp:</span>{" "}
                <span className="text-white">{selectedCase.timestamp}</span>
              </div>
              <div>
                <span className="text-slate-400">Centre / Camera:</span>{" "}
                <span className="text-white">
                  {selectedCase.centre_id} / {selectedCase.camera_id}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Signing Key ID:</span>{" "}
                <span className="text-cyan-400">{selectedCase.signing_key_id}</span>
              </div>
            </div>

            {/* Visual Keyframes (Requirement 9: Honest state) */}
            <div className="space-y-1.5">
              <span className="text-xs font-mono text-slate-400 uppercase">
                Visual Evidence Status:
              </span>
              <div className="p-3 rounded bg-[#080d16] border border-[#1e2e46] text-xs font-mono space-y-2">
                <div className="text-amber-400 flex items-center space-x-1.5 font-bold">
                  <Info className="w-4 h-4" />
                  <span>Visual keyframe unavailable — live evidence capture will be connected in Phase 6.</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Per epistemic architecture rules, simulated or synthetic images are not misrepresented as real CCTV frames.
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  Registered Image Hash: {selectedCase.image_sha256}
                </div>
              </div>
            </div>

            {/* Cryptographic Hashes Verification */}
            <div className="bg-[#080d16] p-3 rounded border border-[#1e2e46] space-y-1.5 font-mono text-[11px]">
              <div className="text-xs font-bold text-cyan-300 uppercase mb-1">
                Cryptographic Seals & Digital Signatures:
              </div>
              <div className="truncate">
                <span className="text-slate-400">Metadata SHA-256: </span>
                <span className="text-slate-200">{selectedCase.metadata_sha256}</span>
              </div>
              <div className="truncate">
                <span className="text-slate-400">Combined Evidence Hash: </span>
                <span className="text-cyan-400 font-bold">{selectedCase.evidence_combined_hash}</span>
              </div>
              <div className="truncate">
                <span className="text-slate-400">HMAC-SHA256 Signature: </span>
                <span className="text-emerald-400">{selectedCase.event_signature}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setInspectModalOpen(false)}
                className="px-4 py-2 rounded bg-cyan-500 hover:bg-cyan-600 text-black font-semibold text-xs"
              >
                Done Inspecting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
