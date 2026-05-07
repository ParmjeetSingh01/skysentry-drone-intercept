"""
SkySentry Backend v3.0 — FastAPI
POST /detect/image  — YOLO on uploaded image
POST /detect/video  — YOLO per-frame on uploaded video
WS   /ws/webcam     — realtime webcam detection
WS   /ws/sim        — 30fps simulation + Kalman tracker
"""
import asyncio, base64, json, math, random, time
from typing import List, Dict
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import numpy as np, cv2

app = FastAPI(title="SkySentry API", version="3.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
W, H = 1280, 720

# ── YOLO model ───────────────────────────────────────────────────────────────
_model = None
def get_model():
    global _model
    if _model is None:
        try:
            from ultralytics import YOLO
            _model = YOLO("yolov8n.pt")
            print("[YOLO] yolov8n.pt loaded")
        except Exception as e:
            print(f"[YOLO] failed: {e}")
    return _model

# ── Class remapping (COCO → threat labels) ───────────────────────────────────
REMAP = {
    "airplane":     "fixed-wing-drone",
    "bird":         "micro-UAV",
    "kite":         "tethered-UAV",
    "helicopter":   "rotary-UAV",
    "frisbee":      "disc-UAV",
    "sports ball":  "spherical-drone",
    "person":       "ground-operator",
    "car":          "ground-vehicle",
    "truck":        "convoy-vehicle",
    "motorcycle":   "scout-unit",
    "bicycle":      "recon-unit",
    "backpack":     "payload-carrier",
}
AERIAL = {"fixed-wing-drone","micro-UAV","tethered-UAV","rotary-UAV",
          "disc-UAV","spherical-drone","payload-carrier","drone","uav","quadcopter"}

def run_yolo(img, conf=0.18):
    m = get_model()
    if m is None:
        return []
    res = m(img, conf=conf, verbose=False)[0]
    dets = []
    for b in res.boxes:
        raw   = m.names[int(b.cls[0])]
        label = REMAP.get(raw, raw)
        x1, y1, x2, y2 = map(int, b.xyxy[0].tolist())
        dets.append({
            "bbox":      [x1, y1, x2, y2],
            "conf":      round(float(b.conf[0]), 3),
            "class":     label,
            "raw_class": raw,
            "class_id":  int(b.cls[0]),
            "is_aerial": label in AERIAL,
            "is_threat": True,
            "center":    [(x1+x2)//2, (y1+y2)//2],
        })
    return dets

# ── Annotation ───────────────────────────────────────────────────────────────
COLS = [(0,220,50),(0,180,255),(255,160,0),(200,0,255),(255,60,60)]

def annotate(img, dets):
    for i, d in enumerate(dets):
        col = COLS[i % len(COLS)]
        x1, y1, x2, y2 = d["bbox"]
        cv2.rectangle(img, (x1,y1), (x2,y2), col, 2)
        cs = 16
        for (px,py),(dx1,dy1),(dx2,dy2) in [
            ((x1,y1),(cs,0),(0,cs)), ((x2,y1),(-cs,0),(0,cs)),
            ((x1,y2),(cs,0),(0,-cs)), ((x2,y2),(-cs,0),(0,-cs))]:
            cv2.line(img,(px,py),(px+dx1,py+dy1),col,2)
            cv2.line(img,(px,py),(px+dx2,py+dy2),col,2)
        lbl = f"{d['class']}  {d['conf']:.0%}"
        (tw,th),_ = cv2.getTextSize(lbl, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
        cv2.rectangle(img,(x1,y1-th-8),(x1+tw+6,y1),(10,10,10),-1)
        cv2.putText(img, lbl, (x1+3,y1-4), cv2.FONT_HERSHEY_SIMPLEX, 0.55,(255,255,255),1)
    cv2.putText(img,"SkySentry AI | YOLOv8",(10,img.shape[0]-12),
                cv2.FONT_HERSHEY_SIMPLEX,0.5,(0,200,80),1)
    return img

def enc(img):
    _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 82])
    return base64.b64encode(buf).decode()

# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.post("/detect/image")
async def detect_image(file: UploadFile = File(...), conf: float = 0.18):
    data = await file.read()
    img  = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        return JSONResponse({"error": "bad image"}, 400)
    dets   = run_yolo(img, conf)
    aerial = [d for d in dets if d["is_aerial"]]
    ann    = annotate(img.copy(), dets)
    return {
        "filename":      file.filename,
        "shape":         list(img.shape[:2]),
        "detections":    dets,
        "count":         len(dets),
        "aerial_count":  len(aerial),
        "status":        "THREAT DETECTED" if dets else "ALL CLEAR",
        "annotated_b64": enc(ann),
    }

@app.post("/detect/video")
async def detect_video(file: UploadFile = File(...), conf: float = 0.18, every_n: int = 5):
    data = await file.read()
    tmp  = f"/tmp/{file.filename}"
    with open(tmp, "wb") as f:
        f.write(data)
    cap = cv2.VideoCapture(tmp)
    if not cap.isOpened():
        return JSONResponse({"error": "bad video"}, 400)
    fps   = cap.get(cv2.CAP_PROP_FPS) or 30
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frames, fi = [], 0
    while True:
        ret, frame = cap.read()
        if not ret: break
        if fi % every_n == 0:
            dets = run_yolo(frame, conf)
            frames.append({
                "frame_idx":   fi,
                "timestamp_s": round(fi/fps, 3),
                "detections":  dets,
                "count":       len(dets),
            })
        fi += 1
    cap.release()
    return {
        "filename":          file.filename,
        "total_frames":      total,
        "analyzed_frames":   len(frames),
        "fps":               fps,
        "total_detections":  sum(r["count"] for r in frames),
        "frames":            frames,
    }

@app.websocket("/ws/webcam")
async def ws_webcam(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            msg = await ws.receive_text()
            b64 = json.loads(msg).get("frame", "")
            img = cv2.imdecode(np.frombuffer(base64.b64decode(b64), np.uint8),
                               cv2.IMREAD_COLOR)
            if img is None:
                await ws.send_text(json.dumps({"error": "bad frame"}))
                continue
            dets = run_yolo(img, 0.18)
            ann  = annotate(img.copy(), dets)
            await ws.send_text(json.dumps({
                "detections": dets,
                "count":      len(dets),
                "status":     "THREAT DETECTED" if dets else "ALL CLEAR",
                "annotated":  enc(ann),
                "ts":         int(time.time()*1000),
            }))
    except WebSocketDisconnect:
        pass

# ── Simulation (Kalman + intercept) ──────────────────────────────────────────
class KF:
    _c = 0
    def __init__(self, bbox):
        KF._c += 1; self.id = KF._c; self.lost = 0; self.history = []
        self.F = np.array([[1,0,1,0],[0,1,0,1],[0,0,1,0],[0,0,0,1]], float)
        self.H = np.array([[1,0,0,0],[0,1,0,0]], float)
        self.Q = np.eye(4)*0.01; self.R = np.eye(2)*1.0; self.P = np.eye(4)*100.0
        cx=(bbox[0]+bbox[2])/2.0; cy=(bbox[1]+bbox[3])/2.0
        self.x = np.array([[cx],[cy],[0.],[0.]])
    def predict(self):
        self.x = self.F@self.x; self.P = self.F@self.P@self.F.T+self.Q
    def update(self, bbox):
        cx=(bbox[0]+bbox[2])/2.0; cy=(bbox[1]+bbox[3])/2.0
        z=np.array([[cx],[cy]]); S=self.H@self.P@self.H.T+self.R
        K=self.P@self.H.T@np.linalg.inv(S)
        self.x+=K@(z-self.H@self.x); self.P=(np.eye(4)-K@self.H)@self.P
        self.lost=0; self.history.append([float(self.x[0,0]),float(self.x[1,0])])
        if len(self.history)>50: self.history.pop(0)
    def state(self):
        return {"id":self.id,"position":[float(self.x[0,0]),float(self.x[1,0])],
                "velocity":[float(self.x[2,0]),float(self.x[3,0])],"history":self.history[-20:]}

class MT:
    def __init__(self): self.ts: List[KF] = []
    def update(self, dets):
        for t in self.ts: t.predict()
        if not dets:
            for t in self.ts: t.lost += 1
        else:
            ut, ud = set(), set()
            for i, t in enumerate(self.ts):
                tc=t.x[:2].flatten(); bd,bj=-1,1e9
                for j,d in enumerate(dets):
                    if j in ud: continue
                    dc=np.array([(d["bbox"][0]+d["bbox"][2])/2,(d["bbox"][1]+d["bbox"][3])/2])
                    dist=float(np.linalg.norm(tc-dc))
                    if dist<bj: bj,bd=dist,j
                if bd>=0 and bj<130: ut.add(i); ud.add(bd); self.ts[i].update(dets[bd]["bbox"])
            for j,d in enumerate(dets):
                if j not in ud: self.ts.append(KF(d["bbox"]))
            for i in range(len(self.ts)):
                if i not in ut: self.ts[i].lost += 1
        self.ts = [t for t in self.ts if t.lost<=8]
        return [t.state() for t in self.ts if len(t.history)>=1]

def icp(ip, tp, tv, spd=14.0):
    ix,iy=ip; tx,ty=tp; tvx,tvy=tv
    tg=math.hypot(tx-ix,ty-iy)/max(spd,1e-3)
    for _ in range(60):
        fx=tx+tvx*tg; fy=ty+tvy*tg; tn=math.hypot(fx-ix,fy-iy)/max(spd,1e-3)
        if abs(tn-tg)<0.005: break
        tg=tn
    fx=tx+tvx*tg; fy=ty+tvy*tg; dx,dy=fx-ix,fy-iy; d=math.hypot(dx,dy)
    hv=(dx/d,dy/d) if d>1e-6 else (1.,0.)
    return {"heading_deg":round(math.degrees(math.atan2(-dy,dx))%360,1),
            "heading_vec":[round(hv[0],4),round(hv[1],4)],
            "intercept_pt":[round(fx,1),round(fy,1)],
            "tti":round(tg,2),"feasible":spd>math.hypot(tvx,tvy)*0.85,
            "distance":round(d,1)}

def threat_score(trk, ip):
    cx,cy=W/2,H/2; px,py=trk["position"]; vx,vy=trk["velocity"]
    dist=math.hypot(px-cx,py-cy); prox=1-min(dist/math.hypot(cx,cy),1)
    sp=math.hypot(vx,vy); ss=min(sp/20,1)
    ap=max(0,-((px-cx)*vx+(py-cy)*vy)/max(dist*sp,1e-6))
    id2=math.hypot(px-ip[0],py-ip[1])
    return round(0.35*prox+0.25*ss+0.25*ap+0.15*(1-min(id2/800,1)),4)

class SD:
    _c=0
    TYPES=["quadcopter","fixed-wing","hexcopter"]
    def __init__(self):
        SD._c+=1; self.id=SD._c; edge=random.choice(["top","left","right","bottom"])
        if edge=="top":    self.x,self.y=random.uniform(100,W-100),random.uniform(20,80)
        elif edge=="bottom":self.x,self.y=random.uniform(100,W-100),random.uniform(H-80,H-20)
        elif edge=="left": self.x,self.y=random.uniform(20,80),random.uniform(100,H-100)
        else:              self.x,self.y=random.uniform(W-80,W-20),random.uniform(100,H-100)
        tx,ty=random.uniform(W*.3,W*.7),random.uniform(H*.3,H*.7)
        spd=random.uniform(2,5.5); a=math.atan2(ty-self.y,tx-self.x)+random.uniform(-.4,.4)
        self.vx=spd*math.cos(a); self.vy=spd*math.sin(a)
        self.sz=random.randint(28,45); self.conf=round(random.uniform(.76,.99),2)
        self.alive=True; self.dtype=random.choice(self.TYPES)
    def step(self):
        self.vx=max(-6,min(6,self.vx+random.uniform(-.15,.15)))
        self.vy=max(-6,min(6,self.vy+random.uniform(-.15,.15)))
        self.x+=self.vx; self.y+=self.vy
        if not(-60<self.x<W+60 and -60<self.y<H+60): self.alive=False
    def det(self):
        x1,y1=max(0,int(self.x-self.sz)),max(0,int(self.y-self.sz))
        x2,y2=min(W,int(self.x+self.sz)),min(H,int(self.y+self.sz))
        return {"bbox":[x1,y1,x2,y2],"conf":round(self.conf+random.uniform(-.03,.03),2),
                "class":self.dtype,"center":[int(self.x),int(self.y)],"is_threat":True}

class Sess:
    def __init__(self): self.reset()
    def reset(self):
        self.drones=[SD() for _ in range(3)]; self.tracker=MT()
        self.ix=float(W//2); self.iy=float(H-60); self.frame=0
        self.stats={"intercepted":0,"total_threats":3,"frames":0}
    def step(self) -> Dict:
        self.frame+=1; self.stats["frames"]+=1
        if self.frame%120==0 and len(self.drones)<5:
            self.drones.append(SD()); self.stats["total_threats"]+=1
        for d in self.drones: d.step()
        self.drones=[d for d in self.drones if d.alive]
        dets=[d.det() for d in self.drones]; tracks=self.tracker.update(dets)
        tgts=[]; bt=None; bs=-1; bic=None
        for t in tracks:
            s=threat_score(t,(self.ix,self.iy)); i=icp((self.ix,self.iy),t["position"],t["velocity"])
            t["score"]=s; t["intercept"]=i; tgts.append(t)
            if s>bs: bs=s; bt=t; bic=i
        if bic:
            tx,ty=bic["intercept_pt"]; dx,dy=tx-self.ix,ty-self.iy; d=math.hypot(dx,dy)
            if d>14: self.ix+=14*dx/d; self.iy+=14*dy/d
            else:
                self.ix,self.iy=tx,ty
                if bt and math.hypot(bt["position"][0]-self.ix,bt["position"][1]-self.iy)<40:
                    self.stats["intercepted"]+=1
                    self.drones=[d for d in self.drones if abs(d.x-bt["position"][0])>50]
        return {"frame":self.frame,"ts":int(time.time()*1000),"arena":{"w":W,"h":H},
                "drones":[d.det() for d in self.drones],"tracks":tgts,
                "interceptor":{"x":round(self.ix,1),"y":round(self.iy,1),"speed":14.0},
                "target":bt,"stats":self.stats,
                "status":"THREAT DETECTED" if tgts else "ALL CLEAR"}

@app.websocket("/ws/sim")
async def ws_sim(ws: WebSocket):
    await ws.accept(); s = Sess()
    try:
        while True:
            try:
                msg=await asyncio.wait_for(ws.receive_text(),timeout=0.001)
                cmd=json.loads(msg)
                if cmd.get("action")=="spawn" and len(s.drones)<5: s.drones.append(SD())
                elif cmd.get("action")=="remove" and s.drones: s.drones.pop()
                elif cmd.get("action")=="reset": s.reset()
            except: pass
            await ws.send_text(json.dumps(s.step()))
            await asyncio.sleep(1/30)
    except WebSocketDisconnect: pass

@app.get("/health")
def health(): return {"status":"ok","version":"3.0.0","model":"yolov8n"}
@app.get("/")
def root(): return {"service":"SkySentry API","endpoints":["/detect/image","/detect/video","/ws/webcam","/ws/sim","/docs"]}
