import base64
import os
from datetime import datetime

import cv2
from fastmcp.utilities.types import Image

from crow_mcp.server.main import mcp


@mcp.tool
def capture_webcam(device_index=6, output_file="webcam_capture.png"):
    """Capture a single frame from webcam.

    Args:
        device_index: Webcam device index (default: 6) [OPTIONAL]
        output_file: Output filename [OPTIONAL]
    """
    # print(f"📷 Attempting to open webcam at index {device_index}...")

    cap = cv2.VideoCapture(device_index)

    if not cap.isOpened():
        # print(f"❌ Failed to open webcam at index {device_index}")
        return False

    # Get camera properties
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    backend = cap.getBackendName()

    # print(f"✅ Webcam opened successfully!")
    # print(f"   Resolution: {width}x{height}")
    # print(f"   FPS: {fps}")
    # print(f"   Backend: {backend}")

    # Read a frame
    # print("📸 Capturing frame...")
    ret, frame = cap.read()

    if not ret:
        # print("❌ Failed to capture frame")
        cap.release()
        return False

    # Generate filename if not provided
    if output_file is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = f"webcam_capture_{timestamp}.png"

    # Save the frame
    # print(f"💾 Saving to {output_file}...")
    success = cv2.imwrite(output_file, frame)

    if success:
        print(f"✅ Successfully saved capture to {output_file}")
        print(f"   Image size: {frame.shape[1]}x{frame.shape[0]} pixels")
        print(f"   File size: {len(frame)} bytes (raw)")
    else:
        print(f"❌ Failed to save image to {output_file}")

    cap.release()
    return Image(data=frame)
