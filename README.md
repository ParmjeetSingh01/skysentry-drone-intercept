# SkySentry v3.0 — AI Drone Intercept System
> YOLOv8 · FastAPI · React · WebSocket · Kalman Tracker · Intercept Solver

## Features
- Simulation: Real-time tactical radar HUD with Kalman tracking + intercept geometry
- Image Detection: Upload drone photos → YOLO bounding boxes + annotated result
- Video Detection: Upload footage → frame-by-frame analysis + timeline chart
- Live Webcam: Real-time YOLO detection streamed via WebSocket

## Local Development
```bash
# Terminal 1 — Backend
cd ~/skysentry/backend
pip3 install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd ~/skysentry/frontend
npm install
REACT_APP_API_URL=http://localhost:8000 npm start
```

## Deploy
- Backend → Render.com (render.yaml included)
- Frontend → Vercel (vercel.json included)
  Set env var: REACT_APP_API_URL=https://your-render-url.onrender.com
