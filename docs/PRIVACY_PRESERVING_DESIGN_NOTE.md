# Privacy-Preserving Design Note (SIH26245)

**Scheme Monitoring Unit — Ministry of Skill Development and Entrepreneurship (MSDE)**  
**Project:** Evidence Intelligence & Compliance Fabric  
**Compliance Standard:** Digital Personal Data Protection (DPDP) Act 2023 / IT Act Section 43A  

---

## 1. Core Privacy Invariant: What is and Isn't Identified

The fundamental design requirement of SIH Problem Statement 26245 states:
> *"Preserve trainee privacy using aggregate presence-detection rather than facial identification wherever a compliance check does not require individual identification."*

Evidence Intelligence operates on an **anonymous aggregate presence model**.

### Table of Identifiability Boundaries

| Feature / Observation | System Capability | Justification & Safeguards |
| :--- | :---: | :--- |
| **Facial Identification / Recognition** | 🚫 **PROHIBITED** | No facial recognition models are loaded in runtime. Zero facial embeddings, landmarks, or biometric vectors are generated or retained. |
| **Individual Facial Geometry** | 🚫 **PROHIBITED** | Faces are neither cropped nor matched against Aadhaar or photo databases. |
| **Emotion / Demographic Profiling** | 🚫 **PROHIBITED** | No age, gender, race, or sentiment analysis is conducted. |
| **Continuous Cloud Video Stream** | 🚫 **PROHIBITED** | Zero live raw video streams are transmitted to central servers or cloud platforms. |
| **Anonymous Bounding Box Count** | ✅ **PERMITTED** | Detects category `person` using lightweight YOLO (3.2M params) to estimate headcount. |
| **Centroid Seating Mapping** | ✅ **PERMITTED** | Computes spatial `(x, y)` ground centroids of bounding boxes within classroom polygons. |
| **Temporal Dwell Persistence** | ✅ **PERMITTED** | Anonymous tracker assigns ephemeral integer Track IDs (`Track_01`, `Track_02`) to verify continuous 10-minute training dwell. IDs expire on exit. |
| **Equipment Presence Verification** | ✅ **PERMITTED** | Verifies presence and apparent availability of approved workbenches, workstations, and machinery against sanctioned inventory. |
| **Cryptographic Keyframe Sealing** | ✅ **PERMITTED** | On compliance event generation, a single keyframe is locally sampled, hashed (`SHA-256`), and digitally signed (`HMAC-SHA256`) for tamper-evident chain-of-custody. |

---

## 2. Edge Processing & Local Video Containment

1. **Local Frame Lifecycle:**
   - Video frames ingested via RTSP/HTTP are stored strictly in a volatile local circular RAM ring buffer.
   - Frames are processed at 1–3 FPS for inference and immediately overwritten.
   - Raw video is never stored to permanent disk or forwarded off-site.

2. **Zero-PII Telemetry:**
   - The only payload transmitted to the central MSDE monitoring unit is a **~4.2 KB signed JSON Evidence Passport**.
   - This passport contains:
     - Mathematical scores (Camera Trust, Observability, Temporal Persistence, Record Agreement)
     - Integer counts (e.g. `cctv_observed: 20`, `registered_roster: 20`)
     - Causal diagnostic reasons
     - SHA-256 hashes and HMAC digital signatures
   - No personally identifiable information (PII) is included in the telemetry packet.

3. **Role-Based Access Control (RBAC):**
   - Access to inspection keyframes within the Evidence Vault requires cryptographic officer tokens (`ADMIN` or `AUDITOR`).
   - Every officer inspection creates an immutable, timestamped entry in the append-only `AuditTrail` ledger.

---

## 3. Epistemic Integrity vs Surveillance Overreach

Evidence Intelligence explicitly acknowledges the limits of optical surveillance:
- **Presence ≠ Compliance:** The system does not attempt invasive behavioral or gaze tracking.
- **The Evidence Ladder:** The system classifies infrastructure availability only up to *Apparently Usable*, explicitly warning officers:
  > *"CCTV optical evidence cannot prove true machine functional calibration; requires IoT power sensor or manual audit verification."*
- **Right to Refusal:** The engine triggers `ABSTAIN` rather than issuing false penalties when video clarity or camera trust is degraded.
