import math, random

class SimDrone:
    def __init__(self, drone_id, arena_w=800, arena_h=600):
        self.id=drone_id; self.w=arena_w; self.h=arena_h
        self.x=float(random.choice([0,arena_w])); self.y=float(random.randint(50,arena_h-50))
        self.vx=random.uniform(1.5,4.0)*(1 if self.x==0 else -1); self.vy=random.uniform(-1.5,1.5)
        self.alt=random.randint(50,400); self.threat=random.choice(["THREAT","WARN","WARN","THREAT"])
        self.label=random.choice(["DJI-Phantom","Quad-UAV","FPV-Racer","Fixed-Wing","Unknown-UAV"])
        self.conf=round(random.uniform(0.62,0.97),2); self.alive=True
    def step(self):
        self.vx+=random.uniform(-0.1,0.1); self.vy+=random.uniform(-0.1,0.1)
        self.vx=max(-6,min(6,self.vx)); self.vy=max(-4,min(4,self.vy))
        self.x+=self.vx; self.y+=self.vy; self.alt+=random.randint(-2,2); self.alt=max(10,min(500,self.alt))
        if self.x<-50 or self.x>self.w+50 or self.y<-50 or self.y>self.h+50: self.alive=False
    def to_dict(self):
        return {"id":self.id,"x":round(self.x,1),"y":round(self.y,1),"vx":round(self.vx,2),"vy":round(self.vy,2),"alt":self.alt,"label":self.label,"conf":self.conf,"level":self.threat,"alive":self.alive}

class SimInterceptor:
    def __init__(self, w=800, h=600):
        self.x=w/2; self.y=h/2; self.speed=5.0; self.status="PATROL"; self.heading=0.0
    def pursue(self, t):
        if not t: self.status="PATROL"; return
        dx,dy=t["x"]-self.x,t["y"]-self.y; dist=math.hypot(dx,dy)
        if dist<1: self.status="INTERCEPTED"; return
        self.heading=math.degrees(math.atan2(dy,dx)); step=min(self.speed,dist)
        self.x+=dx/dist*step; self.y+=dy/dist*step
        self.status="ENGAGE" if dist<25 else "ARM" if dist<80 else "TRACK" if dist<200 else "PURSUIT"
    def to_dict(self):
        return {"x":round(self.x,1),"y":round(self.y,1),"heading":round(self.heading,1),"status":self.status,"speed":self.speed}
