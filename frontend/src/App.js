import{useState,useEffect}from'react';
import Arena from'./components/Arena';
import Panel from'./components/Panel';
import ImageDetect from'./components/ImageDetect';
import VideoDetect from'./components/VideoDetect';
import WebcamDetect from'./components/WebcamDetect';
import{useSimWS}from'./hooks/useSimWS';
const M='"Share Tech Mono",monospace';
const TABS=[{id:'SIM',icon:'🎯',label:'Simulation'},{id:'IMAGE',icon:'🖼',label:'Image'},{id:'VIDEO',icon:'🎬',label:'Video'},{id:'CAM',icon:'📷',label:'Webcam'}];
export default function App(){
  const{data,connected,send}=useSimWS();
  const[tab,setTab]=useState('SIM');
  const[clock,setClock]=useState('');
  const isAlert=data?.status?.includes('THREAT')&&tab==='SIM';
  useEffect(()=>{const x=setInterval(()=>setClock(new Date().toISOString().replace('T',' ').slice(0,19)+'Z'),1000);return()=>clearInterval(x);},[]);
  return <div style={{width:'100vw',height:'100vh',background:'#0a0f1e',display:'flex',flexDirection:'column',overflow:'hidden',fontFamily:M}}>
    <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:100,backgroundImage:'repeating-linear-gradient(0deg,rgba(0,0,0,0.03) 0px,rgba(0,0,0,0.03) 1px,transparent 1px,transparent 2px)'}}/>
    {isAlert&&<div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:99,border:'2px solid rgba(255,59,48,0.45)',animation:'flash 1s infinite'}}/>}
    {/* TOP BAR */}
    <div style={{display:'flex',alignItems:'center',padding:'0 16px',height:50,background:'rgba(0,0,0,0.9)',borderBottom:'1px solid '+(isAlert?'rgba(255,59,48,0.5)':'rgba(59,130,246,0.15)'),flexShrink:0,gap:10}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginRight:8}}>
        <div style={{width:22,height:22,borderRadius:'50%',background:'conic-gradient(#00ff64 0deg,transparent 60deg,#00ff64 120deg,transparent 180deg,#00ff64 240deg,transparent 300deg)',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{width:9,height:9,borderRadius:'50%',background:'#0a0f1e'}}/>
        </div>
        <span style={{fontSize:12,letterSpacing:3,color:'#60a5fa',fontWeight:'bold'}}>SKYSENTRY</span>
      </div>
      {TABS.map(({id,icon,label})=>(
        <button key={id} onClick={()=>setTab(id)} style={{padding:'5px 14px',border:'1px solid '+(tab===id?'#60a5fa':'rgba(59,130,246,0.18)'),background:tab===id?'rgba(59,130,246,0.12)':'transparent',color:tab===id?'#60a5fa':'rgba(59,130,246,0.45)',borderRadius:3,cursor:'pointer',fontFamily:M,fontSize:11,letterSpacing:1}}>{icon} {label}</button>
      ))}
      {tab==='SIM'&&<div style={{display:'flex',gap:6,marginLeft:8}}>
        {[['spawn','+ SPAWN','#60a5fa'],['remove','- REMOVE','#ff9f0a'],['reset','RESET','#ff3b30']].map(([a,l,c])=>(
          <button key={a} onClick={()=>send(a)} style={{padding:'4px 12px',border:'1px solid '+c,background:'transparent',color:c,borderRadius:2,cursor:'pointer',fontFamily:M,fontSize:11}}>{l}</button>
        ))}
      </div>}
      <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:12}}>
        <span style={{fontSize:10,color:'rgba(59,130,246,0.35)'}}>{clock}</span>
        <div style={{display:'flex',alignItems:'center',gap:6,padding:'3px 10px',border:'1px solid '+(isAlert?'#ff3b30':'#60a5fa'),borderRadius:2,background:isAlert?'rgba(255,59,48,0.08)':'rgba(59,130,246,0.04)'}}>
          <div style={{width:5,height:5,borderRadius:'50%',background:connected?(isAlert?'#ff3b30':'#60a5fa'):'#444'}}/>
          <span style={{fontSize:10,letterSpacing:1,color:isAlert?'#ff3b30':'#60a5fa'}}>{connected?(isAlert?'THREAT':'CLEAR'):'OFFLINE'}</span>
        </div>
      </div>
    </div>
    {/* SIM TAB */}
    {tab==='SIM'&&<>
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
        <div style={{flex:1,position:'relative',overflow:'hidden',background:'#080d1a',borderRight:'1px solid rgba(0,255,100,0.1)'}}>
          <Arena data={data}/>
          {!connected&&<div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(5,10,5,0.88)',flexDirection:'column',gap:16}}>
            <div style={{width:36,height:36,border:'2px solid #00ff64',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
            <div style={{color:'#60a5fa',letterSpacing:3,fontSize:12}}>CONNECTING...</div>
          </div>}
        </div>
        <div style={{width:268,background:'#0d1117',overflowY:'auto',padding:14}}><Panel data={data} connected={connected}/></div>
      </div>
      <div style={{borderTop:'1px solid rgba(0,255,100,0.1)',background:'rgba(0,0,0,0.6)',padding:'4px 14px 6px',flexShrink:0}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr>{['ID','Class','X','Y','Vx','Vy','Score','TTI'].map(h=><th key={h} style={{color:'rgba(0,255,100,0.4)',fontSize:10,letterSpacing:2,padding:'2px 8px',textAlign:'left',borderBottom:'1px solid rgba(59,130,246,0.08)'}}>{h}</th>)}</tr></thead>
          <tbody>{(data?.tracks||[]).map(t=>(
            <tr key={t.id} style={{borderBottom:'1px solid rgba(59,130,246,0.04)'}}>
              <td style={{color:'#ff9f0a',fontSize:11,padding:'3px 8px',fontWeight:'bold',fontFamily:M}}>TGT-{t.id}</td>
              <td style={{color:'rgba(0,255,100,0.6)',fontSize:10,padding:'3px 8px',fontFamily:M}}>{t.dtype||'DRONE'}</td>
              <td style={{color:'#60a5fa',fontSize:11,padding:'3px 8px',fontFamily:M}}>{t.position?.[0]?.toFixed(0)}</td>
              <td style={{color:'#60a5fa',fontSize:11,padding:'3px 8px',fontFamily:M}}>{t.position?.[1]?.toFixed(0)}</td>
              <td style={{color:'#60a5fa',fontSize:11,padding:'3px 8px',fontFamily:M}}>{t.velocity?.[0]?.toFixed(1)}</td>
              <td style={{color:'#60a5fa',fontSize:11,padding:'3px 8px',fontFamily:M}}>{t.velocity?.[1]?.toFixed(1)}</td>
              <td style={{color:((t.score||0)>.65)?'#ff3b30':'#34c759',fontSize:11,padding:'3px 8px',fontWeight:'bold',fontFamily:M}}>{((t.score||0)*100).toFixed(0)}%</td>
              <td style={{color:'#00d4ff',fontSize:11,padding:'3px 8px',fontFamily:M}}>{t.intercept?.tti?.toFixed(1)??'—'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </>}
    {/* OTHER TABS */}
    {tab!=='SIM'&&<div style={{flex:1,overflowY:'auto',padding:24,scrollbarWidth:'thin',scrollbarColor:'rgba(0,255,100,0.2) transparent'}}>
      <div style={{maxWidth:1040,margin:'0 auto'}}>
        <div style={{marginBottom:20,padding:'10px 14px',border:'1px solid rgba(59,130,246,0.15)',borderRadius:6,background:'rgba(59,130,246,0.02)',display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:22}}>{TABS.find(t=>t.id===tab)?.icon}</span>
          <div>
            <div style={{fontSize:10,color:'rgba(0,255,100,0.4)',letterSpacing:2,marginBottom:2}}>MODE</div>
            <div style={{fontSize:12,color:'#60a5fa',fontWeight:'bold',letterSpacing:1}}>
              {tab==='IMAGE'&&'IMAGE DETECTION — Upload a photo for YOLO bounding box analysis'}
              {tab==='VIDEO'&&'VIDEO DETECTION — Upload footage for frame-by-frame YOLO analysis'}
              {tab==='CAM'&&'LIVE WEBCAM — Real-time YOLO via WebSocket (allow camera access)'}
            </div>
          </div>
          <div style={{marginLeft:'auto',padding:'3px 10px',border:'1px solid '+(connected?'#60a5fa':'#ff3b30'),borderRadius:2,fontSize:10,color:connected?'#60a5fa':'#ff3b30',fontFamily:M}}>BACKEND {connected?'ONLINE':'OFFLINE'}</div>
        </div>
        {tab==='IMAGE'&&<ImageDetect/>}
        {tab==='VIDEO'&&<VideoDetect/>}
        {tab==='CAM'&&<WebcamDetect/>}
      </div>
    </div>}
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');*{box-sizing:border-box;margin:0;padding:0;}::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:rgba(0,255,100,0.2);}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes flash{0%,100%{opacity:1}50%{opacity:0.3}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
  </div>;
}
