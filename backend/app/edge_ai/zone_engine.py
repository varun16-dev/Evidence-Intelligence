from typing import Dict, List, Tuple, Any, Optional
import cv2
import numpy as np
from backend.app.edge_ai.schemas import DetectionItem, EquipmentAuditItem

class ZoneEngine:
    """
    Polygon Zone Containment and Spatial Masking Engine.
    Uses ray-casting Point-in-Polygon on the ground-contact point
    to assign detections to operational classroom zones.
    """
    def __init__(self, zones_geojson: Dict[str, Any], frame_resolution: Tuple[int, int] = (640, 480)):
        self.raw_zones = zones_geojson
        self.frame_resolution = frame_resolution
        self.parsed_polygons: Dict[str, np.ndarray] = {}
        self._compile_polygons()

    def update_resolution_and_zones(self, zones_geojson: Dict[str, Any], resolution: Tuple[int, int]):
        self.raw_zones = zones_geojson
        self.frame_resolution = resolution
        self._compile_polygons()

    def _compile_polygons(self):
        self.parsed_polygons = {}
        w, h = self.frame_resolution

        for zone_name, coords in self.raw_zones.items():
            if not coords or len(coords) < 3:
                continue

            pts = []
            for pt in coords:
                x, y = float(pt[0]), float(pt[1])
                # If coordinates are normalized in [0.0, 1.0], scale to pixel resolution
                if 0.0 <= x <= 1.0 and 0.0 <= y <= 1.0:
                    x = x * w
                    y = y * h
                pts.append([x, y])

            poly_arr = np.array(pts, dtype=np.int32).reshape((-1, 1, 2))
            self.parsed_polygons[zone_name] = poly_arr

    def is_point_in_zone(self, point: Tuple[float, float], zone_name: str) -> bool:
        if zone_name not in self.parsed_polygons:
            return False
        poly = self.parsed_polygons[zone_name]
        # cv2.pointPolygonTest returns >= 0 if inside or on boundary
        dist = cv2.pointPolygonTest(poly, (float(point[0]), float(point[1])), False)
        return dist >= 0

    def assign_zones(
        self,
        detections: List[DetectionItem]
    ) -> Tuple[List[DetectionItem], Dict[str, int], List[EquipmentAuditItem]]:
        """
        Tests each detection's ground-contact point against all compiled zones.
        Computes zone occupancy counts and equipment tally.
        """
        zone_occupancy: Dict[str, int] = {z: 0 for z in self.parsed_polygons.keys()}
        zone_occupancy["unassigned"] = 0

        equipment_tally: Dict[Tuple[str, str], int] = {} # (class_name, zone) -> count

        for det in detections:
            matched_zone: Optional[str] = None

            # Test each polygon
            for zone_name in self.parsed_polygons.keys():
                if self.is_point_in_zone(det.ground_point, zone_name):
                    matched_zone = zone_name
                    break

            det.assigned_zone = matched_zone

            if det.class_name == "person":
                if matched_zone:
                    zone_occupancy[matched_zone] += 1
                else:
                    zone_occupancy["unassigned"] += 1
            else:
                # Equipment (chair, monitor/tv, laptop)
                z_label = matched_zone or "general_room"
                key = (det.class_name, z_label)
                equipment_tally[key] = equipment_tally.get(key, 0) + 1

        equipment_list = [
            EquipmentAuditItem(class_name=cls_name, zone=z, count=cnt)
            for (cls_name, z), cnt in equipment_tally.items()
        ]

        return detections, zone_occupancy, equipment_list
