/* eslint-env browser */
"use strict";

/* =========================================================
 * 1) TRAITS (categorized) + MUTATIONS
 * =======================================================*/

/** Use <category>_<variant> keys to auto-group and control draw/layering */
const allTraits = {
  // ---- TAILS (single-select)
  tail_fish:   "images/trait_tail.png",
  tail_fox:    "images/tail_fox.png",
  tail_wolf:   "images/tail_wolf.png",
  tail_dragon: "images/tail_dragon.png",

  // ---- WINGS (single-select, drawn under base so they tuck behind)
  wings_small: "images/trait_wings.png",
  wings_angel: "images/wings_angel.png",
  wings_bat:   "images/wings_bat.png",

  // ---- EARS (single-select)
  ears_shark:  "images/trait_ears.png",
  ears_long:   "images/ears_long.png",
  ears_fuzzy:  "images/ears_fuzzy.png",

  // ---- HORNS (single-select)
  horns_devil:  "images/trait_horns.png",
  horns_ram:    "images/horns_ram.png",
  horns_antler: "images/horns_antler.png",

  // ---- BODY (multi-select)
  body_spines: "images/body_spines.png",
  body_furry:  "images/body_furry.png",

  // ---- HAIR (single-select)
  hair_mane:   "images/trait_mane.png",
};

const baseImage = "images/base.png";

/** Layering:
 *  - below base: wings, tail
 *  - (special under-base overlays like extra_limb)
 *  - base
 *  - above base: body, ears, hair, horns
 */
const CATS_BELOW_BASE = ["wings", "tail"];
const CATS_ABOVE_BASE = ["body", "ears", "hair", "horns"];

/** Single-select categories -> dropdowns */
const SINGLE_SELECT_CATS = new Set(["wings", "tail", "ears", "hair", "horns"]);
/** Multi-select category -> buttons */
const MULTI_SELECT_CATS  = new Set(["body"]);

function categoryOf(traitKey){
  if (!traitKey) return "misc";
  const m = String(traitKey).match(/^([a-z]+)/i);
  return m ? m[1].toLowerCase() : "misc";
}

/* ---- Mutation catalog ---- */
const MUTATIONS = {
  albino:       { kind:"filter",  filter:"grayscale(1) brightness(1.25) contrast(1.1)", parentP:0.25, gpP:0.10, spontaneous:0.005 },
  melanism:     { kind:"filter",  filter:"grayscale(1) brightness(0.7) contrast(1.25)", parentP:0.22, gpP:0.08,  spontaneous:0.004 },

  black_sclera: { kind:"overlay", img:"images/mut_black_sclera.png",                   parentP:0.18, gpP:0.06,  spontaneous:0.01  },
  extra_limb:   { kind:"overlay", img:"images/mut_extra_limb.png",                     parentP:0.14, gpP:0.06,  spontaneous:0.008 },
  extra_eye:    { kind:"overlay", img:"images/mut_extra_eye.png",                      parentP:0.16, gpP:0.07,  spontaneous:0.008 },

  extra_tail:   { kind:"flag",    parentP:0.18, gpP:0.07,  spontaneous:0.01  },
};

/* exclusivity groups (first is higher priority when auto-resolving) */
const MUT_EXCLUSIVE_GROUPS = [
  ["melanism", "albino"], // keep first (melanism) if both would occur
];

/* =========================================================
 * 2) STATE
 * =======================================================*/
let grandparents = [
  { id: "gp1", traits: null, hasMutation: false, mutations: [], manual: false },
  { id: "gp2", traits: null, hasMutation: false, mutations: [], manual: false },
  { id: "gp3", traits: null, hasMutation: false, mutations: [], manual: false },
  { id: "gp4", traits: null, hasMutation: false, mutations: [], manual: false },
];
let parents = [
  { id: "p1", traits: null, hasMutation: false, mutations: [], manual: false },
  { id: "p2", traits: null, hasMutation: false, mutations: [], manual: false },
];

/* =========================================================
 * 3) DOM REFERENCES
 * =======================================================*/
const stage       = document.getElementById("stage");
const zoomContent = document.getElementById("zoomContent");
const grid        = document.getElementById("treeGrid");
const svg         = document.getElementById("treeLines");

/* =========================================================
 * 4) UTILITIES
 * =======================================================*/
function ensureTraitArray(char){ if (!Array.isArray(char.traits)) char.traits = []; }
function ensureMutationArray(char){ if (!Array.isArray(char.mutations)) char.mutations = []; }
function clamp(v,min,max){ return Math.min(max, Math.max(min, v)); }
function distance(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return Math.hypot(dx,dy); }
function midpoint(a,b){ return { x:(a.x+b.x)/2, y:(a.y+b.y)/2 }; }

/* Robust image loader: never block on 404 */
function drawImageAt(ctx, src, x, y, w, h){
  return new Promise((res)=>{
    const img = new Image();
    img.onload = ()=>{ ctx.drawImage(img, x, y, w, h); res(); };
    img.onerror = ()=>{ console.warn("[img-missing]", src); res(); };
    img.src = src;
  });
}
function drawImage(ctx, src, w, h){ return drawImageAt(ctx, src, 0, 0, w, h); }

function createScheduler(fn){ let raf=null; return function(){ if(raf) cancelAnimationFrame(raf); raf=requestAnimationFrame(()=>{ fn(); raf=null; }); }; }
let scheduleDraw = () => {};
function sample(arr){ return arr[Math.floor(Math.random()*arr.length)] || null; }
function shuffled(arr){ const a=arr.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function sampleMany(arr, k){ return shuffled(arr).slice(0, Math.max(0, Math.min(k, arr.length))); }
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
function removeCategory(traits, cat){ return (traits||[]).filter(t => categoryOf(t) !== cat); }
function hasCategory(traits, cat){ return (traits||[]).some(t => categoryOf(t) === cat); }

/* enforce one-per-category (except body) — pinned win ties */
function enforceCategoryCapsKeepPinned(traitsArr, pinnedSet=new Set()){
  const out = [];
  const keptByCat = new Map();
  for (const t of traitsArr){
    const cat = categoryOf(t);
    if (MULTI_SELECT_CATS.has(cat)){ if (!out.includes(t)) out.push(t); continue; }
    if (!keptByCat.has(cat)){ keptByCat.set(cat,t); if (!out.includes(t)) out.push(t); }
    else {
      const existing = keptByCat.get(cat);
      const existingPinned = pinnedSet.has(existing);
      const newPinned = pinnedSet.has(t);
      if (newPinned && !existingPinned){
        const idx = out.indexOf(existing); if (idx!==-1) out[idx]=t;
        keptByCat.set(cat,t);
      }
    }
  }
  return out;
}

/** choose more traits (highest family frequency first) to reach N, respecting category caps */
function fillUpTo(current, pinnedSet, score, target){
  const need = target - current.length;
  if (need <= 0) return current;

  const canAdd = (key) => {
    const cat = categoryOf(key);
    if (MULTI_SELECT_CATS.has(cat)) return true;
    return !current.some(t => categoryOf(t) === cat);
  };

  const keys = Object.keys(allTraits).slice();
  keys.sort((a,b)=>{
    const sa = score.get(a) || 0;
    const sb = score.get(b) || 0;
    if (sb !== sa) return sb - sa;
    return Math.random() - 0.5;
  });

  for (const k of keys){
    if (current.length >= target) break;
    if (current.includes(k)) continue;
    if (!canAdd(k)) continue;
    current.push(k);
  }
  return current;
}

/** convenience wrapper for 3 */
function fillUpToThree(current, pinnedSet, score){
  return fillUpTo(current, pinnedSet, score, 3);
}

/** enforce exclusivity groups on mutation arrays/sets */
function enforceExclusiveMutations(listOrSet, favor=null){
  const set = new Set(listOrSet || []);
  for (const group of MUT_EXCLUSIVE_GROUPS){
    const present = group.filter(k => set.has(k));
    if (present.length > 1){
      const keep = (favor && present.includes(favor)) ? favor : group[0];
      group.forEach(k => { if (k !== keep) set.delete(k); });
    }
  }
  return [...set];
}

/* =========================================================
 * 5) RENDERING
 * =======================================================*/
async function drawTraitsInOrder(ctx, selected, mutationsSet, width, height){
  const hasExtraTail = mutationsSet && mutationsSet.has("extra_tail");
  const extraTailYOffset = -Math.round(height * 0.08); // ~8% upward

  // BELOW BASE (wings, tail)
  for (const cat of CATS_BELOW_BASE){
    for (const t of selected){
      if (categoryOf(t) === cat && allTraits[t]){
        await drawImage(ctx, allTraits[t], width, height);
        if (cat === "tail" && hasExtraTail){
          await drawImageAt(ctx, allTraits[t], 0, extraTailYOffset, width, height);
        }
      }
    }
  }

  // SPECIAL UNDER-BASE OVERLAY: extra_limb (draw it now so it sits under the base)
  if (mutationsSet && mutationsSet.has("extra_limb") && MUTATIONS.extra_limb.img){
    await drawImage(ctx, MUTATIONS.extra_limb.img, width, height);
  }

  // BASE
  await drawImage(ctx, baseImage, width, height);

  // ABOVE BASE (body, ears, hair, horns)
  for (const cat of CATS_ABOVE_BASE){
    for (const t of selected){
      if (categoryOf(t) === cat && allTraits[t]){
        await drawImage(ctx, allTraits[t], width, height);
      }
    }
  }
}

function mutationFilterFromList(mutations=[]){
  const set = new Set(mutations);
  if (set.has("melanism")) return MUTATIONS.melanism.filter;
  if (set.has("albino"))   return MUTATIONS.albino.filter;
  return "";
}

async function renderCharacter(canvasId, char, blank=false){
  const el = document.querySelector(`#${canvasId} canvas`);
  if (!el) return;
  const ctx = el.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0,0,el.width,el.height);
  el.style.filter = "";

  ensureTraitArray(char);
  ensureMutationArray(char);

  const actuallyBlank = blank || char.traits === null;

  if (!actuallyBlank){
    const selected = new Set(Array.isArray(char.traits) ? char.traits : []);
    const mutSet = new Set(char.mutations || []);
    await drawTraitsInOrder(ctx, selected, mutSet, el.width, el.height);

    // overlays (skip extra_limb — already drawn under base)
    for (const m of (char.mutations || [])){
      if (m === "extra_limb") continue;
      const info = MUTATIONS[m];
      if (info && info.kind === "overlay" && info.img){
        await drawImage(ctx, info.img, el.width, el.height);
      }
    }
    const f = mutationFilterFromList(char.mutations);
    if (f) el.style.filter = f;
  }

  const info = document.querySelector(`#${canvasId} .traitText`);
  if (info){
    const traitList = actuallyBlank ? "—" : (Array.isArray(char.traits) ? char.traits.join(", ") : "None");
    const muts = (char.mutations && char.mutations.length)
      ? ` <span class="mut-label">• Mutations:</span> ${char.mutations.map(m=>`<span class="mut-tag">${m}</span>`).join(" ")}`
      : "";
    info.innerHTML = traitList + muts;
  }
}

/* Helper to render the CHILD canvas with the same logic */
async function renderToCanvasEl(canvasEl, traits=[], mutations=[]){
  const ctx = canvasEl.getContext("2d");
  canvasEl.style.filter = "";
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0,0,canvasEl.width,canvasEl.height);

  const selected = new Set(Array.isArray(traits) ? traits : []);
  const mutSet = new Set(mutations || []);
  await drawTraitsInOrder(ctx, selected, mutSet, canvasEl.width, canvasEl.height);

  // overlays — skip extra_limb (already under base)
  for (const m of (mutations || [])){
    if (m === "extra_limb") continue;
    const info = MUTATIONS[m];
    if (info && info.kind === "overlay" && info.img){
      await drawImage(ctx, info.img, canvasEl.width, canvasEl.height);
    }
  }
  const f = mutationFilterFromList(mutations);
  if (f) canvasEl.style.filter = f;
}

/* =========================================================
 * 6) TRAIT & MUTATION UI
 * =======================================================*/
function updateTraitUI(charId, traits=[], mutations=[]){
  const root = document.querySelector(`#${charId} .traitSelect`);
  if (!root) return;

  // update dropdowns
  root.querySelectorAll("select[data-cat]").forEach(sel=>{
    const cat = sel.getAttribute("data-cat");
    const picked = (traits||[]).find(t => categoryOf(t) === cat) || "";
    sel.value = picked || "";
  });

  // update body & mutation buttons
  root.querySelectorAll(".traitBtn").forEach(btn=>{
    const key = btn.getAttribute("data-key");
    const kind = btn.getAttribute("data-kind"); // "trait" or "mutation"
    let isActive = false;
    if (kind === "trait") isActive = Array.isArray(traits) && traits.includes(key);
    else if (kind === "mutation") isActive = Array.isArray(mutations) && mutations.includes(key);
    btn.classList.toggle("activeTrait", isActive);
    btn.setAttribute("aria-pressed", String(isActive));
  });
}

function setupTraitDropdown(char){
  const container = document.querySelector(`#${char.id} .traitSelect`);
  if (!container) return;

  // Group traits by category
  const groups = {};
  Object.keys(allTraits).forEach(k=>{
    const cat = categoryOf(k);
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(k);
  });

  container.innerHTML = "";

  const header = document.createElement("label");
  header.textContent = "Select Traits & Mutations:";
  container.appendChild(header);

  // NONE button (clear traits & mutations)
  const rowNone = document.createElement("div");
  rowNone.classList.add("dropdownTraits");
  const noneBtn = document.createElement("button");
  noneBtn.textContent = "None (clear all)";
  noneBtn.classList.add("traitBtn");
  noneBtn.setAttribute("data-kind","clear");
  noneBtn.addEventListener("click", ()=>{
    char.traits = [];
    char.mutations = [];
    char.hasMutation = false;
    char.manual = true;
    if (char.id==="p1") parents[0]=char;
    if (char.id==="p2") parents[1]=char;
    flushDependents(char.id);
    renderCharacter(char.id, char, false);
    updateTraitUI(char.id, char.traits, char.mutations);
    scheduleDraw();
  });
  rowNone.appendChild(noneBtn);
  container.appendChild(rowNone);

  /* ----- Single-select categories as dropdowns ----- */
  const selectRow = document.createElement("div");
  selectRow.classList.add("selectRow");

  const singleCatsOrdered = Array.from(new Set([
    ...CATS_BELOW_BASE.filter(c=>SINGLE_SELECT_CATS.has(c)),
    ...CATS_ABOVE_BASE.filter(c=>SINGLE_SELECT_CATS.has(c)),
    ...Array.from(SINGLE_SELECT_CATS).filter(c=>!CATS_BELOW_BASE.includes(c)&&!CATS_ABOVE_BASE.includes(c))
  ]));

  singleCatsOrdered.forEach(cat=>{
    const wrap = document.createElement("div");
    wrap.classList.add("selectWrap");

    const label = document.createElement("span");
    label.textContent = cat.toUpperCase();
    wrap.appendChild(label);

    const sel = document.createElement("select");
    sel.setAttribute("data-cat", cat);

    // blank option
    const optNone = document.createElement("option");
    optNone.value = "";
    optNone.textContent = "— none —";
    sel.appendChild(optNone);

    // options
    (groups[cat]||[]).forEach(key=>{
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = key;
      sel.appendChild(opt);
    });

    // initial value
    const picked = (Array.isArray(char.traits)?char.traits:[]).find(t=>categoryOf(t)===cat) || "";
    sel.value = picked || "";

    sel.addEventListener("change", ()=>{
      ensureTraitArray(char);
      const value = sel.value;
      // remove any existing trait in this category
      char.traits = removeCategory(char.traits, cat);
      if (value) char.traits.push(value);

      char.manual = true;
      if (char.id==="p1") parents[0]=char;
      if (char.id==="p2") parents[1]=char;
      flushDependents(char.id);
      renderCharacter(char.id, char);
      updateTraitUI(char.id, char.traits, char.mutations);
      scheduleDraw();
    });

    wrap.appendChild(sel);
    selectRow.appendChild(wrap);
  });

  container.appendChild(selectRow);

  /* ----- Body category (multi-select buttons) ----- */
  const groupsBody = groups.body || [];
  if (groupsBody.length){
    const label = document.createElement("div");
    label.style.margin = "8px 0 4px";
    label.style.color = "#a6accd";
    label.textContent = "BODY";
    container.appendChild(label);

    const wrap = document.createElement("div");
    wrap.classList.add("dropdownTraits");
    groupsBody.forEach(trait=>{
      const btn = document.createElement("button");
      btn.classList.add("traitBtn");
      btn.setAttribute("data-kind","trait");
      btn.setAttribute("data-key", trait);
      btn.textContent = trait;
      btn.addEventListener("click", ()=>{
        ensureTraitArray(char);
        if (char.traits.includes(trait)) char.traits = char.traits.filter(t=>t!==trait);
        else char.traits.push(trait);

        char.manual = true;
        if (char.id==="p1") parents[0]=char;
        if (char.id==="p2") parents[1]=char;
        flushDependents(char.id);
        renderCharacter(char.id, char);
        updateTraitUI(char.id, char.traits, char.mutations);
        scheduleDraw();
      });
      wrap.appendChild(btn);
    });
    container.appendChild(wrap);
  }

  /* ----- Mutations (multi-select buttons) ----- */
  const mutLabel = document.createElement("div");
  mutLabel.style.margin = "10px 0 4px";
  mutLabel.style.color = "#a6accd";
  mutLabel.textContent = "MUTATIONS";
  container.appendChild(mutLabel);

  const mutWrap = document.createElement("div");
  mutWrap.classList.add("dropdownTraits");
  Object.keys(MUTATIONS).forEach(key=>{
    const btn = document.createElement("button");
    btn.classList.add("traitBtn");
    btn.setAttribute("data-kind","mutation");
    btn.setAttribute("data-key", key);
    btn.textContent = key;
    btn.addEventListener("click", ()=>{
      ensureMutationArray(char);
      if (char.mutations.includes(key)) {
        char.mutations = char.mutations.filter(m=>m!==key);
      } else {
        char.mutations = [...char.mutations, key];
      }
      char.mutations = enforceExclusiveMutations(char.mutations, key);
      char.hasMutation = char.mutations.length > 0;

      char.manual = true;
      if (char.id==="p1") parents[0]=char;
      if (char.id==="p2") parents[1]=char;
      renderCharacter(char.id, char);
      updateTraitUI(char.id, char.traits, char.mutations);
      scheduleDraw();
    });
    mutWrap.appendChild(btn);
  });
  container.appendChild(mutWrap);

  updateTraitUI(char.id, Array.isArray(char.traits) ? char.traits : [], Array.isArray(char.mutations) ? char.mutations : []);
}

function flushDependents(charId){
  if (charId.startsWith("p")){
    grandparents.forEach(gp=>{
      gp.traits=null; gp.mutations=[]; gp.hasMutation=false; gp.manual=false;
      renderCharacter(gp.id, gp, true);
      updateTraitUI(gp.id, [], []);
    });
  } else if (charId.startsWith("gp")){
    parents.forEach(p=>{
      p.traits=null; p.mutations=[]; p.hasMutation=false; p.manual=false;
      renderCharacter(p.id, p, true);
      updateTraitUI(p.id, [], []);
    });
  }
}

/* =========================================================
 * 7) GENETICS (randomize + breed)
 * =======================================================*/
function randomizeCharacter(char){
  ensureTraitArray(char);
  ensureMutationArray(char);

  const keys = Object.keys(allTraits);
  const order = shuffled(keys);

  const targetCount = Math.floor(Math.random()*4); // 0–3 total traits
  const picks = [];

  for (const t of order){
    if (picks.length >= targetCount) break;
    const cat = categoryOf(t);
    if (MULTI_SELECT_CATS.has(cat)){
      if (!picks.includes(t)) picks.push(t);
    } else {
      if (hasCategory(picks, cat)) continue;
      picks.push(t);
    }
  }

  char.traits = picks;

  // spontaneous mutations ONLY when randomizing a standalone character
  char.mutations = [];
  for (const k of Object.keys(MUTATIONS)){
    const m = MUTATIONS[k];
    if (Math.random() < (m.spontaneous || 0)) char.mutations.push(k);
  }
  char.mutations = enforceExclusiveMutations(char.mutations);
  char.hasMutation = char.mutations.length > 0;

  char.manual = false;
  if (char.id==="p1") parents[0]=char;
  if (char.id==="p2") parents[1]=char;
  updateTraitUI(char.id, char.traits, char.mutations);
  renderCharacter(char.id, char);
  scheduleDraw();
}

/**
 * Genetics:
 *  - Parent dominance when both parents have 3+ traits:
 *      * Grandparent "echo" effects are heavily down-weighted.
 *      * Force-fill to 3 traits (no trimming).
 *  - If EVERY member (both parents + considered grandparents) has ≥2 traits,
 *      * Child is guaranteed to end with at least 2 traits (floor).
 *  - Otherwise use existing probabilities (with mild GP influence).
 *  - No spontaneous mutations during breeding (inherit only).
 */
function breed(p1, p2, grandparentsSet = []) {
  const keys = Object.keys(allTraits);

  const p1Traits = Array.isArray(p1.traits) ? p1.traits : [];
  const p2Traits = Array.isArray(p2.traits) ? p2.traits : [];
  const p1Count  = p1Traits.length;
  const p2Count  = p2Traits.length;

  const parentsHaveTraits = p1Count && p2Count;
  const directZeroParent  = (p1Count===0 || p2Count===0);

  const effectiveGPs = Array.isArray(grandparentsSet) ? grandparentsSet.filter(g => Array.isArray(g.traits)) : [];
  const gpCounts = effectiveGPs.map(g => g.traits.length);
  const familyCounts = [p1Count, p2Count, ...gpCounts];
  const minFamilyCount = familyCounts.length ? Math.min(...familyCounts) : 0;

  const zeroGPCount = effectiveGPs.filter(g => g.traits.length === 0).length;

  // NEW: parent dominance flag & scales (reduce GP influence when both parents are strong)
  const PARENT_DOMINANCE   = (p1Count >= 3 && p2Count >= 3);
  const GP_ECHO_SCALE      = PARENT_DOMINANCE ? 0.35 : 1.0; // scales per-trait GP-miss drop
  const GP_ZERO_ECHO_SCALE = PARENT_DOMINANCE ? 0.30 : 1.0; // scales zero-GP empty/drop
  const FORCE_THREE_BY_PARENTS = PARENT_DOMINANCE;          // force fill to 3 if both parents 3+

  const PROB = {
    SINGLE: 0.44,
    SINGLE_PARENT_ZERO: 0.36,
    MULTI: 0.82,
    DIVERSIFY_PARENT_CLONE: 0.55,
    DROP_ONE_IF_DIRECT_ZERO: 0.25,
    PARENTS_DIFFERENT_BONUS: 0.10,
    ECHO_EMPTY_1GP: 0.03,
    ECHO_DROP_1GP:  0.10,
    ECHO_EMPTY_2GP: 0.06,
    ECHO_DROP_2GP:  0.18,
    TRIM_3_TO_2: 0.45,
    TRIM_2_TO_1: 0.10,
    SHARED_MISSING_DROP_BASE: 0.06,
    SHARED_MISSING_DROP_PER_MISS: 0.04,
    SHARED_MISSING_DROP_CAP: 0.18,
  };

  // Family frequency map
  const score = new Map(keys.map(k=>[k,0]));
  const bump = (arr)=>{ if (!Array.isArray(arr)) return; [...new Set(arr)].forEach(t=>score.set(t,(score.get(t)||0)+1)); };
  bump(p1Traits); bump(p2Traits);
  if (Array.isArray(grandparentsSet)) grandparentsSet.forEach(g=>bump(g.traits));

  const chosen = [];
  const pinned = new Set();

  // ----- GUARANTEED SHARED -----
  const sharedBoth = intersect(p1Traits, p2Traits);
  if (sharedBoth.length >= 3){
    const picks = sampleMany(sharedBoth, 3);
    picks.forEach(t => { chosen.push(t); pinned.add(t); });
  } else if (sharedBoth.length > 0){
    sharedBoth.forEach(t => { if (!chosen.includes(t)) { chosen.push(t); pinned.add(t); } });
  }

  // ----- PER-TRAIT LACK ECHO ON PINNED (down-weighted if parents dominate) -----
  if (pinned.size && effectiveGPs.length){
    const totalGP = effectiveGPs.length;
    [...pinned].forEach(t=>{
      const gpHave = effectiveGPs.filter(g => g.traits.includes(t)).length;
      const gpMiss = Math.max(0, totalGP - gpHave);
      if (gpMiss > 0){
        let dropP = clamp(
          PROB.SHARED_MISSING_DROP_BASE + PROB.SHARED_MISSING_DROP_PER_MISS * (gpMiss - 1),
          0,
          PROB.SHARED_MISSING_DROP_CAP
        );
        dropP *= GP_ECHO_SCALE; // reduce GP influence
        if (Math.random() < dropP){
          const idx = chosen.indexOf(t);
          if (idx > -1) chosen.splice(idx, 1);
          pinned.delete(t);
        }
      }
    });
  }

  // ----- OTHER SOURCES -----
  keys.forEach(t=>{
    if (chosen.length >= 3) return;
    if (chosen.includes(t)) return;

    const count = score.get(t) || 0;
    const p1Has = p1Traits.includes(t);
    const p2Has = p2Traits.includes(t);

    if (p1Has && p2Has){
      if (chosen.length < 3 && !pinned.has(t) && Math.random() < PROB.MULTI * 0.1) chosen.push(t);
      return;
    }
    if (count >= 2){
      if (Math.random() < PROB.MULTI) chosen.push(t);
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
      if (Math.random() < p) chosen.push(t);
    }
  });

  // ----- DIVERSIFY IF CLONE (don't drop pinned) -----
  const diversifyIfClone = () => {
    const noMutChosen = chosen.filter(t=>t!=="mutation");
    const p1Only = p1Traits.filter(t=>!p2Traits.includes(t));
    const p2Only = p2Traits.filter(t=>!p1Traits.includes(t));

    const dropFrom = (arr)=>arr.filter(t=>!pinned.has(t));
    const nudge = (dropPool, addPool) => {
      const pool = dropFrom(dropPool.length ? dropPool : noMutChosen);
      const drop = pool.length ? sample(pool) : null;
      const add  = addPool.length ? sample(addPool) : null;
      if (drop != null){
        const idx = chosen.indexOf(drop);
        if (idx>-1) chosen.splice(idx,1);
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

  // ----- PARENTS-DIFFERENT BONUS -----
  const parentsDifferent =
    new Set([...p1Traits, ...p2Traits]).size >
    Math.max(p1Count, p2Count);
  if (parentsDifferent && chosen.length < 3 && Math.random() < PROB.PARENTS_DIFFERENT_BONUS){
    const pool = [...new Set([...p1Traits, ...p2Traits])].filter(t=>!chosen.includes(t));
    if (pool.length) chosen.push(sample(pool));
  }

  // ----- EARLY ANCESTRAL ECHO (0-trait grandparents) — down-weight when parents dominate -----
  const allPinnedFullySupported =
    effectiveGPs.length > 0
      ? [...pinned].every(t => effectiveGPs.every(g => g.traits.includes(t)))
      : false;
  const hardGuarantee3 = (pinned.size >= 3) && allPinnedFullySupported;

  let echoEmptied = false;
  if (!hardGuarantee3 && zeroGPCount > 0 && parentsHaveTraits){
    let emptyP = (zeroGPCount === 1) ? PROB.ECHO_EMPTY_1GP : PROB.ECHO_EMPTY_2GP;
    let dropP  = (zeroGPCount === 1) ? PROB.ECHO_DROP_1GP  : PROB.ECHO_DROP_2GP;
    emptyP *= GP_ZERO_ECHO_SCALE;
    dropP  *= GP_ZERO_ECHO_SCALE;
    if (Math.random() < emptyP){
      chosen.length = 0;
      echoEmptied = true;
    } else if (Math.random() < dropP && chosen.length > 0){
      const droppable = chosen.filter(t=>!pinned.has(t));
      if (droppable.length){
        const drop = sample(droppable);
        chosen.splice(chosen.indexOf(drop),1);
      }
    }
  }

  // ----- FALLBACKS (ignore GP penalty when parents dominate) -----
  if (chosen.length === 0 && !echoEmptied){
    if (directZeroParent){
      if (parentsHaveTraits && Math.random() < 0.30){
        const union = [...new Set([...p1Traits, ...p2Traits])];
        if (union.length) chosen.push(sample(union));
      }
    } else {
      const fallbackP = (zeroGPCount > 0 && !PARENT_DOMINANCE) ? 0.55 : 0.70;
      if (parentsHaveTraits && Math.random() < fallbackP){
        const union = [...new Set([...p1Traits, ...p2Traits])];
        if (union.length) chosen.push(sample(union));
      }
    }
  }

  // ----- DIRECT-ZERO-PARENT DROP -----
  if (directZeroParent && chosen.length >= 1 && Math.random() < PROB.DROP_ONE_IF_DIRECT_ZERO){
    const droppable = chosen.filter(t=>!pinned.has(t));
    if (droppable.length){
      const drop = sample(droppable);
      chosen.splice(chosen.indexOf(drop),1);
    }
  }

  // Enforce category caps BEFORE trimming
  let enforced = enforceCategoryCapsKeepPinned(chosen, pinned);

  // ----- Force-to-3 when both parents are strong, else if whole family strong -----
  if (FORCE_THREE_BY_PARENTS){
    enforced = fillUpToThree(enforced, pinned, score);
    // skip trimming — parents dominate
  } else if (minFamilyCount >= 3){
    enforced = fillUpToThree(enforced, pinned, score);
  } else {
    // normal trimming
    if (enforced.length === 3 && Math.random() < PROB.TRIM_3_TO_2){
      const nonPinned = enforced.filter(t=>!pinned.has(t));
      if (nonPinned.length){
        const nonShared = nonPinned.filter(t => !sharedBoth.includes(t));
        const drop = (nonShared.length ? sample(nonShared) : sample(nonPinned));
        const idx = enforced.indexOf(drop);
        if (idx>-1) enforced.splice(idx, 1);
      }
    } else if (enforced.length === 2 && Math.random() < PROB.TRIM_2_TO_1){
      const nonPinned = enforced.filter(t=>!pinned.has(t));
      if (nonPinned.length){
        const nonShared = nonPinned.filter(t => !sharedBoth.includes(t));
        const drop = (nonShared.length ? sample(nonShared) : sample(nonPinned));
        const idx = enforced.indexOf(drop);
        if (idx>-1) enforced.splice(idx, 1);
      }
    }

    // NEW: Floor of 2 traits if EVERYONE has ≥2 traits
    if (minFamilyCount >= 2 && enforced.length < 2){
      enforced = fillUpTo(enforced, pinned, score, 2);
    }
  }

  // Unique + final cap
  const unique = [...new Set(enforced)].slice(0, 3);

  // ----- MUTATIONS (inherit only; no spontaneous during breeding) -----
  const parentMutSet = new Set([
    ...((p1 && p1.mutations) || []),
    ...((p2 && p2.mutations) || []),
  ]);
  const gpMutSet = new Set(
    (Array.isArray(grandparentsSet) ? grandparentsSet : [])
      .flatMap(g => (g && g.mutations) ? g.mutations : [])
  );

  const childMutations = new Set();
  for (const key of Object.keys(MUTATIONS)){
    const m = MUTATIONS[key];
    const fromParent = parentMutSet.has(key);
    const fromGP     = gpMutSet.has(key);

    // Only inherit if present in parents or grandparents; no spontaneous here
    let p = 0;
    if (fromParent) p = m.parentP || 0;
    else if (fromGP) p = m.gpP || 0;
    else p = 0;

    if (Math.random() < p) childMutations.add(key);
  }

  // exclusivity after inheritance
  const mutations = enforceExclusiveMutations(childMutations);
  const hasMutation = mutations.length > 0;

  return { traits: unique, hasMutation, mutations };
}

/* =========================================================
 * 8) ACTIONS / EVENT HANDLERS
 * =======================================================*/
const resetBtn = document.getElementById("globalReset");
if (resetBtn){
  resetBtn.addEventListener("click", ()=>{
    [...grandparents, ...parents].forEach(ch=>{
      ch.traits=null; ch.mutations=[]; ch.hasMutation=false; ch.manual=false;
      renderCharacter(ch.id, ch, true);
      updateTraitUI(ch.id, [], []);
    });
    const c = document.getElementById("childCanvas");
    if (c) c.getContext("2d").clearRect(0,0,c.width,c.height);
    const td = document.getElementById("traitsDisplay");
    if (td) td.innerHTML = "All reset.";
    scheduleDraw();
  });
}

function debugLogBreeding(eventType, p1, p2, gset, result){
  console.group(`🐾 ${eventType} RESULT`);
  console.log("Parent1:", p1?.id, p1?.traits, "Mut:", p1?.mutations);
  console.log("Parent2:", p2?.id, p2?.traits, "Mut:", p2?.mutations);
  if (Array.isArray(gset) && gset.length) gset.forEach((gp,i)=>console.log(" GP"+(i+1), gp.id, gp.traits, "Mut:", gp.mutations));
  else console.log("No grandparents used.");
  console.log("➡️ Result:", result.traits, "Mutation:", result.hasMutation, "Mutations:", result.mutations);
  console.groupEnd();
}

document.querySelectorAll(".breedBtn").forEach((btn,i)=>{
  btn.onclick = ()=>{
    const gpPair = i===0 ? [grandparents[0], grandparents[1]] : [grandparents[2], grandparents[3]];
    const valid  = gpPair.filter(gp => gp.manual || Array.isArray(gp.traits));
    const newParent = breed(gpPair[0], gpPair[1], valid);
    newParent.id = i===0 ? "p1" : "p2";
    parents[i] = newParent;
    debugLogBreeding("Grandparents ➜ Parent", gpPair[0], gpPair[1], valid, newParent);
    renderCharacter(newParent.id, newParent);
    updateTraitUI(newParent.id, newParent.traits, newParent.mutations);
    scheduleDraw();
  };
});

const finalBreedBtn = document.getElementById("finalBreed");
if (finalBreedBtn){
  finalBreedBtn.addEventListener("click", async ()=>{
    const validGP = grandparents.filter(gp => gp.manual || Array.isArray(gp.traits));
    const child = breed(parents[0], parents[1], validGP);
    debugLogBreeding("Parent ➜ Child", parents[0], parents[1], validGP, child);

    const c = document.getElementById("childCanvas");
    await renderToCanvasEl(c, child.traits, child.mutations);

    const td = document.getElementById("traitsDisplay");
    if (td){
      const muts = (child.mutations && child.mutations.length)
        ? ` <span class="mut-label">• Mutations:</span> ${child.mutations.map(m=>`<span class="mut-tag">${m}</span>`).join(" ")}`
        : "";
      td.innerHTML = `Child traits: ${Array.isArray(child.traits) ? child.traits.join(", ") : "None"}${muts}`;
    }
    scheduleDraw();
  });
}

/* =========================================================
 * 9) MOBILE-ONLY PAN/ZOOM VIEW — panning UI (toolbar hidden)
 * =======================================================*/
const IS_MOBILE = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
document.body.classList.toggle("mobile-zoom", IS_MOBILE);

const ZOOM_MIN=0.5, ZOOM_MAX=2.5;
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

/* NOTE: toggle pinch if needed */
const ALLOW_PINCH = true;

if (IS_MOBILE){
  let pointers=new Map(); let lastPan={x:0,y:0}; let pinchStart=null;

  stage.addEventListener("pointerdown", (e)=>{
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    lastPan = { x: e.clientX, y: e.clientY };
    if (idleConnectorTimer) clearTimeout(idleConnectorTimer);
  });

  stage.addEventListener("pointermove", (e)=>{
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});

    if (pointers.size===1){
      const dx=e.clientX-lastPan.x, dy=e.clientY-lastPan.y;
      origin.x+=dx; origin.y+=dy; lastPan = { x: e.clientX, y: e.clientY };
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
 * 10) CONNECTORS (SVG)
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
 * 11) INITIALIZATION
 * =======================================================*/
[...grandparents, ...parents].forEach(setupTraitDropdown);
document.querySelectorAll(".randomBtn").forEach((btn,i)=>btn.addEventListener("click", ()=>randomizeCharacter(grandparents[i])));

const ro = new ResizeObserver(()=>{ applyTransform(); scheduleDraw(); });
ro.observe(grid);

// initial draw
window.addEventListener("load", ()=>{ scheduleDraw(); });
window.addEventListener("resize", ()=>{ applyTransform(); scheduleDraw(); });
