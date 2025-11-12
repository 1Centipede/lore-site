// ===============================
// TRAITS + BASE SETUP
// ===============================
const allTraits = {
  horns: "images/trait_horns.png",
  tail: "images/trait_tail.png",
  ears: "images/trait_ears.png",
  wings: "images/trait_wings.png",
  mane: "images/trait_mane.png",
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

// Helper to ensure a char has an array when adding traits
function ensureTraitArray(char) {
  if (!Array.isArray(char.traits)) char.traits = [];
}

// ===============================
// RANDOMIZER
// ===============================
function randomizeCharacter(char) {
  ensureTraitArray(char);
  const traitKeys = Object.keys(allTraits);
  const traits = [];
  const traitCount = Math.floor(Math.random() * 4); // 0–3

  while (traits.length < traitCount) {
    const random = traitKeys[Math.floor(Math.random() * traitKeys.length)];
    if (!traits.includes(random)) traits.push(random);
  }

  const hasMutation = Math.random() < 0.15;
  char.traits = traits;
  char.hasMutation = hasMutation;
  char.manual = false;

  if (char.id === "p1") parents[0] = char;
  if (char.id === "p2") parents[1] = char;

  updateTraitButtons(char.id, char.traits);
  renderCharacter(char.id, char);
}

// ===============================
// BREED FUNCTION
// ===============================
function breed(p1, p2, grandparentsSet = []) {
  const ignoreGrandparents = Boolean(p1.manual || p2.manual);
  const allKeys = Object.keys(allTraits);
  const traitScores = new Map();
  allKeys.forEach(t => traitScores.set(t, 0));

  const sources = [];
  if (Array.isArray(p1.traits)) sources.push(p1.traits);
  if (Array.isArray(p2.traits)) sources.push(p2.traits);
  if (!ignoreGrandparents && Array.isArray(grandparentsSet)) {
    grandparentsSet.forEach(g => {
      if (Array.isArray(g.traits)) sources.push(g.traits);
    });
  }

  sources.forEach(arr => {
    [...new Set(arr)].forEach(tr => {
      if (traitScores.has(tr)) traitScores.set(tr, traitScores.get(tr) + 1);
    });
  });

  const familyMembers = [p1, p2].concat(ignoreGrandparents ? [] : grandparentsSet || []);
  const zeroTraitHistory = familyMembers.some(
    m => Array.isArray(m.traits) && m.traits.length === 0
  );

  const chosen = [];
  allKeys.forEach(t => {
    const count = traitScores.get(t) || 0;
    const p1Has = Array.isArray(p1.traits) && p1.traits.includes(t);
    const p2Has = Array.isArray(p2.traits) && p2.traits.includes(t);
    const bothGPHave =
      !ignoreGrandparents &&
      Array.isArray(grandparentsSet) &&
      grandparentsSet.length >= 2 &&
      grandparentsSet.every(g => Array.isArray(g.traits) && g.traits.includes(t));

      // If both parents have it, or both GPs have it (and no zero-trait history), always inherit
    if (bothGPHave || (p1Has && p2Has && !zeroTraitHistory)) {
      if (!chosen.includes(t)) chosen.push(t);
      return;
    }
    // If trait appears in 2+ family members, getting the trait if grandparents lack it
    if (count >= 2) {
      if (Math.random() < 0.95 && !chosen.includes(t)) chosen.push(t);
      return;
    }
    if (count === 1) {
      if (Math.random() < 0.55 && !chosen.includes(t)) chosen.push(t);
    }
  });

  const parentsDifferent =
    new Set([...(Array.isArray(p1.traits) ? p1.traits : []), ...(Array.isArray(p2.traits) ? p2.traits : [])]).size >
    Math.max((Array.isArray(p1.traits) ? p1.traits.length : 0), (Array.isArray(p2.traits) ? p2.traits.length : 0));
    // If parents have different traits, 15% chance to mix those into the child
  if (parentsDifferent && Math.random() < 0.15) {
    const pool = [...new Set([...(Array.isArray(p1.traits) ? p1.traits : []), ...(Array.isArray(p2.traits) ? p2.traits : [])])].filter(t => !chosen.includes(t));
    if (pool.length) chosen.push(pool[Math.floor(Math.random() * pool.length)]);
  }

  const parentsHaveTraits = Array.isArray(p1.traits) && p1.traits.length && Array.isArray(p2.traits) && p2.traits.length;
  if (!zeroTraitHistory && (p1.manual || p2.manual) && parentsHaveTraits && chosen.length === 0) {
    const union = [...new Set([...(Array.isArray(p1.traits) ? p1.traits : []), ...(Array.isArray(p2.traits) ? p2.traits : [])])];
    if (union.length) chosen.push(union[Math.floor(Math.random() * union.length)]);
  } else if (!zeroTraitHistory && chosen.length === 0 && Math.random() < 0.8) {
    const union = [
      ...new Set([
        ...(Array.isArray(p1.traits) ? p1.traits : []),
        ...(Array.isArray(p2.traits) ? p2.traits : []),
        ...((Array.isArray(grandparentsSet) ? grandparentsSet.flatMap(g => (Array.isArray(g.traits) ? g.traits : [])) : [])),
      ]),
    ];
    if (union.length) chosen.push(union[Math.floor(Math.random() * union.length)]);
  }

  const unique = [...new Set(chosen)].slice(0, 3);

  let hasMutation = false;
  if (
    (Array.isArray(p1.traits) && p1.hasMutation) ||
    (Array.isArray(p2.traits) && p2.hasMutation) ||
    (!ignoreGrandparents && Array.isArray(grandparentsSet) && grandparentsSet.some(g => g.hasMutation))
  ) {
    if (Math.random() < 0.1) {
      hasMutation = true;
      if (!unique.includes("mutation")) unique.push("mutation");
    }
  }

  return { traits: unique, hasMutation };
}

// ===============================
// RENDER (PIXEL-CRISP)
// ===============================
async function renderCharacter(canvasId, char, blank = false) {
  const el = document.querySelector(`#${canvasId} canvas`);
  const ctx = el.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, el.width, el.height);

  const actuallyBlank = blank || char.traits === null;
  if (!actuallyBlank) {
    const renderOrder = ["tail", "base", "wings", "ears", "horns", "mane"];
    for (const t of renderOrder) {
      if (t === "base") await drawImage(ctx, baseImage, el.width, el.height);
      else if (Array.isArray(char.traits) && char.traits.includes(t) && allTraits[t])
        await drawImage(ctx, allTraits[t], el.width, el.height);
    }
    if (char.hasMutation) {
      ctx.fillStyle = "rgba(255,100,255,0.3)";
      ctx.fillRect(0, 0, el.width, el.height);
    }
  }

  const info = document.querySelector(`#${canvasId} .traitText`);
  info.textContent = actuallyBlank
    ? ""
    : `Traits: ${Array.isArray(char.traits) ? char.traits.join(", ") : "None"} ${char.hasMutation ? "(mutation!)" : ""}`;
}

// ===============================
// DRAW IMAGE HELPER
// ===============================
function drawImage(ctx, src, w, h) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h);
      res();
    };
    img.src = src;
  });
}

// ===============================
// UPDATE TRAIT BUTTONS
// ===============================
function updateTraitButtons(charId, traits = []) {
  const container = document.querySelector(`#${charId} .dropdownTraits`);
  if (!container) return;

  container.querySelectorAll(".traitBtn").forEach(btn => {
    if ((btn.textContent === "None" && (!traits || traits.length === 0)) || traits.includes(btn.textContent)) {
      btn.classList.add("activeTrait");
    } else {
      btn.classList.remove("activeTrait");
    }
  });
}

// ===============================
// DROPDOWN SETUP
// ===============================
function setupTraitDropdown(char) {
  const container = document.querySelector(`#${char.id} .traitSelect`);
  const traitKeys = Object.keys(allTraits);
  container.innerHTML = "";

  const label = document.createElement("label");
  label.textContent = "Select Traits:";
  const dropdown = document.createElement("div");
  dropdown.classList.add("dropdownTraits");

  // --- NONE BUTTON ---
  const noneBtn = document.createElement("button");
  noneBtn.textContent = "None";
  noneBtn.classList.add("traitBtn");
  noneBtn.addEventListener("click", () => {
    char.traits = [];
    char.hasMutation = false;
    char.manual = true;
    if (char.id === "p1") parents[0] = char;
    if (char.id === "p2") parents[1] = char;

    flushDependents(char.id);
    renderCharacter(char.id, char, false);
    updateTraitButtons(char.id, char.traits);
  });
  dropdown.appendChild(noneBtn);

  // --- TRAIT BUTTONS ---
  traitKeys.forEach(trait => {
    const btn = document.createElement("button");
    btn.textContent = trait;
    btn.classList.add("traitBtn");

    btn.addEventListener("click", () => {
      ensureTraitArray(char);

      // Toggle trait
      if (char.traits.includes(trait)) char.traits = char.traits.filter(t => t !== trait);
      else char.traits.push(trait);

      char.manual = true;

      if (char.id === "p1") parents[0] = char;
      if (char.id === "p2") parents[1] = char;

      flushDependents(char.id);
      renderCharacter(char.id, char);
      updateTraitButtons(char.id, char.traits);
    });

    dropdown.appendChild(btn);
  });

  container.append(label, dropdown);
}

// ===============================
// FLUSH DEPENDENTS
// ===============================
function flushDependents(charId) {
  if (charId.startsWith("p")) {
    grandparents.forEach(gp => {
      gp.traits = null;
      gp.hasMutation = false;
      gp.manual = false;
      renderCharacter(gp.id, gp, true);
      updateTraitButtons(gp.id, []);
    });
  } else if (charId.startsWith("gp")) {
    parents.forEach(p => {
      p.traits = null;
      p.hasMutation = false;
      p.manual = false;
      renderCharacter(p.id, p, true);
      updateTraitButtons(p.id, []);
    });
  }
}

// ===============================
// GLOBAL RESET BUTTON
// ===============================
document.getElementById("globalReset")?.addEventListener("click", () => {
  [...grandparents, ...parents].forEach(ch => {
    ch.traits = null;
    ch.hasMutation = false;
    ch.manual = false;
    renderCharacter(ch.id, ch, true);
    updateTraitButtons(ch.id, []);
  });

  const childCanvas = document.getElementById("childCanvas");
  if (childCanvas) childCanvas.getContext("2d").clearRect(0, 0, childCanvas.width, childCanvas.height);
  document.getElementById("traitsDisplay").textContent = "All reset.";
});

// ===============================
// BREED BUTTONS + DEBUG
// ===============================
function debugLogBreeding(eventType, p1, p2, gset, result) {
  console.group(`🐾 ${eventType} RESULT`);
  console.log("Parent1:", p1.id, p1.traits, "Manual:", p1.manual);
  console.log("Parent2:", p2.id, p2.traits, "Manual:", p2.manual);
  if (Array.isArray(gset) && gset.length) gset.forEach((gp, i) => console.log(" GP" + (i + 1), gp.id, gp.traits));
  else console.log("No grandparents used.");
  console.log("➡️ Result:", result.traits, "Mutation:", result.hasMutation);
  console.groupEnd();
}

document.querySelectorAll(".breedBtn").forEach((btn, i) => {
  btn.onclick = () => {
    const gpPair = i === 0 ? [grandparents[0], grandparents[1]] : [grandparents[2], grandparents[3]];
    const valid = gpPair.filter(gp => gp.manual || (Array.isArray(gp.traits) && gp.traits.length));
    const newParent = breed(gpPair[0], gpPair[1], valid);
    newParent.id = i === 0 ? "p1" : "p2";
    parents[i] = newParent;
    debugLogBreeding("Grandparents ➜ Parent", gpPair[0], gpPair[1], valid, newParent);
    renderCharacter(newParent.id, newParent);
    updateTraitButtons(newParent.id, newParent.traits);
  };
});

document.getElementById("finalBreed").onclick = async () => {
  const validGP = grandparents.filter(gp => gp.manual || (Array.isArray(gp.traits) && gp.traits.length));
  const child = breed(parents[0], parents[1], validGP);
  debugLogBreeding("Parent ➜ Child", parents[0], parents[1], validGP, child);

  const c = document.getElementById("childCanvas");
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.imageSmoothingEnabled = false;
  const order = ["tail", "base", "wings", "ears", "horns", "mane"];
  for (const t of order) {
    if (t === "base") await drawImage(ctx, baseImage, c.width, c.height);
    else if (Array.isArray(child.traits) && child.traits.includes(t) && allTraits[t]) await drawImage(ctx, allTraits[t], c.width, c.height);
  }
  if (child.hasMutation) {
    ctx.fillStyle = "rgba(255,100,255,0.3)";
    ctx.fillRect(0, 0, c.width, c.height);
  }
  document.getElementById("traitsDisplay").textContent =
    `Child traits: ${Array.isArray(child.traits) ? child.traits.join(", ") : "None"} ${child.hasMutation ? "(mutation!)" : ""}`;
  updateTraitButtons("childCanvas", child.traits);
};

// ===============================
// INIT
// ===============================
[...grandparents, ...parents].forEach(setupTraitDropdown);
document.querySelectorAll(".randomBtn").forEach((btn, i) =>
  btn.addEventListener("click", () => randomizeCharacter(grandparents[i]))
);
