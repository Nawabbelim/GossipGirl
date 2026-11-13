import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  getDocs,
  query,
  where,
  increment,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { cfg } from "./firebase-config.js";
import mini from "./minigame.js";

// [display name, id] — put photos at img/<id>.jpg (falls back to the initial)
const CH = [
  ["Blair Waldorf", "blair"],
  ["Serena van der Woodsen", "serena"],
  ["Chuck Bass", "chuck"],
  ["Nate Archibald", "nate"],
  ["Dan Humphrey", "dan"],
  ["Jenny Humphrey", "jenny"],
  ["Georgina Sparks", "georgina"],
  ["Vanessa Abrams", "vanessa"],
  ["Lily van der Woodsen", "lily"],
  ["Eric van der Woodsen", "eric"],
  ["Rufus Humphrey", "rufus"],
  ["Dorota Kishlovsky", "dorota"],
];
const H3 = 6e4, // 1 min  tempp
  // const H3 = 1.08e7,
  MISS = 5,
  REJECT = 15,
  $ = (s) => document.querySelector(s);
const day = () => new Date().toLocaleDateString("en-CA"),
  yday = () => new Date(Date.now() - 864e5).toLocaleDateString("en-CA");
const mins = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  },
  inRain = () => mins() >= /*1320*/ 1140 && mins() < /*1335*/ 1155; //tempp
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt()};`);
const name = (id) => (CH.find((c) => c[1] == id) || ["Someone"])[0];
const av = (id, dead) =>
  `<div class="av ${dead ? "dead" : ""}" title="${name(id)}"><b>${name(id)[0]}</b><img src="img/${id}.jpg" alt="" onerror="this.remove()"></div>`;

// ---- sound (synthesised, no assets) ----
let ac;
const snd = (f, t = "sine", d = 0.15, v = 0.08) => {
  try {
    ac ??= new AudioContext();
    ac.resume();
    const o = ac.createOscillator(),
      g = ac.createGain();
    o.type = t;
    o.frequency.value = f;
    g.gain.setValueAtTime(v, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(1e-3, ac.currentTime + d);
    o.connect(g).connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + d);
  } catch {}
};
const sfx = {
  click: () => snd(420, "square", 0.05),
  drip: () => {
    snd(900, "sine", 0.12);
    setTimeout(() => snd(500, "sine", 0.2), 90);
  },
  sting: () =>
    [220, 185, 147].forEach((f, i) =>
      setTimeout(() => snd(f, "sawtooth", 0.4, 0.1), i * 160),
    ),
  thunder: () => snd(55, "sawtooth", 1.4, 0.25),
};
document.addEventListener(
  "click",
  (e) => e.target.closest("button") && sfx.click(),
);
const gg = (t) => {
  const e = $("#toast");
  e.textContent = "💋 " + t;
  e.className = "show";
  clearTimeout(gg.t);
  gg.t = setTimeout(() => (e.className = ""), 5500);
};
const modal = (h) => {
  const m = $("#modal");
  m.hidden = !h;
  m.innerHTML = h
    ? `<div class=card>${h}<p><button data-x>Close</button></p></div>`
    : "";
};

// ---- blood drops background ----
{
  const cv = $("#drops"),
    x = cv.getContext("2d");
  let D = [];
  const rs = () => {
    cv.width = innerWidth;
    cv.height = innerHeight;
  };
  rs();
  onresize = rs;
  (function f() {
    x.fillStyle = "rgba(5,2,3,.16)";
    x.fillRect(0, 0, cv.width, cv.height);
    if (Math.random() < 0.12)
      D.push({
        x: Math.random() * cv.width,
        y: 0,
        v: 2 + Math.random() * 4,
        r: 1 + Math.random() * 2.5,
      });
    D = D.filter((d) => (d.y += d.v) < cv.height);
    D.forEach((d) => {
      x.fillStyle = "#a1000f";
      x.beginPath();
      x.ellipse(d.x, d.y, d.r, d.r * 3, 0, 0, 7);
      x.fill();
    });
    requestAnimationFrame(f);
  })();
}

// ---- state ----
const db = getFirestore(initializeApp(cfg));
let uid,
  me,
  pts,
  last,
  capUid,
  roster = [],
  rainOn = 0,
  busy = 0,
  rainTimer,
  hackList = [];

signInAnonymously(getAuth())
  .then((u) => {
    uid = u.user.uid;
    load();
  })
  .catch((e) => gg("Firebase: " + e.message));

async function load() {
  const u = await getDoc(doc(db, "users", uid));
  if (!u.exists()) return pick();
  me = u.data();
  const p = (await getDoc(doc(db, "priv", uid))).data();
  pts = p.pts;
  last = p.last;
  await penalty();
  await capAward();
  const c = await getDoc(doc(db, "meta", "cap"));
  capUid = c.exists() ? c.data().uid : null;
  await resolve(yday());
  if (mins() >= 1335) await resolve(day());
  roster = (await getDocs(collection(db, "users"))).docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
  render();
  if (!window.tk) window.tk = setInterval(tick, 1000);
}

async function pick() {
  const taken = new Set(
    (await getDocs(collection(db, "users"))).docs.map((d) => d.data().ch),
  );
  $("#app").innerHTML =
    `<h2>Who are you tonight?</h2><div class=chars>${CH.map(([n, id]) => `<button class=pc data-id=${id} ${taken.has(id) ? "disabled" : ""}>${av(id)}<span>${n}</span></button>`).join("")}</div>`;
}

// ---- loyalty: 5 points per missed 3h window, hidden in priv/{uid} ----
async function penalty() {
  if (me.n < 10 || me.banned) return;
  const m = Math.floor((Date.now() - last) / H3);
  if (m < 1) return;
  pts -= MISS * m;
  last += m * H3;
  await updateDoc(doc(db, "priv", uid), { pts, last });
  sfx.sting();
  gg(
    `You went quiet for ${m} window${m > 1 ? "s" : ""}. I took points. Only you can see how many.`,
  );
  if (pts <= 0) {
    me.banned = true;
    await updateDoc(doc(db, "users", uid), { banned: true });
  }
}

function render() {
  $("#jail").hidden = !me.banned;
  if (me.banned) {
    $("#jail").innerHTML =
      `<div class=bars></div><div class=cell><div class=coffin>⚰️</div><h1>Banished</h1><p>${name(me.ch)}, your loyalty hit zero. You're out of the group.</p></div>`;
    $("#app").innerHTML = "";
    return;
  }
  const own = capUid == uid,
    left = 2 - (me.rv?.d == day() ? me.rv.n : 0),
    onb = me.n < 10;
  $("#app").innerHTML = `
  <section class=card><div class=row>${av(me.ch)}<div><h2>${name(me.ch)}</h2><p>Loyalty <b class=pts>${pts}</b> <small>only you can see this</small></p></div></div>
  <div class=row style="margin-top:14px">${roster.map((u) => `<div class=mem>${av(u.ch, u.banned)}${u.id == capUid ? "<i class=cap>🧢</i>" : ""}${u.banned ? "<i class=cap>⚰️</i>" : ""}</div>`).join("")}</div></section>
  <section class=card><h3>${onb ? `Initiation: secret ${me.n + 1} of 10` : "Spill, sweetie"}</h3>
  <textarea id=tx maxlength=240 placeholder="A secret. A scandal. Someone else's mess."></textarea>
  <select id=ab><option value="">About: myself, or no one in particular</option>${CH.map(([n, id]) => `<option value=${id}>About ${n}</option>`).join("")}</select>
  <button id=send>Whisper to Gossip Girl</button>${onb ? "" : "<p>Next secret due in <b id=cd></b></p>"}</section>
  <section class=card><h3>Today's Blockade</h3><p>Best score before midnight takes Georgina's cap.</p><button id=pl>Play ${esc(mini.name)}</button>
  ${own ? `<p>🧢 You hold the cap: ${left} hack${left == 1 ? "" : "s"} left today.</p><button id=hk>Hack a secret</button>` : ""}</section>
  <section class=card><p>Chit rain falls every night 10:00 to 10:15.</p></section>`;
}

function tick() {
  if (!me || me.banned) return;
  const cd = $("#cd");
  if (cd) {
    const s = Math.max(0, Math.ceil((last + H3 - Date.now()) / 1e3));
    cd.textContent = [(s / 3600) | 0, ((s / 60) | 0) % 60, s % 60]
      .map((v) => String(v).padStart(2, 0))
      .join(":");
    cd.classList.toggle("late", s < 900);
  }
  if (me.n >= 10 && !busy && Date.now() >= last + H3) {
    busy = 1;
    penalty().then(() => {
      busy = 0;
      render();
    });
  }
  if (inRain() && !rainOn) startRain();
  if (!inRain() && rainOn) endRain();
}

async function send() {
  const t = $("#tx").value.trim();
  if (t.length < 5) return gg("Say something worth hearing.");
  await addDoc(collection(db, "secrets"), {
    text: t,
    by: uid,
    about: $("#ab").value,
    t: Date.now(),
  });
  me.n++;
  last = Date.now();
  await updateDoc(doc(db, "users", uid), { n: me.n });
  await updateDoc(doc(db, "priv", uid), { last });
  sfx.drip();
  gg(
    me.n == 10 ? "Initiation done. Now I own all of you. xoxo" : "Noted. xoxo",
  );
  render();
}

// ---- 10:00 pm chit rain: one secret, every chit identical, AND-logic rejection ----
async function startRain() {
  rainOn = 1;
  const d = day(),
    rd = doc(db, "rain", d);
  let r = await getDoc(rd);
  if (!r.exists()) {
    const all = (await getDocs(collection(db, "secrets"))).docs
      .map((x) => x.id)
      .sort();
    if (!all.length) return (rainOn = 0);
    await setDoc(rd, {
      sid: all[
        ([...d].reduce((a, c) => (a * 31 + c.charCodeAt()) | 0, 7) >>> 0) %
          all.length
      ],
      done: false,
    });
    r = await getDoc(rd);
  }
  const s = (await getDoc(doc(db, "secrets", r.data().sid))).data(),
    t = esc(s.text);
  $("#rain").hidden = false;
  sfx.thunder();
  rainTimer = setInterval(
    () => snd(800 + Math.random() * 900, "sine", 0.04, 0.03),
    180,
  );
  $("#rain").innerHTML =
    Array.from(
      { length: 36 },
      () =>
        `<i class=chit style="left:${Math.random() * 95}%;animation-delay:${Math.random() * 6}s;animation-duration:${4 + Math.random() * 4}s">${t}</i>`,
    ).join("") +
    `<div class=card id=rc><h2>Chit rain</h2><p>${s.about ? "A secret about " + name(s.about) : "A secret from someone close"}</p><blockquote>${t}</blockquote>${s.by == uid ? "<p>This one is yours. Pray.</p>" : "<button data-v=real>Genuine</button> <button data-v=fake>Fake</button>"}</div>`;
}
function endRain() {
  rainOn = 0;
  clearInterval(rainTimer);
  $("#rain").hidden = true;
  resolve(day());
}

async function resolve(d) {
  // rejected only if every other live member votes fake
  const rd = doc(db, "rain", d),
    r = await getDoc(rd);
  if (!r.exists() || r.data().done) return;
  await updateDoc(rd, { done: true });
  const fake = (await getDocs(collection(db, "rain", d, "votes"))).docs.filter(
    (x) => x.data().v == "fake",
  ).length;
  const live = (await getDocs(collection(db, "users"))).docs.filter(
    (x) => !x.data().banned,
  ).length;
  const s = (await getDoc(doc(db, "secrets", r.data().sid))).data(),
    bad = live > 1 && fake >= live - 1;
  if (bad) await updateDoc(doc(db, "priv", s.by), { pts: increment(-REJECT) });
  await updateDoc(rd, { verdict: bad ? "rejected" : "genuine" });
  gg(
    bad
      ? "Last night's secret was fake. The liar paid for it."
      : "Last night's secret was real. xoxo",
  );
}

// ---- cap: yesterday's best score wins; holder hacks 2 secrets per day ----
async function capAward() {
  const y = /*yday(),*/ day(), //tempp
    cd = doc(db, "meta", "cap"),
    c = await getDoc(cd);
  if (c.exists() && c.data().for >= y) return;
  const sc = (
    await getDocs(query(collection(db, "scores"), where("day", "==", y)))
  ).docs
    .map((x) => x.data())
    .sort((a, b) => b.s - a.s);
  if (sc[0]) await setDoc(cd, { uid: sc[0].uid, for: y });
}
async function hack() {
  if (2 - (me.rv?.d == day() ? me.rv.n : 0) < 1)
    return gg("Out of hacks today. Georgina sleeps.");
  hackList = (await getDocs(collection(db, "secrets"))).docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => b.t - a.t)
    .slice(0, 12);
  modal(
    `<h3>Hack</h3>${hackList.map((s) => `<p>${esc(s.text)} <button data-h=${s.id}>Reveal who</button></p>`).join("") || "<p>Nothing to steal yet.</p>"}`,
  );
}
async function reveal(id) {
  const used = me.rv?.d == day() ? me.rv.n : 0;
  if (used >= 2) return gg("Out of hacks today.");
  const s = hackList.find((x) => x.id == id),
    u = await getDoc(doc(db, "users", s.by));
  me.rv = { d: day(), n: used + 1 };
  await updateDoc(doc(db, "users", uid), { rv: me.rv });
  sfx.sting();
  modal("");
  gg(`${name(u.data().ch)} said: "${s.text}"`);
  render();
}

async function play() {
  const k = day() + "_" + uid;
  if ((await getDoc(doc(db, "scores", k))).exists())
    return gg("One try a day, sweetie.");
  modal(`<h3>${esc(mini.name)}</h3><div id=mg></div>`);
  mini.mount($("#mg"), async (s) => {
    await setDoc(doc(db, "scores", k), { uid, day: day(), s });
    sfx[s ? "drip" : "sting"]();
    gg(`You scored ${s}. The cap is decided at midnight.`);
    setTimeout(() => modal(""), 2200);
  });
}

// ---- clicks ----
$("#app").onclick = async (e) => {
  const pc = e.target.closest(".pc");
  if (pc && !pc.disabled) {
    await setDoc(doc(db, "users", uid), {
      ch: pc.dataset.id,
      n: 0,
      banned: false,
    });
    await setDoc(doc(db, "priv", uid), { pts: 100, last: Date.now() });
    sfx.drip();
    return load();
  }
  const id = e.target.closest("button")?.id;
  if (id == "send") send();
  if (id == "pl") play();
  if (id == "hk") hack();
};
$("#modal").onclick = (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if ("x" in b.dataset) modal("");
  if (b.dataset.h) reveal(b.dataset.h);
};
$("#rain").onclick = async (e) => {
  const v = e.target.dataset.v;
  if (!v) return;
  await setDoc(doc(db, "rain", day(), "votes", uid), { v });
  sfx.drip();
  e.target.parentElement.innerHTML =
    "<h2>Vote locked</h2><p>Nobody will know which way you voted.</p>";
};
