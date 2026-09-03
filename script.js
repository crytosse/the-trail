/* ============================================================
   THE TRAIL — game logic
   ------------------------------------------------------------
   1. pixelSprite(): turn an ASCII grid into crisp pixel art
   2. Title screen scenery (sun, clouds, trees, stars)
   3. Title -> map transition
   4. The overworld: nodes, trail path, walkable hiker
   5. Level dialogs (each project is a "level")
   ============================================================ */

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------
   1. PIXEL SPRITE RENDERER
   grid: array of equal-length strings; each char -> a color in `palette`.
   '.' (or any char missing from palette) = transparent.
   Returns an <svg> element scaled by `scale` px per pixel.
------------------------------------------------------------ */
function pixelSprite(grid, palette, scale = 4) {
  const rows = grid.length;
  const cols = grid[0].length;
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${cols} ${rows}`);
  svg.setAttribute("width", cols * scale);
  svg.setAttribute("height", rows * scale);
  svg.setAttribute("shape-rendering", "crispEdges");
  svg.classList.add("sprite");
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const color = palette[grid[y][x]];
      if (!color) continue;
      const r = document.createElementNS(svgNS, "rect");
      r.setAttribute("x", x); r.setAttribute("y", y);
      r.setAttribute("width", 1); r.setAttribute("height", 1);
      r.setAttribute("fill", color);
      svg.appendChild(r);
    }
  }
  return svg;
}

/* Build a filled pixel disc (used for the sun) */
function discGrid(size) {
  const c = (size - 1) / 2, r = size / 2 - 0.4, rows = [];
  for (let y = 0; y < size; y++) {
    let row = "";
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      row += d > r ? "." : d < r * 0.5 ? "w" : "y";
    }
    rows.push(row);
  }
  return rows;
}

/* ------------------------------------------------------------
   SPRITE DEFINITIONS
------------------------------------------------------------ */
const HIKER = [
  "....OOOO....",
  "...OHHHHHO..",
  "..OHHHHHHO..",
  "...OFFFFO...",
  "...OFFFFO...",
  "..KOSSSSSO..",
  ".KKOSSSSSO..",
  ".KKOSSSSSO..",
  "..OSSSSSSO..",
  "..OSSSSSSO..",
  "..OPPPPPPO..",
  "..OPP..PPO..",
  "..OBB..BBO..",
  "..OBB..BBO..",
];
const HIKER_PAL = {
  O: "#1a1f14", H: "#7a4e28", F: "#f0c9a0",
  S: "#3f6d9e", P: "#242430", B: "#4a3320", K: "#8a5a2b",
};

const TREE = [
  "....t....",
  "...ttt...",
  "..ttttt..",
  "..ttttt..",
  ".ttttttt.",
  ".ttttttt.",
  "ttttttttt",
  "ttttttttt",
  "....o....",
  "....o....",
];
const TREE_PAL = { t: "#1f4a34", o: "#5a3a1c" };

const CLOUD = [
  "....wwww....",
  "..wwwwwwww..",
  ".wwwwwwwwww.",
  "wwwwwwwwwwww",
  ".wwwwwwww...",
];
const CLOUD_PAL = { w: "#ffffff" };

const SUN_PAL = { y: "#ffb347", w: "#ffe08a" };

/* ------------------------------------------------------------
   2. TITLE SCREEN SCENERY
------------------------------------------------------------ */
(function buildTitleScenery() {
  // Sun
  document.getElementById("sun").appendChild(pixelSprite(discGrid(20), SUN_PAL, 7));

  // Clouds
  const clouds = document.getElementById("clouds");
  const c1 = pixelSprite(CLOUD, CLOUD_PAL, 6); c1.classList.add("cloud", "c1");
  const c2 = pixelSprite(CLOUD, CLOUD_PAL, 4); c2.classList.add("cloud", "c2");
  clouds.append(c1, c2);

  // Trees along the horizon
  const treeline = document.getElementById("treeline");
  const count = Math.max(6, Math.floor(window.innerWidth / 150));
  for (let i = 0; i < count; i++) {
    const t = pixelSprite(TREE, TREE_PAL, i % 3 === 0 ? 7 : 5);
    treeline.appendChild(t);
  }

  // Stars (only in the upper sky), skipped if reduced motion still fine to show
  const stars = document.getElementById("stars");
  for (let i = 0; i < 40; i++) {
    const s = document.createElement("div");
    s.className = "star";
    s.style.left = Math.random() * 100 + "%";
    s.style.top = Math.random() * 45 + "%";
    s.style.animationDelay = (i % 6) * 0.25 + "s";
    stars.appendChild(s);
  }
})();

/* Subtle parallax on the sky (mouse) */
if (!reduceMotion) {
  const sky = document.querySelector(".sky");
  window.addEventListener("mousemove", (e) => {
    if (document.getElementById("title").classList.contains("is-hidden")) return;
    const dx = (e.clientX / window.innerWidth - 0.5) * 14;
    const dy = (e.clientY / window.innerHeight - 0.5) * 10;
    sky.style.transform = `translate(${dx}px, ${dy}px)`;
  });
}

/* ------------------------------------------------------------
   AREAS (biomes) — the trail climbs through these in order.
   Each has an x-range on the 1000-wide map + a display label.
------------------------------------------------------------ */
const AREAS = [
  { id: "forest",    label: "FOREST OF FIRSTS", cx: 165, cy: 110 },
  { id: "desert",    label: "THE DESERT",       cx: 470, cy: 585 },
  { id: "mountains", label: "THE MOUNTAINS",    cx: 815, cy: 205 },
  { id: "clouds",    label: "THE CLOUDS",       cx: 690, cy: 34 },
];

/* ------------------------------------------------------------
   PROJECT DATA — edit here to add/change waypoints ("levels")
   area: forest | desert | mountains | clouds
   x,y are positions on a 1000 x 620 map.
------------------------------------------------------------ */
const NODES = [
  // ===== FOREST OF FIRSTS =====
  {
    id: "basecamp", area: "forest", type: "about", x: 165, y: 212, label: "BASECAMP",
    quip: `The finance committee managed a portfolio with $15 million in assets. I still can't believe they let "kids" do that...`,
    level: {
      tag: "FOREST OF FIRSTS · SCHOOL",
      title: "Basecamp",
      role: "B.S. Marketing · Bloomsburg University · 2012–2016",
      body: "Studied marketing. Got involved in student government. Learned enough to know I wanted to make things for a living.",
      chips: ["CGA Executive Board", "Senior Class Secretary", "Finance Committee"],
      features: [],
    },
  },
  {
    id: "breaking", area: "forest", type: "breaking", x: 250, y: 132, label: "BREAKING TRAIL",
    quip: `No joke, I "walked" the robot dogs. I still consider it my weirdest job.`,
    level: {
      tag: "FOREST OF FIRSTS · FIRST STEPS",
      title: "Breaking Trail",
      role: "2016–2019",
      body: `My "career trajectory" was a little... wild. Houston Chamber of Commerce → Philadelphia Ad Agency → ROBOT DOGS?!`,
      image: "img/breaking-collage.jpg",
      roles: [
        {
          co: "GREATER HOUSTON PARTNERSHIP",
          meta: "Public Policy · 2016–2018",
          desc: `Started as an intern. Became an assistant. Then a coordinator. Helped host public policy committees and did work in Texas I'm still proud of today — pushing for early-childhood-education funding, helping repeal the "Bathroom Bill", and adding to Houston's incredible economic growth through pro-business policies.`,
        },
        {
          co: "KARMA AGENCY (now Material)",
          meta: "Account Management · 2018–2019",
          desc: `This is the pivot. I left public policy and moved to Philadelphia, entering the advertising & marketing world with clients like Nike, the New York Philharmonic & the UVA Darden School of Business.`,
        },
        {
          co: "GHOST ROBOTICS",
          meta: "Marketing Consultant · 2019",
          desc: `I worked for a fledgling company making quadruped unmanned ground vehicles. That's robot dogs. 🐕`,
        },
      ],
      outro: "In all three roles, I embraced communications, marketing, editing & copywriting.",
      chips: ["Public policy", "Account management", "Marketing & copy"],
      features: [],
    },
  },

  // ===== THE DESERT =====
  {
    id: "mainquest", area: "desert", type: "mainquest", x: 360, y: 186, label: "THE MAIN QUEST",
    quip: `With no experience, I moved from Philly to Utah to start a career in writing. That's when my main quest started.`,
    level: {
      tag: "DESERT OF DOING · THE MAIN QUEST",
      title: "The Main Quest",
      role: "Backcountry · 2019–Present",
      body: `I came to Backcountry as a writer. Seven years, four roles, hundreds of projects, and a whole lot of time outside later, I'm leading the team responsible for telling its stories.`,
      image: "img/mq/hero-billboard.jpg",
      progression: ["Writer", "Senior Copywriter", "Manager of Copy", "Editorial Manager"],
      stats: [
        { num: "7+", label: "YEARS" },
        { num: "4", label: "ROLES" },
        { num: "100s", label: "PROJECTS" },
        { num: "3+", label: "BRANDS" },
        { num: "Dozens", label: "CHANNELS" },
        { num: "1", label: "CAREER-DEFINING CHAPTER" },
      ],
      markersIntro: "Three trail markers along the way — each opens its own field guide:",
      markers: [
        { title: "STORIES", sub: "Email, film, social & the writing behind them", color: "#c0432f", href: "pdfs/The-Main-Quest-Stories.pdf?v=4" },
        { title: "IN THE WILD", sub: "Retail, print & the physical world", color: "#6fbf4a", href: "pdfs/The-Main-Quest-In-The-Wild.pdf?v=2" },
        { title: "LEADERSHIP", sub: "Building teams & creative direction", color: "#4c8ff0", href: "pdfs/The-Main-Quest-Leadership.pdf?v=2" },
      ],
    },
  },
  {
    id: "sidequests", area: "desert", type: "freelance", x: 450, y: 322, label: "SIDE QUESTS",
    level: {
      tag: "DESERT OF DOING · FREELANCE",
      title: "Side Quests",
      role: "Freelance · copywriter & creative strategist",
      body: "After 10 years as a writer, I've met some friends along the way! I like to stay in touch and pick up projects to help them out. I've worked with iconic brands like Dickies, HYER & Gnarly Nutrition.",
      chips: ["Dickies", "HYER", "Gnarly Nutrition"],
      image: "img/sidequests-hero.jpg",
      links: [{ label: "OPEN THE CASE STUDY ▶", href: "pdfs/Side-Quests-Freelance.pdf" }],
    },
  },
  {
    id: "campfire", area: "desert", type: "book", x: 330, y: 440, label: "CAMPFIRE STORIES",
    quip: `I read 10,000 of Teddy Roosevelt's letters. He still hasn't written back.`,
    level: {
      tag: "DESERT OF DOING · A BOOK I WROTE",
      title: "The Last Letters of Theodore Roosevelt",
      role: "A full-length book I wrote & researched",
      body: "No campfire tale here — this one's a real, published book with my name on the cover. After the Library of Congress released 300,000 of Theodore Roosevelt's documents in 2019, I read more than 10,000 letters, transcribed my favorites, and wrote a full-length collection — a guided window on the early 1900s. You can hold it in your hands.",
      chips: ["Published book", "Author", "Archival research"],
      features: [
        "300,000-document Library of Congress archive",
        "10,000+ letters read & transcribed by hand",
        "A full-length book — published & on Amazon",
      ],
      image: "img/campfire-hero.jpg",
      links: [
        { label: "FIND IT ON AMAZON ▶", href: "https://www.amazon.com/Last-Letters-Theodore-Roosevelt-1918-1919/dp/B0C9SPDZ22" },
        { label: "OPEN CASE STUDY ▶", href: "pdfs/The-Last-Letters-Case-Study.pdf?v=5" },
      ],
    },
  },

  // ===== THE MOUNTAINS =====
  {
    id: "youtube", area: "mountains", type: "youtube", x: 600, y: 372, label: "BEYOND THE 9-5",
    quip: `I once let ChatGPT pick where to dig for gold. It went about how you'd expect.`,
    level: {
      tag: "MOUNTAINS OF MAKING · ADVENTURE ALEX",
      title: "Adventure Alex",
      role: "Creator, filmmaker & storyteller",
      body: "Adventure Alex is my independently produced YouTube channel built around a simple idea: turn curiosity into adventure. From backpacking remote mountain ranges and searching for gold to fishing alpine lakes and letting AI choose where I go next, every video starts with a question, challenge, or place worth exploring.<br><br>I handle the entire creative process—from concepting and trip planning to filming, drone work, writing, editing, packaging, and publishing—building each adventure into a story designed to entertain well beyond the experience itself.",
      image: "img/youtube-hero.jpg",
      chips: ["Creative Direction", "Filmmaking", "Storytelling"],
      features: [
        "3,100+ subscribers and growing",
        "500,000+ views across long-form & short-form content",
        "Highly engaged community built around adventure, curiosity & exploration",
        "Concept, writing, cinematography, editing & creative direction—all independently produced",
      ],
      links: [
        { label: "WATCH ON YOUTUBE ▶", href: "https://www.youtube.com/@alexmoliski" },
        { label: "OPEN THE CASE STUDY ▶", href: "pdfs/Adventure-Alex-Case-Study.pdf" },
      ],
    },
  },
  {
    id: "lens", area: "mountains", type: "photo", x: 670, y: 211, label: "A NEW LENS",
    quip: `Half a billion views… and I still can't make my phone photos look good.`,
    level: {
      tag: "MOUNTAINS OF MAKING · PHOTOGRAPHY",
      title: "A New Lens",
      role: "Photography & motion",
      body: "I take photos and videos. Then I give them away.<br><br>What started as a way to give back to the creative community has grown into nearly 500 million views, millions of downloads, awards, homepage features, and my work being used by people all over the world.",
      image: "img/lens-hero.jpg",
      chips: ["Unsplash", "Pexels", "500M+ views"],
      features: [
        "Unsplash Photo of the Year runner-up (2025)",
        "500M+ views across platforms",
      ],
      links: [
        { label: "OPEN THE LOOKBOOK ▶", href: "pdfs/A-New-Lens-Lookbook.pdf" },
        { label: "SEE THE UNSPLASH AWARD ▶", href: "https://unsplash.com/awards/2025/iXa4J7j_tGY" },
        { label: "SEE MORE ON INSTAGRAM ▶", href: "https://instagram.com/alexmoliski" },
      ],
    },
  },

  // ===== THE CLOUDS =====
  {
    id: "above", area: "clouds", type: "cloud", x: 810, y: 341, label: "ABOVE & BEYOND",
    quip: `I put music on Spotify. Please clap. Or, uh, stream.`,
    level: {
      tag: "CLOUDS OF CREATION · PASSION PROJECTS",
      title: "Above & Beyond",
      role: "Passion projects & experiments",
      body: `Some of my favorite projects started with, "I wonder if I could do that."<br><br>From releasing music on Spotify and composing for an award-winning interactive website to building apps, websites, and plugins with AI, I'm always looking for an excuse to learn something new, make something weird, or head somewhere I haven't been before.`,
      image: "img/above-hero.jpg",
      chips: ["Music on Spotify", "Interactive", "AI builds"],
      markersIntro: "A couple of chapters worth wandering into:",
      markers: [
        { title: "A TRAIL TALE", sub: "Hear my music on a Webby award-winning website", color: "var(--accent)", href: "https://atrailtale.com" },
        { title: "HERD HUB", sub: "The internal platform I built — case study", color: "#6fbf4a", href: "pdfs/Herd-Hub-Case-Study.pdf" },
      ],
    },
  },
  {
    id: "summit", area: "clouds", type: "summit", x: 860, y: 186, label: "THE SUMMIT",
    quip: `Thanks for getting to know me. You made it to the top.`,
    level: {
      tag: "CLOUDS OF CREATION · THE SUMMIT",
      title: "The Summit — say hi",
      role: "Let's find the next trail",
      body: "Have a story to tell or a project in mind? Reach out — happy to talk shop, gear, or the next expedition.",
      chips: ["Open to work"],
      features: [],
      note: "Prefer to copy it? Alex@moliski.net",
      links: [
        { label: "EMAIL ▶", href: "mailto:Alex@moliski.net" },
        { label: "INSTAGRAM ▶", href: "https://instagram.com/alexmoliski" },
        { label: "LINKEDIN ▶", href: "https://www.linkedin.com/in/alexander-moliski/" },
      ],
    },
  },
];


/* ------------------------------------------------------------
   3. TITLE -> MAP TRANSITION
------------------------------------------------------------ */
const titleScreen = document.getElementById("title");
const mapScreen = document.getElementById("map-screen");
const world = document.getElementById("world");
let mapBuilt = false;

function startTrail() {
  titleScreen.classList.add("is-hidden");
  titleScreen.setAttribute("aria-hidden", "true");
  mapScreen.classList.remove("is-hidden");
  mapScreen.setAttribute("aria-hidden", "false");
  if (!mapBuilt) { buildMap(); mapBuilt = true; }
  setTimeout(() => world.focus(), 50);
}
function backToTitle() {
  mapScreen.classList.add("is-hidden");
  mapScreen.setAttribute("aria-hidden", "true");
  titleScreen.classList.remove("is-hidden");
  titleScreen.setAttribute("aria-hidden", "false");
}

document.getElementById("start-btn").addEventListener("click", startTrail);
document.getElementById("title-btn").addEventListener("click", backToTitle);

/* Quick-contact card — reachable any time from the "SAY HI" button in the HUD,
   so folks don't have to dig into a stop to find how to reach me. */
const CONTACT = {
  tag: "CONTACT",
  title: "Say Hi &#128075;",
  role: "Let's make something together",
  body: "Got a project, a role, a question — or just want to talk shop? Email's the fastest way to reach me. I read every one.",
  note: "Prefer to copy it? Alex@moliski.net",
  links: [
    { label: "EMAIL ME &#9654;", href: "mailto:Alex@moliski.net" },
    { label: "LINKEDIN &#9654;", href: "https://www.linkedin.com/in/alexander-moliski/" },
    { label: "INSTAGRAM &#9654;", href: "https://instagram.com/alexmoliski" },
    { label: "YOUTUBE &#9654;", href: "https://www.youtube.com/@alexmoliski" },
  ],
};
document.getElementById("sayhi-btn").addEventListener("click", () => openLevel(null, CONTACT));

/* ------------------------------------------------------------
   4. THE OVERWORLD MAP
------------------------------------------------------------ */
let current = -1;        // -1 = at the trailhead, not yet on a stop
let maxReached = -1;
let hiker;
const START = { x: 100, y: 225 };  // trailhead, just off Basecamp

// Off-trail "shortcut" — a little island in the water that bypasses the whole
// experience and jumps straight to the credentials/highlights page.
const SHORTCUT = {
  x: 246, y: 534,
  label: "HIGH POINTS",
  level: {
    tag: "IN A HURRY? · THE HIGH POINTS",
    title: "High Points",
    role: "The highlight reel — all in one place",
    body: "Not in the mood for the whole trail? No worries. Here are the high points:",
    chips: ["Backcountry", "Webby winner", "500M+ views", "Published author"],
    features: [
      "Editorial Manager at Backcountry — leading editorial across Backcountry, Competitive Cyclist & SteepAndCheap",
      "10+ years in outdoor creative & marketing; grew from Writer to Editorial Manager",
      "A Trail Tale — Webby award-winning interactive site (I composed the original score)",
      "Author of The Last Letters of Theodore Roosevelt — a published, full-length book",
      "500M+ photo & video views · Unsplash Photo of the Year Runner-Up (2025) · 114+ Pexels homepage features",
      "Adventure Alex — independently produced YouTube channel (3,100+ subscribers, 500K+ views)",
      "Freelance copy & brand voice — Dickies, HYER & Gnarly Nutrition",
      "Herd Hub — built a full internal platform solo with AI",
      "Original music released on Spotify",
    ],
    note: "Prefer to copy it? Alex@moliski.net",
    links: [
      { label: "EMAIL ME ▶", href: "mailto:Alex@moliski.net" },
      { label: "LINKEDIN ▶", href: "https://www.linkedin.com/in/alexander-moliski/" },
    ],
  },
};

/* Insert the custom map background image */
function buildBiomes() {
  const img = document.createElement("img");
  img.className = "biome-img";
  img.src = "img/map.jpg";
  img.alt = "";
  world.prepend(img);
}

function buildMap() {
  // Map background image (region banners are baked into the art)
  buildBiomes();

  // Trail path points, in the 1000x620 coordinate space
  const pts = NODES.map((n) => `${n.x},${n.y}`).join(" ");
  document.getElementById("trail-casing").setAttribute("points", pts);
  document.getElementById("trail-base").setAttribute("points", pts);
  document.getElementById("trail-center").setAttribute("points", pts);

  // Nodes
  NODES.forEach((n, i) => {
    const btn = document.createElement("button");
    btn.className = "node";
    btn.dataset.type = n.type;
    btn.dataset.index = i;
    btn.style.left = (n.x / 1000) * 100 + "%";
    btn.style.top = (n.y / 620) * 100 + "%";
    btn.setAttribute("aria-label", `${n.label} — visit`);
    btn.innerHTML =
      `<span class="node-badge">${n.type === "summit" ? "&#9873;" : i + 1}</span>` +
      `<span class="node-label">${n.label}</span>`;
    btn.addEventListener("click", () => { moveTo(i); openLevel(i); });
    world.appendChild(btn);
  });

  // Off-trail shortcut: a dashed line from Basecamp out to the island + a special node
  const svgNS2 = "http://www.w3.org/2000/svg";
  const dash = document.createElementNS(svgNS2, "polyline");
  dash.setAttribute("class", "trail-shortcut");
  dash.setAttribute("fill", "none");
  dash.setAttribute("points", `${NODES[0].x},${NODES[0].y} ${SHORTCUT.x},${SHORTCUT.y}`);
  document.getElementById("trail-svg").appendChild(dash);

  const sc = document.createElement("button");
  sc.className = "node";
  sc.dataset.type = "shortcut";
  sc.style.left = (SHORTCUT.x / 1000) * 100 + "%";
  sc.style.top = (SHORTCUT.y / 620) * 100 + "%";
  sc.setAttribute("aria-label", `${SHORTCUT.label} — skip to my credentials`);
  sc.innerHTML =
    `<span class="node-badge">&#187;</span>` +
    `<span class="node-label">${SHORTCUT.label}</span>`;
  sc.addEventListener("click", () => openLevel(null, SHORTCUT.level));
  world.appendChild(sc);

  // Hiker
  hiker = document.createElement("div");
  hiker.id = "hiker";
  if (!reduceMotion) hiker.classList.add("bob");
  hiker.appendChild(pixelSprite(HIKER, HIKER_PAL, 4));
  world.appendChild(hiker);

  placeHiker(current);
  updateProgress();
}

function placeHiker(i) {
  const n = i < 0 ? START : NODES[i];
  hiker.style.left = (n.x / 1000) * 100 + "%";
  hiker.style.top = (n.y / 620) * 100 + "%";
}

function updateProgress() {
  // Bright path drawn through every node up to the furthest reached
  const reached = NODES.slice(0, maxReached + 1).map((n) => `${n.x},${n.y}`).join(" ");
  document.getElementById("trail-progress").setAttribute("points", reached);
  // Before the first move, pulse Basecamp so it reads as the starting destination
  const highlight = current < 0 ? 0 : current;
  document.querySelectorAll(".node").forEach((el, i) =>
    el.classList.toggle("is-current", i === highlight));
}

function moveTo(i) {
  const prev = current;
  current = Math.max(0, Math.min(NODES.length - 1, i));
  maxReached = Math.max(maxReached, current);
  placeHiker(current);
  updateProgress();
  // On arriving at a new stop, unlock its quip (adds to rotation) and show it
  if (current !== prev && NODES[current].quip && typeof unlockQuip === "function") {
    unlockQuip(NODES[current].quip);
  }
}

/* ------------------------------------------------------------
   5. LEVEL DIALOG
------------------------------------------------------------ */
const overlay = document.getElementById("level");
const levelContent = document.getElementById("level-content");

function openLevel(i, lvOverride) {
  const lv = lvOverride || NODES[i].level;
  let inner =
    `<p class="level-tag">${lv.tag}</p>` +
    `<h2 class="level-title" id="level-title">${lv.title}</h2>` +
    `<p class="level-role">${lv.role}</p>` +
    `<p class="level-body">${lv.body}</p>`;
  // Optional role-progression ribbon (e.g., The Main Quest)
  if (lv.progression?.length)
    inner += `<div class="mq-prog">` + lv.progression.map((r, idx) =>
      `<span class="mq-prog-step${idx === lv.progression.length - 1 ? " is-now" : ""}">${r}</span>` +
      (idx < lv.progression.length - 1 ? `<span class="mq-prog-arrow" aria-hidden="true">&#9654;</span>` : "")
    ).join("") + `</div>`;
  // Optional stats grid (the "trophy shelf")
  if (lv.stats?.length)
    inner += `<ul class="mq-stats">` + lv.stats.map((s) =>
      `<li><span class="mq-stat-num">${s.num}</span><span class="mq-stat-label">${s.label}</span></li>`
    ).join("") + `</ul>`;
  // Optional clickable trail markers (deep-link into a deck / section)
  if (lv.markers?.length) {
    if (lv.markersIntro) inner += `<p class="mq-markers-intro">${lv.markersIntro}</p>`;
    inner += `<div class="mq-markers">` + lv.markers.map((m, idx) => {
      const newTab = m.href.startsWith("http") || m.href.includes(".pdf");
      const ext = newTab ? ' target="_blank" rel="noopener"' : "";
      return `<a class="mq-marker" style="--mk:${m.color || "var(--accent)"}" href="${m.href}"${ext}>` +
        `<span class="mq-marker-badge">${idx + 1}</span>` +
        `<span class="mq-marker-txt"><span class="mq-marker-title">${m.title}</span>` +
        `<span class="mq-marker-sub">${m.sub}</span></span>` +
        `<span class="mq-marker-go" aria-hidden="true">&#9654;</span></a>`;
    }).join("") + `</div>`;
  }
  // Optional multi-role career timeline (e.g., Breaking Trail)
  if (lv.roles?.length)
    inner += `<div class="timeline">` + lv.roles.map((r, idx) =>
      `<div class="tl-role">` +
        `<p class="tl-co">${r.co}</p>` +
        `<p class="tl-meta">${r.meta}</p>` +
        `<p class="tl-desc">${r.desc}</p>` +
      `</div>` +
      (idx < lv.roles.length - 1 ? `<div class="tl-arrow" aria-hidden="true">&#9660;</div>` : "")
    ).join("") + `</div>`;
  if (lv.outro) inner += `<p class="level-body">${lv.outro}</p>`;
  if (lv.chips?.length)
    inner += `<ul class="level-chips">${lv.chips.map((c) => `<li>${c}</li>`).join("")}</ul>`;
  if (lv.features?.length)
    inner += `<ul class="level-features">${lv.features.map((f) => `<li>${f}</li>`).join("")}</ul>`;
  if (lv.note) inner += `<p class="level-note">${lv.note}</p>`;
  if (lv.links?.length)
    inner += `<div class="level-links">${lv.links
      .map((l) => {
        const newTab = l.href.startsWith("http") || l.href.endsWith(".pdf");
        const ext = newTab ? ' target="_blank" rel="noopener"' : "";
        return `<a class="level-cta" href="${l.href}"${ext}>${l.label}</a>`;
      })
      .join("")}</div>`;
  const html =
    (lv.image ? `<img class="level-shot" src="${lv.image}" alt="${lv.title}" />` : "") +
    `<div class="level-pad">${inner}</div>`;
  levelContent.innerHTML = html;
  overlay.classList.remove("is-hidden");
  overlay.setAttribute("aria-hidden", "false");
}
function closeLevel() {
  overlay.classList.add("is-hidden");
  overlay.setAttribute("aria-hidden", "true");
  world.focus();
}
document.getElementById("level-close").addEventListener("click", closeLevel);
overlay.addEventListener("click", (e) => { if (e.target === overlay) closeLevel(); });

/* ------------------------------------------------------------
   ABOUT ME — hidden easter egg (click the guide avatar)
------------------------------------------------------------ */
const aboutOverlay = document.getElementById("about");
const aboutContent = document.getElementById("about-content");
let aboutBuilt = false;
function openAbout() {
  if (!aboutBuilt) {
    aboutContent.innerHTML =
      `<img class="level-shot" src="img/about-photo.jpg" alt="Alex on the trail" />` +
      `<div class="level-pad">` +
        `<p class="level-tag">&#9733; A HIDDEN TRAIL &middot; ABOUT ME</p>` +
        `<h2 class="level-title">Hey, I'm Alex</h2>` +
        `<p class="about-lead">For the pursuit of hidden adventure and lived, meaningful experiences.</p>` +
        `<p class="level-body">I'm a storyteller, filmmaker, photographer, and creative lead focused on exploration, adventure, and the landscapes that make people feel small in the best possible way.</p>` +
        `<p class="level-body">For the last decade, I've worked professionally in storytelling and creative marketing within the outdoor industry — helping shape campaigns, editorial strategy, and brand narratives designed to connect people with the outdoors. Over time, that work expanded beyond writing and into photography, filmmaking, and visual storytelling.</p>` +
        `<p class="level-body">Today, my work spans multiple mediums, but the core idea behind all of it stays the same:</p>` +
        `<p class="about-emph">Adventure is out there. You just have to find it.</p>` +
        `<p class="level-body">That belief has led me deep into remote canyons, onto forgotten trails, across desert landscapes, and into stories hidden just beyond the places most people stop looking. Through my YouTube channel, Adventure Alex, I create cinematic outdoor films centered on modern exploration — blending adventure, curiosity, and storytelling into experiences that feel immersive, human, and real.</p>` +
        `<p class="level-body">Along the way, my photography and video work has generated over half a billion views globally through platforms like Pexels, and my creative work has been recognized through awards, publications, and collaborations across film, photography, and digital media.</p>` +
        `<p class="level-body">Have a story in mind? Let's tell it.</p>` +
        `<div class="level-links"><a class="level-cta" href="mailto:Alex@moliski.net">EMAIL ME ▶</a></div>` +
      `</div>`;
    aboutBuilt = true;
  }
  aboutOverlay.classList.remove("is-hidden");
  aboutOverlay.setAttribute("aria-hidden", "false");
}
function closeAbout() {
  aboutOverlay.classList.add("is-hidden");
  aboutOverlay.setAttribute("aria-hidden", "true");
}
document.getElementById("about-close").addEventListener("click", closeAbout);
aboutOverlay.addEventListener("click", (e) => { if (e.target === aboutOverlay) closeAbout(); });
document.querySelectorAll(".avatar").forEach((el) => {
  el.addEventListener("click", (e) => { e.stopPropagation(); openAbout(); });
});

/* ------------------------------------------------------------
   GUIDE — rotating speech bubble on the map
------------------------------------------------------------ */
function rotateBubble(el, lines, ms, html) {
  if (!el) return;
  let i = 0;
  setInterval(() => {
    i = (i + 1) % lines.length;
    el.classList.add("swap");
    setTimeout(() => {
      if (html) el.innerHTML = lines[i];
      else el.textContent = lines[i];
      el.classList.remove("swap");
    }, 240);
  }, ms);
}

// Map guide — idle lines rotate, but a per-stop "quip" can take over on arrival
const MAP_GUIDE_LINES = [
  "Follow the trail to get to know me!",
  "I grew up in PA, but spent a lot of time in Texas and Utah too!",
  "I'm always looking for my next adventure.",
  "Full disclosure. I used AI to help me make this project. Tryin' something new.",
  "Don't have time for a hike? Jump to High Points to skip ahead.",
];
const mgBubble = document.getElementById("guide-bubble");
const unlockedQuips = [];   // quips added to the rotation as stops are visited
let mgIdx = 0, mgHold = 0;
function guidePool() { return MAP_GUIDE_LINES.concat(unlockedQuips); }
function guideSwap(text) {
  if (!mgBubble) return;
  mgBubble.classList.add("swap");
  setTimeout(() => { mgBubble.textContent = text; mgBubble.classList.remove("swap"); }, 240);
}
// Show a specific line and hold it (pauses idle rotation for holdMs)
function guideSay(text, holdMs = 25000) { mgHold = Date.now() + holdMs; guideSwap(text); }
// Called when arriving at a stop: add its quip to the rotation (once) and show it
function unlockQuip(q) {
  if (!unlockedQuips.includes(q)) unlockedQuips.push(q);
  guideSay(q, 25000);
}
if (mgBubble) {
  setInterval(() => {
    if (Date.now() < mgHold) return;         // a quip is currently holding
    const pool = guidePool();
    mgIdx = (mgIdx + 1) % pool.length;
    guideSwap(pool[mgIdx]);
  }, 16000);
}

// Title guide — rotates through greetings (HTML for the first, styled line)
rotateBubble(document.getElementById("title-bubble"), [
  "&ldquo;The Trail&rdquo;<br><span>AKA my portfolio</span>",
  "Go ahead, start the trail! Adventure starts one click.. er uh... step at a time.",
  "It's nice to meet you.",
  "Thanks for stopping by.",
], 16000, true);

/* ------------------------------------------------------------
   KEYBOARD CONTROLS
------------------------------------------------------------ */
document.addEventListener("keydown", (e) => {
  if (!aboutOverlay.classList.contains("is-hidden")) {
    if (e.key === "Escape") closeAbout();
    return;
  }
  const onTitle = !titleScreen.classList.contains("is-hidden");
  const levelOpen = !overlay.classList.contains("is-hidden");

  if (onTitle) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startTrail(); }
    return;
  }
  if (levelOpen) {
    if (e.key === "Escape") closeLevel();
    return;
  }
  // On the map
  switch (e.key) {
    case "ArrowRight": case "ArrowDown": case "d": case "s":
      e.preventDefault(); moveTo(current + 1); break;
    case "ArrowLeft": case "ArrowUp": case "a": case "w":
      e.preventDefault(); moveTo(current - 1); break;
    case "Enter": case " ":
      e.preventDefault();
      if (current < 0) moveTo(0);   // step onto Basecamp first
      else openLevel(current);
      break;
    case "Escape":
      backToTitle(); break;
  }
});
