from typing import Tuple, Dict, Any, Optional
from collections import deque
import cv2
import numpy as np
from pydantic import BaseModel

class CameraTrustMetrics(BaseModel):
    blur_score: float # 0.0 (unusable blur) to 1.0 (crystal sharp)
    raw_laplacian_var: float
    brightness_score: float # 0.0 (pitch black or blinding glare) to 1.0 (optimal)
    mean_luminance: float
    freeze_detected: bool # True if identical frames repeated
    interframe_pixel_mad: float # Mean Absolute Difference between consecutive frames
    obstruction_detected: bool # True if lens covered
    edge_density: float
    cadence_score: float # 0.0 to 1.0 (stability of FPS)
    composite_camera_trust: float # Combined S_cam in [0.0, 1.0]
    hard_veto_triggered: bool
    veto_reason: Optional[str] = None

class SensorTrustEvaluator:
    """
    Evaluates physical imaging health and optical integrity of a camera.
    All operations use lightweight OpenCV primitives (< 4 ms per frame on CPU).
    """
    def __init__(
        self,
        blur_sharpness_threshold: float = 120.0,
        blur_hard_fail_threshold: float = 22.0,
        min_luminance_threshold: float = 20.0,
        max_luminance_threshold: float = 235.0,
        freeze_mad_threshold: float = 0.15,
        freeze_consecutive_limit: int = 8,
        obstruction_edge_threshold: float = 0.008
    ):
        self.tau_sharp = blur_sharpness_threshold
        self.tau_blur_fail = blur_hard_fail_threshold
        self.min_lum = min_luminance_threshold
        self.max_lum = max_luminance_threshold
        self.freeze_mad_threshold = freeze_mad_threshold
        self.freeze_consecutive_limit = freeze_consecutive_limit
        self.obstruction_edge_threshold = obstruction_edge_threshold

        self.prev_gray: Optional[np.ndarray] = None
        self.consecutive_freeze_count = 0
        self.recent_timestamps: deque = deque(maxlen=30)

    def evaluate_frame(
        self,
        frame: np.ndarray,
        timestamp: float,
        target_fps: float = 3.0
    ) -> CameraTrustMetrics:
        """
        Processes a single frame and outputs complete CameraTrustMetrics.
        """
        self.recent_timestamps.append(timestamp)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if len(frame.shape) == 3 else frame

        # 1. Blur Evaluation (Laplacian variance)
        lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        blur_score = min(1.0, max(0.0, round(lap_var / self.tau_sharp, 3)))

        # 2. Brightness & Exposure Evaluation
        mean_lum = float(np.mean(gray))
        hist = cv2.calcHist([gray], [0], None, [256], [0, 256]).flatten()
        total_pixels = float(gray.shape[0] * gray.shape[1])
        dark_clip_pct = float(np.sum(hist[:12]) / total_pixels)
        bright_clip_pct = float(np.sum(hist[243:]) / total_pixels)

        # Penalize extreme clipping and distance from mid-gray (128)
        lum_balance = 1.0 - (abs(mean_lum - 128.0) / 128.0)
        clip_penalty = min(1.0, 1.5 * (dark_clip_pct + bright_clip_pct))
        brightness_score = min(1.0, max(0.0, round(lum_balance * (1.0 - clip_penalty), 3)))

        # 3. Freeze Detection (Anti-Spoofing: Pixel MAD)
        interframe_mad = 5.0 # default for first frame
        is_frozen = False
        if self.prev_gray is not None:
            diff = cv2.absdiff(gray, self.prev_gray)
            interframe_mad = float(np.mean(diff))

            if interframe_mad < self.freeze_mad_threshold:
                self.consecutive_freeze_count += 1
            else:
                self.consecutive_freeze_count = 0

            if self.consecutive_freeze_count >= self.freeze_consecutive_limit:
                is_frozen = True
        self.prev_gray = gray.copy()

        # 4. Obstruction & Lens Tamper Detection (Edge density check)
        edges = cv2.Canny(gray, 50, 150)
        edge_density = float(np.count_nonzero(edges) / total_pixels)
        is_obstructed = False
        # If edge density is near zero while illumination is normal, solid object covers lens
        if edge_density < self.obstruction_edge_threshold and mean_lum > self.min_lum:
            is_obstructed = True

        # 5. Cadence / FPS Stability
        cadence_score = 1.0
        if len(self.recent_timestamps) >= 3:
            time_span = self.recent_timestamps[-1] - self.recent_timestamps[0]
            if time_span > 0:
                actual_fps = (len(self.recent_timestamps) - 1) / time_span
                fps_diff = abs(actual_fps - target_fps)
                cadence_score = min(1.0, max(0.0, round(1.0 - (fps_diff / target_fps), 3)))

        # 6. Hard Veto Checks
        veto_triggered = False
        veto_reason = None

        if is_obstructed:
            veto_triggered = True
            veto_reason = "CAMERA_VIEW_OBSTRUCTED: Lens physically covered or blocked"
        elif is_frozen:
            veto_triggered = True
            veto_reason = "STREAM_FROZEN: Camera feed is stagnant or looping"
        elif lap_var < self.tau_blur_fail:
            veto_triggered = True
            veto_reason = f"SEVERE_OPTICAL_BLUR: Laplacian variance ({round(lap_var, 1)}) below minimum ({self.tau_blur_fail})"
        elif mean_lum < self.min_lum:
            veto_triggered = True
            veto_reason = f"EXTREME_UNDEREXPOSURE: Blackout or lights off (mean lum: {round(mean_lum, 1)})"
        elif mean_lum > self.max_lum:
            veto_triggered = True
            veto_reason = f"BLINDING_GLARE: Extreme overexposure (mean lum: {round(mean_lum, 1)})"

        # 7. Composite Camera Trust Score
        if veto_triggered:
            composite_trust = 0.0
        else:
            composite_trust = round(
                (0.40 * blur_score) +
                (0.30 * brightness_score) +
                (0.15 * cadence_score) +
                (0.15 * min(1.0, edge_density / 0.04)),
                3
            )

        return CameraTrustMetrics(
            blur_score=blur_score,
            raw_laplacian_var=round(lap_var, 1),
            brightness_score=brightness_score,
            mean_luminance=round(mean_lum, 1),
            freeze_detected=is_frozen,
            interframe_pixel_mad=round(interframe_mad, 3),
            obstruction_detected=is_obstructed,
            edge_density=round(edge_density, 4),
            cadence_score=cadence_score,
            composite_camera_trust=composite_trust,
            hard_veto_triggered=veto_triggered,
            veto_reason=veto_reason
        )
