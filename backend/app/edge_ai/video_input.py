import time
from datetime import datetime, timezone
from typing import Optional, Generator, Tuple
from collections import deque
import cv2
import numpy as np
from backend.app.edge_ai.schemas import FrameMetadata
from backend.app.logging_config import logger

class VideoInputSampler:
    """
    Decoupled Video Ingestion and Frame Sampler.
    Samples keyframes at target inference cadence (e.g., 2.5 - 3.0 FPS)
    and maintains an in-memory rolling ring buffer of recent frames.
    """
    def __init__(
        self,
        source: str,
        target_fps: float = 3.0,
        ring_buffer_size: int = 30,
        target_resolution: Optional[Tuple[int, int]] = (640, 480)
    ):
        self.source = source
        self.target_fps = target_fps
        self.ring_buffer_size = ring_buffer_size
        self.target_resolution = target_resolution
        self.sample_interval = 1.0 / max(0.1, target_fps)

        self.cap: Optional[cv2.VideoCapture] = None
        self.frame_index = 0
        self.last_sample_time = 0.0
        self.actual_timestamps = deque(maxlen=30)
        self.frame_buffer = deque(maxlen=ring_buffer_size)
        self.is_opened = False

    def open(self) -> bool:
        # Handle numeric string as integer webcam device ID
        src = int(self.source) if self.source.isdigit() else self.source
        self.cap = cv2.VideoCapture(src)
        self.is_opened = self.cap.isOpened()
        if not self.is_opened:
            logger.error(f"Failed to open video source: {self.source}")
        else:
            logger.info(f"Opened video stream: {self.source} (Target inference FPS: {self.target_fps})")
        return self.is_opened

    def close(self):
        if self.cap:
            self.cap.release()
            self.is_opened = False
            logger.info("Video stream closed.")

    def get_latest_buffered_frame(self) -> Optional[np.ndarray]:
        if self.frame_buffer:
            return self.frame_buffer[-1]
        return None

    def read_frames(self, simulate_realtime: bool = True) -> Generator[Tuple[np.ndarray, FrameMetadata], None, None]:
        """
        Yields sampled frames at target_fps with precise metadata.
        """
        if not self.is_opened and not self.open():
            return

        frame_count = 0
        start_wall_time = time.time()
        native_fps = self.cap.get(cv2.CAP_PROP_FPS) or 25.0
        native_frame_interval = 1.0 / native_fps

        while self.is_opened and self.cap.isOpened():
            ret, frame = self.cap.read()
            if not ret:
                # Video file reached EOF
                logger.info(f"Video source reached end of stream after {frame_count} frames.")
                break

            frame_count += 1
            now = time.time()

            # For pre-recorded files, maintain video stream pacing if simulate_realtime is enabled
            if simulate_realtime and isinstance(self.source, str) and not self.source.isdigit() and not self.source.startswith("rtsp"):
                expected_elapsed = frame_count * native_frame_interval
                actual_elapsed = now - start_wall_time
                sleep_needed = expected_elapsed - actual_elapsed
                if sleep_needed > 0:
                    time.sleep(sleep_needed)
                    now = time.time()

            # Frame sampling: handle both live/realtime pacing and offline fast processing
            if not simulate_realtime:
                frame_step = max(1, int(round(native_fps / self.target_fps)))
                if (frame_count - 1) % frame_step != 0:
                    continue
                current_ts = start_wall_time + (frame_count * native_frame_interval)
            else:
                if (now - self.last_sample_time) < self.sample_interval:
                    continue
                current_ts = now
                self.last_sample_time = now

            self.frame_index += 1
            self.actual_timestamps.append(current_ts)

            # Resize if required
            if self.target_resolution:
                frame_resized = cv2.resize(frame, self.target_resolution)
            else:
                frame_resized = frame

            # Push to rolling buffer
            self.frame_buffer.append(frame_resized.copy())

            # Compute empirical FPS
            cadence_fps = self.target_fps
            if len(self.actual_timestamps) >= 2:
                time_span = self.actual_timestamps[-1] - self.actual_timestamps[0]
                if time_span > 0:
                    cadence_fps = round((len(self.actual_timestamps) - 1) / time_span, 2)

            meta = FrameMetadata(
                frame_index=self.frame_index,
                timestamp=current_ts,
                iso_timestamp=datetime.now(timezone.utc).isoformat(),
                resolution=(frame_resized.shape[1], frame_resized.shape[0]),
                cadence_fps=cadence_fps
            )

            yield frame_resized, meta

        self.close()
