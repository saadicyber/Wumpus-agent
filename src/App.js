import React, { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
// KNOWLEDGE BASE — CNF + Resolution (hard cap prevents freeze)
// ═══════════════════════════════════════════════════════════════

function negLit(l) { return l.startsWith("-") ? l.slice(1) : "-" + l; }

function resolve(c1, c2) {
  const results = [];
  for (const lit of c1) {
    const comp = negLit(lit);
    if (c2.includes(comp)) {
      const r = [...new Set([...c1.filter(l => l !== lit), ...c2.filter(l => l !== comp)])];
      if (!r.some(l => r.includes(negLit(l)))) results.push(r);
    }
  }
  return results;
}

class KB {
  constructor() { this.clauses = []; this.keys = new Set(); this.totalSteps = 0; }

  tell(clauses) {
    for (const c of clauses) {
      const k = [...c].sort().join("|");
      if (!this.keys.has(k)) { this.keys.add(k); this.clauses.push(c); }
    }
  }

  ask(queryLit) {
    const negQ = negLit(queryLit);
    const working = this.clauses.map(c => [...c]);
    working.push([negQ]);
    const seen = new Set(working.map(c => [...c].sort().join("|")));
    let steps = 0;
    const MAX = 2000; // hard cap — stops page freeze
    let changed = true;
    while (changed && steps < MAX) {
      changed = false;
      const n = working.length;
      for (let i = 0; i < n && steps < MAX; i++) {
        for (let j = i + 1; j < n && steps < MAX; j++) {
          steps++; this.totalSteps++;
          for (const r of resolve(working[i], working[j])) {
            if (r.length === 0) return true;
            const k = [...r].sort().join("|");
            if (!seen.has(k)) { seen.add(k); working.push(r); changed = true; }
          }
        }
      }
    }
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// WORLD
// ═══════════════════════════════════════════════════════════════

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function adjCells(r, c, R, C) {
  return [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].filter(([x,y]) => x>=0&&x<R&&y>=0&&y<C);
}

function buildWorld(R, C, nPits) {
  const grid = Array.from({length:R}, () =>
    Array.from({length:C}, () => ({pit:false, wumpus:false, gold:false}))
  );
  const pool = shuffle(
    Array.from({length:R*C}, (_,i) => [Math.floor(i/C), i%C])
      .filter(([r,c]) => !(r===0 && c===0))
  );
  let idx = 0;
  for (let i = 0; i < Math.min(nPits, pool.length-2); i++) {
    const [r,c] = pool[idx++]; grid[r][c].pit = true;
  }
  const [wr,wc] = pool[idx++]; grid[wr][wc].wumpus = true;
  for (let i = idx; i < pool.length; i++) {
    const [r,c] = pool[i];
    if (!grid[r][c].pit && !grid[r][c].wumpus) { grid[r][c].gold = true; break; }
  }
  return grid;
}

function getPercepts(world, r, c, R, C) {
  let breeze=false, stench=false, glitter=world[r][c].gold;
  for (const [ar,ac] of adjCells(r,c,R,C)) {
    if (world[ar][ac].pit) breeze = true;
    if (world[ar][ac].wumpus) stench = true;
  }
  return {breeze, stench, glitter};
}

// ═══════════════════════════════════════════════════════════════
// AGENT — ONE CELL MOVE PER SNAPSHOT (no skipping)
// ═══════════════════════════════════════════════════════════════

function runAgent(R, C, world) {
  const kb = new KB();
  const visited = new Set();
  const safeSet = new Set();
  const unsafeSet = new Set();
  const snapshots = [];

  const cid = (r,c) => `${r}_${c}`;
  const PV  = (r,c) => `P_${r}_${c}`;
  const WV  = (r,c) => `W_${r}_${c}`;

  function takeSnapshot(r, c, note, action) {
    const cells = [];
    for (let row=0; row<R; row++) {
      for (let col=0; col<C; col++) {
        const id = cid(row,col);
        const isV = visited.has(id);
        const isA = row===r && col===c;
        const reveal = isV || isA;
        cells.push({
          row, col, isAgent:isA, isVisited:isV,
          isSafe: safeSet.has(id),
          isUnsafe: unsafeSet.has(id),
          pit:    reveal && world[row][col].pit,
          wumpus: reveal && world[row][col].wumpus,
          gold:   reveal && world[row][col].gold,
        });
      }
    }
    snapshots.push({
      cells, r, c, note, action,
      percepts: getPercepts(world, r, c, R, C),
      inferenceSteps: kb.totalSteps,
      visitedCount: visited.size,
      safeCount: safeSet.size,
    });
  }

  function inferNeighbors(r, c) {
    for (const [ar,ac] of adjCells(r,c,R,C)) {
      const id = cid(ar,ac);
      if (visited.has(id) || unsafeSet.has(id)) continue;
      const safe = kb.ask("-"+PV(ar,ac)) && kb.ask("-"+WV(ar,ac));
      if (safe) { safeSet.add(id); unsafeSet.delete(id); }
      else if (kb.ask(PV(ar,ac)) || kb.ask(WV(ar,ac))) unsafeSet.add(id);
    }
  }

  function visitCell(r, c) {
    const id = cid(r,c);
    visited.add(id); safeSet.delete(id);
    const p = getPercepts(world, r, c, R, C);

    if (!p.breeze) {
      // No breeze → safe adjacent
      for (const [ar,ac] of adjCells(r,c,R,C)) {
        kb.tell([["-"+PV(ar,ac)]]);
        if (!visited.has(cid(ar,ac)) && !unsafeSet.has(cid(ar,ac)))
          safeSet.add(cid(ar,ac));
      }
    } else {
      const ns = adjCells(r,c,R,C).map(([ar,ac]) => PV(ar,ac));
      const B = `B_${r}_${c}`;
      kb.tell([[B], ["-"+B, ...ns], ...ns.map(n=>[B,"-"+n])]);
    }

    if (!p.stench) {
      for (const [ar,ac] of adjCells(r,c,R,C)) kb.tell([["-"+WV(ar,ac)]]);
    } else {
      const ns = adjCells(r,c,R,C).map(([ar,ac]) => WV(ar,ac));
      const Sv = `S_${r}_${c}`;
      kb.tell([[Sv], ["-"+Sv, ...ns], ...ns.map(n=>[Sv,"-"+n])]);
    }

    inferNeighbors(r, c);
  }

  // BFS — each dequeue = one snapshot (one cell move)
  safeSet.add(cid(0,0));
  const queue = [[0,0]];
  const enqueued = new Set([cid(0,0)]);
  let guard = R * C * 3;

  while (queue.length > 0 && guard-- > 0) {
    const [r, c] = queue.shift();

    visitCell(r, c);

    // Death check
    if (world[r][c].pit || world[r][c].wumpus) {
      takeSnapshot(r, c, `Walked into ${world[r][c].pit?"a Pit 🕳️":"the Wumpus 👾"}! Agent dead.`, "DIED");
      return snapshots;
    }

    // Gold check
    if (world[r][c].gold) {
      takeSnapshot(r, c, "Gold found! Mission complete. 🏆", "WIN");
      return snapshots;
    }

    // Normal move snapshot
    const p = getPercepts(world, r, c, R, C);
    const perceptStr = [p.breeze?"BREEZE":"", p.stench?"STENCH":"", p.glitter?"GLITTER":""].filter(Boolean).join(" | ") || "none";
    takeSnapshot(r, c, `Moved to (${r},${c}) — percepts: ${perceptStr}`, "MOVE");

    // Add newly-safe neighbors to queue
    for (const [ar,ac] of adjCells(r,c,R,C)) {
      const id = cid(ar,ac);
      if (!visited.has(id) && !enqueued.has(id) && safeSet.has(id)) {
        queue.push([ar,ac]); enqueued.add(id);
      }
    }
  }

  takeSnapshot(0, 0, "No provably safe moves remain. Agent halted. ⚠️", "STUCK");
  return snapshots;
}

// ═══════════════════════════════════════════════════════════════
// UI
// ═══════════════════════════════════════════════════════════════

export default function App() {
  const [rows, setRows]     = useState(5);
  const [cols, setCols]     = useState(5);
  const [pits, setPits]     = useState(3);
  const [snaps, setSnaps]   = useState([]);
  const [idx, setIdx]       = useState(0);
  const [auto, setAuto]     = useState(false);
  const [speed, setSpeed]   = useState(600);
  const logRef  = useRef(null);
  const timerRef = useRef(null);

  const newEpisode = useCallback(() => {
    setAuto(false);
    const world = buildWorld(rows, cols, pits);
    setSnaps(runAgent(rows, cols, world));
    setIdx(0);
  }, [rows, cols, pits]);

  // Auto-play
  useEffect(() => {
    clearInterval(timerRef.current);
    if (auto && snaps.length > 0) {
      timerRef.current = setInterval(() => {
        setIdx(i => {
          if (i >= snaps.length - 1) { setAuto(false); return i; }
          return i + 1;
        });
      }, speed);
    }
    return () => clearInterval(timerRef.current);
  }, [auto, snaps, speed]);

  // Arrow keys: LEFT/RIGHT only
  useEffect(() => {
    const h = e => {
      if (!snaps.length) return;
      if (e.key === "ArrowLeft")  { e.preventDefault(); setIdx(i => Math.max(0, i-1)); }
      if (e.key === "ArrowRight") { e.preventDefault(); setIdx(i => Math.min(snaps.length-1, i+1)); }
      if (e.key === " ")          { e.preventDefault(); setAuto(a => !a); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [snaps]);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [idx]);

  const snap = snaps[idx] || null;
  const CELL = Math.max(44, Math.min(66, Math.floor(460 / Math.max(rows, cols))));

  const outcomeAction = snaps[snaps.length-1]?.action;

  const panelStyle = {
    background:"#0d1520", border:"1px solid #1a2d44",
    borderRadius:10, padding:16
  };

  return (
    <div style={{
      minHeight:"100vh", background:"#080d14", display:"flex",
      flexDirection:"column", alignItems:"center", padding:"20px 16px",
      fontFamily:"'Courier New', monospace", color:"#c8dce8"
    }}>
      {/* Title */}
      <div style={{
        fontSize:"clamp(1.1rem,3vw,1.9rem)", fontWeight:"bold", letterSpacing:"0.1em",
        background:"linear-gradient(135deg,#00e5ff,#0077ff)",
        WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
        textTransform:"uppercase", marginBottom:4, textAlign:"center"
      }}>⚡ Wumpus Logic Agent</div>
      <div style={{color:"#334455", fontSize:"0.68rem", letterSpacing:"0.18em", marginBottom:20}}>
        PROPOSITIONAL KB · RESOLUTION REFUTATION · CNF ENGINE
      </div>

      <div style={{display:"flex", gap:16, flexWrap:"wrap", justifyContent:"center", width:"100%", maxWidth:1100}}>

        {/* ── LEFT: Config ── */}
        <div style={{...panelStyle, width:240}}>
          <div style={{fontSize:"0.62rem", letterSpacing:"0.2em", color:"#00aacc", textTransform:"uppercase", borderBottom:"1px solid #1a2d44", paddingBottom:8, marginBottom:12}}>▸ Configuration</div>

          {[["ROWS",rows,setRows,3,7],["COLS",cols,setCols,3,7],["PITS",pits,setPits,1,Math.max(1,rows*cols-4)]].map(([lbl,val,set,mn,mx])=>(
            <div key={lbl} style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:"0.68rem",color:"#446688",letterSpacing:"0.08em"}}>{lbl}</span>
                <span style={{color:"#00ccff",fontWeight:"bold"}}>{val}</span>
              </div>
              <input type="range" min={mn} max={mx} value={val}
                onChange={e=>set(+e.target.value)}
                style={{width:"100%",accentColor:"#00aacc"}}/>
            </div>
          ))}

          <button onClick={newEpisode} style={{
            width:"100%", padding:"9px", background:"#0a1e33", border:"1px solid #00aacc",
            borderRadius:6, color:"#00ccff", fontFamily:"'Courier New',monospace",
            fontSize:"0.78rem", letterSpacing:"0.12em", cursor:"pointer",
            textTransform:"uppercase", marginBottom:8
          }}>▶ New Episode</button>

          {snaps.length > 0 && <>
            <div style={{display:"flex", gap:5, marginBottom:6}}>
              {[["⏮",()=>setIdx(0),idx===0],
                ["← Prev",()=>setIdx(i=>Math.max(0,i-1)),idx===0],
                ["Next →",()=>setIdx(i=>Math.min(snaps.length-1,i+1)),idx>=snaps.length-1],
                ["⏭",()=>setIdx(snaps.length-1),idx>=snaps.length-1]
              ].map(([label,fn,dis])=>(
                <button key={label} onClick={fn} disabled={dis} style={{
                  flex:1, padding:"6px 2px", background:"#0a1520",
                  border:"1px solid #1a2d44", borderRadius:5, color: dis?"#223":"#88aabb",
                  fontFamily:"'Courier New',monospace", fontSize:"0.65rem", cursor: dis?"default":"pointer"
                }}>{label}</button>
              ))}
            </div>

            <div style={{display:"flex", gap:6, alignItems:"center", marginBottom:6}}>
              <span style={{fontSize:"0.62rem",color:"#446688"}}>SPEED</span>
              <select value={speed} onChange={e=>setSpeed(+e.target.value)} style={{
                flex:1, background:"#0a1520", border:"1px solid #1a2d44", borderRadius:4,
                color:"#88aabb", fontFamily:"'Courier New',monospace", fontSize:"0.68rem", padding:"3px 6px"
              }}>
                <option value={1200}>Slow</option>
                <option value={600}>Normal</option>
                <option value={250}>Fast</option>
              </select>
              <button onClick={()=>setAuto(a=>!a)} style={{
                padding:"5px 10px", background:"#0a1520", border:"1px solid #1a2d44",
                borderRadius:5, color:"#88aabb", fontFamily:"'Courier New',monospace",
                fontSize:"0.75rem", cursor:"pointer"
              }}>{auto?"⏸":"▶"}</button>
            </div>

            <div style={{textAlign:"center",fontSize:"0.62rem",color:"#334455",marginBottom:6}}>
              ← → arrow keys &nbsp;·&nbsp; Space = play/pause
            </div>
            <div style={{textAlign:"center",fontSize:"0.72rem",color:"#00aacc",fontWeight:"bold"}}>
              Step {idx+1} / {snaps.length}
            </div>
          </>}

          {/* Legend */}
          <div style={{marginTop:14,display:"flex",flexWrap:"wrap",gap:8}}>
            {[["#0d2030","1px solid #1a4060","Visited"],
              ["#0a2318","1px solid #0d5030","Safe"],
              ["#2a0a0a","1px solid #6a1010","Hazard"],
              ["#0a1018","1px solid #111d2a","Unknown"]
            ].map(([bg,border,lbl])=>(
              <div key={lbl} style={{display:"flex",alignItems:"center",gap:5,fontSize:"0.62rem",color:"#446688"}}>
                <div style={{width:11,height:11,borderRadius:3,background:bg,border}}/>
                {lbl}
              </div>
            ))}
          </div>
        </div>

        {/* ── CENTER: Grid ── */}
        <div style={{...panelStyle, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center"}}>
          {snap ? <>
            <div style={{display:"grid", gridTemplateColumns:`repeat(${cols}, ${CELL}px)`, gap:3}}>
              {snap.cells.map((cell,i)=>{
                const icons=[];
                if (cell.isAgent)  icons.push("🤖");
                if (cell.pit)      icons.push("🕳️");
                if (cell.wumpus)   icons.push("👾");
                if (cell.gold)     icons.push("🏆");
                if (!cell.isVisited && !cell.isAgent && cell.isSafe)   icons.push("✓");
                if (!cell.isVisited && !cell.isAgent && cell.isUnsafe) icons.push("✗");

                const bg = cell.isAgent ? "#0d2a3a"
                         : cell.isVisited ? "#0d2030"
                         : cell.isSafe ? "#0a2318"
                         : cell.isUnsafe ? "#2a0a0a"
                         : "#0a1018";
                const bd = cell.isAgent ? "2px solid #00e5ff"
                         : cell.isVisited ? "1px solid #1a4060"
                         : cell.isSafe ? "1px solid #0d5030"
                         : cell.isUnsafe ? "1px solid #6a1010"
                         : "1px solid #111d2a";

                return (
                  <div key={i} style={{
                    width:CELL, height:CELL, borderRadius:5,
                    background:bg, border:bd,
                    boxShadow: cell.isAgent?"0 0 14px rgba(0,229,255,0.5)":"none",
                    display:"flex", flexDirection:"column",
                    alignItems:"center", justifyContent:"center",
                    position:"relative", transition:"background 0.2s, border 0.2s",
                    fontSize: CELL>52?"1.1rem":"0.85rem"
                  }}>
                    <span style={{position:"absolute",top:2,left:3,fontSize:"0.43rem",color:"rgba(100,160,200,0.35)"}}>
                      {cell.row},{cell.col}
                    </span>
                    <span>{icons.join("")}</span>
                    {CELL>48 && (
                      <span style={{fontSize:"0.4rem",color:"rgba(100,160,200,0.4)",marginTop:1}}>
                        {cell.isVisited?"VISITED":cell.isSafe&&!cell.isAgent?"SAFE":cell.isUnsafe?"HAZARD":""}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {idx===snaps.length-1 && (
              <div style={{
                marginTop:12, padding:"8px 20px", borderRadius:8,
                textAlign:"center", fontWeight:"bold", letterSpacing:"0.1em",
                fontSize:"0.85rem", textTransform:"uppercase",
                ...(outcomeAction==="WIN"
                  ? {background:"rgba(0,180,80,0.15)",border:"1px solid #00cc55",color:"#00ee66"}
                  : outcomeAction==="DIED"
                  ? {background:"rgba(220,30,30,0.12)",border:"1px solid #cc2222",color:"#ff4444"}
                  : {background:"rgba(200,170,0,0.1)",border:"1px solid #ccaa00",color:"#ffdd44"})
              }}>
                {outcomeAction==="WIN" ? "🏆 Gold Retrieved — Victory!"
                : outcomeAction==="DIED" ? "💀 Agent Eliminated"
                : "⚠️ No Safe Moves — Halted"}
              </div>
            )}
          </> : (
            <div style={{padding:"50px 70px", textAlign:"center", color:"#334455", fontSize:"0.8rem", letterSpacing:"0.12em"}}>
              🗺️<br/><br/>CONFIGURE &amp; PRESS<br/>NEW EPISODE
            </div>
          )}
        </div>

        {/* ── RIGHT: Metrics ── */}
        <div style={{...panelStyle, width:210}}>
          <div style={{fontSize:"0.62rem",letterSpacing:"0.2em",color:"#00aacc",textTransform:"uppercase",borderBottom:"1px solid #1a2d44",paddingBottom:8,marginBottom:12}}>▸ Metrics</div>

          {snap ? <>
            {[
              ["Inference Steps", snap.inferenceSteps],
              ["Cells Visited",   snap.visitedCount],
              ["Safe Known",      snap.safeCount],
              ["Agent At",        `(${snap.r}, ${snap.c})`],
              ["Action",          snap.action],
            ].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #111d2a",fontSize:"0.73rem"}}>
                <span style={{color:"#446688",fontSize:"0.67rem"}}>{k}</span>
                <span style={{color:"#00ccff",fontWeight:"bold",fontSize:"0.7rem"}}>{v}</span>
              </div>
            ))}

            <div style={{marginTop:10}}>
              <div style={{fontSize:"0.65rem",color:"#446688",marginBottom:6}}>Active Percepts</div>
              {snap.percepts.breeze  && <span style={{display:"inline-block",padding:"2px 8px",borderRadius:20,fontSize:"0.6rem",margin:2,background:"rgba(0,80,200,0.3)",border:"1px solid #0055cc",color:"#66aaff"}}>BREEZE</span>}
              {snap.percepts.stench  && <span style={{display:"inline-block",padding:"2px 8px",borderRadius:20,fontSize:"0.6rem",margin:2,background:"rgba(180,80,0,0.3)",border:"1px solid #bb5500",color:"#ffaa55"}}>STENCH</span>}
              {snap.percepts.glitter && <span style={{display:"inline-block",padding:"2px 8px",borderRadius:20,fontSize:"0.6rem",margin:2,background:"rgba(200,170,0,0.3)",border:"1px solid #ccaa00",color:"#ffee55"}}>GLITTER</span>}
              {!snap.percepts.breeze && !snap.percepts.stench && !snap.percepts.glitter && (
                <span style={{display:"inline-block",padding:"2px 8px",borderRadius:20,fontSize:"0.6rem",margin:2,background:"#111",border:"1px solid #222",color:"#444"}}>NONE</span>
              )}
            </div>

            <div style={{fontSize:"0.62rem",letterSpacing:"0.2em",color:"#00aacc",textTransform:"uppercase",borderBottom:"1px solid #1a2d44",paddingBottom:6,marginTop:14,marginBottom:8}}>▸ Agent Log</div>
            <div ref={logRef} style={{
              fontFamily:"'Courier New',monospace", fontSize:"0.63rem", color:"#446688",
              lineHeight:1.8, maxHeight:140, overflowY:"auto", padding:8,
              background:"rgba(0,0,0,0.25)", borderRadius:4, border:"1px solid #111d2a"
            }}>
              {snaps.slice(0,idx+1).map((s,i)=>(
                <div key={i} style={{color: s.action==="WIN"?"#00ee66":s.action==="DIED"?"#ff4444":"#446688"}}>
                  [{i+1}] {s.note}
                </div>
              ))}
            </div>
          </> : (
            <div style={{color:"#334455",fontSize:"0.7rem",textAlign:"center",padding:"20px 0"}}>No active episode</div>
          )}
        </div>

      </div>
    </div>
  );
}