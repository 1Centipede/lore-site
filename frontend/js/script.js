const allTraits = {
  horns: "images/trait_horns.png",
  tail: "images/trait_tail.png",
  ears: "images/trait_ears.png",
  wings: "images/trait_wings.png",
  mane: "images/trait_mane.png",
};

const baseImage = "images/base.png";

let grandparents = [
  { id: "gp1", traits: [], hasMutation: false, manual: false },
  { id: "gp2", traits: [], hasMutation: false, manual: false },
  { id: "gp3", traits: [], hasMutation: false, manual: false },
  { id: "gp4", traits: [], hasMutation: false, manual: false },
];

let parents = [
  { id: "p1", traits: [], hasMutation: false, manual: false },
  { id: "p2", traits: [], hasMutation: false, manual: false },
];

// --- RANDOMIZE CHARACTER ---
function randomizeCharacter(char) {
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

  updateTraitButtons(char.id, traits);
  renderCharacter(char.id, char);
}

// --- BREED FUNCTION ---
function breed(p1, p2, grandparentsSet) {
  const traits = [];
  const allTraitsKeys = Object.keys(allTraits);

  const side1Traits = [p1.traits, grandparentsSet[0]?.traits || [], grandparentsSet[1]?.traits || []].flat();
  const side2Traits = [p2.traits, grandparentsSet[2]?.traits || [], grandparentsSet[3]?.traits || []].flat();

  const parentCommons = p1.traits.filter(t => p2.traits.includes(t));
  parentCommons.forEach(t => {
    if (!traits.includes(t)) {
      const side1Has = side1Traits.includes(t);
      const side2Has = side2Traits.includes(t);
      const chance = side1Has && side2Has ? 0.95 : 0.5;
      if (Math.random() < chance) traits.push(t);
    }
  });

  allTraitsKeys.forEach(t => {
    if (!traits.includes(t)) {
      const side1Has = side1Traits.includes(t);
      const side2Has = side2Traits.includes(t);
      const chance = side1Has && side2Has ? 0.7 : (side1Has || side2Has ? 0.4 : 0);
      if (Math.random() < chance) traits.push(t);
    }
  });

  const zeroTraitHistory = [p1, p2, ...grandparentsSet].some(x => x.traits.length === 0);
  let finalCount = zeroTraitHistory ? Math.floor(Math.random() * 4) : Math.floor(Math.random() * 3) + 1;
  if (!zeroTraitHistory && finalCount === 0) finalCount = 1;

  while (traits.length > finalCount) traits.pop();

  let hasMutation = false;
  if (p1.hasMutation || p2.hasMutation || grandparentsSet.some(g => g.hasMutation)) {
    if (Math.random() < 0.2) {
      hasMutation = true;
      if (!traits.includes("mutation")) traits.push("mutation");
    }
  }

  return { traits, hasMutation };
}

// --- RENDER CHARACTER ---
async function renderCharacter(canvasId, char, blank = false) {
  const el = document.querySelector(`#${canvasId} canvas`);
  const ctx = el.getContext("2d");
  ctx.clearRect(0, 0, el.width, el.height);

  if (!blank) {
    const renderOrder = ["tail", "base", "wings", "ears", "horns", "mane"];
    for (const t of renderOrder) {
      if (t === "base") await drawImage(ctx, baseImage, el.width, el.height);
      else if (char.traits.includes(t) && allTraits[t]) await drawImage(ctx, allTraits[t], el.width, el.height);
    }

    if (char.hasMutation) {
      ctx.fillStyle = "rgba(255, 100, 255, 0.3)";
      ctx.fillRect(0, 0, el.width, el.height);
    }
  }

  const info = document.querySelector(`#${canvasId} .traitText`);
  info.textContent = blank
    ? ""
    : `Traits: ${char.traits.join(", ") || "None"} ${char.hasMutation ? "(mutation!)" : ""}`;
}

function drawImage(ctx, src, w, h) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h);
      resolve();
    };
    img.src = src;
  });
}

// --- TRAIT DROPDOWN HANDLING ---
function setupTraitDropdown(char) {
  const container = document.querySelector(`#${char.id} .traitSelect`);
  const traitKeys = Object.keys(allTraits);
  container.innerHTML = "";

  const label = document.createElement("label");
  label.textContent = "Select Traits:";

  const dropdown = document.createElement("div");
  dropdown.classList.add("dropdownTraits");

  // "Reset" option -> completely blank
  const resetBtn = document.createElement("button");
  resetBtn.textContent = "Reset";
  resetBtn.classList.add("resetButton");
  resetBtn.addEventListener("click", () => {
    char.traits = [];
    char.hasMutation = false;
    char.manual = false;

    flushDependents(char.id, false);

    renderCharacter(char.id, char, true); // blank
    updateTraitButtons(char.id, char.traits);
  });
  dropdown.appendChild(resetBtn);

  // "None" option -> base image only
  const noneBtn = document.createElement("button");
  noneBtn.textContent = "None";
  noneBtn.addEventListener("click", () => {
    char.traits = [];
    char.hasMutation = false;
    char.manual = true; // manual selection

    renderCharacter(char.id, char, false); // base image only
    updateTraitButtons(char.id, char.traits);
  });
  dropdown.appendChild(noneBtn);

  // Trait toggle buttons
  traitKeys.forEach(trait => {
    const btn = document.createElement("button");
    btn.textContent = trait;
    btn.classList.add("traitBtn");
    btn.addEventListener("click", () => {
      if (char.traits.includes(trait)) {
        char.traits = char.traits.filter(t => t !== trait);
      } else {
        char.traits.push(trait);
      }

      char.manual = true;
      flushDependents(char.id, true);

      renderCharacter(char.id, char);
      updateTraitButtons(char.id, char.traits);
    });
    dropdown.appendChild(btn);
  });

  container.appendChild(label);
  container.appendChild(dropdown);
}

function updateTraitButtons(charId, selectedTraits) {
  const container = document.querySelector(`#${charId} .traitSelect`);
  container.querySelectorAll(".traitBtn").forEach(btn => {
    if (selectedTraits.includes(btn.textContent)) btn.classList.add("activeTrait");
    else btn.classList.remove("activeTrait");
  });
}

// --- FLUSH DEPENDENTS ---
function flushDependents(charId, manualSelected) {
  if (charId.startsWith("p")) {
    // Parent manually selected -> flush grandparents completely blank
    grandparents.forEach(gp => {
      gp.traits = [];
      gp.hasMutation = false;
      gp.manual = false;
      renderCharacter(gp.id, gp, true); // <-- blank = true
      updateTraitButtons(gp.id, gp.traits);
    });
  } else if (charId.startsWith("gp")) {
    // Grandparent manually selected -> flush parents completely blank
    parents.forEach(p => {
      p.traits = [];
      p.hasMutation = false;
      p.manual = false;
      renderCharacter(p.id, p, true); // <-- blank = true
      updateTraitButtons(p.id, p.traits);
    });
  }
}

// --- EVENT LISTENERS ---
document.querySelectorAll(".randomBtn").forEach((btn, i) => {
  btn.addEventListener("click", () => randomizeCharacter(grandparents[i]));
});

document.querySelectorAll(".breedBtn").forEach((btn, i) => {
  btn.addEventListener("click", () => {
    const gpPair = i === 0 ? [grandparents[0], grandparents[1]] : [grandparents[2], grandparents[3]];

    // Only include grandparents if they have traits or were manually selected
    const validGPs = gpPair.filter(gp => gp.traits.length > 0 || gp.manual);

    const newParent = breed(
      gpPair[0],
      gpPair[1],
      validGPs.length === 2 ? validGPs : []
    );

    newParent.id = i === 0 ? "p1" : "p2";
    parents[i] = newParent;
    renderCharacter(newParent.id, newParent);
  });
});

document.getElementById("finalBreed").addEventListener("click", async () => {
  const child = breed(parents[0], parents[1], grandparents);
  const canvas = document.getElementById("childCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const renderOrder = ["tail", "base", "wings", "ears", "horns", "mane"];
  for (const t of renderOrder) {
    if (t === "base") await drawImage(ctx, baseImage, canvas.width, canvas.height);
    else if (child.traits.includes(t) && allTraits[t]) await drawImage(ctx, allTraits[t], canvas.width, canvas.height);
  }

  if (child.hasMutation) {
    ctx.fillStyle = "rgba(255, 100, 255, 0.3)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  document.getElementById("traitsDisplay").textContent =
    `Child traits: ${child.traits.join(", ") || "None"} ${child.hasMutation ? "(mutation!)" : ""}`;
});

// --- INIT ---
[...grandparents, ...parents].forEach(setupTraitDropdown);
