import os
import cv2
import numpy as np

def draw_classroom_background(w=640, h=480):
    # Classroom room layout (floor, wall, desks, whiteboard)
    bg = np.ones((h, w, 3), dtype=np.uint8) * 40 # Dark wall
    # Floor (lower half)
    cv2.rectangle(bg, (0, 200), (w, h), (70, 70, 75), -1)
    # Whiteboard on back wall
    cv2.rectangle(bg, (160, 30), (480, 160), (220, 220, 225), -1)
    cv2.putText(bg, "SKILL MISSION - BATCH A", (180, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (40, 40, 40), 2)
    # Desks in student zone
    for x in [80, 240, 400]:
        cv2.rectangle(bg, (x, 300), (x + 130, 400), (90, 60, 40), -1)
        # Monitor
        cv2.rectangle(bg, (x + 35, 250), (x + 95, 300), (30, 30, 30), -1)
        cv2.rectangle(bg, (x + 60, 300), (x + 70, 315), (20, 20, 20), -1)
    return bg

def draw_person(canvas, x, y, scale=1.0):
    # Draw simple human silhouette (head, torso, legs)
    head_r = int(18 * scale)
    cv2.circle(canvas, (int(x), int(y)), head_r, (200, 180, 160), -1) # Head
    cv2.rectangle(canvas, (int(x - 22 * scale), int(y + head_r)), (int(x + 22 * scale), int(y + 80 * scale)), (30, 80, 180), -1) # Torso (Blue shirt)
    cv2.rectangle(canvas, (int(x - 18 * scale), int(y + 80 * scale)), (int(x - 2 * scale), int(y + 140 * scale)), (20, 20, 30), -1) # Left leg
    cv2.rectangle(canvas, (int(x + 2 * scale), int(y + 80 * scale)), (int(x + 18 * scale), int(y + 140 * scale)), (20, 20, 30), -1) # Right leg

def add_sensor_noise(canvas, std=1.2):
    noise = np.random.normal(0, std, canvas.shape)
    return np.clip(canvas.astype(np.float32) + noise, 0, 255).astype(np.uint8)

def generate_scenarios(output_dir="backend/test_videos", fps=10):
    os.makedirs(output_dir, exist_ok=True)
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    w, h = 640, 480

    # 1. SCENARIO A: Transient Walk-by (person enters left, walks to right, exits at t=4s)
    path_a = os.path.join(output_dir, "scenario_transient.mp4")
    out_a = cv2.VideoWriter(path_a, fourcc, fps, (w, h))
    total_frames = fps * 6 # 6 seconds
    for f in range(total_frames):
        bg = draw_classroom_background(w, h)
        if f < fps * 4.5:
            # Walking across doorway / corridor
            x = 40 + (f / (fps * 4.5)) * 540
            y = 230
            draw_person(bg, x, y, scale=0.9)
        out_a.write(bg)
    out_a.release()
    print(f"Generated: {path_a}")

    # 2. SCENARIO B: Persistent Trainee (person sits at Desk #1 for 20 seconds)
    path_b = os.path.join(output_dir, "scenario_persistent.mp4")
    out_b = cv2.VideoWriter(path_b, fourcc, fps, (w, h))
    total_frames = fps * 20 # 20 seconds
    for f in range(total_frames):
        bg = draw_classroom_background(w, h)
        # Person seated at desk (x=145, y=270)
        draw_person(bg, 145, 270, scale=0.85)
        out_b.write(add_sensor_noise(bg, std=1.2))
    out_b.release()
    print(f"Generated: {path_b}")

    # 3. SCENARIO C: Photo-Realistic Classroom Video with Detected Person & Desks
    try:
        from ultralytics.utils import ASSETS
        bus_img = cv2.imread(str(ASSETS / "bus.jpg"))
        # Person 1 crop from bus.jpg: [48, 398, 245, 902]
        person_crop = bus_img[398:900, 48:245]
        person_resized = cv2.resize(person_crop, (90, 180))

        path_c = os.path.join(output_dir, "scenario_classroom_class.mp4")
        out_c = cv2.VideoWriter(path_c, fourcc, fps, (w, h))
        for f in range(fps * 20): # 20 seconds
            bg = draw_classroom_background(w, h)
            # Seat person at Desk 1 (x=100, y=230)
            h_p, w_p = person_resized.shape[:2]
            bg[230:230+h_p, 100:100+w_p] = person_resized
            out_c.write(add_sensor_noise(bg, std=1.2))
        out_c.release()
        print(f"Generated realistic composite: {path_c}")
    except Exception as e:
        print(f"Notice: Could not generate composite: {e}")

    # 4. SCENARIO D: Freeze Stream (Zero-variance static video triggering Anti-Spoof Veto)
    path_d = os.path.join(output_dir, "scenario_freeze.mp4")
    out_d = cv2.VideoWriter(path_d, fourcc, fps, (w, h))
    bg_freeze = draw_classroom_background(w, h)
    draw_person(bg_freeze, 145, 270, scale=0.85)
    for _ in range(fps * 10): # 10 seconds of exact duplicate frames
        out_d.write(bg_freeze)
    out_d.release()
    print(f"Generated freeze scenario: {path_d}")

if __name__ == "__main__":
    generate_scenarios()


