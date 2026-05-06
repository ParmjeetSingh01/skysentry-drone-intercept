import math

class InterceptSolver:
    def __init__(self, intercept_speed=25.0):
        self.speed=intercept_speed; self.engaged=False; self._prev_los=None
    def solve(self, interceptor, target, target_vel=(0,0)):
        ix,iy=interceptor; tx,ty=target; tvx,tvy=target_vel
        dx,dy=tx-ix,ty-iy; dist=math.hypot(dx,dy)
        if dist<1: return {"heading":0,"distance":0,"eta":0,"status":"INTERCEPTED","pn_accel":0,"los_deg":0,"engaged":True,"intercept_pos":[ix,iy]}
        los=math.atan2(dy,dx); los_rate=(los-self._prev_los) if self._prev_los else 0.0; self._prev_los=los
        heading=(math.degrees(los)+90)%360; closing=self.speed-(tvx*math.cos(los)+tvy*math.sin(los)); eta=dist/max(closing,0.1)
        if dist<30: self.engaged=True; status="ENGAGE"
        elif dist<120: status="ARM"
        elif dist<300: status="TRACK"
        else: status="SEARCH"
        return {"heading":round(heading,1),"distance":round(dist,1),"eta":round(eta,2),"status":status,"pn_accel":round(3.0*self.speed*los_rate,3),"los_deg":round(math.degrees(los),1),"engaged":self.engaged,"intercept_pos":[round(tx+tvx*eta,1),round(ty+tvy*eta,1)]}
