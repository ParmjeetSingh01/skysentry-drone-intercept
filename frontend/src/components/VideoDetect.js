import{useState,useRef}from'react';
const API=process.env.REACT_APP_API_URL||'http://localhost:8000';
const M='"Share Tech Mono",monospace';
export default function VideoDetect(){
  const[result,setResult]=useState(null);
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState('');
  const[prog,setProg]=useState('');
  const inp=useRef(null);
  async function upload(file){
    if(!file)return;
    setLoading(true);setError('');setResult(null);setProg('Uploading...');
    const fd=new FormData();fd.append('file',file);
    try{
      setProg('Running YOLO on every 5th frame...');
      const r=await fetch(API+'/detect/video?every_n=5',{method:'POST',body:fd});
      const d=await r.json();
      if(d.error)setError(d.error);else setResult(d);
    }catch(e){setError('Cannot reach backend.');}
    setLoading(false);setProg('');
  }
  const box={padding:16,border:'1px solid rgba(59,130,246,0.12)',borderRadius:6,background:'rgba(59,130,246,0.02)'};
  const lbl={color:'rgba(59,130,246,0.45)',fontSize:10,letterSpacing:2,textTransform:'uppercase'};
  const maxDets=result?Math.max(...result.frames.map(f=>f.count),1):1;
  return <div style={{display:'flex',flexDirection:'column',gap:20,fontFamily:M}}>
    <div onClick={()=>inp.current?.click()} style={{...box,border:'2px dashed rgba(59,130,246,0.25)',cursor:'pointer',textAlign:'center',padding:48}}>
      <div style={{fontSize:40,marginBottom:12}}>🎬</div>
      <div style={{color:'#60a5fa',fontSize:13,letterSpacing:1}}>CLICK TO UPLOAD VIDEO</div>
      <div style={{color:'rgba(0,255,100,0.4)',fontSize:11,marginTop:6}}>MP4 · AVI · MOV · MKV</div>
      <input ref={inp} type="file" accept="video/*" style={{display:'none'}} onChange={e=>upload(e.target.files[0])}/>
    </div>
    {loading&&<div style={{textAlign:'center',color:'#60a5fa',letterSpacing:2,animation:'pulse 1s infinite'}}>⚙ {prog}</div>}
    {error&&<div style={{color:'#ff3b30',fontSize:12,padding:12,border:'1px solid rgba(255,59,48,0.3)',borderRadius:4}}>{error}</div>}
    {result&&<div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
        {[{l:'File',v:result.filename},{l:'Total Frames',v:result.total_frames},{l:'Analyzed',v:result.analyzed_frames},{l:'FPS',v:result.fps?.toFixed(1)},{l:'Detections',v:result.total_detections}].map(({l,v})=>(
          <div key={l} style={{...box,flex:1,minWidth:100}}>
            <div style={lbl}>{l}</div>
            <div style={{color:'#60a5fa',fontSize:14,fontWeight:'bold',marginTop:4}}>{v}</div>
          </div>
        ))}
      </div>
      <div>
        <div style={{...lbl,marginBottom:10}}>DETECTION TIMELINE</div>
        <div style={{background:'rgba(0,0,0,0.4)',borderRadius:4,padding:16,height:130,position:'relative',border:'1px solid rgba(59,130,246,0.08)'}}>
          <div style={{display:'flex',alignItems:'flex-end',height:'100%',gap:1}}>
            {result.frames.map((f,i)=>{
              const pct=f.count/maxDets;
              const col=pct>.6?'#ff3b30':pct>.3?'#ff9f0a':'#34c759';
              return <div key={i} title={'Frame '+f.frame_idx+': '+f.count+' detections'} style={{flex:1,height:Math.max(4,pct*100)+'%',background:col,opacity:.85,borderRadius:'2px 2px 0 0',minWidth:2}}/>;
            })}
          </div>
          <div style={{position:'absolute',top:6,right:10,fontSize:10,color:'rgba(0,255,100,0.4)'}}>MAX {maxDets}/frame</div>
        </div>
      </div>
      <div style={{maxHeight:280,overflowY:'auto'}}>
        <div style={{...lbl,marginBottom:8}}>FRAMES WITH DETECTIONS</div>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr>{['Frame','Time','Count','Classes'].map(h=><th key={h} style={{...lbl,padding:'4px 8px',textAlign:'left',borderBottom:'1px solid rgba(0,255,100,0.1)'}}>{h}</th>)}</tr></thead>
          <tbody>{result.frames.filter(f=>f.count>0).map((f,i)=>(
            <tr key={i} style={{borderBottom:'1px solid rgba(59,130,246,0.04)'}}>
              <td style={{color:'#ff9f0a',fontFamily:M,fontSize:11,padding:'4px 8px'}}>{f.frame_idx}</td>
              <td style={{color:'#60a5fa',fontFamily:M,fontSize:11,padding:'4px 8px'}}>{f.timestamp_s}s</td>
              <td style={{color:f.count>2?'#ff3b30':'#60a5fa',fontFamily:M,fontSize:12,padding:'4px 8px',fontWeight:'bold'}}>{f.count}</td>
              <td style={{color:'rgba(0,255,100,0.7)',fontFamily:M,fontSize:10,padding:'4px 8px'}}>{[...new Set(f.detections.map(d=>d.class))].join(', ')||'—'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>}
  </div>;
}
