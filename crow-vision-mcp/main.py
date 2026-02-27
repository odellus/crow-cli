import base64
import os
from datetime import datetime

import cv2
from fastmcp import FastMCP
from fastmcp.utilities.types import Image

mcp = FastMCP("crow-vision-mcp")


@mcp.tool
def capture_webcam(device_index: int = 6) -> Image:
    """Capture a single frame from webcam.

    Args:
        device_index: Webcam device index (default: 6)
    """
    cap = cv2.VideoCapture(device_index)

    if not cap.isOpened():
        raise ValueError(f"❌ Failed to open webcam at index {device_index}")

    ret, frame = cap.read()
    cap.release()

    if not ret:
        raise RuntimeError("❌ Failed to capture frame from webcam")

    # 1. Encode the OpenCV matrix (NumPy array) into a JPEG buffer
    success, buffer = cv2.imencode(".jpg", frame)
    if not success:
        raise RuntimeError("❌ Failed to encode frame to JPEG")

    # 2. Convert the memory buffer to raw bytes
    image_bytes = buffer.tobytes()

    # 3. Pass the raw bytes and specify the format to FastMCP
    return Image(data=image_bytes, format="jpeg")


if __name__ == "__main__":
    mcp.run()
