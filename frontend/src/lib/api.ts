export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";


export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface Room {
  room_id: string;
  centre_id: string;
  room_name: string;
  room_type: string;
  seating_capacity: number;
  camera_id: string;
  rtsp_stream_uri: string;
  zones_geojson: Record<string, any>;
  created_at: string;
}

export interface TrainingCentre {
  centre_id: string;
  centre_name: string;
  state: string;
  district: string;
  accredited_trades: string[];
  is_active: boolean;
  created_at: string;
  rooms?: Room[];
}

export interface HealthStatus {
  status: string;
  timestamp: string;
  project: string;
  environment: string;
  database: string;
}

export async function checkBackendHealth(): Promise<HealthStatus> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
    if (!res.ok) throw new Error("Health check failed");
    return await res.json();
  } catch (error) {
    return {
      status: "OFFLINE",
      timestamp: new Date().toISOString(),
      project: "Evidence Intelligence API",
      environment: "unknown",
      database: "DISCONNECTED"
    };
  }
}

export async function loginUser(username: string, password: string): Promise<{ access_token: string; role: string; username: string }> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Login failed" }));
    throw new Error(err.detail || "Authentication error");
  }
  return await res.json();
}

export async function getProfile(token: string): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to load user profile");
  return await res.json();
}

export async function registerUser(
  userData: { username: string; email: string; password: string; role?: string },
  token: string
): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(userData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Registration failed" }));
    throw new Error(err.detail || "User registration error");
  }
  return await res.json();
}

export async function fetchCentres(token?: string): Promise<TrainingCentre[]> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/centres`, {
      headers,
      cache: "no-store"
    });
    if (!res.ok) throw new Error("Failed to load training centres");
    return await res.json();
  } catch (err) {
    console.warn("fetchCentres connection fallback:", err);
    return [];
  }
}

export async function fetchCameras(token?: string): Promise<Room[]> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/cameras`, {
      headers,
      cache: "no-store"
    });
    if (!res.ok) throw new Error("Failed to load cameras");
    return await res.json();
  } catch (err) {
    console.warn("fetchCameras connection fallback:", err);
    return [];
  }
}

export async function createCentre(data: { centre_id: string; centre_name: string; state: string; district: string; accredited_trades: string[] }, token: string): Promise<TrainingCentre> {
  const res = await fetch(`${API_BASE_URL}/centres`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to create centre" }));
    throw new Error(err.detail || "Failed to create centre");
  }
  return await res.json();
}

export async function createCamera(centreId: string, data: { room_id: string; room_name: string; room_type: string; seating_capacity: number; camera_id: string; rtsp_stream_uri: string; zones_geojson: any }, token: string): Promise<Room> {
  const res = await fetch(`${API_BASE_URL}/centres/${centreId}/cameras`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to create camera" }));
    throw new Error(err.detail || "Failed to create camera");
  }
  return await res.json();
}

export async function updateCameraZones(cameraId: string, zonesGeojson: any, token: string): Promise<Room> {
  const res = await fetch(`${API_BASE_URL}/cameras/${cameraId}/zones`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ zones_geojson: zonesGeojson })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to update zones" }));
    throw new Error(err.detail || "Failed to update zones");
  }
  return await res.json();
}

export interface SufficiencyVerdict {
  evaluation_id?: string;
  evaluated_at?: string;
  decision: "VERIFIED" | "REVIEW" | "ABSTAIN";
  evidence_score: number;
  confidence: number;
  reasons: string[];
  contributing_factors: {
    camera_trust: number;
    observability: number;
    detection_quality: number;
    temporal_persistence: number;
    scene_stability: number;
    record_agreement: number;
    anti_spoof: number;
  };
  compliance_reasoning?: {
    cctv_attendance_estimate: number;
    authoritative_attendance_record: number;
    approved_infra_inventory: Record<string, number>;
    observed_infra_state: Record<string, number>;
    evidence_ladder: {
      level: "PRESENT" | "VISIBLE" | "APPARENTLY_AVAILABLE" | "APPARENTLY_USABLE";
      stages: Record<string, boolean>;
      epistemic_disclaimer: string;
    };
  };
  evidence_acquisition?: {
    status: "SUFFICIENT" | "MORE_OBSERVATION_REQUIRED";
    recommended_action: string;
    action_label: string;
    strategy_details: string;
  };
  telemetry?: {
    continuous_streaming_avoided: boolean;
    edge_event_packet_size_kb: number;
    bandwidth_saved_percent: number;
    raw_video_mbps_prevented: number;
    privacy_mode: string;
  };
}

export async function evaluateSufficiency(factors: {
  camera_trust: number;
  observability: number;
  detection_quality: number;
  temporal_persistence: number;
  scene_stability: number;
  record_agreement: number;
  anti_spoof: number;
  hard_veto_reason?: string;
}): Promise<SufficiencyVerdict> {
  const res = await fetch(`${API_BASE_URL}/evaluate/sufficiency`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(factors)
  });
  if (!res.ok) {
    throw new Error("Failed to evaluate evidence sufficiency");
  }
  return await res.json();
}

export interface AuditRecordData {
  audit_id: number;
  passport_id: string;
  step_sequence: number;
  actor_id: string;
  actor_role: string;
  action_performed: string;
  notes?: string;
  client_ip_or_host?: string;
  timestamp: string;
  signed_hash: string;
}

export interface DecisionHistoryItemData {
  step: number;
  reviewer?: string | null;
  actor: string;
  role: string;
  action: string;
  previous_decision?: string | null;
  new_decision: string;
  reason: string;
  timestamp: string;
  original_ai_verdict?: string | null;
  evidence_score?: number | null;
}

export interface ReviewQueueStatsData {
  total_in_queue: number;
  pending_review_count: number;
  pending_abstain_count: number;
  adjudicated_count: number;
}

export interface EvidencePassportData {
  passport_id: string;
  event_id: string;
  centre_id: string;
  room_id: string;
  camera_id: string;
  timestamp: string;
  event_type: string;
  final_evidence_score: number;
  verdict: "VERIFIED" | "REVIEW" | "ABSTAIN";
  compliance_finding: string;
  reasons_for_decision: string[];
  raw_keyframe_uri: string;
  annotated_keyframe_uri: string;
  review_status: string;
  governance_decision?: string | null;
  decision_history: DecisionHistoryItemData[];
  assigned_officer_id?: string;
  adjudicated_at?: string;
  officer_remarks?: string;
  contributing_factors?: Record<string, any>;
  camera_trust?: { score: number; [key: string]: any };
  observability?: { score: number; [key: string]: any };
  detection_quality?: { score: number; [key: string]: any };
  temporal_evidence?: { score: number; [key: string]: any };
  scene_stability?: { score: number; [key: string]: any };
  record_agreement?: { score: number; [key: string]: any };
  anti_spoof_signals?: { score: number; [key: string]: any };
  detection_summary?: Record<string, any>;
  image_sha256: string;
  metadata_sha256: string;
  evidence_combined_hash: string;
  event_signature: string;
  signing_key_id: string;
  created_at: string;
  audit_logs: AuditRecordData[];
}

export interface ReviewQueueResponseData {
  stats: ReviewQueueStatsData;
  items: EvidencePassportData[];
}

export interface VerificationResultData {
  passport_id: string;
  is_authentic: boolean;
  status: "VALID" | "TAMPERED_METADATA" | "TAMPERED_IMAGE" | "INVALID_SIGNATURE" | "CORRUPTED";
  stored_metadata_sha256: string;
  recomputed_metadata_sha256: string;
  stored_image_sha256: string;
  recomputed_image_sha256?: string;
  stored_combined_hash: string;
  recomputed_combined_hash: string;
  signature_valid: boolean;
  details: string;
}

function getAuthHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const t = token || (typeof window !== "undefined" ? localStorage.getItem("ei_auth_token") : null);
  if (t) {
    headers["Authorization"] = `Bearer ${t}`;
  }
  return headers;
}

export async function fetchPassports(verdict?: string, token?: string): Promise<EvidencePassportData[]> {
  try {
    const url = verdict
      ? `${API_BASE_URL}/passports?verdict=${encodeURIComponent(verdict)}`
      : `${API_BASE_URL}/passports`;
    const res = await fetch(url, {
      headers: getAuthHeaders(token),
      cache: "no-store"
    });
    if (!res.ok) throw new Error("Failed to load Evidence Passports");
    return await res.json();
  } catch (err) {
    console.warn("fetchPassports connection fallback:", err);
    return [];
  }
}

export async function getPassport(passportId: string, token?: string): Promise<EvidencePassportData> {
  const res = await fetch(`${API_BASE_URL}/passports/${passportId}`, {
    headers: getAuthHeaders(token),
    cache: "no-store"
  });
  if (!res.ok) throw new Error("Failed to load Evidence Passport details");
  return await res.json();
}

export async function verifyPassportIntegrity(passportId: string, token?: string): Promise<VerificationResultData> {
  const headers = getAuthHeaders(token);
  headers["Content-Type"] = "application/json";
  const res = await fetch(`${API_BASE_URL}/passports/${passportId}/verify`, {
    method: "POST",
    headers
  });
  if (!res.ok) throw new Error("Cryptographic integrity verification failed");
  return await res.json();
}

export async function fetchReviewQueue(verdict?: string, status: string = "PENDING", token?: string): Promise<ReviewQueueResponseData> {
  try {
    const params = new URLSearchParams();
    if (verdict && verdict !== "ALL") params.append("verdict", verdict);
    if (status) params.append("status", status);
    const url = `${API_BASE_URL}/governance/review-queue?${params.toString()}`;
    const res = await fetch(url, {
      headers: getAuthHeaders(token),
      cache: "no-store"
    });
    if (!res.ok) throw new Error("Failed to load governance review queue");
    return await res.json();
  } catch (err) {
    console.warn("fetchReviewQueue connection fallback:", err);
    return {
      stats: {
        total_in_queue: 0,
        pending_review_count: 0,
        pending_abstain_count: 0,
        adjudicated_count: 0
      },
      items: []
    };
  }
}

export async function executeGovernanceAction(
  passportId: string,
  action: "CONFIRM" | "REJECT" | "REQUEST INSPECTION",
  reason: string,
  token?: string
): Promise<EvidencePassportData> {
  const headers = getAuthHeaders(token);
  headers["Content-Type"] = "application/json";
  // Reviewer identity is derived exclusively on the backend from the JWT token
  const res = await fetch(`${API_BASE_URL}/governance/passports/${passportId}/action`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, reason })
  });
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Your session is no longer valid. Please sign in again.");
    }
    if (res.status === 403) {
      throw new Error("Your role is not authorized to perform this governance action.");
    }
    if (res.status === 404) {
      throw new Error("Evidence Passport not found.");
    }
    if (res.status === 409) {
      throw new Error("Conflict: This case has already been adjudicated.");
    }
    const err = await res.json().catch(() => ({ detail: "Failed to execute governance action" }));
    throw new Error(err.detail || "Failed to execute governance action");
  }
  return await res.json();
}

export async function adjudicatePassport(
  passportId: string,
  data: { review_status: string; officer_remarks: string },
  token?: string
): Promise<EvidencePassportData> {
  const headers = getAuthHeaders(token);
  headers["Content-Type"] = "application/json";
  const res = await fetch(`${API_BASE_URL}/passports/${passportId}/adjudicate`, {
    method: "POST",
    headers,
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Your session is no longer valid. Please sign in again.");
    }
    if (res.status === 403) {
      throw new Error("Your role is not authorized to perform this adjudication.");
    }
    if (res.status === 404) {
      throw new Error("Evidence Passport not found.");
    }
    const err = await res.json().catch(() => ({ detail: "Failed to record officer adjudication" }));
    throw new Error(err.detail || "Failed to record officer adjudication");
  }
  return await res.json();
}

export async function generatePassport(data: any, token?: string): Promise<EvidencePassportData> {
  const headers = getAuthHeaders(token);
  headers["Content-Type"] = "application/json";
  const res = await fetch(`${API_BASE_URL}/passports/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error("Failed to generate passport");
  return await res.json();
}

export interface TestClipData {
  filename: string;
  title: string;
  description: string;
  event_type: string;
  default_expected_headcount: number;
}

export interface ClipAnalysisResponseData {
  analysis_id: string;
  camera_id: string;
  room_id: string;
  centre_id: string;
  source_type: string;
  clip_filename: string;
  frames_processed: number;
  tracks_detected: number;
  verified_trainees: number;
  transient_loiterers: number;
  evidence_score: number;
  verdict: "VERIFIED" | "REVIEW" | "ABSTAIN";
  reasons: string[];
  passport_id: string;
  keyframe_available: boolean;
  image_sha256: string;
  raw_keyframe_uri: string;
  annotated_keyframe_uri: string;
  processing_status: string;
  processing_duration_seconds: number;
  contributing_factors: {
    camera_trust: number;
    observability: number;
    detection_quality: number;
    temporal_persistence: number;
    scene_stability: number;
    record_agreement: number;
    anti_spoof: number;
  };
}

export async function fetchTestClips(token?: string): Promise<TestClipData[]> {
  const headers = getAuthHeaders(token);
  const res = await fetch(`${API_BASE_URL}/cameras/test-clips`, { headers });
  if (!res.ok) throw new Error("Failed to fetch available test clips");
  return await res.json();
}

export async function analyzeCameraClip(
  cameraId: string,
  data: {
    clip_filename: string;
    max_frames?: number;
    sample_fps?: number;
    expected_headcount?: number;
  },
  token?: string
): Promise<ClipAnalysisResponseData> {
  const headers = getAuthHeaders(token);
  headers["Content-Type"] = "application/json";
  const res = await fetch(`${API_BASE_URL}/cameras/${cameraId}/analyze-clip`, {
    method: "POST",
    headers,
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Video analysis failed" }));
    throw new Error(err.detail || "Video analysis failed");
  }
  return await res.json();
}



