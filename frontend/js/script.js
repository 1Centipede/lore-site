/* eslint-env browser */
"use strict";

/* =========================================================
 * 1) CONSTANTS & STATE
 * =======================================================*/
const allTraits = {
  horns: "images/trait_horns.png",
  tail:  "images/trait_tail.png",
  ears:  "images/trait_ears.png",
  wings: "images/trait_wings.png",
  mane:  "images/trait_mane.png",
};
const baseImage = "images/base.png";

let grandparents = [
  { id: "gp1", traits: null, hasMutation: false, manual: false },
  { id: "gp2", traits: null, hasMutation: false, manual: false },
  { id: "gp3", traits: null, hasMutation: false, manual: false },
  { id: "gp4", traits: null, hasMutation: false, manual: false },
];
let parents = [
  { id: "p1", traits: null, hasMutation: false, manual: false },
  { id: "p2", traits: null, hasMutation: false, manual: false },
];

/* =========================================================
 * 2) DOM REFERENCES
 * =======================================================*/
const stage       = document.getElementById("stage");
const zoomContent = document.getElementById("zoomContent");
const grid        = document.getElementById("treeGrid");
const svg         = document.getElementById("treeLines");

/* =========================================================
 * 3) UTILITIES
 * =======================================================*/
function ensureTraitArray(char){ if (!Array.isArray(char.traits)) char.traits = []; }
function clamp(v,min,max){ return Math.min(max, Math.max(min, v)); }
function distance(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return Math.hypot(dx,dy); }
function midpoint(a,b){ return { x:(a.x+b.x)/2, y:(a.y+b.y)/2 }; }
function drawImage(ctx, src, w, h){
  return new Promise((res)=>{ const img=new Image(); img.onload=()=>{ ctx.drawImage(img,0,0,w,h); res(); }; img.src=src; });
}
function createScheduler(fn){ let raf=null; return function(){ if(raf) cancelAnimationFrame(raf); raf=requestAnimationFrame(()=>{ fn(); raf=null; }); }; }
let scheduleDraw = () => {};
function sample(arr){ return arr[Math.floor(Math.random()*arr.length)] || null; }
function intersect(a,b){
  const A = new Set(Array.isArray(a)?a:[]);
  const B = new Set(Array.isArray(b)?b:[]);
  const out = [];
  A.forEach(x=>{ if (B.has(x)) out.push(x); });
  return out;
}
function toSet(arr){ return new Set(Array.isArray(arr)?arr:[]); }
function equalSets(aArr,bArr){
  const a=toSet(aArr), b=toSet(bArr);
  if (a.size!==b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/* =========================================================
 * 4) RENDERING
 * =======================================================*/
async function renderCharacter(canvasId, char, blank=false){
  const el = document.querySelector(`#${canvasId} canvas`);
  if (!el) return;
  const ctx = el.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0,0,el.width,el.height);

  const actuallyBlank = blank || char.traits === null;
  if (!actuallyBlank){
    const order = ["tail","base","wings","ears","horns","mane"];
    for (const t of order){
      if (t==="base") await drawImage(ctx, baseImage, el.width, el.height);
      else if (Array.isArray(char.traits) && char.traits.includes(t) && allTraits[t]) {
        await drawImage(ctx, allTraits[t], el.width, el.height);
      }
    }
    if (char.hasMutation){
      ctx.fillStyle = "rgba(255,100,255,0.3)"; // why: visual hint
      ctx.fillRect(0,0,el.width,el.height);
    }
  }

  const info = document.querySelector(`#${canvasId} .traitText`);
  if (info){
    info.textContent = actuallyBlank
      ? "—"
      : `Traits: ${Array.isArray(char.traits) ? char.traits.join(", ") : "None"} ${char.hasMutation ? "(mutation!)" : ""}`;
  }
}

/* =========================================================
 * 5) TRAIT UI
 * =======================================================*/
function updateTraitButtons(charId, traits=[]){
  const container = document.querySelector(`#${charId} .dropdownTraits`);
  if (!container) return;
  container.querySelectorAll(".traitBtn").forEach(btn=>{
    const isNone   = btn.textContent==="None" && (!traits || traits.length===0);
    const isActive = isNone || traits.includes(btn.textContent);
    btn.classList.toggle("activeTrait", isActive);
  });
}
function setupTraitDropdown(char){
  const container = document.querySelector(`#${char.id} .traitSelect`);
  if (!container) return;

  const traitKeys = Object.keys(allTraits);
  container.innerHTML = "";

  const label = document.createElement("label");
  label.textContent = "Select Traits:";

  const dropdown = document.createElement("div");
  dropdown.classList.add("dropdownTraits");

  const noneBtn = document.createElement("button");
  noneBtn.textContent = "None";
  noneBtn.classList.add("traitBtn");
  noneBtn.addEventListener("click", ()=>{
    char.traits = [];
    char.hasMutation = false;
    char.manual = true;
    if (char.id==="p1") parents[0]=char;
    if (char.id==="p2") parents[1]=char;
    flushDependents(char.id);
    renderCharacter(char.id, char, false);
    updateTraitButtons(char.id, char.traits);
    scheduleDraw();
  });
  dropdown.appendChild(noneBtn);

  traitKeys.forEach(trait=>{
    const btn = document.createElement("button");
    btn.textContent = trait;
    btn.classList.add("traitBtn");
    btn.addEventListener("click", ()=>{
      ensureTraitArray(char);
      if (char.traits.includes(trait)) char.traits = char.traits.filter(t=>t!==trait);
      else char.traits.push(trait);
      char.manual = true;
      if (char.id==="p1") parents[0]=char;
      if (char.id==="p2") parents[1]=char;
      flushDependents(char.id);
      renderCharacter(char.id, char);
      updateTraitButtons(char.id, char.traits);
      scheduleDraw();
    });
    dropdown.appendChild(btn);
  });

  container.append(label, dropdown);
}
function flushDependents(charId){
  if (charId.startsWith("p")){
    grandparents.forEach(gp=>{
      gp.traits=null; gp.hasMutation=false; gp.manual=false;
      renderCharacter(gp.id, gp, true);
      updateTraitButtons(gp.id, []);
    });
  } else if (charId.startsWith("gp")){
    parents.forEach(p=>{
      p.traits=null; p.hasMutation=false; p.manual=false;
      renderCharacter(p.id, p, true);
      updateTraitButtons(p.id, []);
    });
  }
}

/* =========================================================
 * 6) GENETICS (randomize + breed) — tuned mixing & priorities
 * =======================================================*/
function randomizeCharacter(char){
  ensureTraitArray(char);
  const keys = Object.keys(allTraits);
  const traits = [];
  const traitCount = Math.floor(Math.random()*4); // 0–3
  while (traits.length < traitCount){
    const r = keys[Math.floor(Math.random()*keys.length)];
    if (!traits.includes(r)) traits.push(r);
  }
  char.traits = traits;
  char.hasMutation = Math.random()<0.15;
  char.manual = false;
  if (char.id==="p1") parents[0]=char;
  if (char.id==="p2") parents[1]=char;
  updateTraitButtons(char.id, char.traits);
  renderCharacter(char.id, char);
  scheduleDraw();
}

/* Breed (unchanged from your tuned version) */
function breed(p1, p2, grandparentsSet = []) {
  const keys = Object.keys(allTraits);

  const p1Traits = Array.isArray(p1.traits) ? p1.traits : [];
  const p2Traits = Array.isArray(p2.traits) ? p2.traits : [];
  const p1Count  = p1Traits.length;
  const p2Count  = p2Traits.length;

  const parentsHaveTraits = p1Count && p2Count;
  const directZeroParent  = (p1Count===0 || p2Count===0);

  const zeroGPCount = Array.isArray(grandparentsSet)
    ? grandparentsSet.filter(g => Array.isArray(g.traits) && g.traits.length === 0).length
    : 0;

  const PROB = {
    SINGLE: 0.44,
    SINGLE_PARENT_ZERO: 0.36,
    MULTI: 0.82,
    ADD_ANOTHER_SHARED: 0.18,
    DIVERSIFY_PARENT_CLONE: 0.55,
    DROP_ONE_IF_DIRECT_ZERO: 0.25,
    PARENTS_DIFFERENT_BONUS: 0.10,
    ECHO_EMPTY_1GP: 0.03,
    ECHO_DROP_1GP:  0.10,
    ECHO_EMPTY_2GP: 0.06,
    ECHO_DROP_2GP:  0.18,
    TRIM_3_TO_2: 0.45,
    TRIM_2_TO_1: 0.10,
  };

  const score = new Map(keys.map(k=>[k,0]));
  const bump = (arr)=>{ if (!Array.isArray(arr)) return; [...new Set(arr)].forEach(t=>score.set(t,(score.get(t)||0)+1)); };
  bump(p1Traits); bump(p2Traits);
  if (Array.isArray(grandparentsSet)) grandparentsSet.forEach(g=>bump(g.traits));

  const chosen = [];

  // shared first
  const sharedBoth = intersect(p1Traits, p2Traits);
  if (sharedBoth.length > 0){
    chosen.push(sample(sharedBoth));
    if (sharedBoth.length > 1 && chosen.length < 3 && Math.random() < PROB.ADD_ANOTHER_SHARED){
      const remaining = sharedBoth.filter(t => !chosen.includes(t));
      const pick2 = sample(remaining);
      if (pick2) chosen.push(pick2);
    }
  }

  // others
  keys.forEach(t=>{
    if (chosen.includes(t)) return;
    const count = score.get(t) || 0;
    const p1Has = p1Traits.includes(t);
    const p2Has = p2Traits.includes(t);

    if (p1Has && p2Has){
      if (Math.random() < 0.08 && chosen.length < 3) chosen.push(t);
      return;
    }
    if (count >= 2){
      if (Math.random() < PROB.MULTI && !chosen.includes(t) && chosen.length < 3) chosen.push(t);
      return;
    }
    if (count === 1){
      let p = PROB.SINGLE;
      const richerP1 = p1Count > p2Count;
      const richerP2 = p2Count > p1Count;
      if ((p1Has && richerP1) || (p2Has && richerP2)) p -= 0.06;
      if (directZeroParent && (p1Has || p2Has))       p -= 0.06;
      if (directZeroParent)                           p = Math.min(p, PROB.SINGLE_PARENT_ZERO);
      p = clamp(p, 0.20, 0.65);
      if (Math.random() < p && !chosen.includes(t) && chosen.length < 3) chosen.push(t);
    }
  });

  // diversify if clone
  const diversifyIfClone = () => {
    const noMutChosen = chosen.filter(t=>t!=="mutation");
    const p1Only = p1Traits.filter(t=>!p2Traits.includes(t));
    const p2Only = p2Traits.filter(t=>!p1Traits.includes(t));

    const nudge = (dropFrom, addFrom) => {
      const drop = (dropFrom.length ? sample(dropFrom) : sample(noMutChosen));
      const add  = addFrom.length ? sample(addFrom) : null;
      if (drop != null) {
        const idx = chosen.indexOf(drop);
        if (idx>-1) chosen.splice(idx, 1);
      }
      if (add && !chosen.includes(add) && chosen.length < 3) chosen.push(add);
    };

    if (equalSets(noMutChosen, p1Traits) && noMutChosen.length && Math.random() < PROB.DIVERSIFY_PARENT_CLONE) {
      p2Only.length ? nudge(noMutChosen.filter(t => !p2Traits.includes(t)), p2Only) : nudge(noMutChosen, []);
    } else if (equalSets(noMutChosen, p2Traits) && noMutChosen.length && Math.random() < PROB.DIVERSIFY_PARENT_CLONE) {
      p1Only.length ? nudge(noMutChosen.filter(t => !p1Traits.includes(t)), p1Only) : nudge(noMutChosen, []);
    }
  };
  diversifyIfClone();

  // parents-different bonus
  const parentsDifferent =
    new Set([...p1Traits, ...p2Traits]).size >
    Math.max(p1Count, p2Count);
  if (parentsDifferent && Math.random() < PROB.PARENTS_DIFFERENT_BONUS && chosen.length < 3){
    const pool = [...new Set([...p1Traits, ...p2Traits])].filter(t=>!chosen.includes(t));
    if (pool.length) chosen.push(sample(pool));
  }

  // early ancestral echo
  let echoEmptied = false;
  if (zeroGPCount > 0 && parentsHaveTraits){
    const emptyP = (zeroGPCount === 1) ? PROB.ECHO_EMPTY_1GP : PROB.ECHO_EMPTY_2GP;
    const dropP  = (zeroGPCount === 1) ? PROB.ECHO_DROP_1GP  : PROB.ECHO_DROP_2GP;
    if (Math.random() < emptyP){
      chosen.length = 0;
      echoEmptied = true;
    } else if (Math.random() < dropP && chosen.length > 0){
      const drop = sample(chosen);
      chosen.splice(chosen.indexOf(drop),1);
    }
  }

  // fallbacks (don’t refill if echo emptied)
  if (chosen.length === 0 && !echoEmptied){
    if (directZeroParent){
      if (parentsHaveTraits && Math.random() < 0.30){
        const union = [...new Set([...p1Traits, ...p2Traits])];
        if (union.length) chosen.push(sample(union));
      }
    } else {
      const fallbackP = zeroGPCount > 0 ? 0.55 : 0.70;
      if (parentsHaveTraits && Math.random() < fallbackP){
        const union = [...new Set([...p1Traits, ...p2Traits])];
        if (union.length) chosen.push(sample(union));
      }
    }
  }

  if (directZeroParent && chosen.length >= 1 && Math.random() < 0.25){
    const drop = sample(chosen);
    chosen.splice(chosen.indexOf(drop),1);
  }

  if (chosen.length === 3 && Math.random() < 0.45){
    const sharedBoth = intersect(p1Traits, p2Traits);
    const nonShared = chosen.filter(t => !sharedBoth.includes(t));
    const drop = nonShared.length ? sample(nonShared) : sample(chosen);
    chosen.splice(chosen.indexOf(drop), 1);
  } else if (chosen.length === 2 && Math.random() < 0.10){
    const sharedBoth = intersect(p1Traits, p2Traits);
    const nonShared = chosen.filter(t => !sharedBoth.includes(t));
    const drop = nonShared.length ? sample(nonShared) : sample(chosen);
    chosen.splice(chosen.indexOf(drop), 1);
  }

  const unique = [...new Set(chosen)].slice(0, 3);

  let hasMutation = false;
  if (
    (p1.traits && p1.hasMutation) ||
    (p2.traits && p2.hasMutation) ||
    (Array.isArray(grandparentsSet) && grandparentsSet.some(g=>g.hasMutation))
  ){
    if (Math.random() < 0.10){
      hasMutation = true;
      if (!unique.includes("mutation")) unique.push("mutation");
    }
  }

  return { traits: unique, hasMutation };
}

/* =========================================================
 * 7) ACTIONS / EVENT HANDLERS
 * =======================================================*/
document.getElementById("globalReset")?.addEventListener("click", ()=>{
  [...grandparents, ...parents].forEach(ch=>{
    ch.traits=null; ch.hasMutation=false; ch.manual=false;
    renderCharacter(ch.id, ch, true);
    updateTraitButtons(ch.id, []);
  });
  const c = document.getElementById("childCanvas");
  c?.getContext("2d").clearRect(0,0,c.width,c.height);
  const td = document.getElementById("traitsDisplay");
  if (td) td.textContent = "All reset.";
  scheduleDraw();
});

function debugLogBreeding(eventType, p1, p2, gset, result){
  console.group(`🐾 ${eventType} RESULT`);
  console.log("Parent1:", p1.id, p1.traits, "Manual:", p1.manual);
  console.log("Parent2:", p2.id, p2.traits, "Manual:", p2.manual);
  if (Array.isArray(gset) && gset.length) gset.forEach((gp,i)=>console.log(" GP"+(i+1), gp.id, gp.traits));
  else console.log("No grandparents used.");
  console.log("➡️ Result:", result.traits, "Mutation:", result.hasMutation);
  console.groupEnd();
}

document.querySelectorAll(".breedBtn").forEach((btn,i)=>{
  btn.onclick = ()=>{
    const gpPair = i===0 ? [grandparents[0], grandparents[1]] : [grandparents[2], grandparents[3]];
    const valid  = gpPair.filter(gp => gp.manual || Array.isArray(gp.traits)); // include [] None
    const newParent = breed(gpPair[0], gpPair[1], valid);
    newParent.id = i===0 ? "p1" : "p2";
    parents[i] = newParent;
    debugLogBreeding("Grandparents ➜ Parent", gpPair[0], gpPair[1], valid, newParent);
    renderCharacter(newParent.id, newParent);
    updateTraitButtons(newParent.id, newParent.traits);
    scheduleDraw();
  };
});

document.getElementById("finalBreed").onclick = async ()=>{
  const validGP = grandparents.filter(gp => gp.manual || Array.isArray(gp.traits)); // include [] None
  const child = breed(parents[0], parents[1], validGP);
  debugLogBreeding("Parent ➜ Child", parents[0], parents[1], validGP, child);

  const c = document.getElementById("childCanvas");
  const ctx = c.getContext("2d");
  ctx.clearRect(0,0,c.width,c.height);
  ctx.imageSmoothingEnabled = false;

  const order = ["tail","base","wings","ears","horns","mane"];
  for (const t of order){
    if (t==="base") await drawImage(ctx, baseImage, c.width, c.height);
    else if (Array.isArray(child.traits) && child.traits.includes(t) && allTraits[t]) {
      await drawImage(ctx, allTraits[t], c.width, c.height);
    }
  }
  if (child.hasMutation){
    ctx.fillStyle = "rgba(255,100,255,0.3)";
    ctx.fillRect(0,0,c.width,c.height);
  }
  document.getElementById("traitsDisplay").textContent =
    `Child traits: ${Array.isArray(child.traits) ? child.traits.join(", ") : "None"} ${child.hasMutation ? "(mutation!)" : ""}`;
  scheduleDraw();
};

/* =========================================================
 * 8) MOBILE-ONLY PAN/ZOOM VIEW — panning only UI (buttons hidden)
 * =======================================================*/
const IS_MOBILE = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
document.body.classList.toggle("mobile-zoom", IS_MOBILE);

const ZOOM_MIN=0.5, ZOOM_MAX=2.5, ZOOM_STEP=0.12;
let scale=1, origin={x:0,y:0};

const DEFER_CONNECTOR_MS = 80;
let idleConnectorTimer = null;

function stageSize(){ const r = stage.getBoundingClientRect(); return { w: r.width, h: r.height }; }
function contentSize(){ return { w: grid.offsetWidth, h: grid.offsetHeight }; }

/** Keep content within stage bounds. */
function clampOriginToBounds(){
  const { w: sw, h: sh } = stageSize();
  const { w: cw, h: ch } = contentSize();
  const tw = cw * scale;
  const th = ch * scale;

  if (tw <= sw){ origin.x = (sw - tw) / 2; }
  else { origin.x = clamp(origin.x, sw - tw, 0); }

  if (th <= sh){ origin.y = (sh - th) / 2; }
  else { origin.y = clamp(origin.y, sh - th, 0); }
}

function scheduleConnectorsAfterIdle(delay = DEFER_CONNECTOR_MS){
  if (idleConnectorTimer) clearTimeout(idleConnectorTimer);
  idleConnectorTimer = setTimeout(()=>{ scheduleDraw(); }, delay);
}

function applyTransform(){
  clampOriginToBounds();
  zoomContent.style.transform = IS_MOBILE
    ? `translate3d(${origin.x}px, ${origin.y}px, 0) scale(${scale})`
    : "none";
}
applyTransform();

/* NOTE: If you want to disable pinch zoom too, set ALLOW_PINCH=false. */
const ALLOW_PINCH = true;

if (IS_MOBILE){
  let pointers=new Map(); let lastPan={x:0,y:0}; let pinchStart=null;

  stage.addEventListener("pointerdown", (e)=>{
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    lastPan={x:e.clientX,y:e.clientY};
    if (idleConnectorTimer) clearTimeout(idleConnectorTimer);
  });

  stage.addEventListener("pointermove", (e)=>{
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});

    if (pointers.size===1){
      const dx=e.clientX-lastPan.x, dy=e.clientY-lastPan.y;
      origin.x+=dx; origin.y+=dy; lastPan={x:e.clientX,y:e.clientY};
      applyTransform();
      scheduleConnectorsAfterIdle();
    } else if (ALLOW_PINCH && pointers.size===2){
      const pts=[...pointers.values()], c=midpoint(pts[0],pts[1]), dist=distance(pts[0],pts[1]);
      if (!pinchStart){ pinchStart={dist,scale,center:c}; }
      else {
        const targetScale=clamp(pinchStart.scale*(dist/pinchStart.dist), ZOOM_MIN, ZOOM_MAX);
        const rect=stage.getBoundingClientRect();
        const cx=c.x-rect.left, cy=c.y-rect.top;
        origin.x += (cx/scale)-(cx/targetScale);
        origin.y += (cy/scale)-(cy/targetScale);
        scale=targetScale;
        applyTransform();
        scheduleConnectorsAfterIdle();
      }
    }
  });

  ["pointerup","pointercancel","pointerleave"].forEach(type=>{
    stage.addEventListener(type,(e)=>{
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchStart=null;
      applyTransform();
      scheduleConnectorsAfterIdle(40);
    });
  });
}

/* =========================================================
 * 9) CONNECTORS (SVG)
 * =======================================================*/
const paths = [
  { from:"#gp1", to:"#p1" }, { from:"#gp2", to:"#p1" },
  { from:"#gp3", to:"#p2" }, { from:"#gp4", to:"#p2" },
  { from:"#p1",  to:"#childCanvas" }, { from:"#p2", to:"#childCanvas" },
];

function drawConnectors(){
  const gRect = grid.getBoundingClientRect();
  if (!gRect.width || !gRect.height) return;
  svg.setAttribute("width", gRect.width);
  svg.setAttribute("height", gRect.height);
  svg.setAttribute("viewBox", `0 0 ${gRect.width} ${gRect.height}`);
  svg.innerHTML="";
  paths.forEach(({from,to})=>{
    const a=document.querySelector(from);
    const b= to==="#childCanvas" ? document.querySelector("#childCanvas") : document.querySelector(to);
    if (!a || !b) return;
    const aRect=a.getBoundingClientRect(), bRect=b.getBoundingClientRect();
    const x1=aRect.left-gRect.left + aRect.width/2;
    const y1=aRect.top -gRect.top  + aRect.height;
    const x2=bRect.left-gRect.left + bRect.width/2;
    const y2=bRect.top -gRect.top;
    const dy=Math.max(20, Math.abs(y2-y1)*0.4);
    const d=`M ${x1} ${y1} C ${x1} ${y1+dy}, ${x2} ${y2-dy}, ${x2} ${y2}`;
    const path=document.createElementNS("http://www.w3.org/2000/svg","path");
    path.setAttribute("d", d);
    path.setAttribute("fill","none");
    path.setAttribute("stroke","rgba(231,233,255,.55)");
    path.setAttribute("stroke-width","2.5");
    path.setAttribute("stroke-linecap","round");
    svg.appendChild(path);
  });
}
scheduleDraw = createScheduler(drawConnectors);

/* =========================================================
 * 10) INITIALIZATION & OBSERVERS
 * =======================================================*/
[...grandparents, ...parents].forEach(setupTraitDropdown);
document.querySelectorAll(".randomBtn").forEach((btn,i)=>btn.addEventListener("click", ()=>randomizeCharacter(grandparents[i])));

const ro = new ResizeObserver(()=>{ applyTransform(); scheduleDraw(); });
ro.observe(grid);

// No auto-fit; just draw connectors initially
window.addEventListener("load", ()=>{ scheduleDraw(); });
window.addEventListener("resize", ()=>{ applyTransform(); scheduleDraw(); });