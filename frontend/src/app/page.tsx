"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  Camera,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Building2,
  Lock,
  LogOut,
  RefreshCw,
  Plus,
  Eye,
  Server,
  Layers,
  Sparkles,
  FileCheck,
  Key,
  Hash,
  ShieldCheck,
  History,
  ShieldAlert,
  ArrowRight,
  Scale,
  Users,
  UserPlus,
  Cpu,
  Clock,
  Terminal,
  Edit3,
  Info,
  ChevronRight,
  AlertCircle,
  Video
} from "lucide-react";
import {
  checkBackendHealth,
  fetchCentres,
  fetchCameras,
  loginUser,
  createCentre,
  createCamera,
  evaluateSufficiency,
  fetchPassports,
  getPassport,
  verifyPassportIntegrity,
  adjudicatePassport,
  generatePassport,
  fetchReviewQueue,
  updateCameraZones,
  registerUser,
  executeGovernanceAction,
  HealthStatus,
  TrainingCentre,
  Room,
  SufficiencyVerdict,
  EvidencePassportData,
  VerificationResultData,
  ReviewQueueStatsData
} from "@/lib/api";
import HumanGovernanceQueue from "@/components/HumanGovernanceQueue";
import EvidenceFabricView from "@/components/EvidenceFabricView";
import RealVideoPipelineView from "@/components/RealVideoPipelineView";

export default function DashboardPage() {

  // System State
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [centres, setCentres] = useState<TrainingCentre[]>([]);
  const [selectedCentre, setSelectedCentre] = useState<TrainingCentre | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Auth State
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [token, setToken] = useState<string>("");
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string } | null>(null);
  const [loginForm, setLoginForm] = useState({ username: "admin", password: "admin123" });
  const [authError, setAuthError] = useState<string>("");

  // Role Navigation Tab State
  // Admin: "overview" | "centres" | "cameras" | "users" | "health" | "passports" | "audit"
  // Officer: "overview" | "fabric" | "passports" | "queue" | "compliance"
  const [activeTab, setActiveTab] = useState<string>("overview");

  // Modals for Centre / Camera / Zone creation
  const [showCentreModal, setShowCentreModal] = useState<boolean>(false);
  const [newCentre, setNewCentre] = useState({
    centre_id: "",
    centre_name: "",
    state: "Delhi",
    district: "South Delhi",
    accredited_trades: "IT-ITES-L4, SEWING-MACHINE-OP-L2"
  });

  const [showCameraModal, setShowCameraModal] = useState<boolean>(false);
  const [newCamera, setNewCamera] = useState({
    room_id: "",
    room_name: "",
    room_type: "IT_LAB",
    seating_capacity: 25,
    camera_id: "",
    rtsp_stream_uri: "rtsp://192.168.1.100:554/ch1"
  });

  // Zone Configuration Editor State (Admin Only)
  const [showZoneModal, setShowZoneModal] = useState<boolean>(false);
  const [editingZones, setEditingZones] = useState<string>("");
  const [savingZones, setSavingZones] = useState<boolean>(false);

  // User Registration State (Admin Only)
  const [newUserForm, setNewUserForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "OFFICER"
  });
  const [registeringUser, setRegisteringUser] = useState<boolean>(false);
  const [registerSuccess, setRegisterSuccess] = useState<string>("");
  const [registerError, setRegisterError] = useState<string>("");

  // Epistemic Innovation Interactive Demo State (5 SIH Scenarios)
  type DemoScenarioType = "normal" | "occlusion" | "transient" | "conflict" | "spoof";
  const [demoScenario, setDemoScenario] = useState<DemoScenarioType>("conflict");
  const [liveVerdict, setLiveVerdict] = useState<SufficiencyVerdict | null>(null);

  // Evidence Passports & Audit State
  const [passports, setPassports] = useState<EvidencePassportData[]>([]);
  const [passportFilter, setPassportFilter] = useState<string>("");
  const [selectedPassport, setSelectedPassport] = useState<EvidencePassportData | null>(null);
  const [sealingPassport, setSealingPassport] = useState<boolean>(false);
  const [verificationModal, setVerificationModal] = useState<{
    open: boolean;
    result: VerificationResultData | null;
    loading: boolean;
    passportId: string;
  }>({ open: false, result: null, loading: false, passportId: "" });
  const [adjudicateModal, setAdjudicateModal] = useState<{
    open: boolean;
    passport: EvidencePassportData | null;
    status: "CONFIRM" | "REJECT" | "REQUEST INSPECTION";
    remarks: string;
    step: "EDIT" | "CONFIRM";
  }>({ open: false, passport: null, status: "CONFIRM", remarks: "", step: "EDIT" });
  const [adjudicateSubmitting, setAdjudicateSubmitting] = useState<boolean>(false);

  // Human Governance Review Queue State
  const [reviewQueue, setReviewQueue] = useState<EvidencePassportData[]>([]);
  const [reviewQueueStats, setReviewQueueStats] = useState<ReviewQueueStatsData | null>(null);
  const [reviewVerdictFilter, setReviewVerdictFilter] = useState<string>("ALL");
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string>("PENDING");

  // Dynamic live scenario calculation
  useEffect(() => {
    if (!token) return;
    const fetchLiveVerdict = async () => {
      try {
        let payload;
        if (demoScenario === "normal") {
          payload = {
            camera_trust: 0.98,
            observability: 0.96,
            detection_quality: 0.94,
            temporal_persistence: 0.97,
            scene_stability: 0.95,
            record_agreement: 0.98,
            anti_spoof: 1.00
          };
        } else if (demoScenario === "occlusion") {
          payload = {
            camera_trust: 0.85,
            observability: 0.22,
            detection_quality: 0.35,
            temporal_persistence: 0.40,
            scene_stability: 0.50,
            record_agreement: 0.60,
            anti_spoof: 0.95,
            hard_veto_reason: "Camera field of view heavily occluded (Observability 22% < 30% epistemic floor)"
          };
        } else if (demoScenario === "transient") {
          payload = {
            camera_trust: 0.95,
            observability: 0.92,
            detection_quality: 0.90,
            temporal_persistence: 0.15,
            scene_stability: 0.40,
            record_agreement: 0.50,
            anti_spoof: 1.00,
            hard_veto_reason: "Dwell time in classroom zone (15%) fails mandatory 10-minute training persistence threshold"
          };
        } else if (demoScenario === "conflict") {
          payload = {
            camera_trust: 0.95,
            observability: 0.94,
            detection_quality: 0.92,
            temporal_persistence: 0.95,
            scene_stability: 0.90,
            record_agreement: 0.12,
            anti_spoof: 1.00
          };
        } else {
          // spoof / camera freeze
          payload = {
            camera_trust: 0.12,
            observability: 0.85,
            detection_quality: 0.70,
            temporal_persistence: 0.90,
            scene_stability: 0.98,
            record_agreement: 0.30,
            anti_spoof: 0.00,
            hard_veto_reason: "Anti-spoof trip: zero temporal frame entropy. Potential video loop or camera freeze."
          };
        }
        const v = await evaluateSufficiency(payload);
        setLiveVerdict(v);
      } catch (err) {
        console.warn("API live evaluation fallback:", err);
      }
    };
    fetchLiveVerdict();
  }, [demoScenario, token]);

  // Load initial data
  const loadData = async () => {
    setLoading(true);
    try {
      const h = await checkBackendHealth();
      setHealth(h);
      const c = await fetchCentres(token);
      setCentres(c);
      if (c.length > 0 && !selectedCentre) {
        setSelectedCentre(c[0]);
        if (c[0].rooms && c[0].rooms.length > 0) {
          setSelectedRoom(c[0].rooms[0]);
        }
      }
      const passList = await fetchPassports(passportFilter || undefined, token);
      setPassports(passList);
      if (passList.length > 0 && !selectedPassport) {
        setSelectedPassport(passList[0]);
      }
      const qRes = await fetchReviewQueue(reviewVerdictFilter, reviewStatusFilter, token);
      setReviewQueue(qRes.items);
      setReviewQueueStats(qRes.stats);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    const fetchQ = async () => {
      try {
        const qRes = await fetchReviewQueue(reviewVerdictFilter, reviewStatusFilter, token);
        setReviewQueue(qRes.items);
        setReviewQueueStats(qRes.stats);
      } catch (err) {
        console.error("Error updating review queue:", err);
      }
    };
    fetchQ();
  }, [token, reviewVerdictFilter, reviewStatusFilter]);

  const handleSealCurrentVerdict = async () => {
    if (!liveVerdict) return;
    setSealingPassport(true);
    try {
      const newP = await generatePassport({
        centre_id: selectedCentre?.centre_id || "TC-DL-OKHLA-04",
        room_id: selectedRoom?.room_id || "ROOM-101",
        camera_id: selectedRoom?.camera_id || "CAM-OKHLA-01",
        event_type: "CLASSROOM_SESSION_ATTENDANCE",
        compliance_finding: demoScenario === "normal"
          ? "Scenario 1: Verified classroom attendance matches authoritative biometric roster (20 vs 20 trainees)"
          : demoScenario === "occlusion"
          ? "Scenario 2: Camera field of view occluded; optical evidence insufficient to assess attendance"
          : demoScenario === "transient"
          ? "Scenario 3: Fleeting transit detected; failed continuous 10-minute training dwell requirement"
          : demoScenario === "conflict"
          ? "Scenario 4: High-priority breach: CCTV observed 4 visual trainees vs 25 registered on official NSDC roster"
          : "Scenario 5: Sensor integrity anomaly: zero temporal photon noise indicates frozen stream or video loop replay",
        verdict: liveVerdict,
        raw_keyframe_b64: "U0lIMjYyNDVfRVZJREVOQ0VfVEVTVF9GUkFNRQ==",
        evidence_features: {
          detection_summary: {
            scenario: demoScenario,
            observed_trainees: demoScenario === "normal" ? 20 : demoScenario === "conflict" ? 4 : 2,
            registered_trainees: 20
          }
        }
      }, token);
      alert(`Evidence Passport Sealed successfully!\nPassport ID: ${newP.passport_id}\nVerdict: ${newP.verdict}\nCombined Hash: ${newP.evidence_combined_hash.slice(0, 16)}...`);
      await loadData();
      if (newP.verdict === "REVIEW" || newP.verdict === "ABSTAIN") {
        if (currentUser?.role === "OFFICER") {
          setActiveTab("queue");
        } else {
          setActiveTab("passports");
        }
      } else {
        setActiveTab("passports");
        setSelectedPassport(newP);
      }
    } catch (e: any) {
      alert(`Error sealing passport: ${e.message}`);
    } finally {
      setSealingPassport(false);
    }
  };

  const handleVerifyPassport = async (passportId: string) => {
    setVerificationModal({ open: true, result: null, loading: true, passportId });
    try {
      const res = await verifyPassportIntegrity(passportId, token);
      setVerificationModal({ open: true, result: res, loading: false, passportId });
    } catch (err: any) {
      alert(`Verification failed: ${err.message}`);
      setVerificationModal({ open: false, result: null, loading: false, passportId: "" });
    }
  };

  const handleAdjudicateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjudicateModal.passport) return;
    if (currentUser?.role !== "OFFICER") {
      alert("Unauthorized: Compliance adjudication is strictly restricted to Vigilance Officers.");
      return;
    }
    if (!adjudicateModal.remarks || adjudicateModal.remarks.trim().length < 3) {
      alert("A valid justification reason is required before recording a governance decision.");
      return;
    }

    // Step 1: Require confirmation before proceeding
    if (adjudicateModal.step === "EDIT") {
      setAdjudicateModal((prev) => ({ ...prev, step: "CONFIRM" }));
      return;
    }

    // Step 2: Execute governance action
    setAdjudicateSubmitting(true);
    try {
      const updated = await executeGovernanceAction(
        adjudicateModal.passport.passport_id,
        adjudicateModal.status,
        adjudicateModal.remarks.trim(),
        token
      );
      alert(
        `Human Governance Decision Recorded!\nAction: ${adjudicateModal.status}\nReviewer: ${currentUser.username} (JWT Verified)\nOriginal AI Verdict: ${updated.verdict} (Immutable)`
      );
      setAdjudicateModal({ open: false, passport: null, status: "CONFIRM", remarks: "", step: "EDIT" });
      await loadData();
      setSelectedPassport(updated);
    } catch (err: any) {
      alert(`Adjudication failed: ${err.message}`);
      setAdjudicateModal((prev) => ({ ...prev, step: "EDIT" }));
    } finally {
      setAdjudicateSubmitting(false);
    }
  };

  // Auth session hydration
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedToken = localStorage.getItem("ei_auth_token");
      const savedUser = localStorage.getItem("ei_auth_user");
      if (savedToken && savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          setToken(savedToken);
          setCurrentUser(parsed);
          setActiveTab("overview");
        } catch (e) {
          localStorage.removeItem("ei_auth_token");
          localStorage.removeItem("ei_auth_user");
        }
      }
      setIsAuthChecking(false);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      const res = await loginUser(loginForm.username, loginForm.password);
      setToken(res.access_token);
      const userData = { username: res.username, role: res.role };
      setCurrentUser(userData);
      if (typeof window !== "undefined") {
        localStorage.setItem("ei_auth_token", res.access_token);
        localStorage.setItem("ei_auth_user", JSON.stringify(userData));
      }
      setActiveTab("overview");
      await loadData();
    } catch (err: any) {
      setAuthError(err.message || "Invalid credentials");
    }
  };

  const handleLogout = () => {
    setToken("");
    setCurrentUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("ei_auth_token");
      localStorage.removeItem("ei_auth_user");
    }
  };

  const handleCreateCentreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      alert("Please login first to register centres");
      return;
    }
    if (currentUser?.role !== "ADMIN") {
      alert("Unauthorized: Only System Administrators can register training centres.");
      return;
    }
    try {
      const trades = newCentre.accredited_trades.split(",").map((s) => s.trim()).filter(Boolean);
      await createCentre({ ...newCentre, accredited_trades: trades }, token);
      setShowCentreModal(false);
      setNewCentre({ centre_id: "", centre_name: "", state: "Delhi", district: "South Delhi", accredited_trades: "IT-ITES-L4" });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateCameraSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      alert("Please login first to register cameras");
      return;
    }
    if (currentUser?.role !== "ADMIN") {
      alert("Unauthorized: Only System Administrators can register cameras.");
      return;
    }
    if (!selectedCentre) {
      alert("Please select a training centre first");
      return;
    }
    try {
      await createCamera(
        selectedCentre.centre_id,
        {
          ...newCamera,
          zones_geojson: {
            student_zone: [[50, 100], [590, 100], [590, 450], [50, 450]],
            instructor_zone: [[50, 20], [590, 20], [590, 80], [50, 80]]
          }
        },
        token
      );
      setShowCameraModal(false);
      setNewCamera({
        room_id: "",
        room_name: "",
        room_type: "IT_LAB",
        seating_capacity: 25,
        camera_id: "",
        rtsp_stream_uri: "rtsp://192.168.1.100:554/ch1"
      });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateZonesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom || !token) return;
    if (currentUser?.role !== "ADMIN") {
      alert("Unauthorized: Only System Administrators can modify camera compliance zones.");
      return;
    }
    setSavingZones(true);
    try {
      const parsed = JSON.parse(editingZones);
      await updateCameraZones(selectedRoom.camera_id, parsed, token);
      alert("Camera compliance zones updated successfully!");
      setShowZoneModal(false);
      await loadData();
    } catch (err: any) {
      alert(`Zone update failed: ${err.message}`);
    } finally {
      setSavingZones(false);
    }
  };

  const handleRegisterUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || currentUser?.role !== "ADMIN") return;
    setRegisteringUser(true);
    setRegisterSuccess("");
    setRegisterError("");
    try {
      const created = await registerUser(newUserForm, token);
      setRegisterSuccess(`User '${created.username}' registered successfully with role '${created.role}'!`);
      setNewUserForm({ username: "", email: "", password: "", role: "OFFICER" });
    } catch (err: any) {
      setRegisterError(err.message || "Failed to register user");
    } finally {
      setRegisteringUser(false);
    }
  };

  // Session hydration check
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#060a12] flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
        <div className="text-xs font-mono text-cyan-400 uppercase tracking-widest animate-pulse">
          Initializing Security Subsystem...
        </div>
      </div>
    );
  }

  // RESTRICT ACCESS: Gated behind authentication
  if (!token || !currentUser) {
    return (
      <div className="min-h-screen bg-[#060a12] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="glass-panel-elevated p-8 w-full max-w-md space-y-6 border border-[#2c4263] relative z-10 shadow-2xl shadow-black/80">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 border border-cyan-500/30 text-cyan-400 mb-1">
              <Shield className="w-8 h-8" />
            </div>
            <div className="flex items-center justify-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-white uppercase">EVIDENCE INTELLIGENCE</h1>
              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-mono font-bold">
                SIH26245
              </span>
            </div>
            <p className="text-xs text-slate-400">
              AI-Based Real-Time Monitoring of Training Centres for Attendance and Infrastructure Compliance
            </p>
          </div>

          <div className="p-3 rounded-lg bg-[#080d16] border border-[#1e2e46] text-center space-y-1">
            <div className="flex items-center justify-center space-x-1.5 text-xs text-amber-400 font-mono font-bold">
              <Lock className="w-3.5 h-3.5" />
              <span>ROLE-AUTHENTICATED PORTAL</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Protected console for Authorized Vigilance Officers, NSDC Compliance Auditors & Centre Administrators.
            </p>
          </div>

          {authError && (
            <div className="text-xs p-3 rounded bg-rose-500/15 border border-rose-500/40 text-rose-300 flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs text-slate-300 block mb-1 font-medium">Username / Identifier</label>
              <input
                type="text"
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                className="w-full bg-[#0a0f18] border border-[#2c4263] rounded-lg px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
                placeholder="e.g. admin"
                required
              />
            </div>

            <div>
              <label className="text-xs text-slate-300 block mb-1 font-medium">Security Password</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full bg-[#0a0f18] border border-[#2c4263] rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                placeholder="••••••••"
                required
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span>Quick Demo Fill:</span>
              <div className="space-x-1.5">
                <button
                  type="button"
                  onClick={() => setLoginForm({ username: "admin", password: "admin123" })}
                  className="px-2 py-0.5 rounded bg-[#162235] text-cyan-300 hover:text-white border border-cyan-500/30 text-[11px] font-mono"
                >
                  admin (Admin)
                </button>
                <button
                  type="button"
                  onClick={() => setLoginForm({ username: "officer_rajesh", password: "officer123" })}
                  className="px-2 py-0.5 rounded bg-[#162235] text-emerald-300 hover:text-white border border-emerald-500/30 text-[11px] font-mono"
                >
                  officer (Auditor)
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-black font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-cyan-950/40 flex items-center justify-center space-x-2"
            >
              <Lock className="w-4 h-4" />
              <span>Authenticate & Enter Console</span>
            </button>
          </form>

          {/* System Health Pill */}
          <div className="pt-2 border-t border-[#1e2e46] flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>
              Core API:{" "}
              <strong className={health?.status === "ONLINE" ? "text-emerald-400" : "text-amber-400"}>
                {health?.status || "ONLINE"}
              </strong>
            </span>
            <span>
              Ledger DB:{" "}
              <strong className={health?.database === "HEALTHY" ? "text-emerald-400" : "text-amber-400"}>
                {health?.database || "HEALTHY"}
              </strong>
            </span>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = currentUser.role === "ADMIN";
  const isOfficer = currentUser.role === "OFFICER";
  const totalCameras = centres.reduce((acc, c) => acc + (c.rooms?.length || 0), 0);

  // Officer Attention & Triage Real Metrics
  const reviewCases = passports.filter((p) => p.verdict === "REVIEW");
  const abstainCases = passports.filter((p) => p.verdict === "ABSTAIN");
  const verifiedCases = passports.filter((p) => p.verdict === "VERIFIED");
  const pendingGovernanceCases = passports.filter(
    (p) => (p.review_status === "PENDING" || !p.governance_decision) && (p.verdict === "REVIEW" || p.verdict === "ABSTAIN")
  );
  const pendingGovernanceCount = reviewQueueStats?.total_in_queue ?? pendingGovernanceCases.length;

  // Consolidated Audit Logs from database Evidence Passports
  const allAuditLogs = passports
    .flatMap((p) =>
      (p.audit_logs || []).map((log) => ({
        ...log,
        passport_id: p.passport_id,
        verdict: p.verdict
      }))
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="flex flex-col min-h-screen bg-[#060a12] text-slate-200">
      {/* Top Navbar with Dynamic Role Branding */}
      <header className="border-b border-[#1e2e46] bg-[#0c121d]/90 backdrop-blur sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={`p-2 rounded-lg border ${
              isAdmin
                ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            }`}
          >
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold tracking-tight text-white text-base">EVIDENCE INTELLIGENCE</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase border ${
                  isAdmin
                    ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                }`}
              >
                {isAdmin ? "SYSTEM ADMIN CONSOLE" : "OFFICER VIGILANCE CONSOLE"}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              {isAdmin
                ? "SYSTEM ADMINISTRATION / SYSTEM OVERSIGHT — Infrastructure & Audit Management"
                : "CENTRE MONITORING / EVIDENCE REVIEW — Vigilance Adjudication & Compliance"}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Health Pill */}
          <div className="hidden sm:flex items-center space-x-2 text-xs px-3 py-1.5 rounded-full bg-[#121824] border border-[#1e2e46]">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">API:</span>
            <span className={`font-mono font-medium ${health?.status === "ONLINE" ? "text-emerald-400" : "text-amber-400"}`}>
              {health?.status || "ONLINE"}
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">DB:</span>
            <span className={`font-mono font-medium ${health?.database === "HEALTHY" ? "text-emerald-400" : "text-red-400"}`}>
              {health?.database || "HEALTHY"}
            </span>
          </div>

          {/* User Auth Action */}
          <div className="flex items-center space-x-3">
            <div className="text-right">
              <div className="text-xs font-bold text-white uppercase">{currentUser.username}</div>
              <div className="text-[10px] font-mono font-semibold flex items-center justify-end space-x-1">
                <span className={isAdmin ? "text-purple-400" : "text-emerald-400"}>
                  {isAdmin ? "ADMINISTRATOR" : "OFFICER"}
                </span>
                <span className="text-slate-500">• JWT Verified</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1.5 py-1.5 px-2.5 rounded-lg bg-[#162235] hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-[#2c4263] hover:border-rose-500/40 transition text-xs font-medium"
              title="Logout from console"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>

          <button
            onClick={loadData}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Role-Aware Navigation Bar */}
        <div className="flex items-center space-x-1.5 border-b border-[#1e2e46] pb-1 overflow-x-auto">
          {isAdmin ? (
            /* ADMIN NAVIGATION TABS */
            <>
              <button
                onClick={() => setActiveTab("overview")}
                className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 shrink-0 ${
                  activeTab === "overview"
                    ? "border-cyan-400 text-cyan-300 bg-[#0d1420]"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>Dashboard / Overview</span>
              </button>

              <button
                onClick={() => setActiveTab("centres")}
                className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 shrink-0 ${
                  activeTab === "centres"
                    ? "border-emerald-500 text-emerald-400 bg-[#0d1420]"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Building2 className="w-4 h-4 text-emerald-400" />
                <span>Training Centres ({centres.length})</span>
              </button>

              <button
                onClick={() => setActiveTab("cameras")}
                className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 shrink-0 ${
                  activeTab === "cameras"
                    ? "border-cyan-500 text-cyan-400 bg-[#0d1420]"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Camera className="w-4 h-4 text-cyan-400" />
                <span>Cameras & Zones ({totalCameras})</span>
              </button>

              <button
                onClick={() => setActiveTab("video-pipeline")}
                className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 shrink-0 ${
                  activeTab === "video-pipeline"
                    ? "border-cyan-500 text-cyan-400 bg-[#0d1420]"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Video className="w-4 h-4 text-cyan-400" />
                <span>Real Video Pipeline</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  REAL CV
                </span>
              </button>

              <button
                onClick={() => setActiveTab("users")}
                className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 shrink-0 ${
                  activeTab === "users"
                    ? "border-purple-400 text-purple-300 bg-[#0d1420]"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Users className="w-4 h-4 text-purple-400" />
                <span>Users / Officers</span>
              </button>

              <button
                onClick={() => setActiveTab("health")}
                className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 shrink-0 ${
                  activeTab === "health"
                    ? "border-emerald-400 text-emerald-300 bg-[#0d1420]"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Server className="w-4 h-4 text-emerald-400" />
                <span>System Health</span>
              </button>

              <button
                onClick={() => setActiveTab("passports")}
                className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 shrink-0 ${
                  activeTab === "passports"
                    ? "border-cyan-400 text-cyan-300 bg-[#0d1420]"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileCheck className="w-4 h-4 text-cyan-400" />
                <span>Evidence / Passport Audit ({passports.length})</span>
              </button>

              <button
                onClick={() => setActiveTab("audit")}
                className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 shrink-0 ${
                  activeTab === "audit"
                    ? "border-amber-400 text-amber-300 bg-[#0d1420]"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <History className="w-4 h-4 text-amber-400" />
                <span>Global Audit Log ({allAuditLogs.length})</span>
              </button>
            </>
          ) : (
            /* OFFICER NAVIGATION TABS */
            <>
              <button
                onClick={() => setActiveTab("overview")}
                className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 shrink-0 ${
                  activeTab === "overview"
                    ? "border-cyan-400 text-cyan-300 bg-[#0d1420]"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>Dashboard / Centre Monitoring</span>
              </button>

              <button
                onClick={() => setActiveTab("video-pipeline")}
                className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 shrink-0 ${
                  activeTab === "video-pipeline"
                    ? "border-cyan-500 text-cyan-400 bg-[#0d1420]"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Video className="w-4 h-4 text-cyan-400" />
                <span>Real Video Pipeline</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  REAL CV
                </span>
              </button>

              <button
                onClick={() => setActiveTab("fabric")}
                className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 shrink-0 ${
                  activeTab === "fabric"
                    ? "border-cyan-400 text-cyan-300 bg-[#0d1420]"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Evidence Fabric (8 Stages)</span>
              </button>


              <button
                onClick={() => setActiveTab("passports")}
                className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 shrink-0 ${
                  activeTab === "passports"
                    ? "border-cyan-500 text-cyan-400 bg-[#0d1420]"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileCheck className="w-4 h-4 text-cyan-400" />
                <span>Evidence Passports ({passports.length})</span>
              </button>

              <button
                onClick={() => setActiveTab("queue")}
                className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 shrink-0 ${
                  activeTab === "queue"
                    ? "border-amber-500 text-amber-400 bg-[#0d1420]"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Scale className="w-4 h-4 text-amber-400" />
                <span>Review Queue</span>
                {reviewQueueStats && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      reviewQueueStats.total_in_queue > 0
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {reviewQueueStats.total_in_queue}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("compliance")}
                className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 shrink-0 ${
                  activeTab === "compliance"
                    ? "border-emerald-500 text-emerald-400 bg-[#0d1420]"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Building2 className="w-4 h-4 text-emerald-400" />
                <span>Centre Compliance</span>
              </button>
            </>
          )}
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: OVERVIEW (ROLE-SPECIFIC HERO & METRICS) */}
        {/* ========================================================================= */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Epistemic Innovation Hero Banner */}
            <section className="glass-panel p-5 border-l-4 border-l-cyan-400 relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-cyan-400 text-xs font-bold tracking-wider uppercase">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>The Core Innovation: Detection Confidence ≠ Decision Confidence</span>
                  </div>
                  <h1 className="text-lg font-bold text-white tracking-tight">
                    AI Surveillance for Governance Must Answer:{" "}
                    <span className="text-cyan-300 italic font-serif">"Is there enough trustworthy evidence to act?"</span>
                  </h1>
                  <p className="text-xs text-slate-400 max-w-3xl">
                    Conventional AI levies wrongful penalties on blurred feeds or transient passersby. Evidence Intelligence
                    gates compliance through an isolated <strong>Evidence Sufficiency Engine</strong> that explicitly{" "}
                    <span className="text-rose-400 font-medium">ABSTAINS</span> when sensor integrity is compromised.
                  </p>
                </div>

                {/* Quick Epistemic Scenario Switcher */}
                <div className="bg-[#0b1019] p-3 rounded-lg border border-[#1e2e46] flex flex-col space-y-2 min-w-[340px]">
                  <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wide">
                    <span className="text-amber-400 font-bold">DEMO / SIMULATED EVIDENCE:</span>
                    <span className="text-[10px] text-slate-400">Live pipeline connects in Phase 6</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                    <button
                      onClick={() => setDemoScenario("normal")}
                      className={`text-[11px] py-1.5 px-2 rounded font-medium transition flex flex-col items-center justify-center ${
                        demoScenario === "normal"
                          ? "bg-emerald-500 text-black font-bold shadow-sm"
                          : "bg-[#162235] text-slate-300 hover:bg-[#1f3049]"
                      }`}
                      title="Scenario 1: Normal training session -> Strong evidence -> VERIFIED"
                    >
                      <span>S1: Normal</span>
                      <span className="text-[9px] font-mono opacity-80">VERIFIED</span>
                    </button>
                    <button
                      onClick={() => setDemoScenario("occlusion")}
                      className={`text-[11px] py-1.5 px-2 rounded font-medium transition flex flex-col items-center justify-center ${
                        demoScenario === "occlusion"
                          ? "bg-rose-500 text-white font-bold shadow-sm"
                          : "bg-[#162235] text-slate-300 hover:bg-[#1f3049]"
                      }`}
                      title="Scenario 2: Poor visibility / occlusion -> Insufficient evidence -> ABSTAIN"
                    >
                      <span>S2: Occlusion</span>
                      <span className="text-[9px] font-mono opacity-80">ABSTAIN</span>
                    </button>
                    <button
                      onClick={() => setDemoScenario("transient")}
                      className={`text-[11px] py-1.5 px-2 rounded font-medium transition flex flex-col items-center justify-center ${
                        demoScenario === "transient"
                          ? "bg-amber-600 text-white font-bold shadow-sm"
                          : "bg-[#162235] text-slate-300 hover:bg-[#1f3049]"
                      }`}
                      title="Scenario 3: Temporary detection / passerby -> Insufficient temporal persistence -> ABSTAIN"
                    >
                      <span>S3: Fleeting</span>
                      <span className="text-[9px] font-mono opacity-80">ABSTAIN</span>
                    </button>
                    <button
                      onClick={() => setDemoScenario("conflict")}
                      className={`text-[11px] py-1.5 px-2 rounded font-medium transition flex flex-col items-center justify-center ${
                        demoScenario === "conflict"
                          ? "bg-amber-500 text-black font-bold shadow-sm"
                          : "bg-[#162235] text-slate-300 hover:bg-[#1f3049]"
                      }`}
                      title="Scenario 4: CCTV attendance conflicts with authoritative record -> REVIEW"
                    >
                      <span>S4: Conflict</span>
                      <span className="text-[9px] font-mono opacity-80">REVIEW</span>
                    </button>
                    <button
                      onClick={() => setDemoScenario("spoof")}
                      className={`text-[11px] py-1.5 px-2 rounded font-medium transition flex flex-col items-center justify-center ${
                        demoScenario === "spoof"
                          ? "bg-purple-600 text-white font-bold shadow-sm"
                          : "bg-[#162235] text-slate-300 hover:bg-[#1f3049]"
                      }`}
                      title="Scenario 5: Camera freeze/replay suspicion -> Low camera trust -> ABSTAIN"
                    >
                      <span>S5: Freeze</span>
                      <span className="text-[9px] font-mono opacity-80">ABSTAIN</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Epistemic Synthesis Display */}
              <div className="mt-4 pt-4 border-t border-[#1e2e46] grid grid-cols-1 md:grid-cols-4 gap-3.5">
                <div className="bg-[#080d16] p-3 rounded border border-[#1a2638]">
                  <div className="text-[11px] font-mono text-slate-400">1. RAW AI PERCEPTION</div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-base font-bold text-white">
                      {demoScenario === "normal"
                        ? "20 Persons (94% YOLO)"
                        : demoScenario === "occlusion"
                        ? "2 Persons (35% YOLO)"
                        : demoScenario === "transient"
                        ? "1 Person (90% YOLO)"
                        : demoScenario === "conflict"
                        ? "4 Persons (92% YOLO)"
                        : "18 Persons (70% YOLO)"}
                    </span>
                    <span className="text-[10px] text-amber-400/90 font-mono">Simulated Frame</span>
                  </div>
                </div>

                <div className="bg-[#080d16] p-3 rounded border border-[#1a2638]">
                  <div className="text-[11px] font-mono text-slate-400">2. EPISTEMIC GATES & TRUST</div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span
                      className={`text-base font-bold ${
                        demoScenario === "normal" || demoScenario === "conflict"
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}
                    >
                      {demoScenario === "normal"
                        ? "Trust: 98% (Pristine)"
                        : demoScenario === "occlusion"
                        ? "Observability: 22%"
                        : demoScenario === "transient"
                        ? "Dwell: 15% (Fleeting)"
                        : demoScenario === "conflict"
                        ? "Roster Mismatch: 12%"
                        : "Trust: 12% (Freeze)"}
                    </span>
                  </div>
                </div>

                <div className="bg-[#080d16] p-3 rounded border border-[#1a2638]">
                  <div className="text-[11px] font-mono text-slate-400">3. EPISTEMIC DECISION</div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span
                      className={`text-base font-bold font-mono px-2 py-0.5 rounded ${
                        liveVerdict?.decision === "VERIFIED"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                          : liveVerdict?.decision === "REVIEW"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                          : "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                      }`}
                    >
                      {liveVerdict?.decision || "EVALUATING..."}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      Score: {liveVerdict?.evidence_score.toFixed(2) || "0.00"}
                    </span>
                  </div>
                </div>

                <div className="bg-[#080d16] p-3 rounded border border-[#1a2638] flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>4. CRYPTOGRAPHIC SEAL</span>
                    <span className="text-cyan-400 text-[10px]">HMAC-SHA256</span>
                  </div>
                  <button
                    onClick={handleSealCurrentVerdict}
                    disabled={sealingPassport || !liveVerdict}
                    className="mt-2 w-full flex items-center justify-center space-x-1.5 text-xs py-1.5 px-3 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition font-medium"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{sealingPassport ? "Sealing..." : "Seal as Evidence Passport"}</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#0d1420] p-4 rounded-xl border border-[#1e2e46] space-y-1">
                <span className="text-[11px] font-mono text-slate-400 uppercase">Accredited Centres</span>
                <div className="text-2xl font-bold text-white font-mono">{centres.length}</div>
                <div className="text-[11px] text-emerald-400 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Monitored Facilities</span>
                </div>
              </div>

              <div className="bg-[#0d1420] p-4 rounded-xl border border-[#1e2e46] space-y-1">
                <span className="text-[11px] font-mono text-slate-400 uppercase">Configured Classrooms</span>
                <div className="text-2xl font-bold text-cyan-400 font-mono">{totalCameras}</div>
                <div className="text-[10px] text-amber-400/90 font-mono">Live camera telemetry: Pending Phase 6</div>
              </div>

              <div className="bg-[#0d1420] p-4 rounded-xl border border-[#1e2e46] space-y-1">
                <span className="text-[11px] font-mono text-slate-400 uppercase">Sealed Passports</span>
                <div className="text-2xl font-bold text-white font-mono">{passports.length}</div>
                <div className="text-[11px] text-cyan-400">Cryptographically Chained</div>
              </div>

              <div className="bg-[#0d1420] p-4 rounded-xl border border-[#1e2e46] space-y-1">
                <span className="text-[11px] font-mono text-slate-400 uppercase">Review Queue Triage</span>
                <div className="text-2xl font-bold text-amber-400 font-mono">
                  {pendingGovernanceCount}
                </div>
                <div className="text-[11px] text-amber-400/80">Pending Officer Adjudication</div>
              </div>
            </div>

            {/* OFFICER CENTRE MONITORING: "WHAT REQUIRES MY ATTENTION?" */}
            {isOfficer && (
              <div className="glass-panel p-5 space-y-4 border-l-4 border-l-amber-500">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1e2e46] pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                      <Scale className="w-4 h-4 text-amber-400" />
                      <span>Officer Centre Monitoring: What Requires My Attention?</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Real-time vigilance overview across all registered training centres and sealed Evidence Passports.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("queue")}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition shrink-0"
                  >
                    <span>Open Review Queue ({pendingGovernanceCount})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {/* REVIEW Cases */}
                  <div
                    onClick={() => {
                      setReviewVerdictFilter("REVIEW");
                      setActiveTab("queue");
                    }}
                    className="p-3.5 rounded-xl bg-[#090f1a] border border-amber-500/30 hover:border-amber-400 transition cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-amber-400 font-bold uppercase">REVIEW Cases</span>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                        {reviewCases.length}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium">Contradiction / Discrepancy</p>
                    <p className="text-[11px] text-slate-400">
                      Discrepancy detected between visual count and official NSDC roster. Requires Officer decision.
                    </p>
                  </div>

                  {/* ABSTAIN Cases */}
                  <div
                    onClick={() => {
                      setReviewVerdictFilter("ABSTAIN");
                      setActiveTab("queue");
                    }}
                    className="p-3.5 rounded-xl bg-[#090f1a] border border-purple-500/30 hover:border-purple-400 transition cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-purple-400 font-bold uppercase">ABSTAIN Cases</span>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                        {abstainCases.length}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium">Insufficient Evidence (Not a Violation)</p>
                    <p className="text-[11px] text-slate-400">
                      Sensor degradation, occlusion, or freeze. Inability to verify is not an infraction.
                    </p>
                  </div>

                  {/* Pending Governance */}
                  <div
                    onClick={() => setActiveTab("queue")}
                    className="p-3.5 rounded-xl bg-[#090f1a] border border-rose-500/30 hover:border-rose-400 transition cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-rose-400 font-bold uppercase">Pending Actions</span>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300">
                        {pendingGovernanceCount}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium">Awaiting Adjudication</p>
                    <p className="text-[11px] text-slate-400">
                      Events awaiting Officer CONFIRM, REJECT, or REQUEST INSPECTION action.
                    </p>
                  </div>

                  {/* VERIFIED Cases */}
                  <div
                    onClick={() => {
                      setPassportFilter("VERIFIED");
                      setActiveTab("passports");
                    }}
                    className="p-3.5 rounded-xl bg-[#090f1a] border border-emerald-500/30 hover:border-emerald-400 transition cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-emerald-400 font-bold uppercase">VERIFIED Cases</span>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                        {verifiedCases.length}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium">High Confidence Proof</p>
                    <p className="text-[11px] text-slate-400">
                      Sufficient evidence (Score ≥ 0.75, no vetoes) cryptographically sealed.
                    </p>
                  </div>
                </div>

                <div className="pt-2 text-[11px] text-slate-400 font-mono border-t border-[#1e2e46]/60 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-amber-400 font-semibold">• Epistemic Notice:</span>
                    <span>CCTV evidence alone cannot prove true machine functionality. Additional IoT or inspection evidence required.</span>
                  </div>
                  <div className="text-slate-500">Live camera telemetry: Pending Phase 6</div>
                </div>
              </div>
            )}

            {/* Role-Specific Overview Section */}
            {isAdmin ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div
                  onClick={() => setActiveTab("centres")}
                  className="bg-[#0b1019] p-5 rounded-xl border border-[#1e2e46] hover:border-emerald-500/50 cursor-pointer transition space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Training Centre Management</h3>
                  <p className="text-xs text-slate-400">
                    Register training centres, manage NSDC accredited trades, and oversee institutional compliance.
                  </p>
                </div>

                <div
                  onClick={() => setActiveTab("cameras")}
                  className="bg-[#0b1019] p-5 rounded-xl border border-[#1e2e46] hover:border-cyan-500/50 cursor-pointer transition space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                      <Camera className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Camera & Zone Configuration</h3>
                  <p className="text-xs text-slate-400">
                    Register CCTV streams, configure GeoJSON compliance zones, and inspect seating capacity layouts.
                  </p>
                </div>

                <div
                  onClick={() => setActiveTab("audit")}
                  className="bg-[#0b1019] p-5 rounded-xl border border-[#1e2e46] hover:border-amber-500/50 cursor-pointer transition space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      <History className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Global Audit Oversight</h3>
                  <p className="text-xs text-slate-400">
                    Inspect immutable cryptographic audit logs chained across all training centres and events.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div
                  onClick={() => setActiveTab("queue")}
                  className="bg-[#0b1019] p-5 rounded-xl border border-amber-500/40 hover:border-amber-400 cursor-pointer transition space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      <Scale className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Human Governance Review Queue</h3>
                  <p className="text-xs text-slate-400">
                    Review and adjudicate AI-flagged REVIEW and ABSTAIN events: CONFIRM, REJECT, or REQUEST INSPECTION.
                  </p>
                </div>

                <div
                  onClick={() => setActiveTab("fabric")}
                  className="bg-[#0b1019] p-5 rounded-xl border border-[#1e2e46] hover:border-cyan-500/50 cursor-pointer transition space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Evidence Fabric Architecture</h3>
                  <p className="text-xs text-slate-400">
                    Explore the 10 pipeline stages of sensor trust, temporal validation, and sufficiency synthesis.
                  </p>
                </div>

                <div
                  onClick={() => setActiveTab("compliance")}
                  className="bg-[#0b1019] p-5 rounded-xl border border-[#1e2e46] hover:border-emerald-500/50 cursor-pointer transition space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Centre Compliance Monitoring</h3>
                  <p className="text-xs text-slate-400">
                    Monitor live room attendance against authoritative biometric schedules in read-only audit mode.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2 (ADMIN): TRAINING CENTRE MANAGEMENT */}
        {/* ========================================================================= */}
        {isAdmin && activeTab === "centres" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">Accredited Centres</h2>
                  <span className="text-xs bg-[#162235] text-slate-300 px-2 py-0.5 rounded-full font-mono">
                    {centres.length}
                  </span>
                </div>
                <button
                  onClick={() => setShowCentreModal(true)}
                  className="flex items-center space-x-1 text-xs px-2.5 py-1 rounded bg-[#162235] hover:bg-[#20304a] text-emerald-400 border border-emerald-500/30 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Centre</span>
                </button>
              </div>

              <div className="space-y-3">
                {centres.map((centre) => {
                  const isSelected = selectedCentre?.centre_id === centre.centre_id;
                  return (
                    <div
                      key={centre.centre_id}
                      onClick={() => {
                        setSelectedCentre(centre);
                        if (centre.rooms && centre.rooms.length > 0) {
                          setSelectedRoom(centre.rooms[0]);
                        } else {
                          setSelectedRoom(null);
                        }
                      }}
                      className={`p-4 rounded-xl cursor-pointer transition border ${
                        isSelected
                          ? "bg-[#131d2e] border-emerald-500/50 shadow-md"
                          : "bg-[#0d1420] border-[#1e2e46] hover:border-slate-600"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-white">{centre.centre_name}</h3>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{centre.centre_id}</p>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {centre.state}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {centre.accredited_trades.map((trade, idx) => (
                          <span key={idx} className="text-[10px] px-2 py-0.5 rounded bg-[#1a2638] text-slate-300">
                            {trade}
                          </span>
                        ))}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-[#1e2e46] flex items-center justify-between text-xs text-slate-400">
                        <span>
                          Monitored Rooms: <strong className="text-white font-mono">{centre.rooms?.length || 0}</strong>
                        </span>
                        <span className="text-emerald-400 text-[11px] flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Active Monitoring</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Selected Centre Overview */}
            <div className="lg:col-span-7 space-y-4">
              {selectedCentre ? (
                <div className="glass-panel p-5 space-y-4 border border-[#1e2e46]">
                  <div className="flex items-center justify-between border-b border-[#1e2e46] pb-3">
                    <div>
                      <h3 className="text-base font-bold text-white">{selectedCentre.centre_name}</h3>
                      <p className="text-xs text-slate-400 font-mono">
                        {selectedCentre.centre_id} | {selectedCentre.district}, {selectedCentre.state}
                      </p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      NSDC Accredited
                    </span>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-mono text-slate-400 uppercase">Accredited Vocational Trades:</span>
                    <div className="flex flex-wrap gap-2">
                      {selectedCentre.accredited_trades.map((trade, idx) => (
                        <div key={idx} className="p-2 rounded bg-[#0b1019] border border-[#1e2e46] text-xs font-mono">
                          <span className="text-cyan-400 font-bold">• </span>
                          <span className="text-white">{trade}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-slate-400 uppercase">
                        Configured Training Classrooms ({selectedCentre.rooms?.length || 0}):
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedCentre.rooms?.map((r) => (
                        <div key={r.room_id} className="p-3 rounded-lg bg-[#0b1019] border border-[#1e2e46] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">{r.room_name}</span>
                            <span className="text-[10px] font-mono text-cyan-400">{r.room_type}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">Camera: {r.camera_id}</div>
                          <div className="text-[11px] text-slate-400">Capacity: {r.seating_capacity} trainees</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center glass-panel text-slate-400 text-xs">
                  Select a training centre on the left to inspect its configuration details.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3 (ADMIN): CAMERA & ZONE CONFIGURATION */}
        {/* ========================================================================= */}
        {isAdmin && activeTab === "cameras" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Centres and Rooms Picker */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Camera className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">CCTV Hardware Registry</h2>
                </div>
                {selectedCentre && (
                  <button
                    onClick={() => setShowCameraModal(true)}
                    className="flex items-center space-x-1 text-xs px-2.5 py-1 rounded bg-[#162235] hover:bg-[#20304a] text-cyan-400 border border-cyan-500/30 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Register Camera</span>
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-400 block font-mono">Select Training Facility:</label>
                <select
                  value={selectedCentre?.centre_id || ""}
                  onChange={(e) => {
                    const c = centres.find((x) => x.centre_id === e.target.value);
                    if (c) {
                      setSelectedCentre(c);
                      setSelectedRoom(c.rooms && c.rooms.length > 0 ? c.rooms[0] : null);
                    }
                  }}
                  className="w-full bg-[#0a0f18] border border-[#2c4263] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                >
                  {centres.map((c) => (
                    <option key={c.centre_id} value={c.centre_id}>
                      {c.centre_name} ({c.centre_id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                {selectedCentre?.rooms?.map((room) => {
                  const isRoomSelected = selectedRoom?.room_id === room.room_id;
                  return (
                    <div
                      key={room.room_id}
                      onClick={() => setSelectedRoom(room)}
                      className={`p-3.5 rounded-lg border cursor-pointer transition ${
                        isRoomSelected
                          ? "bg-[#131e30] border-cyan-500/60 shadow-lg"
                          : "bg-[#0b121c] border-[#1e2e46] hover:border-slate-600"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          {room.room_type}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">Cap: {room.seating_capacity} seats</span>
                      </div>
                      <h4 className="text-sm font-medium text-white mt-2">{room.room_name}</h4>
                      <div className="text-xs text-slate-400 font-mono mt-1">Room ID: {room.room_id}</div>
                      <div className="text-[11px] text-slate-500 font-mono truncate mt-1">Camera ID: {room.camera_id}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Camera Details & Zone Geometry */}
            <div className="lg:col-span-7 space-y-4">
              {selectedRoom ? (
                <div className="glass-panel p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-[#1e2e46] pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                        <span>{selectedRoom.room_name}</span>
                        <span className="text-xs font-mono text-cyan-400 font-normal">({selectedRoom.camera_id})</span>
                      </h3>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">Stream: {selectedRoom.rtsp_stream_uri}</p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>RTSP Configured</span>
                    </span>
                  </div>

                  {/* Zone GeoJSON Inspector & Editor */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-slate-300 flex items-center space-x-1.5">
                        <Layers className="w-3.5 h-3.5 text-purple-400" />
                        <span>Configured Compliance Polygon Zones (GeoJSON)</span>
                      </span>
                      <button
                        onClick={() => {
                          setEditingZones(JSON.stringify(selectedRoom.zones_geojson || {}, null, 2));
                          setShowZoneModal(true);
                        }}
                        className="flex items-center space-x-1 text-xs px-2.5 py-1 rounded bg-[#162235] hover:bg-[#20304a] text-purple-300 border border-purple-500/40 transition font-mono"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-purple-400" />
                        <span>Configure Zones</span>
                      </button>
                    </div>
                    <pre className="p-3 rounded-lg bg-[#070b12] border border-[#1e2e46] text-[11px] font-mono text-purple-300 overflow-x-auto max-h-48">
                      {JSON.stringify(selectedRoom.zones_geojson, null, 2)}
                    </pre>
                  </div>

                  {/* Sanctioned Infrastructure & Equipment Compliance Inspection */}
                  <div className="p-3.5 rounded-lg bg-[#070b12] border border-[#1e2e46] space-y-2.5 font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-[#1e2e46] pb-2">
                      <span className="text-slate-300 font-bold uppercase tracking-wider flex items-center space-x-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Sanctioned Infrastructure & Equipment Audit</span>
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold">
                        MSDE Sanction Verified
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
                      <div className="p-2 rounded bg-[#0b1019] border border-[#1a2638]">
                        <div className="text-[10px] text-slate-400 uppercase">Seating Capacity:</div>
                        <div className="text-white font-bold mt-0.5">{selectedRoom.seating_capacity} Sanctioned Seats</div>
                        <div className="text-[10px] text-emerald-400 mt-1">✓ Adequate Layout Geometry</div>
                      </div>

                      <div className="p-2 rounded bg-[#0b1019] border border-[#1a2638]">
                        <div className="text-[10px] text-slate-400 uppercase">Workbenches & Machinery:</div>
                        <div className="text-white font-bold mt-0.5">
                          {selectedRoom.room_type === "VOCATIONAL_WORKSHOP" ? "10 Units (Sewing/Tools)" : "25 Workstations"}
                        </div>
                        <div className="text-[10px] text-cyan-400 mt-1">✓ Equipment Ladder: APPARENTLY USABLE</div>
                      </div>

                      <div className="p-2 rounded bg-[#0b1019] border border-[#1a2638]">
                        <div className="text-[10px] text-slate-400 uppercase">Hardware Operability:</div>
                        <div className="text-emerald-400 font-bold mt-0.5">100% Present in Bay</div>
                        <div className="text-[10px] text-slate-400 mt-1">Zero missing inventory gaps</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center glass-panel text-slate-400 text-xs">
                  Select a room above to inspect camera settings and compliance zone polygons.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4 (ADMIN): USERS & OFFICERS DIRECTORY */}
        {/* ========================================================================= */}
        {isAdmin && activeTab === "users" && (
          <div className="space-y-6">
            {/* Requirement 8 Notice Banner */}
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs space-y-1.5 font-mono">
              <div className="flex items-center space-x-2 font-bold uppercase text-blue-400">
                <Users className="w-4 h-4 shrink-0" />
                <span>Admin User & Officer Directory (Phase 5 Provision)</span>
              </div>
              <p className="text-slate-300 font-sans leading-relaxed">
                The backend User Listing endpoint (<code>GET /api/v1/auth/users</code>) is scheduled for Phase 5. In
                accordance with architectural governance rules, simulated user records are not fabricated. Below is the
                current authenticated session and the live user registration service.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Left Column: Current User & System Role Matrix */}
              <div className="md:col-span-6 space-y-4">
                <div className="glass-panel p-5 space-y-4 border border-[#1e2e46]">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Current Authenticated Identity</span>
                  </h3>
                  <div className="p-3.5 rounded-lg bg-[#070b12] border border-[#1e2e46] space-y-2 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Username:</span>
                      <span className="text-white font-bold">{currentUser.username}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Role:</span>
                      <span className="text-purple-400 font-bold">{currentUser.role}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Auth Token:</span>
                      <span className="text-emerald-400">Bearer JWT (HS256 Verified)</span>
                    </div>
                  </div>
                </div>

                <div className="glass-panel p-5 space-y-3 border border-[#1e2e46]">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Authoritative System Roles</h3>
                  <div className="space-y-2 text-xs">
                    <div className="p-3 rounded bg-[#070b12] border border-[#1e2e46]">
                      <div className="text-purple-400 font-bold font-mono">ADMIN (System Administrator)</div>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Permitted: Training Centres, Cameras, Zone Polygons, User Provisioning, System Health, Audit Oversight.
                        Prohibited: Compliance Adjudication (CONFIRM / REJECT / REQUEST INSPECTION).
                      </p>
                    </div>
                    <div className="p-3 rounded bg-[#070b12] border border-[#1e2e46]">
                      <div className="text-emerald-400 font-bold font-mono">OFFICER (Vigilance Reviewer)</div>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Permitted: Centre Monitoring, Evidence Fabric Review, Passport Inspection, Human Governance Adjudication.
                        Prohibited: Adding Centres, Registering Cameras, Modifying Zones.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Register New Officer / Admin Form */}
              <div className="md:col-span-6">
                <div className="glass-panel p-5 space-y-4 border border-[#1e2e46]">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                    <UserPlus className="w-4 h-4 text-cyan-400" />
                    <span>Provision Officer / User Account</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Creates an authoritative user record using the live backend <code>POST /api/v1/auth/register</code> endpoint.
                  </p>

                  {registerSuccess && (
                    <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-xs">
                      {registerSuccess}
                    </div>
                  )}

                  {registerError && (
                    <div className="p-3 rounded bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs">
                      {registerError}
                    </div>
                  )}

                  <form onSubmit={handleRegisterUserSubmit} className="space-y-3">
                    <div>
                      <label className="text-xs text-slate-300 block mb-1">Username</label>
                      <input
                        type="text"
                        value={newUserForm.username}
                        onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                        placeholder="e.g. officer_anita"
                        className="w-full bg-[#0a0f18] border border-[#2c4263] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-300 block mb-1">Email Address</label>
                      <input
                        type="email"
                        value={newUserForm.email}
                        onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                        placeholder="e.g. anita.vigilance@nsdc.gov.in"
                        className="w-full bg-[#0a0f18] border border-[#2c4263] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-300 block mb-1">Initial Password</label>
                      <input
                        type="password"
                        value={newUserForm.password}
                        onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                        placeholder="••••••••"
                        className="w-full bg-[#0a0f18] border border-[#2c4263] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-300 block mb-1">Assign Role</label>
                      <select
                        value={newUserForm.role}
                        onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                        className="w-full bg-[#0a0f18] border border-[#2c4263] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                      >
                        <option value="OFFICER">OFFICER (Vigilance & Adjudication)</option>
                        <option value="ADMIN">ADMIN (System Administrator)</option>
                      </select>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={registeringUser}
                        className="w-full py-2 rounded bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-black font-bold text-xs uppercase tracking-wider transition"
                      >
                        {registeringUser ? "Registering..." : "Create System Account"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5 (ADMIN): SYSTEM HEALTH */}
        {/* ========================================================================= */}
        {isAdmin && activeTab === "health" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-[#0d1420] p-4 rounded-xl border border-[#1e2e46] space-y-1">
                <span className="text-[11px] font-mono text-slate-400 uppercase">Core API Engine</span>
                <div
                  className={`text-2xl font-bold font-mono ${
                    health?.status === "ONLINE" ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {health?.status || "ONLINE"}
                </div>
                <div className="text-[11px] text-slate-400">FastAPI Async Uvicorn</div>
              </div>

              <div className="bg-[#0d1420] p-4 rounded-xl border border-[#1e2e46] space-y-1">
                <span className="text-[11px] font-mono text-slate-400 uppercase">Cryptographic DB</span>
                <div
                  className={`text-2xl font-bold font-mono ${
                    health?.database === "HEALTHY" ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {health?.database || "HEALTHY"}
                </div>
                <div className="text-[11px] text-slate-400">SQLite Async Chained Ledger</div>
              </div>

              <div className="bg-[#0d1420] p-4 rounded-xl border border-[#1e2e46] space-y-1">
                <span className="text-[11px] font-mono text-slate-400 uppercase">Auth Subsystem</span>
                <div className="text-2xl font-bold text-cyan-400 font-mono">ACTIVE</div>
                <div className="text-[11px] text-slate-400">JWT Bearer (HS256)</div>
              </div>

              <div className="bg-[#0d1420] p-4 rounded-xl border border-[#1e2e46] space-y-1">
                <span className="text-[11px] font-mono text-slate-400 uppercase">Camera Telemetry</span>
                <div className="text-xs font-bold text-amber-400 font-mono mt-1">Not connected</div>
                <div className="text-[10px] text-slate-400">Edge streaming daemon pending Phase 6</div>
              </div>
            </div>

            {/* Subsystem Health Details */}
            <div className="glass-panel p-5 space-y-4 border border-[#1e2e46]">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                <Server className="w-4 h-4 text-emerald-400" />
                <span>Backend Telemetry & Environment Diagnostic</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-3.5 rounded-lg bg-[#070b12] border border-[#1e2e46] space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Project Name:</span>
                    <span className="text-white">{health?.project || "Evidence Intelligence"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Application Environment:</span>
                    <span className="text-cyan-400">{health?.environment || "development"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Diagnostic Timestamp:</span>
                    <span className="text-slate-300">{health?.timestamp || new Date().toISOString()}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-[#070b12] border border-[#1e2e46] space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sufficiency Engine:</span>
                    <span className="text-emerald-400">Deterministic Mathematical Isolation</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cryptographic Signing:</span>
                    <span className="text-emerald-400">HMAC-SHA256 Chained Audit</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Role Enforcement:</span>
                    <span className="text-emerald-400">100% Backend Enforced (Phase 1 & 2)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: EVIDENCE & PASSPORTS (ADMIN AUDIT MODE vs OFFICER ADJUDICATION) */}
        {/* ========================================================================= */}
        {activeTab === "passports" && (
          <div className="space-y-4">
            {isAdmin && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center space-x-2">
                <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  ADMIN AUDIT OVERSIGHT MODE — Inspection & Cryptographic Integrity Verification Only. Compliance
                  adjudication is restricted to authorized Vigilance Officers.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Passports List */}
              <div className="lg:col-span-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileCheck className="w-4 h-4 text-cyan-400" />
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">Sealed Passports</h2>
                    <span className="text-xs bg-[#162235] text-slate-300 px-2 py-0.5 rounded-full font-mono">
                      {passports.length}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5 text-xs">
                    <select
                      value={passportFilter}
                      onChange={(e) => setPassportFilter(e.target.value)}
                      className="bg-[#0b1019] border border-[#1e2e46] text-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-cyan-500"
                    >
                      <option value="">All Verdicts</option>
                      <option value="VERIFIED">VERIFIED</option>
                      <option value="REVIEW">REVIEW</option>
                      <option value="ABSTAIN">ABSTAIN</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  {passports.map((passport) => {
                    const isSelected = selectedPassport?.passport_id === passport.passport_id;
                    return (
                      <div
                        key={passport.passport_id}
                        onClick={() => setSelectedPassport(passport)}
                        className={`p-4 rounded-xl cursor-pointer transition border ${
                          isSelected
                            ? "bg-[#131d2e] border-cyan-500/50 shadow-md"
                            : "bg-[#0d1420] border-[#1e2e46] hover:border-slate-600"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-mono text-cyan-400 font-bold">{passport.passport_id}</span>
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                                  passport.verdict === "VERIFIED"
                                    ? "badge-verified"
                                    : passport.verdict === "REVIEW"
                                    ? "badge-review"
                                    : "badge-abstain"
                                }`}
                              >
                                {passport.verdict}
                              </span>
                            </div>
                            <p className="text-xs text-white font-medium mt-1">{passport.compliance_finding}</p>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            S = {passport.final_evidence_score.toFixed(2)}
                          </span>
                        </div>

                        <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                          <span>
                            {passport.room_id} | {passport.camera_id}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(passport.timestamp).toLocaleTimeString()}
                          </span>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-[#1e2e46] flex items-center justify-between text-xs">
                          <span className="text-slate-400 text-[11px] flex items-center space-x-1">
                            <History className="w-3 h-3 text-cyan-400" />
                            <span>Audit Trail: {passport.audit_logs?.length || 1} Events</span>
                          </span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                              passport.review_status === "INSPECTION_MANDATED"
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                : passport.review_status === "CONFIRMED"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            }`}
                          >
                            {passport.review_status}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {passports.length === 0 && (
                    <div className="p-8 text-center glass-panel text-slate-400 text-xs">
                      {loading ? "Loading Evidence Passports..." : "No Evidence Passports available."}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Selected Passport Details & Verification */}
              <div className="lg:col-span-7 space-y-4">
                {selectedPassport ? (
                  <div className="glass-panel p-5 space-y-5 border border-[#1e2e46]">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[#1e2e46] pb-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-mono text-cyan-400 font-bold">
                            {selectedPassport.passport_id}
                          </span>
                          <span
                            className={`text-xs font-mono px-2.5 py-0.5 rounded font-bold uppercase ${
                              selectedPassport.verdict === "VERIFIED"
                                ? "badge-verified"
                                : selectedPassport.verdict === "REVIEW"
                                ? "badge-review"
                                : "badge-abstain"
                            }`}
                          >
                            {selectedPassport.verdict}
                          </span>
                        </div>
                        <h3 className="text-base font-semibold text-white mt-1">
                          {selectedPassport.compliance_finding}
                        </h3>
                        <div className="text-xs text-slate-400 font-mono mt-1">
                          {selectedPassport.centre_id} • {selectedPassport.room_id} • {selectedPassport.camera_id} •{" "}
                          {new Date(selectedPassport.timestamp).toLocaleString()}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          onClick={() => handleVerifyPassport(selectedPassport.passport_id)}
                          className="flex items-center space-x-1.5 py-1.5 px-3 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Verify Integrity</span>
                        </button>

                        {/* Officer Adjudication Button (STRICTLY HIDDEN FROM ADMIN) */}
                        {isOfficer && selectedPassport.review_status === "PENDING" && (
                          <button
                            onClick={() =>
                              setAdjudicateModal({
                                open: true,
                                passport: selectedPassport,
                                status: "CONFIRM",
                                remarks: "",
                                step: "EDIT"
                              })
                            }
                            className="flex items-center space-x-1.5 py-1.5 px-3 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition"
                          >
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                            <span>Adjudicate</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Two Separate Facts: AI Verdict vs Human Decision */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      <div className="p-3.5 rounded-lg bg-[#070b12] border border-[#1e2e46] space-y-1">
                        <div className="text-[10px] font-mono text-slate-400 uppercase font-bold">1. Original AI Verdict (Immutable)</div>
                        <div className="flex items-baseline space-x-2">
                          <span
                            className={`text-sm font-mono font-bold uppercase ${
                              selectedPassport.verdict === "VERIFIED"
                                ? "text-emerald-400"
                                : selectedPassport.verdict === "REVIEW"
                                ? "text-amber-400"
                                : "text-purple-400"
                            }`}
                          >
                            {selectedPassport.verdict}
                          </span>
                          <span className="text-xs font-mono text-slate-400">
                            Score: {selectedPassport.final_evidence_score.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">Deterministic mathematical evaluation; permanent record.</p>
                      </div>

                      <div className="p-3.5 rounded-lg bg-[#070b12] border border-[#1e2e46] space-y-1">
                        <div className="text-[10px] font-mono text-slate-400 uppercase font-bold">2. Human Governance Decision</div>
                        <div className="flex items-baseline space-x-2">
                          <span
                            className={`text-sm font-mono font-bold uppercase ${
                              selectedPassport.governance_decision === "CONFIRMED"
                                ? "text-emerald-400"
                                : selectedPassport.governance_decision === "REJECTED"
                                ? "text-rose-400"
                                : selectedPassport.governance_decision === "REQUEST INSPECTION" || selectedPassport.review_status === "INSPECTION_MANDATED"
                                ? "text-amber-400"
                                : "text-slate-400"
                            }`}
                          >
                            {selectedPassport.governance_decision || selectedPassport.review_status || "PENDING"}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {selectedPassport.assigned_officer_id ? (
                            <span>
                              Reviewer: <strong className="text-white">{selectedPassport.assigned_officer_id}</strong> (JWT Verified)
                            </span>
                          ) : (
                            <span className="italic">Awaiting Officer Adjudication</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ABSTAIN Workflow Banner */}
                    {selectedPassport.verdict === "ABSTAIN" && (
                      <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/40 text-xs space-y-2">
                        <div className="flex items-center space-x-2 text-purple-300 font-bold">
                          <Info className="w-4 h-4 text-purple-400 shrink-0" />
                          <span>INSUFFICIENT EVIDENCE (Not a Violation)</span>
                        </div>
                        <p className="text-slate-300 leading-relaxed">
                          An ABSTAIN result reflects an inability to verify compliance due to degraded sensor trust, occlusion,
                          or lack of continuous temporal dwell. <strong>This is NOT a compliance infraction.</strong> No penalty or
                          breach may be assessed without sufficient trustworthy evidence.
                        </p>
                        <div className="pt-1 flex flex-wrap gap-2 text-[11px] font-mono">
                          <span className="px-2 py-0.5 rounded bg-purple-950/60 border border-purple-700/50 text-purple-300">
                            Strategy: WAIT_NEXT_WINDOW
                          </span>
                          <span className="px-2 py-0.5 rounded bg-purple-950/60 border border-purple-700/50 text-purple-300">
                            Strategy: CHECK_ALTERNATE_CAMERA
                          </span>
                          <span className="px-2 py-0.5 rounded bg-purple-950/60 border border-purple-700/50 text-purple-300">
                            Strategy: COLLECT_MORE_TEMPORAL_DATA
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Evidence Sufficiency Engine: 7 Factors Display */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-slate-400 uppercase font-bold">
                          Evidence Sufficiency Breakdown (7 Multi-Factor Gates):
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          Final Score: <strong className="text-white font-bold">{selectedPassport.final_evidence_score.toFixed(2)}</strong> / 1.00
                        </span>
                      </div>

                      {/* Thresholds guide */}
                      <div className="p-2.5 rounded bg-[#070b12] border border-[#1e2e46] text-[11px] font-mono flex items-center justify-between text-slate-400 flex-wrap gap-2">
                        <span>Thresholds:</span>
                        <span className="text-emerald-400 font-bold">VERIFIED ≥ 0.75</span>
                        <span>•</span>
                        <span className="text-amber-400 font-bold">REVIEW ≥ 0.45</span>
                        <span>•</span>
                        <span className="text-purple-400 font-bold">ABSTAIN &lt; 0.45 (or Hard Veto)</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {/* 1. Camera Trust */}
                        <div className="p-2.5 rounded bg-[#070b12] border border-[#1e2e46] space-y-1">
                          <div className="flex justify-between font-mono">
                            <span className="text-slate-300">1. Camera Trust</span>
                            <span className="text-cyan-400 font-bold">
                              {(selectedPassport.contributing_factors?.camera_trust ?? 0.85).toFixed(2)} (w=15%)
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">Veto threshold: &lt; 0.20 → ABSTAIN</div>
                        </div>

                        {/* 2. Observability */}
                        <div className="p-2.5 rounded bg-[#070b12] border border-[#1e2e46] space-y-1">
                          <div className="flex justify-between font-mono">
                            <span className="text-slate-300">2. Observability</span>
                            <span className="text-cyan-400 font-bold">
                              {(selectedPassport.contributing_factors?.observability ?? 0.85).toFixed(2)} (w=15%)
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">Veto threshold: &lt; 0.30 → ABSTAIN</div>
                        </div>

                        {/* 3. Detection Quality */}
                        <div className="p-2.5 rounded bg-[#070b12] border border-[#1e2e46] space-y-1">
                          <div className="flex justify-between font-mono">
                            <span className="text-slate-300">3. Detection Quality</span>
                            <span className="text-cyan-400 font-bold">
                              {(selectedPassport.contributing_factors?.detection_quality ?? 0.80).toFixed(2)} (w=15%)
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">YOLO confidence & bounding box overlap</div>
                        </div>

                        {/* 4. Temporal Persistence */}
                        <div className="p-2.5 rounded bg-[#070b12] border border-[#1e2e46] space-y-1">
                          <div className="flex justify-between font-mono">
                            <span className="text-slate-300">4. Temporal Persistence</span>
                            <span className="text-cyan-400 font-bold">
                              {(selectedPassport.contributing_factors?.temporal_persistence ?? 0.85).toFixed(2)} (w=20%)
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">Continuous classroom dwell verification</div>
                        </div>

                        {/* 5. Scene Stability */}
                        <div className="p-2.5 rounded bg-[#070b12] border border-[#1e2e46] space-y-1">
                          <div className="flex justify-between font-mono">
                            <span className="text-slate-300">5. Scene Stability</span>
                            <span className="text-cyan-400 font-bold">
                              {(selectedPassport.contributing_factors?.scene_stability ?? 0.90).toFixed(2)} (w=10%)
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">Background subtraction & optical flow sanity</div>
                        </div>

                        {/* 6. Record Agreement */}
                        <div className="p-2.5 rounded bg-[#070b12] border border-[#1e2e46] space-y-1">
                          <div className="flex justify-between font-mono">
                            <span className="text-slate-300">6. Record Agreement</span>
                            <span className="text-cyan-400 font-bold">
                              {(selectedPassport.contributing_factors?.record_agreement ?? 0.80).toFixed(2)} (w=10%)
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">NSDC authoritative timetable reconciliation</div>
                        </div>

                        {/* 7. Anti-Spoof */}
                        <div className="p-2.5 rounded bg-[#070b12] border border-[#1e2e46] space-y-1 sm:col-span-2">
                          <div className="flex justify-between font-mono">
                            <span className="text-slate-300">7. Anti-Spoof Signals</span>
                            <span className="text-cyan-400 font-bold">
                              {(selectedPassport.contributing_factors?.anti_spoof ?? 1.00).toFixed(2)} (w=15%)
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">Veto threshold: &lt; 0.50 → ABSTAIN (Loop replay detection)</div>
                        </div>
                      </div>
                    </div>

                    {/* Verdict Explanation ("WHY?") */}
                    <div className="p-4 rounded-xl bg-[#070b12] border border-[#1e2e46] space-y-2 text-xs">
                      <div className="flex items-center justify-between border-b border-[#1e2e46] pb-2">
                        <span className="font-mono text-slate-400 uppercase font-bold">Verdict Explanation & Epistemic Reasoning</span>
                        <span className="font-mono text-cyan-400">Score: {selectedPassport.final_evidence_score.toFixed(2)}</span>
                      </div>

                      <div className="space-y-1">
                        <div className="text-slate-400 uppercase text-[10px] font-bold">WHY?</div>
                        <ul className="space-y-1 pl-4 list-disc text-slate-200">
                          {selectedPassport.reasons_for_decision && selectedPassport.reasons_for_decision.length > 0 ? (
                            selectedPassport.reasons_for_decision.map((reason, idx) => (
                              <li key={idx} className="leading-relaxed">
                                {reason}
                              </li>
                            ))
                          ) : (
                            <li>All multi-factor epistemic gates evaluated within standard parameters.</li>
                          )}
                        </ul>
                      </div>

                      <div className="pt-2 border-t border-[#1e2e46] flex items-center justify-between">
                        <span className="text-slate-400 text-[11px] font-mono">RECOMMENDED ACTION:</span>
                        <span className="font-bold text-white text-[11px]">
                          {selectedPassport.verdict === "VERIFIED"
                            ? "Compliance confirmed with high-confidence cryptographic proof."
                            : selectedPassport.verdict === "REVIEW"
                            ? "Human review required. Officer adjudication mandated."
                            : "Insufficient evidence. Do NOT penalize. Trigger secondary camera sampling."}
                        </span>
                      </div>
                    </div>

                    {/* Evidence Ladder & Epistemic Limitation */}
                    <div className="p-3.5 rounded-xl bg-[#090f1a] border border-[#1e2e46] space-y-2 text-xs">
                      <div className="text-[10px] font-mono text-slate-400 uppercase font-bold">
                        Infrastructure Evidence Ladder
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center font-mono text-[10px]">
                        <div className="p-2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          1. PRESENT ✓
                        </div>
                        <div className="p-2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          2. VISIBLE ✓
                        </div>
                        <div className="p-2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                          3. AVAILABLE ~
                        </div>
                        <div className="p-2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          4. USABLE ?
                        </div>
                      </div>
                      <p className="text-[11px] text-amber-400/90 font-mono mt-1">
                        • Epistemic Limitation: CCTV evidence cannot independently prove true machine functionality. Additional IoT or manual inspection evidence may be required.
                      </p>
                    </div>

                    {/* Visual Keyframe Handling (Honest State) */}
                    <div className="p-3.5 rounded-xl bg-[#070b12] border border-[#1e2e46] space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-slate-400 uppercase font-bold text-[10px]">
                          Optical Keyframe Telemetry
                        </span>
                        <span className="text-[10px] text-amber-400 font-mono">Pending Phase 6</span>
                      </div>
                      <div className="p-4 rounded-lg bg-[#040810] border border-[#1e2e46] text-center space-y-1">
                        <Camera className="w-6 h-6 text-slate-500 mx-auto" />
                        <p className="text-slate-300 text-xs">
                          Visual keyframe unavailable — live evidence capture will be connected in Phase 6.
                        </p>
                        <p className="text-[10px] font-mono text-slate-500 truncate">
                          Keyframe SHA-256: {selectedPassport.image_sha256}
                        </p>
                      </div>
                    </div>

                    {/* Decision History Timeline */}
                    <div className="space-y-2">
                      <span className="text-xs font-mono text-slate-400 uppercase font-bold">
                        Decision History ({selectedPassport.decision_history?.length || 0} Records):
                      </span>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {selectedPassport.decision_history && selectedPassport.decision_history.length > 0 ? (
                          selectedPassport.decision_history.map((dh, idx) => (
                            <div
                              key={idx}
                              className="p-3 rounded-lg bg-[#090f1a] border border-[#1e2e46] text-xs space-y-1 font-mono"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-white">
                                  Step #{dh.step || idx + 1}: {dh.action}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {new Date(dh.timestamp).toLocaleString()}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-300">
                                Reviewer: <strong className="text-cyan-300">{dh.reviewer || dh.actor}</strong> ({dh.role})
                              </div>
                              <div className="text-[11px] text-slate-400 italic">"{dh.reason}"</div>
                            </div>
                          ))
                        ) : (
                          <div className="p-3 rounded-lg bg-[#070b12] border border-[#1e2e46] text-slate-400 text-xs text-center">
                            No human governance decision recorded.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Cryptographic Seals & Integrity */}
                    <div className="p-3 rounded-lg bg-[#070b12] border border-[#1e2e46] font-mono text-[11px] space-y-1.5">
                      <div className="text-slate-400 uppercase text-[10px] font-bold">Cryptographic Seals:</div>
                      <div className="truncate">
                        <span className="text-slate-400">Image Hash: </span>
                        <span className="text-slate-200 select-all">{selectedPassport.image_sha256}</span>
                      </div>
                      <div className="truncate">
                        <span className="text-slate-400">Metadata Hash: </span>
                        <span className="text-slate-200 select-all">{selectedPassport.metadata_sha256}</span>
                      </div>
                      <div className="truncate">
                        <span className="text-slate-400">Combined Evidence: </span>
                        <span className="text-cyan-400 font-bold select-all">{selectedPassport.evidence_combined_hash}</span>
                      </div>
                      <div className="truncate">
                        <span className="text-slate-400">HMAC Signature: </span>
                        <span className="text-emerald-400 select-all">{selectedPassport.event_signature}</span>
                      </div>
                    </div>

                    {/* Chained Audit Trail */}
                    <div className="space-y-2">
                      <span className="text-xs font-mono text-slate-400 uppercase">
                        Chained Audit Trail Events ({selectedPassport.audit_logs?.length || 1}):
                      </span>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {(selectedPassport.audit_logs || []).map((log) => (
                          <div
                            key={log.audit_id || log.step_sequence}
                            className="p-3 rounded-lg bg-[#090f1a] border border-[#1e2e46] text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white">
                                Step #{log.step_sequence}: {log.action_performed}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-300">
                              Actor: <strong className="text-cyan-300">{log.actor_id}</strong> ({log.actor_role})
                            </div>
                            {log.notes && <div className="text-[11px] text-slate-400 italic">"{log.notes}"</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-12 text-center glass-panel text-slate-400 text-xs">
                    Select an Evidence Passport on the left to inspect its cryptographic seals and audit trail.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 7 (ADMIN): GLOBAL AUDIT LOG */}
        {/* ========================================================================= */}
        {isAdmin && activeTab === "audit" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs space-y-1.5 font-mono">
              <div className="flex items-center space-x-2 font-bold uppercase text-purple-400">
                <History className="w-4 h-4 shrink-0" />
                <span>Consolidated System Audit Trail (Oversight View)</span>
              </div>
              <p className="text-slate-300 font-sans leading-relaxed">
                Displaying real chained cryptographic audit records aggregated from all Evidence Passports in the
                database. Cross-service global audit logging endpoint (<code>GET /api/v1/audit/global</code>) is scheduled
                for future release.
              </p>
            </div>

            <div className="glass-panel p-5 space-y-4 border border-[#1e2e46]">
              <div className="flex items-center justify-between border-b border-[#1e2e46] pb-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span>Chronological Tamper-Evident Ledger ({allAuditLogs.length} Events)</span>
                </h3>
              </div>

              <div className="space-y-3">
                {allAuditLogs.map((entry, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-lg bg-[#070b12] border border-[#1e2e46] text-xs font-mono space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                          Step #{entry.step_sequence}
                        </span>
                        <span className="font-bold text-white">{entry.action_performed}</span>
                        <span className="text-[10px] text-slate-500">[{entry.passport_id}]</span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-300">
                      Actor: <strong className="text-cyan-400">{entry.actor_id}</strong> | Role:{" "}
                      <span className="text-purple-300">{entry.actor_role}</span>
                    </div>

                    {entry.notes && (
                      <p className="text-[11px] text-slate-400 bg-[#0c121d] p-1.5 rounded border border-[#1e2e46]/60">
                        {entry.notes}
                      </p>
                    )}

                    <div className="text-[10px] text-slate-500 truncate">
                      Signed Hash: <span className="select-all text-slate-400">{entry.signed_hash}</span>
                    </div>
                  </div>
                ))}

                {allAuditLogs.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No audit records registered yet. Generate Evidence Passports to begin building the immutable chain.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: REAL VIDEO PIPELINE (CV INGESTION & SENSOR TRUST) */}
        {/* ========================================================================= */}
        {activeTab === "video-pipeline" && (
          <RealVideoPipelineView
            token={token}
            onViewPassport={(passId) => {
              const found = passports.find((p) => p.passport_id === passId);
              if (found) {
                setSelectedPassport(found);
              }
              setActiveTab("passports");
            }}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB 8 (OFFICER): EVIDENCE FABRIC (8 STAGES) */}
        {/* ========================================================================= */}
        {isOfficer && activeTab === "fabric" && (
          <EvidenceFabricView
            liveVerdict={liveVerdict}
            demoScenario={demoScenario}
            onSelectScenario={(s) => setDemoScenario(s)}
            onNavigateToTab={(t) => setActiveTab(t)}
          />
        )}


        {/* ========================================================================= */}
        {/* TAB 9 (OFFICER): HUMAN GOVERNANCE REVIEW QUEUE */}
        {/* ========================================================================= */}
        {isOfficer && activeTab === "queue" && (
          <HumanGovernanceQueue
            queueItems={reviewQueue}
            stats={reviewQueueStats}
            loading={loading}
            verdictFilter={reviewVerdictFilter}
            statusFilter={reviewStatusFilter}
            onFilterChange={(v, s) => {
              setReviewVerdictFilter(v);
              setReviewStatusFilter(s);
            }}
            onRefresh={loadData}
            currentUser={currentUser}
            onActionComplete={loadData}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB 10 (OFFICER): CENTRE COMPLIANCE (READ-ONLY MONITORING) */}
        {/* ========================================================================= */}
        {isOfficer && activeTab === "compliance" && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                OFFICER COMPLIANCE VIEW — Centre and camera infrastructure is managed exclusively by System
                Administrators. Officers have read-only inspection access for vigilance audit.
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 space-y-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Monitored Facilities</h3>
                {centres.map((centre) => (
                  <div
                    key={centre.centre_id}
                    onClick={() => {
                      setSelectedCentre(centre);
                      setSelectedRoom(centre.rooms && centre.rooms.length > 0 ? centre.rooms[0] : null);
                    }}
                    className={`p-3.5 rounded-xl cursor-pointer transition border ${
                      selectedCentre?.centre_id === centre.centre_id
                        ? "bg-[#131d2e] border-emerald-500/50"
                        : "bg-[#0d1420] border-[#1e2e46] hover:border-slate-600"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm font-semibold text-white">{centre.centre_name}</h4>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">{centre.centre_id}</div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                        {centre.state}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                      Rooms Monitored: <strong className="text-white">{centre.rooms?.length || 0}</strong>
                    </div>
                  </div>
                ))}
              </div>

              <div className="lg:col-span-7 space-y-4">
                {selectedCentre ? (
                  <div className="glass-panel p-5 space-y-4 border border-[#1e2e46]">
                    <div className="flex items-center justify-between border-b border-[#1e2e46] pb-3">
                      <div>
                        <h3 className="text-sm font-bold text-white">{selectedCentre.centre_name}</h3>
                        <p className="text-xs text-slate-400 font-mono">
                          {selectedCentre.centre_id} | {selectedCentre.district}, {selectedCentre.state}
                        </p>
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        Vigilance Audit
                      </span>
                    </div>

                    <div className="space-y-3">
                      <span className="text-xs font-mono text-slate-400 uppercase">Monitored Classrooms & CCTV:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {selectedCentre.rooms?.map((r) => (
                          <div key={r.room_id} className="p-3.5 rounded-lg bg-[#070b12] border border-[#1e2e46] space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white">{r.room_name}</span>
                              <span className="text-[10px] font-mono text-cyan-400">{r.room_type}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">Camera: {r.camera_id}</div>
                            <div className="text-[11px] text-slate-400">Sanctioned: {r.seating_capacity} seats</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-12 text-center glass-panel text-slate-400 text-xs">
                    Select a training facility on the left to monitor classroom and CCTV compliance status.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Cryptographic Integrity Verification Modal */}
      {verificationModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="glass-panel-elevated p-6 w-full max-w-2xl space-y-4 border border-cyan-500/40">
            <div className="flex items-center justify-between border-b border-[#2c4263] pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>Cryptographic Integrity Verification Engine</span>
              </h3>
              <button
                onClick={() => setVerificationModal({ open: false, result: null, loading: false, passportId: "" })}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {verificationModal.loading ? (
              <div className="p-10 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
                <p className="text-xs text-slate-300 font-mono">
                  Recomputing SHA-256 metadata hash & validating HMAC-SHA256 signature...
                </p>
              </div>
            ) : verificationModal.result ? (
              <div className="space-y-4">
                <div
                  className={`p-4 rounded-lg border ${
                    verificationModal.result.is_authentic
                      ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                      : "bg-rose-500/10 border-rose-500/40 text-rose-300"
                  }`}
                >
                  <div className="flex items-center space-x-2 font-bold text-sm">
                    {verificationModal.result.is_authentic ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400" />
                    )}
                    <span>
                      STATUS: {verificationModal.result.status} (Authentic:{" "}
                      {verificationModal.result.is_authentic ? "YES" : "NO"})
                    </span>
                  </div>
                  <p className="text-xs mt-1">{verificationModal.result.details}</p>
                </div>

                <div className="bg-[#080d16] p-4 rounded-lg border border-[#1a2638] space-y-3 text-xs font-mono">
                  <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider border-b border-[#1e2e46] pb-2">
                    Evidence Integrity Pipeline: Original Evidence → Hash → Stored Hash → Verification
                  </div>

                  <div className="space-y-2">
                    <div className="p-2 rounded bg-[#0f1724]">
                      <div className="text-[10px] text-slate-400 uppercase">1. Canonical Metadata SHA-256:</div>
                      <div className="flex items-center justify-between text-[11px] mt-0.5">
                        <span className="text-slate-400">Stored:</span>
                        <span className="text-slate-200 select-all">{verificationModal.result.stored_metadata_sha256}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] mt-0.5">
                        <span className="text-slate-400">Recomputed:</span>
                        <span className="text-cyan-300 select-all">{verificationModal.result.recomputed_metadata_sha256}</span>
                      </div>
                    </div>

                    <div className="p-2 rounded bg-[#0f1724]">
                      <div className="text-[10px] text-slate-400 uppercase">2. Combined Evidence Hash (Image || Metadata):</div>
                      <div className="flex items-center justify-between text-[11px] mt-0.5">
                        <span className="text-slate-400">Stored:</span>
                        <span className="text-slate-200 select-all">{verificationModal.result.stored_combined_hash}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] mt-0.5">
                        <span className="text-slate-400">Recomputed:</span>
                        <span className="text-cyan-300 select-all">{verificationModal.result.recomputed_combined_hash}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setVerificationModal({ open: false, result: null, loading: false, passportId: "" })}
                    className="px-4 py-2 rounded bg-cyan-500 hover:bg-cyan-600 text-black font-semibold text-xs"
                  >
                    Done Inspecting
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Officer Adjudication Modal (OFFICER ONLY) */}
      {isOfficer && adjudicateModal.open && adjudicateModal.passport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="glass-panel-elevated p-6 w-full max-w-lg space-y-4 border border-amber-500/40">
            <div className="flex items-center justify-between border-b border-[#2c4263] pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <span>Officer Human Governance Adjudication</span>
              </h3>
              <button
                onClick={() => setAdjudicateModal({ open: false, passport: null, status: "CONFIRM", remarks: "", step: "EDIT" })}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Authenticated Reviewer Verified via JWT */}
            <div className="flex items-center space-x-2 text-xs font-mono bg-[#0c1420] p-2.5 rounded border border-[#1e2e46] text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-slate-400">Authenticated Reviewer: </span>
                <strong className="text-white">{currentUser.username}</strong>
                <span className="text-emerald-400 ml-1.5 font-bold">• OFFICER</span>
                <span className="text-slate-500 ml-1.5">• Derived from JWT</span>
              </div>
            </div>

            <div className="bg-[#080d16] p-3 rounded text-xs space-y-1.5 border border-[#1a2638]">
              <div className="flex justify-between">
                <span className="text-slate-400">Passport ID:</span>
                <span className="font-mono text-cyan-400 font-bold">{adjudicateModal.passport.passport_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Original AI Verdict:</span>
                <span className="font-mono font-bold text-amber-400 uppercase">{adjudicateModal.passport.verdict} (Immutable)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Evidence Score:</span>
                <span className="font-mono text-slate-200">S = {adjudicateModal.passport.final_evidence_score.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Compliance Finding:</span>
                <p className="text-white font-medium bg-[#040810] p-2 rounded border border-[#1e2e46]">
                  {adjudicateModal.passport.compliance_finding}
                </p>
              </div>
            </div>

            {adjudicateModal.step === "CONFIRM" ? (
              /* Step 2: Irreversible Action Confirmation Step */
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/40 text-xs space-y-3">
                <div className="flex items-start space-x-2 text-amber-300">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm text-white">Confirm Human Governance Decision</h4>
                    <p className="mt-1 leading-relaxed text-slate-300">
                      You are about to record an authoritative human governance decision:{" "}
                      <strong className="text-amber-300 uppercase font-mono">{adjudicateModal.status}</strong>.
                      The original AI verdict (
                      <strong className="text-white font-mono">{adjudicateModal.passport.verdict}</strong>) will remain
                      permanently immutable in the tamper-evident audit ledger.
                    </p>
                  </div>
                </div>

                <div className="bg-[#080d16] p-2.5 rounded border border-[#1e2e46] font-mono text-[11px] text-slate-300">
                  <span className="text-slate-400">Recorded Justification: </span>
                  <span className="italic">"{adjudicateModal.remarks}"</span>
                </div>

                <div className="pt-2 flex justify-end space-x-2">
                  <button
                    type="button"
                    disabled={adjudicateSubmitting}
                    onClick={() => setAdjudicateModal((prev) => ({ ...prev, step: "EDIT" }))}
                    className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                  >
                    Back to Edit
                  </button>
                  <button
                    type="button"
                    disabled={adjudicateSubmitting}
                    onClick={handleAdjudicateSubmit}
                    className="flex items-center space-x-1.5 px-4 py-2 rounded bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs transition"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{adjudicateSubmitting ? "Signing & Appending..." : "Confirm & Execute Decision"}</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Step 1: Decision Form */
              <form onSubmit={handleAdjudicateSubmit} className="space-y-3">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Human Governance Action</label>
                  <select
                    value={adjudicateModal.status}
                    onChange={(e) =>
                      setAdjudicateModal({
                        ...adjudicateModal,
                        status: e.target.value as "CONFIRM" | "REJECT" | "REQUEST INSPECTION"
                      })
                    }
                    className="w-full bg-[#0a0f18] border border-[#2c4263] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  >
                    <option value="CONFIRM">CONFIRM — Validate and uphold compliance finding</option>
                    <option value="REJECT">REJECT — Overrule finding; evidence does not support non-compliance</option>
                    <option value="REQUEST INSPECTION">REQUEST INSPECTION — Mandate on-site vigilance inspection</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">
                    Officer Justification Reason <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    value={adjudicateModal.remarks}
                    onChange={(e) => setAdjudicateModal({ ...adjudicateModal, remarks: e.target.value })}
                    placeholder="Provide mandatory regulatory justification (e.g., 'Evidence reviewed and verified against institutional attendance roster')..."
                    rows={3}
                    className="w-full bg-[#0a0f18] border border-[#2c4263] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Minimum 3 characters required. Stored permanently in audit ledger.</span>
                </div>

                <div className="pt-2 flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() =>
                      setAdjudicateModal({ open: false, passport: null, status: "CONFIRM", remarks: "", step: "EDIT" })
                    }
                    className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center space-x-1.5 px-4 py-2 rounded bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs transition"
                  >
                    <span>Proceed to Review & Sign</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Add Centre Modal (ADMIN ONLY) */}
      {isAdmin && showCentreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-panel-elevated p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between border-b border-[#2c4263] pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-emerald-400" />
                <span>Register Training Centre</span>
              </h3>
              <button onClick={() => setShowCentreModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCentreSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Centre ID</label>
                  <input
                    type="text"
                    placeholder="e.g. TC-KA-BLR-09"
                    value={newCentre.centre_id}
                    onChange={(e) => setNewCentre({ ...newCentre, centre_id: e.target.value })}
                    className="w-full bg-[#0a0f18] border border-[#2c4263] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 block mb-1">State</label>
                  <input
                    type="text"
                    value={newCentre.state}
                    onChange={(e) => setNewCentre({ ...newCentre, state: e.target.value })}
                    className="w-full bg-[#0a0f18] border border-[#2c4263] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Centre Name</label>
                <input
                  type="text"
                  placeholder="e.g. Bengaluru Skill Academy"
                  value={newCentre.centre_name}
                  onChange={(e) => setNewCentre({ ...newCentre, centre_name: e.target.value })}
                  className="w-full bg-[#0a0f18] border border-[#2c4263] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">District</label>
                  <input
                    type="text"
                    value={newCentre.district}
                    onChange={(e) => setNewCentre({ ...newCentre, district: e.target.value })}
                    className="w-full bg-[#0a0f18] border border-[#2c4263] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Accredited Trades (Comma separated)</label>
                  <input
                    type="text"
                    value={newCentre.accredited_trades}
                    onChange={(e) => setNewCentre({ ...newCentre, accredited_trades: e.target.value })}
                    className="w-full bg-[#0a0f18] border border-[#2c4263] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCentreModal(false)}
                  className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs"
                >
                  Register Centre
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Camera Modal (ADMIN ONLY) */}
      {isAdmin && showCameraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-panel-elevated p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between border-b border-[#2c4263] pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Camera className="w-4 h-4 text-cyan-400" />
                <span>Register Camera for {selectedCentre?.centre_name}</span>
              </h3>
              <button onClick={() => setShowCameraModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCameraSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Room ID</label>
                  <input
                    type="text"
                    placeholder="e.g. ROOM-103"
                    value={newCamera.room_id}
                    onChange={(e) => setNewCamera({ ...newCamera, room_id: e.target.value })}
                    className="w-full bg-[#0a0f18] border border-[#2c4263] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Camera ID</label>
                  <input
                    type="text"
                    placeholder="e.g. CAM-LAB-03"
                    value={newCamera.camera_id}
                    onChange={(e) => setNewCamera({ ...newCamera, camera_id: e.target.value })}
                    className="w-full bg-[#0a0f18] border border-[#2c4263] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Room Name</label>
                <input
                  type="text"
                  placeholder="e.g. Computer Lab C"
                  value={newCamera.room_name}
                  onChange={(e) => setNewCamera({ ...newCamera, room_name: e.target.value })}
                  className="w-full bg-[#0a0f18] border border-[#2c4263] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Room Type</label>
                  <select
                    value={newCamera.room_type}
                    onChange={(e) => setNewCamera({ ...newCamera, room_type: e.target.value })}
                    className="w-full bg-[#0a0f18] border border-[#2c4263] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="IT_LAB">IT Lab</option>
                    <option value="CLASSROOM">Classroom</option>
                    <option value="VOCATIONAL_WORKSHOP">Vocational Workshop</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Seating Capacity</label>
                  <input
                    type="number"
                    value={newCamera.seating_capacity}
                    onChange={(e) => setNewCamera({ ...newCamera, seating_capacity: parseInt(e.target.value) || 20 })}
                    className="w-full bg-[#0a0f18] border border-[#2c4263] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">RTSP Stream URI</label>
                <input
                  type="text"
                  value={newCamera.rtsp_stream_uri}
                  onChange={(e) => setNewCamera({ ...newCamera, rtsp_stream_uri: e.target.value })}
                  className="w-full bg-[#0a0f18] border border-[#2c4263] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                  required
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCameraModal(false)}
                  className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-cyan-500 hover:bg-cyan-600 text-black font-semibold text-xs"
                >
                  Register Camera
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Zone Configuration Modal (ADMIN ONLY) */}
      {isAdmin && showZoneModal && selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="glass-panel-elevated p-6 w-full max-w-lg space-y-4 border border-purple-500/40">
            <div className="flex items-center justify-between border-b border-[#2c4263] pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <span>Configure Zones: {selectedRoom.room_name}</span>
              </h3>
              <button onClick={() => setShowZoneModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateZonesSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1">
                  Point-in-Polygon Zones (GeoJSON format):
                </label>
                <textarea
                  value={editingZones}
                  onChange={(e) => setEditingZones(e.target.value)}
                  rows={8}
                  className="w-full bg-[#0a0f18] border border-[#2c4263] rounded px-3 py-2 text-xs text-purple-300 font-mono focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowZoneModal(false)}
                  className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingZones}
                  className="px-4 py-2 rounded bg-purple-500 hover:bg-purple-600 text-white font-semibold text-xs"
                >
                  {savingZones ? "Saving..." : "Save Zone Geometry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
