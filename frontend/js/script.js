const allTraits = {
  horns: "images/trait_horns.png",
  tail: "images/trait_tail.png",
  ears: "images/trait_ears.png",
  wings: "images/trait_wings.png",
  mane: "images/trait_mane.png",
};

const baseImage = "images/base.png";

// --- CHARACTER DATA ---
let grandparents = [
  { id: "gp1", traits: [], hasMutation: false },
  { id: "gp2", traits: [], hasMutation: false },
  { id: "gp3", traits: [], hasMutation: false },
  { id: "gp4", traits: [], hasMutation: false },
];

let parents = [
  { id: "p1", traits: [], hasMutation: false },
  { id: "p2", traits: [], hasMutation: false },
];

// --- RANDOM TRAITS ---
function randomizeCharacter(char) {
  const traitKeys = Object.keys(allTraits);
  const traits = [];

  // Decide how many traits: 0-3
  const traitCount = Math.floor(Math.random() * 4); // 0,1,2,3

  while (traits.length < traitCount) {
    const random = traitKeys[Math.floor(Math.random() * traitKeys.length)];
    if (!traits.includes(random)) traits.push(random);
  }

  const hasMutation = Math.random() < 0.15;

  char.traits = traits;
  char.hasMutation = hasMutation;

  renderCharacter(char.id, char);
}

// --- BREED FUNCTION ---
function breed(p1, p2, grandparentsSet) {
  const traits = [];
  const allTraitsKeys = Object.keys(allTraits);

  // --- Determine sides dynamically ---
  const side1Traits = [p1.traits, ...(grandparentsSet[0]?.traits ? [grandparentsSet[0].traits] : []), ...(grandparentsSet[1]?.traits ? [grandparentsSet[1].traits] : [])].flat();
  const side2Traits = [p2.traits, ...(grandparentsSet[2]?.traits ? [grandparentsSet[2].traits] : []), ...(grandparentsSet[3]?.traits ? [grandparentsSet[3].traits] : [])].flat();

  // --- PARENT COMMONS: high chance but not guaranteed ---
  const parentCommons = p1.traits.filter(t => p2.traits.includes(t));
  parentCommons.forEach(t => {
    if (!traits.includes(t)) {
      const side1Has = side1Traits.includes(t);
      const side2Has = side2Traits.includes(t);
      const chance = side1Has && side2Has ? 0.95 : 0.5;
      if (Math.random() < chance) traits.push(t);
    }
  });

  // --- INDIVIDUAL TRAITS: chance depends on which side has it ---
  allTraitsKeys.forEach(t => {
    if (!traits.includes(t)) {
      const side1Has = side1Traits.includes(t);
      const side2Has = side2Traits.includes(t);
      const chance = side1Has && side2Has ? 0.7 : (side1Has || side2Has ? 0.4 : 0);
      if (Math.random() < chance) traits.push(t);
    }
  });

  // Limit traits to 1-3, small chance of 0
  let finalCount = Math.floor(Math.random() * 3) + 1; // 1-3
  if (Math.random() < 0.05) finalCount = 0;
  while (traits.length > finalCount) traits.pop();

  // --- MUTATION LOGIC ---
  let hasMutation = false;
  if (p1.hasMutation || p2.hasMutation || grandparentsSet.some(g => g.hasMutation)) {
    if (Math.random() < 0.2) {
      hasMutation = true;
      if (!traits.includes("mutation")) traits.push("mutation");
    }
  }

  return { traits, hasMutation };
}

// --- RENDER FUNCTION ---
async function renderCharacter(canvasId, char) {
  const el = document.querySelector(`#${canvasId} canvas`);
  const ctx = el.getContext("2d");
  ctx.clearRect(0, 0, el.width, el.height);

  // --- FIXED LAYER ORDER ---
  const renderOrder = ["base", "tail", "wings", "ears", "horns", "mane"];
  for (const t of renderOrder) {
    if (t === "base") await drawImage(ctx, baseImage, el.width, el.height);
    else if (char.traits.includes(t) && allTraits[t]) await drawImage(ctx, allTraits[t], el.width, el.height);
  }

  if (char.hasMutation) {
    ctx.fillStyle = "rgba(255, 100, 255, 0.3)";
    ctx.fillRect(0, 0, el.width, el.height);
  }

  const info = document.querySelector(`#${canvasId} .traitText`);
  info.textContent = `Traits: ${char.traits.join(", ")} ${char.hasMutation ? "(mutation!)" : ""}`;
}

function drawImage(ctx, src, w, h) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h);
      resolve();
    };
    img.src = src;
  });
}

// --- EVENT HANDLERS ---
// Grandparents: randomize
document.querySelectorAll(".randomBtn").forEach((btn, i) => {
  btn.addEventListener("click", () => randomizeCharacter(grandparents[i]));
});

// Breed GPs → Parents
document.querySelectorAll(".breedBtn").forEach((btn, i) => {
  btn.addEventListener("click", () => {
    const gpPair = i === 0 ? [grandparents[0], grandparents[1]] : [grandparents[2], grandparents[3]];
    const newParent = breed(gpPair[0], gpPair[1], gpPair); // only 2 grandparents
    newParent.id = i === 0 ? "p1" : "p2";
    parents[i] = newParent;
    renderCharacter(newParent.id, newParent);
  });
});

// Breed Parents → Child
document.getElementById("finalBreed").addEventListener("click", async () => {
  const child = breed(parents[0], parents[1], grandparents); // 4 grandparents
  const canvas = document.getElementById("childCanvas");
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const renderOrder = ["base", "tail", "wings", "ears", "horns", "mane"];
  for (const t of renderOrder) {
    if (t === "base") await drawImage(ctx, baseImage, canvas.width, canvas.height);
    else if (child.traits.includes(t) && allTraits[t]) await drawImage(ctx, allTraits[t], canvas.width, canvas.height);
  }

  if (child.hasMutation) {
    ctx.fillStyle = "rgba(255, 100, 255, 0.3)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  document.getElementById("traitsDisplay").textContent =
    `Child traits: ${child.traits.join(", ")} ${child.hasMutation ? "(mutation!)" : ""}`;
});
