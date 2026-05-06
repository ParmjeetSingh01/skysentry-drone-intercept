import asyncio, json, random, logging, math
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sim_engine import SimDrone, SimInterceptor
from intercept import InterceptSolver

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
ARENA_W, ARENA_H = 800, 600

@asynccontextmanager
async def lifespan(app): logger.info("Starting..."); yield

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/")
def root(): return {"status": "online", "system": "SkySentry"}

@app.get("/health")
def health(): return {"status": "ok", "model": "YOLO26n"}

@app.websocket("/ws/sim")
async def ws_sim(ws: WebSocket):
    await ws.accept()
    drones, frame_n, next_spawn = [], 0, random.randint(10,30)
    interceptor = SimInterceptor(ARENA_W, ARENA_H)
    solver = InterceptSolver(5.0)
    try:
        while True:
            frame_n += 1
            if frame_n >= next_spawn and len(drones) < 4:
                drones.append(SimDrone(frame_n, ARENA_W, ARENA_H))
                next_spawn = frame_n + random.randint(30,80)
            for d in drones: d.step()
            drones = [d for d in drones if d.alive]
            threats = [d for d in drones if d.threat=="THREAT"]
            warns   = [d for d in drones if d.threat=="WARN"]
            pool    = threats or warns or drones
            target  = min(pool, key=lambda d: math.hypot(d.x-interceptor.x, d.y-interceptor.y)) if pool else None
            interceptor.pursue(target.to_dict() if target else None)
            intercept_data = solver.solve((interceptor.x,interceptor.y),(target.x,target.y),(target.vx,target.vy)) if target else {}
            await ws.send_text(json.dumps({
                "frame": frame_n, "timestamp": round(frame_n*0.1,2),
                "arena": {"w":ARENA_W,"h":ARENA_H},
                "threats": [d.to_dict() for d in drones],
                "interceptor": interceptor.to_dict(),
                "intercept": intercept_data,
                "target_id": target.id if target else None,
                "stats": {"total_threats":len(drones),"threat_count":len(threats),"warn_count":len(warns),"engaged":interceptor.status in("ENGAGE","ARM")},
            }))
            await asyncio.sleep(0.1)
    except: pass
