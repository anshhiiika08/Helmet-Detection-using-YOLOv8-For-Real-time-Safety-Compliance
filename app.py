# app/app.py

import os
import uuid
import shutil
import cv2
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from ultralytics import YOLO

# =========================
# CONFIG
# =========================
MODEL_PATH = os.path.join("model/best.pt")
UPLOAD_DIR = os.path.join("app/uploads")
RESULTS_DIR = os.path.join("app/results")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

# =========================
# APP + MODEL INIT
# =========================
app = FastAPI(title="Helmet Detection API", description="YOLOv8 REST API for helmet detection")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    model = YOLO(MODEL_PATH)
except Exception as e:
    raise RuntimeError(f" Could not load YOLO model from {MODEL_PATH}. Error: {e}")


# =========================
# RESPONSE MODELS
# =========================
class PredictionResponse(BaseModel):
    filename: str
    detections: list
    result_url: HttpUrl


# =========================
# ROOT ENDPOINT
# =========================
@app.get("/")
async def root():
    return {"message": " Helmet Detection API is running! Visit /docs for Swagger UI."}


# =========================
# PREDICT ENDPOINT
# =========================
@app.post("/predict/", response_model=PredictionResponse)
async def predict(file: UploadFile = File(...)):
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are supported")

    # Save uploaded file
    file_id = str(uuid.uuid4())[:8]
    input_path = os.path.join(UPLOAD_DIR, f"{file_id}.jpg")
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Run YOLO prediction
    try:
        results = model.predict(source=input_path, save=False, conf=0.25)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {e}")

    # Process results
    detections = []
    pred_obj = results[0]
    for box in pred_obj.boxes:
        x1, y1, x2, y2 = map(float, box.xyxy[0])
        conf = float(box.conf[0])
        cls_id = int(box.cls[0])
        detections.append({
            "class_id": cls_id,
            "label": model.names[cls_id],
            "confidence": round(conf, 3),
            "box": [x1, y1, x2, y2]
        })

    # Save annotated image
    annotated_img = pred_obj.plot()
    result_filename = f"{file_id}_result.jpg"
    result_path = os.path.join(RESULTS_DIR, result_filename)
    cv2.imwrite(result_path, annotated_img)

    # Return response with a URL to fetch annotated image
    return PredictionResponse(
        filename=file.filename,
        detections=detections,
        result_url=f"http://127.0.0.1:8000/download/{result_filename}"
    )

# =========================
# DOWNLOAD ENDPOINT
# =========================
@app.get("/download/{image_name}")
async def download_result(image_name: str):
    path = os.path.join(RESULTS_DIR, image_name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Result not found")
    return FileResponse(path, media_type="image/jpeg", filename=image_name)
