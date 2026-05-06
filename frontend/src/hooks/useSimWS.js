import { useEffect, useRef, useState, useCallback } from "react";
const WS_URL = process.env.REACT_APP_WS_URL || "ws://localhost:8000/ws/sim";
export default function useSimWS() {
  const [frame, setFrame] = useState(null);
  const [status, setStatus] = useState("CONNECTING");
  const wsRef = useRef(null); const retryRef = useRef(null);
  const connect = useCallback(() => {
    setStatus("CONNECTING");
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => setStatus("ONLINE");
    ws.onclose = () => { setStatus("RECONNECTING"); retryRef.current = setTimeout(connect, 2000); };
    ws.onerror = () => setStatus("ERROR");
    ws.onmessage = (e) => { try { setFrame(JSON.parse(e.data)); } catch {} };
    wsRef.current = ws;
  }, []);
  useEffect(() => { connect(); return () => { clearTimeout(retryRef.current); wsRef.current?.close(); }; }, [connect]);
  return { frame, status };
}
