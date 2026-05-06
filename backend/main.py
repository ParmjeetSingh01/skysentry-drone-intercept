import asyncio,base64,json,math,random,time
from fastapi import FastAPI,WebSocket,WebSocketDisconnect,File,UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import numpy as np

app=FastAPI(title="SkySentry API",version="3.0.0")
app.add_middleware(CORSMiddleware,allow_origins=["*"],allow_methods=["*"],allow_headers=["*"])
W,H=1280,720
SPD=14.0

try:
    import cv2
    HAS_CV=True
except:
    HAS_CV=False

_model=None
def get_model():
    global _model
    if _model is None:
        try:
            from ultralytics import YOLO
            _model=YOLO("yolov8n.pt")
            print("[YOLO] loaded yolov8n.pt")
        except Exception as e:
            print(f"[YOLO] unavailable: {e}")
    return _model

def to_b64(img):
    _,buf=cv2.imencode(".jpg",img,[cv2.IMWRITE_JPEG_QUALITY,85])
    return base64.b64encode(buf).decode()

def run_yolo(img,conf=0.25):
    m=get_model()
    if not m:return[]
    res=m(img,conf=conf,verbose=False)[0]
    out=[]
    for box in res.boxes:
        x1,y1,x2,y2=map(int,box.xyxy[0].tolist())
        out.append({"bbox":[x1,y1,x2,y2],"conf":round(float(box.conf[0]),3),
                    "class":m.names[int(box.cls[0])],"center":[(x1+x2)//2,(y1+y2)//2]})
    return out

def annotate(img,dets):
    cols=[(0,220,50),(0,180,255),(255,160,0),(200,0,255),(255,60,60)]
    for i,d in enumerate(dets):
        c=cols[i%len(cols)];x1,y1,x2,y2=d["bbox"]
        cv2.rectangle(img,(x1,y1),(x2,y2),c,2)
        cs=14
        for(px,py),(dx1,dy1),(dx2,dy2) in[((x1,y1),(cs,0),(0,cs)),((x2,y1),(-cs,0),(0,cs)),((x1,y2),(cs,0),(0,-cs)),((x2,y2),(-cs,0),(0,-cs))]:
            cv2.line(img,(px,py),(px+dx1,py+dy1),c,2);cv2.line(img,(px,py),(px+dx2,py+dy2),c,2)
        lbl=f"{d['class']} {d['conf']:.0%}"
        (tw,th),_=cv2.getTextSize(lbl,cv2.FONT_HERSHEY_SIMPLEX,.55,1)
        cv2.rectangle(img,(x1,y1-th-8),(x1+tw+6,y1),(10,10,10),-1)
        cv2.putText(img,lbl,(x1+3,y1-4),cv2.FONT_HERSHEY_SIMPLEX,.55,(255,255,255),1)
    cv2.putText(img,"SkySentry AI",(10,img.shape[0]-10),cv2.FONT_HERSHEY_SIMPLEX,.5,(0,200,80),1)
    return img

@app.get("/health")
def health():return{"status":"ok","version":"3.0.0","cv":HAS_CV}

@app.get("/")
def root():return{"service":"SkySentry API","docs":"/docs"}

@app.post("/detect/image")
async def detect_image(file:UploadFile=File(...)):
    if not HAS_CV:return JSONResponse({"error":"opencv not available on server"},400)
    data=await file.read()
    arr=np.frombuffer(data,np.uint8)
    img=cv2.imdecode(arr,cv2.IMREAD_COLOR)
    if img is None:return JSONResponse({"error":"could not decode image"},400)
    dets=run_yolo(img)
    ann=annotate(img.copy(),dets)
    return{"filename":file.filename,"shape":list(img.shape[:2]),"detections":dets,"count":len(dets),"annotated_b64":to_b64(ann)}

@app.post("/detect/video")
async def detect_video(file:UploadFile=File(...),every_n:int=5):
    if not HAS_CV:return JSONResponse({"error":"opencv not available on server"},400)
    data=await file.read()
    tmp=f"/tmp/upload_{int(time.time())}_{file.filename}"
    with open(tmp,"wb") as f:f.write(data)
    cap=cv2.VideoCapture(tmp)
    if not cap.isOpened():return JSONResponse({"error":"could not open video"},400)
    fps=cap.get(cv2.CAP_PROP_FPS) or 30
    total=int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frames=[];fi=0
    while True:
        ret,frame=cap.read()
        if not ret:break
        if fi%every_n==0:
            dets=run_yolo(frame)
            frames.append({"frame_idx":fi,"timestamp_s":round(fi/fps,3),"detections":dets,"count":len(dets)})
        fi+=1
    cap.release()
    return{"filename":file.filename,"total_frames":total,"analyzed_frames":len(frames),"fps":fps,"total_detections":sum(f["count"] for f in frames),"frames":frames}

# ── WebSocket: webcam (/ws/webcam) ─────────────────────────────────────────
@app.websocket("/ws/webcam")
async def ws_webcam(ws:WebSocket):
    await ws.accept()
    try:
        while True:
            msg=await ws.receive_text()
            payload=json.loads(msg)
            b64=payload.get("frame","")
            if not b64:
                await ws.send_text(json.dumps({"count":0,"detections":[],"annotated":""}))
                continue
            try:
                raw=base64.b64decode(b64)
                arr=np.frombuffer(raw,np.uint8)
                img=cv2.imdecode(arr,cv2.IMREAD_COLOR)
                if img is None:raise ValueError("bad frame")
                dets=run_yolo(img)
                ann=annotate(img.copy(),dets)
                await ws.send_text(json.dumps({"count":len(dets),"detections":dets,"annotated":to_b64(ann),"ts":int(time.time()*1000)}))
            except Exception as e:
                await ws.send_text(json.dumps({"count":0,"detections":[],"annotated":"","error":str(e)}))
    except WebSocketDisconnect:pass

# ── Simulation engine ──────────────────────────────────────────────────────
class KF:
    _c=0
    def __init__(self,bbox):
        KF._c+=1;self.id=KF._c;self.lost=0;self.history=[]
        self.F=np.array([[1,0,1,0],[0,1,0,1],[0,0,1,0],[0,0,0,1]],float)
        self.H=np.array([[1,0,0,0],[0,1,0,0]],float)
        self.Q=np.eye(4)*.01;self.R=np.eye(2)*1.;self.P=np.eye(4)*100.
        cx=(bbox[0]+bbox[2])/2.;cy=(bbox[1]+bbox[3])/2.
        self.x=np.array([[cx],[cy],[0.],[0.]])
    def predict(self):
        self.x=self.F@self.x;self.P=self.F@self.P@self.F.T+self.Q
    def update(self,bbox):
        cx=(bbox[0]+bbox[2])/2.;cy=(bbox[1]+bbox[3])/2.
        z=np.array([[cx],[cy]])
        S=self.H@self.P@self.H.T+self.R;K=self.P@self.H.T@np.linalg.inv(S)
        self.x+=K@(z-self.H@self.x);self.P=(np.eye(4)-K@self.H)@self.P
        self.lost=0;self.history.append([float(self.x[0,0]),float(self.x[1,0])])
        if len(self.history)>50:self.history.pop(0)
    def state(self):
        return{"id":self.id,"position":[float(self.x[0,0]),float(self.x[1,0])],"velocity":[float(self.x[2,0]),float(self.x[3,0])],"history":self.history[-20:]}

class MT:
    def __init__(self):self.ts=[]
    def update(self,dets):
        for t in self.ts:t.predict()
        if not dets:
            for t in self.ts:t.lost+=1
        else:
            ut,ud=set(),set()
            for i,t in enumerate(self.ts):
                tc=t.x[:2].flatten();bd=1e9;bj=-1
                for j,d in enumerate(dets):
                    if j in ud:continue
                    dc=np.array([(d["bbox"][0]+d["bbox"][2])/2,(d["bbox"][1]+d["bbox"][3])/2])
                    dist=float(np.linalg.norm(tc-dc))
                    if dist<bd:bd=dist;bj=j
                if bj>=0 and bd<130:ut.add(i);ud.add(bj);self.ts[i].update(dets[bj]["bbox"])
            for j,d in enumerate(dets):
                if j not in ud:self.ts.append(KF(d["bbox"]))
            for i in range(len(self.ts)):
                if i not in ut:self.ts[i].lost+=1
        self.ts=[t for t in self.ts if t.lost<=8]
        return[t.state() for t in self.ts]

def intercept(ip,tp,tv):
    ix,iy=ip;tx,ty=tp;tvx,tvy=tv
    tg=math.hypot(tx-ix,ty-iy)/max(SPD,1e-3)
    for _ in range(60):
        fx=tx+tvx*tg;fy=ty+tvy*tg
        tn=math.hypot(fx-ix,fy-iy)/max(SPD,1e-3)
        if abs(tn-tg)<.005:break
        tg=tn
    fx=tx+tvx*tg;fy=ty+tvy*tg
    dx,dy=fx-ix,fy-iy;d=math.hypot(dx,dy)
    hv=(dx/d,dy/d) if d>1e-6 else (1.,0.)
    return{"heading_deg":round(math.degrees(math.atan2(-dy,dx))%360,1),"heading_vec":[round(hv[0],4),round(hv[1],4)],"intercept_pt":[round(fx,1),round(fy,1)],"tti":round(tg,2),"feasible":SPD>math.hypot(tvx,tvy)*.85,"distance":round(d,1)}

def score(trk,ipos):
    cx,cy=W/2,H/2;px,py=trk["position"];vx,vy=trk["velocity"]
    dist=math.hypot(px-cx,py-cy)
    prox=1-min(dist/math.hypot(cx,cy),1)
    sp=math.hypot(vx,vy);ss=min(sp/20,1)
    ap=max(0,-((px-cx)*vx+(py-cy)*vy)/max(dist*sp,1e-6))
    id2=math.hypot(px-ipos[0],py-ipos[1])
    return round(.35*prox+.25*ss+.25*ap+.15*(1-min(id2/800,1)),4)

class SD:
    _c=0
    def __init__(self):
        SD._c+=1;self.id=SD._c
        edge=random.choice(["top","left","right","bottom"])
        if edge=="top":self.x,self.y=random.uniform(100,W-100),random.uniform(20,80)
        elif edge=="bottom":self.x,self.y=random.uniform(100,W-100),random.uniform(H-80,H-20)
        elif edge=="left":self.x,self.y=random.uniform(20,80),random.uniform(100,H-100)
        else:self.x,self.y=random.uniform(W-80,W-20),random.uniform(100,H-100)
        tx,ty=random.uniform(W*.3,W*.7),random.uniform(H*.3,H*.7)
        spd=random.uniform(2,5.5);a=math.atan2(ty-self.y,tx-self.x)+random.uniform(-.4,.4)
        self.vx=spd*math.cos(a);self.vy=spd*math.sin(a)
        self.sz=random.randint(28,45);self.conf=round(random.uniform(.76,.99),2)
        self.alive=True;self.dtype=random.choice(["quadcopter","fixed-wing","hexcopter"])
    def step(self):
        self.vx+=random.uniform(-.15,.15);self.vy+=random.uniform(-.15,.15)
        self.vx=max(-6,min(6,self.vx));self.vy=max(-6,min(6,self.vy))
        self.x+=self.vx;self.y+=self.vy
        if not(-60<self.x<W+60 and -60<self.y<H+60):self.alive=False
    def det(self):
        x1,y1=max(0,int(self.x-self.sz)),max(0,int(self.y-self.sz))
        x2,y2=min(W,int(self.x+self.sz)),min(H,int(self.y+self.sz))
        return{"bbox":[x1,y1,x2,y2],"conf":round(self.conf+random.uniform(-.03,.03),2),"class":self.dtype,"center":[int(self.x),int(self.y)]}

class Session:
    def __init__(self):self.reset()
    def reset(self):
        self.drones=[SD() for _ in range(3)];self.tracker=MT()
        self.ix=float(W//2);self.iy=float(H-60);self.frame=0
        self.stats={"intercepted":0,"total_threats":3,"frames":0}
    def step(self):
        self.frame+=1;self.stats["frames"]+=1
        if self.frame%120==0 and len(self.drones)<6:
            self.drones.append(SD());self.stats["total_threats"]+=1
        for d in self.drones:d.step()
        self.drones=[d for d in self.drones if d.alive]
        dets=[d.det() for d in self.drones]
        tracks=self.tracker.update(dets)
        tgts=[];bt=None;bs=-1;bic=None
        for trk in tracks:
            sc=score(trk,(self.ix,self.iy))
            ic=intercept((self.ix,self.iy),trk["position"],trk["velocity"])
            trk["score"]=sc;trk["intercept"]=ic;tgts.append(trk)
            if sc>bs:bs=sc;bt=trk;bic=ic
        if bic:
            tx,ty=bic["intercept_pt"];dx,dy=tx-self.ix,ty-self.iy
            d=math.hypot(dx,dy)
            if d>SPD:self.ix+=SPD*dx/d;self.iy+=SPD*dy/d
            else:
                self.ix,self.iy=tx,ty
                if bt:
                    tp=bt["position"]
                    if math.hypot(tp[0]-self.ix,tp[1]-self.iy)<40:
                        self.stats["intercepted"]+=1
                        self.drones=[d for d in self.drones if abs(d.x-tp[0])>50]
        return{"frame":self.frame,"ts":int(time.time()*1000),"arena":{"w":W,"h":H},"drones":[d.det() for d in self.drones],"tracks":tgts,"interceptor":{"x":round(self.ix,1),"y":round(self.iy,1),"speed":SPD},"target":bt,"stats":self.stats,"status":"THREAT DETECTED" if tgts else "ALL CLEAR"}

@app.websocket("/ws/sim")
async def ws_sim(ws:WebSocket):
    await ws.accept();session=Session()
    try:
        while True:
            try:
                msg=await asyncio.wait_for(ws.receive_text(),timeout=0.001)
                cmd=json.loads(msg)
                if cmd.get("action")=="spawn" and len(session.drones)<6:session.drones.append(SD())
                elif cmd.get("action")=="remove" and session.drones:session.drones.pop()
                elif cmd.get("action")=="reset":session.reset()
            except:pass
            await ws.send_text(json.dumps(session.step()))
            await asyncio.sleep(1/30)
    except WebSocketDisconnect:pass
