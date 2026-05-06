import{useEffect,useRef}from'react';
export default function Arena({data}){
  const ref=useRef(null),fr=useRef(0);
  useEffect(()=>{
    const c=ref.current;if(!c||!data)return;
    const ctx=c.getContext('2d');
    const{arena,drones,tracks,interceptor,target}=data;
    const W=arena?.w||1280,H=arena?.h||720;
    c.width=W;c.height=H;fr.current++;const f=fr.current;
    ctx.fillStyle='#0a0f1e';ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='rgba(59,130,246,0.04)';ctx.lineWidth=0.5;
    for(let x=0;x<W;x+=64){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=0;y<H;y+=64){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    [120,240,360].forEach(r=>{ctx.beginPath();ctx.arc(W/2,H/2,r,0,Math.PI*2);ctx.strokeStyle='rgba(59,130,246,0.06)';ctx.lineWidth=1;ctx.stroke();});
    const a=(f*.04)%(Math.PI*2);ctx.save();ctx.translate(W/2,H/2);ctx.rotate(a);
    const g=ctx.createLinearGradient(0,0,700,0);g.addColorStop(0,'rgba(59,130,246,0.18)');g.addColorStop(1,'rgba(0,255,100,0)');
    ctx.strokeStyle=g;ctx.lineWidth=36;ctx.globalAlpha=0.7;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(700,0);ctx.stroke();ctx.globalAlpha=1;ctx.restore();
    ctx.beginPath();ctx.arc(W/2,H/2,180,0,Math.PI*2);ctx.fillStyle='rgba(255,59,48,0.05)';ctx.fill();
    ctx.strokeStyle='rgba(255,59,48,0.2)';ctx.lineWidth=1.5;ctx.setLineDash([6,6]);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='rgba(59,130,246,0.3)';ctx.font='10px monospace';ctx.textAlign='center';ctx.fillText('PROTECTED ZONE',W/2,H/2-188);
    for(const det of(drones||[])){
      let mt=null,md=1e9;
      for(const t of(tracks||[])){
        const d=Math.hypot(t.position[0]-(det.bbox[0]+det.bbox[2])/2,t.position[1]-(det.bbox[1]+det.bbox[3])/2);
        if(d<md){md=d;mt=t;}
      }
      const[x1,y1,x2,y2]=det.bbox,cx=(x1+x2)/2,cy=(y1+y2)/2;
      if(mt?.history?.length>1){
        ctx.beginPath();ctx.moveTo(mt.history[0][0],mt.history[0][1]);
        mt.history.forEach(p=>ctx.lineTo(p[0],p[1]));
        ctx.strokeStyle='rgba(255,159,10,0.3)';ctx.lineWidth=1.5;ctx.stroke();
      }
      const pulse=0.7+0.3*Math.sin(f*0.15);
      ctx.strokeStyle='#ff3b30';ctx.lineWidth=1.5;ctx.globalAlpha=pulse;
      const cs=14;
      ctx.beginPath();
      ctx.moveTo(x1,y1+cs);ctx.lineTo(x1,y1);ctx.lineTo(x1+cs,y1);
      ctx.moveTo(x2-cs,y1);ctx.lineTo(x2,y1);ctx.lineTo(x2,y1+cs);
      ctx.moveTo(x2,y2-cs);ctx.lineTo(x2,y2);ctx.lineTo(x2-cs,y2);
      ctx.moveTo(x1+cs,y2);ctx.lineTo(x1,y2);ctx.lineTo(x1,y2-cs);
      ctx.stroke();ctx.globalAlpha=1;
      ctx.fillStyle='rgba(255,59,48,0.1)';ctx.fillRect(x1,y1,x2-x1,y2-y1);
      ctx.fillStyle='#ff3b30';ctx.beginPath();ctx.arc(cx,cy,3,0,Math.PI*2);ctx.fill();
      if(mt){
        ctx.font='bold 10px monospace';ctx.fillStyle='#ff3b30';ctx.textAlign='left';
        ctx.fillText('TGT-'+mt.id+'  '+(det.conf*100).toFixed(0)+'%',x1,y1-14);
        ctx.fillStyle='rgba(59,130,246,0.5)';ctx.font='10px monospace';
        ctx.fillText((det.class||'').toUpperCase(),x1,y1-4);
      }
      if(mt?.velocity){
        const[vx,vy]=mt.velocity,ex=cx+vx*10,ey=cy+vy*10;
        ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(ex,ey);
        ctx.strokeStyle='#ff9f0a';ctx.lineWidth=1.5;ctx.stroke();
      }
    }
    for(const t of(tracks||[])){
      const ic=t.intercept;if(!ic?.intercept_pt)continue;
      const[ix,iy]=ic.intercept_pt;
      ctx.beginPath();ctx.arc(ix,iy,16,0,Math.PI*2);ctx.strokeStyle='#ff375f';ctx.lineWidth=1;ctx.stroke();
      ctx.beginPath();ctx.moveTo(ix-10,iy);ctx.lineTo(ix+10,iy);ctx.moveTo(ix,iy-10);ctx.lineTo(ix,iy+10);
      ctx.strokeStyle='#ff375f';ctx.lineWidth=1.5;ctx.stroke();
      ctx.font='9px monospace';ctx.fillStyle='#ff375f';ctx.textAlign='left';
      ctx.fillText('TTI:'+ic.tti?.toFixed(1)+'f',ix+18,iy+4);
    }
    if(interceptor){
      const{x,y}=interceptor;
      if(target?.intercept?.intercept_pt){
        const[tx,ty]=target.intercept.intercept_pt;
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(tx,ty);
        ctx.strokeStyle='rgba(0,212,255,0.5)';ctx.lineWidth=1;ctx.setLineDash([4,6]);ctx.stroke();ctx.setLineDash([]);
      }
      const gw=ctx.createRadialGradient(x,y,0,x,y,30);
      gw.addColorStop(0,'rgba(0,212,255,0.25)');gw.addColorStop(1,'rgba(0,212,255,0)');
      ctx.beginPath();ctx.arc(x,y,30,0,Math.PI*2);ctx.fillStyle=gw;ctx.fill();
      const p=0.85+0.15*Math.sin(f*0.2);
      ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.fillStyle='rgba(0,212,255,'+p+')';ctx.fill();
      ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();
      ctx.font='bold 10px monospace';ctx.fillStyle='#00d4ff';ctx.textAlign='center';
      ctx.fillText('INTERCEPTOR',x,y+28);
    }
    ctx.fillStyle='rgba(59,130,246,0.15)';ctx.font='10px monospace';ctx.textAlign='left';
    ctx.fillText('SkySentry  |  SIMULATION  |  KALMAN + INTERCEPT SOLVER',12,H-12);
  },[data]);
  return <canvas ref={ref} style={{width:'100%',height:'100%',objectFit:'contain',display:'block'}}/>;
}
