import { useState, useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";
import TMF_DATA from "./tmf_data.js";

// ─── Domain config (UI only — colours not in spec data) ──────────────────────
const DOMAINS = {
  customer:   { label: "Customer",    color: "#00d4ff" },
  product:    { label: "Product",     color: "#ff9f0a" },
  service:    { label: "Service Mgmt", color: "#5e9bff" },
  resource:   { label: "Resource",    color: "#30d158" },
  engagement: { label: "Engagement",  color: "#ff6b6b" },
  common:     { label: "Common",      color: "#bf5af2" },
};

// ─── Data from tmf-spec-parser (auto-generated) ───────────────────────────────
const APIS        = TMF_DATA.apis;
const LINKS       = TMF_DATA.links;
const PATTERNS    = TMF_DATA.patterns;
const API_DETAILS = TMF_DATA.details;

// GITHUB_REPOS: built from the apis registry (id → repo name)
const GITHUB_REPOS = Object.fromEntries(
  TMF_DATA.apis.map(a => [a.id, a.repo])
);

// ─── State abbreviations for compact diagram display ─────────────────────────
const STATE_ABBREV = {
  acknowledged:             "ack",
  feasibilityChecked:       "feasib.",
  "done.standard":          "done:std",
  "done.provideAlternative":"done:alt",
  "done.unableToProvide":   "done:no",
  inProgress:               "inProg",
};
const abbrevState = (s, w) => {
  if (STATE_ABBREV[s]) return STATE_ABBREV[s];
  const maxCh = Math.floor((w - 6) / 4.8);
  return s.length > maxCh ? s.slice(0, maxCh - 1) + "…" : s;
};

// ─── Lifecycle Diagram component ──────────────────────────────────────────────
function LifecycleDiagram({ lifecycle, transitions, terminal, domainColor }) {
  if (!lifecycle?.length || !transitions?.length) return null;

  const NH = 18, NR = 3, SVG_W = 290;
  const mainPath   = lifecycle.filter(s => !terminal.includes(s));
  const termStates = lifecycle.filter(s =>  terminal.includes(s));

  const topSlotW = Math.floor(SVG_W / Math.max(mainPath.length, 1));
  const topNW    = Math.max(topSlotW - 8, 28);
  const botSlotW = termStates.length ? Math.floor(SVG_W / termStates.length) : 0;
  const botNW    = termStates.length ? Math.max(botSlotW - 8, 28) : 0;

  const hasBack = transitions.some(t => {
    const fi = mainPath.indexOf(t.from), ti = mainPath.indexOf(t.to);
    return fi >= 0 && ti >= 0 && fi > ti;
  });
  const topY = hasBack ? 22 : 6;
  const botY = topY + NH + 36;
  const svgH = termStates.length ? botY + NH + 10 : topY + NH + 10;
  const fSize = topNW < 50 ? 7 : 8;

  const pos = {};
  mainPath.forEach((s, i)  => { pos[s] = { x: (i + 0.5) * topSlotW, y: topY, w: topNW, isTerm: false }; });
  termStates.forEach((s, i) => {
    const startX = (SVG_W - termStates.length * botSlotW) / 2;
    pos[s] = { x: startX + (i + 0.5) * botSlotW, y: botY, w: botNW, isTerm: true };
  });

  const edges = transitions.map((t, idx) => {
    const fp = pos[t.from], tp = pos[t.to];
    if (!fp || !tp) return null;
    if (fp.y === tp.y) {
      if (fp.x < tp.x) {
        return { key: idx, isBack: false, d: `M${fp.x+fp.w/2},${fp.y+NH/2} L${tp.x-tp.w/2-1},${tp.y+NH/2}` };
      } else {
        const ay = fp.y - 14;
        return { key: idx, isBack: true, d: `M${fp.x},${fp.y} C${fp.x},${ay} ${tp.x},${ay} ${tp.x},${tp.y}` };
      }
    } else {
      const sy = fp.y + NH, ey = tp.y - 1, dy = (ey - sy) / 2;
      return { key: idx, isBack: false, d: `M${fp.x},${sy} C${fp.x},${sy+dy} ${tp.x},${ey-dy} ${tp.x},${ey}` };
    }
  }).filter(Boolean);

  return (
    <svg width="100%" viewBox={`0 0 ${SVG_W} ${svgH}`} style={{display:"block",marginTop:6,marginBottom:4}}>
      <defs>
        <marker id="lc-fwd" viewBox="0 -3 8 6" refX="7" refY="0" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0,-2.5L7,0L0,2.5" fill="none" stroke={domainColor} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </marker>
        <marker id="lc-back" viewBox="0 -3 8 6" refX="7" refY="0" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0,-2.5L7,0L0,2.5" fill="none" stroke="rgba(180,195,215,0.5)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </marker>
      </defs>
      {edges.map(e => (
        <path key={e.key} d={e.d} fill="none"
          stroke={e.isBack ? "rgba(180,195,215,0.3)" : domainColor}
          strokeWidth={e.isBack ? 0.75 : 0.9}
          strokeOpacity={e.isBack ? 0.8 : 0.5}
          strokeDasharray={e.isBack ? "2.5 2.5" : undefined}
          markerEnd={e.isBack ? "url(#lc-back)" : "url(#lc-fwd)"}
        />
      ))}
      {Object.entries(pos).map(([state, p]) => (
        <g key={state}>
          <rect x={p.x-p.w/2} y={p.y} width={p.w} height={NH} rx={NR}
            fill={p.isTerm ? "rgba(255,107,107,0.07)" : `${domainColor}12`}
            stroke={p.isTerm ? "rgba(255,107,107,0.55)" : domainColor}
            strokeWidth={0.75} strokeOpacity={p.isTerm ? 1 : 0.7}
          />
          <text x={p.x} y={p.y+NH/2} textAnchor="middle" dominantBaseline="central"
            fontFamily="JetBrains Mono,monospace" fontSize={fSize} fontWeight="500"
            fill={p.isTerm ? "#ff8585" : domainColor} fillOpacity={0.92}
          >{abbrevState(state, p.w)}</text>
        </g>
      ))}
    </svg>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────
const R = 23;

function SectionTitle({ children }) {
  return (
    <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8.5,letterSpacing:"1.5px",textTransform:"uppercase",color:"rgba(224,232,240,0.28)",marginBottom:7}}>
      {children}
    </div>
  );
}

// ─── Hover Tooltip ────────────────────────────────────────────────────────────
function NodeTooltip({ hovered, apiMap, connCounts, canvasRef }) {
  if (!hovered) return null;
  const api    = apiMap[hovered.id];
  const detail = API_DETAILS[hovered.id];
  const cc     = connCounts[hovered.id] || { out: 0, in: 0 };
  const color  = DOMAINS[api.domain].color;
  const rect   = canvasRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
  const tx     = hovered.cx - rect.left + 18;
  const ty     = hovered.cy - rect.top  - 20;
  const desc   = detail?.description?.split(".")[0] + "." || "";

  return (
    <div style={{
      position:"absolute", left:tx, top:ty, zIndex:50, pointerEvents:"none",
      background:"rgba(6,11,20,0.97)", border:`1px solid ${color}30`,
      borderLeft:`2px solid ${color}`,
      borderRadius:7, padding:"9px 11px", maxWidth:220,
      animation:"fadeUp 0.12s ease",
    }}>
      <div style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:13,color,marginBottom:2}}>{hovered.id}</div>
      <div style={{fontSize:10.5,color:"rgba(224,232,240,0.5)",marginBottom:7,fontFamily:"'Syne',sans-serif"}}>{api.name}</div>
      <div style={{fontSize:10,lineHeight:1.65,color:"rgba(224,232,240,0.5)",marginBottom:8,fontFamily:"'Syne',sans-serif"}}>{desc}</div>
      <div style={{display:"flex",gap:10,fontFamily:"'JetBrains Mono',monospace",fontSize:9.5}}>
        <span style={{color:"rgba(224,232,240,0.35)"}}>out <span style={{color}}>{cc.out}</span></span>
        <span style={{color:"rgba(224,232,240,0.35)"}}>in <span style={{color}}>{cc.in}</span></span>
        <span style={{color:`${color}60`,marginLeft:"auto"}}>{DOMAINS[api.domain].label}</span>
      </div>
    </div>
  );
}

// ─── Main app ─────────────────────────────────────────────────────────────────
export default function TMFMap() {
  const svgRef     = useRef(null);
  const canvasRef  = useRef(null);
  const gRef       = useRef(null);
  const simRef     = useRef(null);
  const zoomRef    = useRef(null);
  const setHovRef  = useRef(null);

  const [selected, setSelected] = useState(null);
  const [hovered,  setHovered]  = useState(null);
  const [pattern,  setPattern]  = useState(null);
  const [search,   setSearch]   = useState("");
  const [domains,  setDomains]  = useState(new Set(Object.keys(DOMAINS)));

  setHovRef.current = setHovered;

  const apiMap = useMemo(() => Object.fromEntries(APIS.map(a => [a.id, a])), []);

  const connCounts = useMemo(() => {
    const c = {};
    APIS.forEach(a => { c[a.id] = { out: 0, in: 0 }; });
    LINKS.forEach(l => {
      const src = typeof l.source === "object" ? l.source.id : l.source;
      const tgt = typeof l.target === "object" ? l.target.id : l.target;
      if (c[src]) c[src].out++;
      if (c[tgt]) c[tgt].in++;
    });
    return c;
  }, []);

  const filtered = useMemo(() => new Set(
    APIS
      .filter(a => domains.has(a.domain))
      .filter(a => !search || a.id.toLowerCase().includes(search.toLowerCase()) || a.name.toLowerCase().includes(search.toLowerCase()))
      .map(a => a.id)
  ), [search, domains]);

  const filteredKey = [...filtered].sort().join(",");

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const W = el.clientWidth  || 900;
    const H = el.clientHeight || 600;
    const svg = d3.select(el);
    svg.selectAll("*").remove();

    const defs = svg.append("defs");
    Object.entries(DOMAINS).forEach(([k, d]) => {
      defs.append("marker")
        .attr("id",`arr-${k}`).attr("viewBox","0 -5 10 10")
        .attr("refX",10).attr("refY",0).attr("markerWidth",5).attr("markerHeight",5).attr("orient","auto")
        .append("path").attr("d","M0,-5L10,0L0,5").attr("fill",d.color).attr("opacity",0.75);
      const f = defs.append("filter").attr("id",`glow-${k}`)
        .attr("x","-60%").attr("y","-60%").attr("width","220%").attr("height","220%");
      f.append("feGaussianBlur").attr("in","SourceGraphic").attr("stdDeviation","5").attr("result","blur");
      const m = f.append("feMerge");
      m.append("feMergeNode").attr("in","blur");
      m.append("feMergeNode").attr("in","SourceGraphic");
    });
    const fs = defs.append("filter").attr("id","glow-sel")
      .attr("x","-60%").attr("y","-60%").attr("width","220%").attr("height","220%");
    fs.append("feGaussianBlur").attr("in","SourceGraphic").attr("stdDeviation","9").attr("result","blur");
    const ms = fs.append("feMerge");
    ms.append("feMergeNode").attr("in","blur");
    ms.append("feMergeNode").attr("in","SourceGraphic");

    const g = svg.append("g");
    gRef.current = g;
    const zoom = d3.zoom().scaleExtent([0.2,4]).on("zoom", e => g.attr("transform",e.transform));
    zoomRef.current = zoom;
    svg.call(zoom);

    const nodes = APIS.map(a => ({...a}));
    const links = LINKS.map(l => ({...l}));

    const counts = {};
    APIS.forEach(a => { counts[a.id] = 0; });
    LINKS.forEach(l => { counts[l.source]=(counts[l.source]||0)+1; counts[l.target]=(counts[l.target]||0)+1; });
    const maxDeg = Math.max(...Object.values(counts));
    const nodeR = d => R + Math.round((counts[d.id] / maxDeg) * 5);

    const sim = d3.forceSimulation(nodes)
      .force("link",      d3.forceLink(links).id(d=>d.id).distance(140).strength(0.45))
      .force("charge",    d3.forceManyBody().strength(-580))
      .force("center",    d3.forceCenter(W/2, H/2))
      .force("collision", d3.forceCollide(d => nodeR(d) + 22));
    simRef.current = sim;

    const linkLayer = g.append("g");
    const linkSel = linkLayer.selectAll("path").data(links).enter().append("path")
      .attr("class","lnk").attr("fill","none").attr("stroke-width",1.5).attr("stroke-opacity",0.32)
      .attr("stroke", d => { const a = APIS.find(x => x.id===(d.source.id||d.source)); return a ? DOMAINS[a.domain].color : "#5e9bff"; })
      .attr("marker-end", d => { const a = APIS.find(x => x.id===(d.source.id||d.source)); return `url(#arr-${a?.domain||"service"})`; });

    const nodeLayer = g.append("g");
    const nodeSel = nodeLayer.selectAll("g").data(nodes).enter().append("g")
      .attr("class","nd").attr("data-sel","0").style("cursor","pointer");

    nodeSel.append("circle").attr("class","nd-ring")
      .attr("r",d=>nodeR(d)+8).attr("fill","none")
      .attr("stroke",d=>DOMAINS[d.domain].color).attr("stroke-width",0.5).attr("stroke-opacity",0.18);
    nodeSel.append("circle").attr("class","nd-body")
      .attr("r",d=>nodeR(d))
      .attr("fill",d=>`${DOMAINS[d.domain].color}16`)
      .attr("stroke",d=>DOMAINS[d.domain].color)
      .attr("stroke-width",1.8)
      .attr("filter",d=>`url(#glow-${d.domain})`);
    nodeSel.append("text")
      .attr("text-anchor","middle").attr("dy","-3.5")
      .attr("font-family","JetBrains Mono,monospace").attr("font-size","9px").attr("font-weight","700")
      .attr("fill",d=>DOMAINS[d.domain].color).attr("pointer-events","none")
      .text(d=>d.id);
    nodeSel.append("text")
      .attr("text-anchor","middle").attr("dy","9px")
      .attr("font-family","Syne,sans-serif").attr("font-size","7px").attr("font-weight","600")
      .attr("fill","rgba(224,232,240,0.42)").attr("pointer-events","none")
      .text(d=>d.short);

    const drag = d3.drag()
      .on("start",(e,d)=>{ if(!e.active) sim.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; })
      .on("drag", (e,d)=>{ d.fx=e.x; d.fy=e.y; })
      .on("end",  (e,d)=>{ if(!e.active) sim.alphaTarget(0); d.fx=null; d.fy=null; });
    nodeSel.call(drag);

    nodeSel
      .on("click",(e,d)=>{ e.stopPropagation(); setSelected(prev=>prev===d.id?null:d.id); })
      .on("mouseenter",(e,d)=>{
        const nr = nodeR(d);
        d3.select(e.currentTarget).select(".nd-body").transition().duration(120).attr("r",nr+5).attr("stroke-width",2.5).attr("filter","url(#glow-sel)");
        d3.select(e.currentTarget).select(".nd-ring").transition().duration(120).attr("r",nr+13).attr("stroke-opacity",0.4);
        setHovRef.current?.({ id: d.id, cx: e.clientX, cy: e.clientY });
      })
      .on("mousemove",(e,d)=>{ setHovRef.current?.({ id: d.id, cx: e.clientX, cy: e.clientY }); })
      .on("mouseleave",(e,d)=>{
        const nr = nodeR(d);
        const isSel = d3.select(e.currentTarget).attr("data-sel")==="1";
        d3.select(e.currentTarget).select(".nd-body").transition().duration(120)
          .attr("r",isSel?nr+3:nr).attr("stroke-width",isSel?2.8:1.8)
          .attr("filter",isSel?"url(#glow-sel)":`url(#glow-${d.domain})`);
        d3.select(e.currentTarget).select(".nd-ring").transition().duration(120)
          .attr("r",nr+8).attr("stroke-opacity",isSel?0.35:0.18);
        setHovRef.current?.(null);
      });

    sim.on("tick", ()=>{
      linkSel.attr("d", d=>{
        const sx=d.source.x, sy=d.source.y, tx=d.target.x, ty=d.target.y;
        const dx=tx-sx, dy=ty-sy, dist=Math.sqrt(dx*dx+dy*dy)||1;
        const nr1=nodeR(d.source), nr2=nodeR(d.target);
        const x1=sx+(dx/dist)*(nr1+3), y1=sy+(dy/dist)*(nr1+3);
        const x2=tx-(dx/dist)*(nr2+6), y2=ty-(dy/dist)*(nr2+6);
        const mx=(sx+tx)/2+dy*0.18, my=(sy+ty)/2-dx*0.18;
        return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;
      });
      nodeSel.attr("transform",d=>`translate(${d.x??0},${d.y??0})`);
    });

    svg.call(zoom.transform, d3.zoomIdentity.translate(W*0.02,H*0.04).scale(0.92));
    return ()=>{ sim.stop(); };
  }, []);

  useEffect(()=>{
    const g = gRef.current;
    if (!g) return;
    const pNodes = pattern ? new Set(PATTERNS.find(p=>p.id===pattern)?.nodes||[]) : null;
    g.selectAll(".nd").each(function(d){
      const vis=filtered.has(d.id), hi=!pNodes||pNodes.has(d.id);
      d3.select(this).transition().duration(220).style("opacity", vis?(hi?1:0.1):0.04);
    });
    g.selectAll(".lnk").each(function(d){
      const src=d.source.id||d.source, tgt=d.target.id||d.target;
      const vis=filtered.has(src)&&filtered.has(tgt), hi=!pNodes||(pNodes.has(src)&&pNodes.has(tgt));
      d3.select(this).transition().duration(220)
        .attr("stroke-opacity",vis?(hi?(pNodes?0.75:0.32):0.03):0.02)
        .attr("stroke-width",hi&&pNodes?2.8:1.5);
    });
  }, [pattern, filteredKey]);

  useEffect(()=>{
    const g = gRef.current;
    if (!g) return;
    const counts = {};
    APIS.forEach(a => { counts[a.id] = 0; });
    LINKS.forEach(l => { counts[l.source]=(counts[l.source]||0)+1; counts[l.target]=(counts[l.target]||0)+1; });
    const maxDeg = Math.max(...Object.values(counts));
    const nr = id => R + Math.round((counts[id] / maxDeg) * 5);
    g.selectAll(".nd").each(function(d){
      const isSel=d.id===selected, r=nr(d.id);
      d3.select(this).attr("data-sel",isSel?"1":"0");
      d3.select(this).select(".nd-body").transition().duration(150)
        .attr("r",isSel?r+3:r).attr("stroke-width",isSel?2.8:1.8)
        .attr("filter",isSel?"url(#glow-sel)":`url(#glow-${d.domain})`);
      d3.select(this).select(".nd-ring").transition().duration(150)
        .attr("stroke-opacity",isSel?0.35:0.18).attr("r",isSel?r+12:r+8);
    });
  }, [selected]);

  const toggleDomain  = k => setDomains(prev=>{ const n=new Set(prev); if(n.has(k)){if(n.size>1)n.delete(k);}else n.add(k); return n; });
  const togglePattern = id => setPattern(p=>p===id?null:id);
  const handleZoom    = d => d3.select(svgRef.current).transition().duration(200).call(zoomRef.current.scaleBy,d);
  const handleReset   = () => {
    const el=svgRef.current;
    d3.select(el).transition().duration(400).call(zoomRef.current.transform,d3.zoomIdentity.translate(el.clientWidth*0.02,el.clientHeight*0.04).scale(0.92));
  };

  const selData    = selected ? apiMap[selected] : null;
  const selDetails = selected ? API_DETAILS[selected] : null;
  const outbound   = selected ? LINKS.filter(l=>(l.source.id||l.source)===selected).map(l=>({id:l.target.id||l.target,label:l.label})) : [];
  const inbound    = selected ? LINKS.filter(l=>(l.target.id||l.target)===selected).map(l=>({id:l.source.id||l.source,label:l.label})) : [];
  const activePatternData = pattern ? PATTERNS.find(p=>p.id===pattern) : null;
  const githubUrl  = selected ? `https://github.com/tmforum-apis/${GITHUB_REPOS[selected]}` : null;

  return (
    <div style={{background:"#060b14",color:"#e0e8f0",height:"100vh",display:"flex",flexDirection:"column",overflow:"hidden",position:"relative",fontFamily:"'Syne',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Syne:wght@400;600;700;800&display=swap');
        @keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes fadeUp{from{transform:translateY(6px);opacity:0}to{transform:translateY(0);opacity:1}}
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:rgba(94,155,255,.25);border-radius:2px}
        .grid-bg::before{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(94,155,255,0.035)1px,transparent 1px),linear-gradient(90deg,rgba(94,155,255,0.035)1px,transparent 1px);background-size:46px 46px;pointer-events:none}
        .zbtn:hover{background:rgba(94,155,255,0.14)!important;color:#fff!important}
        .dbadge:hover{opacity:0.85}
        .refrow:hover{background:rgba(255,255,255,0.06)!important;cursor:pointer}
        .pbtn:hover{opacity:0.85}
        .ghlink{color:rgba(224,232,240,0.3);font-size:9.5px;font-family:'JetBrains Mono',monospace;text-decoration:none;display:flex;align-items:center;gap:4px;padding:2px 7px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);transition:all 0.15s}
        .ghlink:hover{color:rgba(224,232,240,0.7);border-color:rgba(255,255,255,0.18);background:rgba(255,255,255,0.04)}
        button{font-family:inherit;outline:none}
        input{font-family:inherit;outline:none}
      `}</style>

      <div className="grid-bg" style={{position:"absolute",inset:0,zIndex:0,pointerEvents:"none"}}/>

      {/* ── Header ── */}
      <div style={{padding:"9px 18px",display:"flex",alignItems:"center",gap:14,borderBottom:"1px solid rgba(94,155,255,0.1)",background:"rgba(6,11,20,0.97)",backdropFilter:"blur(12px)",zIndex:10,position:"relative",flexShrink:0}}>
        <div style={{display:"flex",flexDirection:"column",gap:1,flexShrink:0}}>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:16,letterSpacing:"-0.5px"}}>
            tmf<span style={{color:"#5e9bff"}}>-map</span>
          </div>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8.5,color:"rgba(224,232,240,0.3)",letterSpacing:"1.4px",textTransform:"uppercase"}}>API Relationship Explorer</div>
        </div>
        <div style={{width:1,height:28,background:"rgba(94,155,255,0.1)",flexShrink:0}}/>
        <div style={{position:"relative",flexShrink:0}}>
          <svg style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",opacity:0.3,pointerEvents:"none"}} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(94,155,255,0.16)",borderRadius:7,padding:"6px 10px 6px 28px",color:"#e0e8f0",fontFamily:"'JetBrains Mono',monospace",fontSize:11,width:200}}
            placeholder="Search APIs…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {Object.entries(DOMAINS).map(([k,d])=>(
            <button key={k} className="dbadge" onClick={()=>toggleDomain(k)} style={{padding:"3px 9px",borderRadius:20,fontSize:10.5,fontWeight:600,cursor:"pointer",border:`1px solid ${domains.has(k)?d.color+"45":"rgba(255,255,255,0.07)"}`,background:domains.has(k)?d.color+"16":"rgba(255,255,255,0.02)",color:domains.has(k)?d.color:"rgba(224,232,240,0.22)",fontFamily:"'Syne',sans-serif",transition:"all 0.15s"}}>
              {d.label}
            </button>
          ))}
        </div>
        <div style={{marginLeft:"auto",fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:"rgba(224,232,240,0.28)",borderLeft:"1px solid rgba(94,155,255,0.1)",paddingLeft:10,flexShrink:0}}>
          {filtered.size}/{APIS.length}
        </div>
      </div>

      {/* ── Canvas ── */}
      <div ref={canvasRef} style={{flex:1,position:"relative",overflow:"hidden",zIndex:1}}>
        <svg ref={svgRef} style={{width:"100%",height:"100%",cursor:"grab",display:"block"}} onClick={()=>setSelected(null)}/>

        <NodeTooltip hovered={hovered} apiMap={apiMap} connCounts={connCounts} canvasRef={canvasRef}/>

        {/* Zoom controls */}
        <div style={{position:"absolute",bottom:62,left:14,display:"flex",flexDirection:"column",gap:4,zIndex:20}}>
          {[{l:"+",a:()=>handleZoom(1.35)},{l:"−",a:()=>handleZoom(1/1.35)},{l:"⊙",a:handleReset}].map(b=>(
            <button key={b.l} className="zbtn" onClick={b.a} style={{width:30,height:30,background:"rgba(6,11,20,0.92)",border:"1px solid rgba(94,155,255,0.18)",borderRadius:6,color:"rgba(224,232,240,0.55)",cursor:"pointer",fontSize:b.l==="⊙"?13:17,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"monospace",transition:"all 0.15s"}}>
              {b.l}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div style={{position:"absolute",bottom:62,right:selected?348:14,background:"rgba(6,11,20,0.9)",border:"1px solid rgba(94,155,255,0.1)",borderRadius:8,padding:"10px 13px",zIndex:20,backdropFilter:"blur(12px)",transition:"right 0.2s"}}>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8.5,letterSpacing:"1.5px",textTransform:"uppercase",color:"rgba(224,232,240,0.28)",marginBottom:8}}>Domains</div>
          {Object.entries(DOMAINS).map(([k,d])=>(
            <div key={k} style={{display:"flex",alignItems:"center",gap:7,marginBottom:5,fontSize:11,color:domains.has(k)?d.color:"rgba(224,232,240,0.3)"}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:d.color,flexShrink:0,opacity:domains.has(k)?1:0.3}}/>{d.label}
            </div>
          ))}
          <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid rgba(94,155,255,0.08)",fontSize:9,color:"rgba(224,232,240,0.2)",fontFamily:"'JetBrains Mono',monospace"}}>
            node size ∝ connections
          </div>
          {activePatternData && (
            <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid rgba(94,155,255,0.08)"}}>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8.5,letterSpacing:"1.5px",textTransform:"uppercase",color:"rgba(224,232,240,0.28)",marginBottom:5}}>Active Pattern</div>
              <div style={{fontSize:11,color:activePatternData.color,fontWeight:600}}>{activePatternData.name}</div>
              <div style={{fontSize:10,color:"rgba(224,232,240,0.4)",marginTop:2,lineHeight:1.5,maxWidth:130}}>{activePatternData.desc}</div>
            </div>
          )}
        </div>

        {/* ── Detail Panel ── */}
        {selected && selData && (
          <div style={{position:"absolute",top:0,right:0,width:334,height:"100%",background:"rgba(6,11,20,0.96)",backdropFilter:"blur(24px)",borderLeft:"1px solid rgba(94,155,255,0.1)",overflowY:"auto",zIndex:30,padding:"18px 18px 28px",animation:"slideIn 0.18s ease"}} onClick={e=>e.stopPropagation()}>
            <button onClick={()=>setSelected(null)} style={{position:"absolute",top:14,right:14,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,color:"rgba(224,232,240,0.45)",width:26,height:26,cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>×</button>

            <div style={{animation:"fadeUp 0.2s ease"}}>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:21,fontWeight:700,color:DOMAINS[selData.domain].color,marginBottom:2}}>{selected}</div>
              <div style={{fontSize:12,color:"rgba(224,232,240,0.42)",marginBottom:8}}>{selData.name}</div>

              <div style={{display:"flex",gap:6,marginBottom:10,alignItems:"center",flexWrap:"wrap"}}>
                <div style={{padding:"2px 8px",borderRadius:4,background:`${DOMAINS[selData.domain].color}14`,border:`1px solid ${DOMAINS[selData.domain].color}35`,color:DOMAINS[selData.domain].color,fontSize:9.5,fontFamily:"'JetBrains Mono',monospace"}}>
                  {DOMAINS[selData.domain].label}
                </div>
                {selDetails?.specRef && (
                  <div style={{padding:"2px 8px",borderRadius:4,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.09)",color:"rgba(224,232,240,0.32)",fontSize:9.5,fontFamily:"'JetBrains Mono',monospace"}}>
                    {selDetails.specRef}
                  </div>
                )}
                {githubUrl && (
                  <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="ghlink">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{flexShrink:0}}>
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.085 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.605-2.665-.305-5.467-1.334-5.467-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23A11.5 11.5 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.29-1.552 3.297-1.23 3.297-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.807 5.625-5.479 5.92.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                    spec
                  </a>
                )}
              </div>

              {connCounts[selected] && (
                <div style={{display:"flex",gap:8,marginBottom:12,paddingBottom:12,borderBottom:"1px solid rgba(94,155,255,0.08)"}}>
                  <div style={{flex:1,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:6,padding:"7px 10px",textAlign:"center"}}>
                    <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:17,fontWeight:700,color:DOMAINS[selData.domain].color}}>{connCounts[selected].out}</div>
                    <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:"rgba(224,232,240,0.3)",marginTop:2}}>outbound refs</div>
                  </div>
                  <div style={{flex:1,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:6,padding:"7px 10px",textAlign:"center"}}>
                    <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:17,fontWeight:700,color:DOMAINS[selData.domain].color}}>{connCounts[selected].in}</div>
                    <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:"rgba(224,232,240,0.3)",marginTop:2}}>referenced by</div>
                  </div>
                  <div style={{flex:1,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:6,padding:"7px 10px",textAlign:"center"}}>
                    <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:17,fontWeight:700,color:DOMAINS[selData.domain].color}}>{connCounts[selected].out + connCounts[selected].in}</div>
                    <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:"rgba(224,232,240,0.3)",marginTop:2}}>total degree</div>
                  </div>
                </div>
              )}

              {selDetails?.description && (
                <div style={{fontSize:11.5,lineHeight:1.75,color:"rgba(224,232,240,0.62)",marginBottom:16,paddingBottom:14,borderBottom:"1px solid rgba(94,155,255,0.07)"}}>
                  {selDetails.description}
                </div>
              )}

              {selDetails?.entities?.length > 0 && (
                <div style={{marginBottom:16}}>
                  <SectionTitle>Data Model</SectionTitle>
                  {selDetails.entities.map(e=>(
                    <div key={e.name} style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(94,155,255,0.1)",borderRadius:7,padding:"10px 11px",marginBottom:7}}>
                      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11.5,fontWeight:600,color:DOMAINS[selData.domain].color,marginBottom:7}}>{e.name}</div>
                      {e.mandatory.map(f=>(
                        <div key={f} style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                          <div style={{width:4,height:4,borderRadius:"50%",background:"#ff6b6b",flexShrink:0}}/>
                          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10.5,color:"rgba(224,232,240,0.85)"}}>{f}</span>
                          <span style={{marginLeft:"auto",fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:"rgba(255,107,107,0.5)"}}>required</span>
                        </div>
                      ))}
                      {e.optional.map(f=>(
                        <div key={f} style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                          <div style={{width:4,height:4,borderRadius:"50%",background:"rgba(224,232,240,0.18)",flexShrink:0}}/>
                          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10.5,color:"rgba(224,232,240,0.38)"}}>{f}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {selDetails?.lifecycle?.length > 0 && (
                <div style={{marginBottom:16}}>
                  <SectionTitle>Lifecycle State Machine</SectionTitle>
                  <LifecycleDiagram
                    lifecycle={selDetails.lifecycle}
                    transitions={selDetails.transitions}
                    terminal={selDetails.terminal}
                    domainColor={DOMAINS[selData.domain].color}
                  />
                  <div style={{display:"flex",gap:12,marginTop:5,fontSize:9.5,color:"rgba(224,232,240,0.28)",fontFamily:"'JetBrains Mono',monospace"}}>
                    <span style={{display:"flex",alignItems:"center",gap:4}}>
                      <span style={{display:"inline-block",width:10,height:10,border:`1px solid ${DOMAINS[selData.domain].color}90`,borderRadius:2,background:`${DOMAINS[selData.domain].color}12`}}/>active
                    </span>
                    <span style={{display:"flex",alignItems:"center",gap:4}}>
                      <span style={{display:"inline-block",width:10,height:10,border:"1px solid rgba(255,107,107,0.55)",borderRadius:2,background:"rgba(255,107,107,0.07)"}}/>terminal
                    </span>
                    <span style={{display:"flex",alignItems:"center",gap:4}}>
                      <span style={{display:"inline-block",width:14,height:1,borderTop:"1px dashed rgba(180,195,215,0.4)"}}/>back-edge
                    </span>
                  </div>
                </div>
              )}

              {outbound.length > 0 && (
                <div style={{marginBottom:12}}>
                  <SectionTitle>References →</SectionTitle>
                  {outbound.map((r,i)=>(
                    <div key={i} className="refrow" onClick={()=>setSelected(r.id)}
                      style={{display:"flex",alignItems:"center",gap:7,padding:"6px 8px",borderRadius:6,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.045)",marginBottom:4,transition:"background 0.12s"}}>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10.5,fontWeight:700,color:DOMAINS[apiMap[r.id]?.domain]?.color||"#5e9bff",flexShrink:0}}>{r.id}</span>
                      <span style={{fontSize:10.5,color:"rgba(224,232,240,0.38)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{apiMap[r.id]?.name}</span>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:"rgba(224,232,240,0.2)",marginLeft:"auto",flexShrink:0}}>{r.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {inbound.length > 0 && (
                <div>
                  <SectionTitle>Referenced by ←</SectionTitle>
                  {inbound.map((r,i)=>(
                    <div key={i} className="refrow" onClick={()=>setSelected(r.id)}
                      style={{display:"flex",alignItems:"center",gap:7,padding:"6px 8px",borderRadius:6,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.045)",marginBottom:4,transition:"background 0.12s"}}>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10.5,fontWeight:700,color:DOMAINS[apiMap[r.id]?.domain]?.color||"#5e9bff",flexShrink:0}}>{r.id}</span>
                      <span style={{fontSize:10.5,color:"rgba(224,232,240,0.38)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{apiMap[r.id]?.name}</span>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:"rgba(224,232,240,0.2)",marginLeft:"auto",flexShrink:0}}>{r.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Pattern Bar ── */}
      <div style={{padding:"7px 18px",display:"flex",gap:8,alignItems:"center",borderTop:"1px solid rgba(94,155,255,0.08)",background:"rgba(6,11,20,0.97)",zIndex:10,position:"relative",flexShrink:0}}>
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8.5,letterSpacing:"1.2px",textTransform:"uppercase",color:"rgba(224,232,240,0.22)",flexShrink:0}}>Patterns</span>
        {PATTERNS.map(p=>(
          <button key={p.id} className="pbtn" onClick={()=>togglePattern(p.id)} title={p.desc}
            style={{padding:"4px 11px",borderRadius:6,fontSize:10.5,fontWeight:600,cursor:"pointer",border:`1px solid ${pattern===p.id?p.color+"50":"rgba(255,255,255,0.07)"}`,background:pattern===p.id?p.color+"16":"rgba(255,255,255,0.025)",color:pattern===p.id?p.color:"rgba(224,232,240,0.38)",fontFamily:"'Syne',sans-serif",transition:"all 0.15s"}}>
            {p.name}
          </button>
        ))}
        <span style={{marginLeft:"auto",fontFamily:"'JetBrains Mono',monospace",fontSize:8.5,color:"rgba(224,232,240,0.14)"}}>
          tmf-devkit · Apache 2.0 · {APIS.length} APIs · {LINKS.length} relationships
        </span>
      </div>
    </div>
  );
}
