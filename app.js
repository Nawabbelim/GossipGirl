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
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { cfg } from "./firebase-config.js";
import mini from "./minigame.js";

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
const H5 = 1.8e7,
  INIT = 3,
  RAIN_SPEED = 1,
  GIFT_POOL = 12,
  CAP_BONUS = 8,
  NOVOTE = 3,
  GRACE = 12e4,
  MISS = 5,
  REJECT = 15,
  FORCE = /rain/.test(location.search),
  $ = (s) => document.querySelector(s);
const due = (f) => {
  let t = f,
    r = H5;
  for (let i = 0; i < 9; i++) {
    const d = new Date(t),
      a = new Date(d).setHours(8, 0, 0, 0),
      e = new Date(d).setHours(23, 0, 0, 0);
    if (t < a) t = a;
    if (t >= e) {
      t = a + 864e5;
      continue;
    }
    if (r <= e - t) return t + r;
    r -= e - t;
    t = a + 864e5;
  }
  return t;
};
const day = () => new Date().toLocaleDateString("en-CA"),
  yday = () => new Date(Date.now() - 864e5).toLocaleDateString("en-CA");
const mins = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  },
  inRain = () => FORCE || (mins() >= 1320 && mins() < 1335);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt()};`),
  name = (id) => (CH.find((c) => c[1] == id) || ["Someone"])[0];
const av = (id, dead) =>
  `<div class="av ${dead ? "dead" : ""}" title="${name(id)}"><b>${name(id)[0]}</b><img src="img/${id}.jpg" alt="" onerror="this.remove()"></div>`;
const CAP = (z) =>
  `<svg class=capsvg width=${z} height=${z} viewBox="0 0 64 64"><ellipse cx=32 cy=47 rx=29 ry=8 fill="#0a0a0a" stroke="#ff2a3d" stroke-width=2 /><path d="M13 46C12 14 52 14 51 46Z" fill="#161012" stroke="#ff2a3d" stroke-width=2 /><path d="M13.5 39Q32 48 50.5 39L51 46Q32 55 13 46Z" fill="#c1121f" /><path d="M22 29Q32 19 42 29Q32 38 22 29Z" fill="#000" stroke="#ff6b78" stroke-width=1.5 /><circle cx=32 cy=29 r=3.5 fill="#ff2a3d" /><path d="M5 18l5 5M59 18l-5 5M32 5v7" stroke="#ff6b78" stroke-width=2 stroke-linecap=round /></svg>`;
const SN = [
  "I see everything, darling.",
  "Careful. The walls have ears, and I own the walls.",
  "Your secrets are already mine.",
  "Loyalty is a currency. You're spending it badly.",
  "Don't make me tell them what you did.",
];

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
const rainSnd = () => {
  try {
    ac ??= new AudioContext();
    const b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate),
      d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ac.createBufferSource(),
      f = ac.createBiquadFilter(),
      g = ac.createGain();
    s.buffer = b;
    s.loop = true;
    f.type = "highpass";
    f.frequency.value = 1800;
    g.gain.value = 0.05;
    s.connect(f).connect(g).connect(ac.destination);
    s.start();
    return () => s.stop();
  } catch {
    return () => {};
  }
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
  gg.t = setTimeout(
    () => (e.className = ""),
    Math.min(6000, 1800 + t.length * 40),
  );
};
const snark = () => gg(SN[(Math.random() * SN.length) | 0]);
const modal = (h) => {
  const m = $("#modal");
  m.hidden = !h;
  document.body.classList.toggle("lock", !!h || rainOn == 1);
  m.innerHTML = h
    ? `<div class=card>${h}<p><button data-x>Close</button></p></div>`
    : "";
};

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
    if (document.body.classList.contains("lock")) {
      requestAnimationFrame(f);
      return;
    }
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

const db = getFirestore(initializeApp(cfg));
let uid,
  me,
  pts,
  last,
  capUid,
  roster = [],
  feed = [],
  tab = "home",
  rainOn = 0,
  busy = 0,
  stopRain,
  rainTimer,
  hackList = [],
  jarList = [],
  rs,
  rq = [],
  rI = -1,
  rainDone = 0,
  rD,
  T0 = Date.now(),
  hk = {},
  need = false,
  pend = 0,
  gameStart,
  tc = 0,
  leadUid,
  alarmed = 0;
const post = (t) =>
  addDoc(collection(db, "meta"), { f: 1, text: t, t: Date.now() }).catch(
    () => {},
  );
const getFeed = async () =>
  (await getDocs(query(collection(db, "meta"), where("f", "==", 1)))).docs
    .map((d) => d.data())
    .sort((a, b) => b.t - a.t)
    .slice(0, 20);
const seed = () =>
  (([...day()].reduce((a, c) => (a * 31 + c.charCodeAt()) | 0, 7) >>> 0) %
    2147483646) +
  1;
const ctx = {
  get seed() {
    return seed();
  },
  daily: async (k, fn) => {
    const r = doc(db, "meta", "d_" + day() + k),
      s = await getDoc(r);
    if (s.exists()) return JSON.parse(s.data().v);
    const v = await fn();
    await setDoc(r, { v: JSON.stringify(v) });
    return v;
  },
};

signInAnonymously(getAuth())
  .then((u) => {
    uid = u.user.uid;
    load();
  })
  .catch((e) => gg("Firebase: " + e.message));

async function load() {
  await capAward();
  const c = await getDoc(doc(db, "meta", "cap"));
  capUid = c.exists() ? c.data().uid : null;
  const u = await getDoc(doc(db, "users", uid));
  if (!u.exists()) return pick();
  me = u.data();
  const p = (await getDoc(doc(db, "priv", uid))).data();
  pts = p.pts;
  last = p.last;
  hk = p.hk || {};
  await penalty();
  await resolve(yday());
  await resolve(day());
  roster = (await getDocs(collection(db, "users"))).docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
  feed = await getFeed();
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
async function penalty() {
  if (me.n < INIT || me.banned) return;
  let m = 0;
  while (m < 30 && due(last) <= Date.now()) {
    last = due(last);
    m++;
  }
  if (m < 1) return;
  if (capUid == uid) {
    last = Date.now();
    await updateDoc(doc(db, "priv", uid), { last });
    return;
  }
  pts -= MISS * m;
  await updateDoc(doc(db, "priv", uid), { pts, last });
  sfx.sting();
  gg(
    `You went quiet for ${m} window${m > 1 ? "s" : ""}. I took points. Only you can see how many.`,
  );
  if (pts <= 0) {
    me.banned = true;
    await updateDoc(doc(db, "users", uid), { banned: true });
    post(`${name(me.ch)} has been banished. Into the coffin they go.`);
  }
}

async function render() {
  $("#jail").hidden = !me.banned;
  if (me.banned) {
    $("#jail").innerHTML =
      `<div class=bars></div><div class=cell><div class=coffin>⚰️</div><h1>Banished</h1><p>${name(me.ch)}, your loyalty hit zero. You're out of the group.</p></div>`;
    $("#app").innerHTML = "";
    return;
  }
  const onb = me.n < INIT,
    own = capUid == uid,
    left = 2 - (me.rv?.d == day() ? me.rv.n : 0);
  if (onb) tab = "home";
  const head = `<div class=ticker><span>📰 ${feed[0] ? esc(feed[0].text) : "Spotted: nothing yet. Give me something."}</span></div>`;
  const power = own
    ? `<div class=power>${CAP(90)}<div><h3>Georgina's Cap</h3><p>You hold the power. ${left} hack${left == 1 ? "" : "s"} left today.</p><p>Gift pool: <b>${me.gp || 0}</b> points</p><button id=hk>Hack a secret</button> <button id=gf>Gift points</button></div></div>`
    : "";
  let h = "";
  if (tab == "home")
    h = `<section class=card><div class=row>${av(me.ch)}<div><h2>${name(me.ch)}</h2><p>Loyalty <b class=pts>${pts}</b> <small>only you can see this</small></p></div></div>${power}</section>
  <section class=card><h3>${onb ? `Initiation: secret ${me.n + 1} of ${INIT}` : "Spill, sweetie"}</h3>
  <textarea id=tx maxlength=240 placeholder="A secret. A scandal. Someone else's mess."></textarea>
  <select id=ab><option value="">About: myself, or no one in particular</option>${CH.map(([n, id]) => `<option value=${id}>About ${n}</option>`).join("")}</select>
  <button id=send>Whisper to Gossip Girl</button>${onb ? "" : own ? "<p>🧢 No timer for you while you hold the cap.</p>" : "<p>Next secret due in <b id=cd></b> <small>(counts 8 AM to 11 PM only)</small></p>"}</section>`;
  if (tab == "blog") {
    feed = await getFeed();
    h = `<section class="card feed"><h3>Gossip Girl's blog</h3>${feed.map((f) => `<p>${esc(f.text)}<small>${new Date(f.t).toLocaleString()}</small></p>`).join("") || "<p>Nothing yet.</p>"}</section>`;
  }
  if (tab == "game") {
    const sc = (
        await getDocs(
          query(collection(db, "scores"), where("day", "==", day())),
        )
      ).docs
        .map((x) => x.data())
        .sort((a, b) => b.s - a.s),
      nm = (id) => name(roster.find((r) => r.id == id)?.ch);
    leadUid = sc[0]?.uid;
    const chd = await getDoc(cref()),
      chBox = chHTML(chd.exists() ? chd.data() : null, nm, leadUid);
    h = `<section class=card><h3>${esc(mini.name)}</h3><p>A new game every day. Highest score before midnight steals the cap.</p><button id=pl>Play today's game</button></section>${power}
    ${chBox}<section class=card><h3>Today's scores</h3>${sc.map((s) => `<div class=lb><span>${nm(s.uid)}</span><b>${s.s}</b></div>`).join("") || "<p>No one has played yet.</p>"}</section>`;
  }
  if (tab == "jar") {
    const js = (
      await getDocs(query(collection(db, "secrets"), where("rev", "==", true)))
    ).docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => b.t - a.t);
    for (const id of Object.keys(hk))
      if (!js.some((x) => x.id == id)) {
        const g = await getDoc(doc(db, "secrets", id));
        if (g.exists()) js.push({ id, ...g.data() });
      }
    js.sort((a, b) => b.t - a.t);
    jarList = js;
    h = `<section class=card><h3>🫙 The jar</h3><p>Every secret I have revealed. Tap a chit to read it.</p><div class=jar>${js.map((s) => `<button class=slip data-j=${s.id}>${esc(s.text.slice(0, 48))}…<small>${s.verdict || "not revealed yet"}${hk[s.id] ? " · 🧢 " + name(hk[s.id]) : ""}</small></button>`).join("") || "<p>The jar is empty.</p>"}</div></section>`;
  }
  if (tab == "crew")
    h = `<div class=crew>${roster.map((u) => `<section class=card>${av(u.ch, u.banned)}<b>${name(u.ch)}</b><p>${u.id == capUid ? CAP(32) + " Holds the cap" : u.banned ? "⚰️ In the coffin" : "Still in the game"}</p></section>`).join("")}</div>`;
  $("#app").innerHTML =
    head +
    h +
    (onb
      ? ""
      : `<nav class=tabs>${[
          ["home", "Whisper"],
          ["blog", "Blog"],
          ["jar", "Jar"],
          ["game", "Game"],
          ["crew", "Crew"],
        ]
          .map(
            ([k, l]) =>
              `<button data-t=${k} class="${tab == k ? "on" : ""}">${l}</button>`,
          )
          .join("")}</nav>`);
}

function tick() {
  if (!me || me.banned) return;
  if (++tc % 20 == 0) {
    sync();
    if (!rainOn && mins() >= 1320) resolve(day());
  }
  if (mins() == 1315 && !alarmed) {
    alarmed = 1;
    ring();
  }
  if (mins() < 1315) alarmed = 0;
  const cd = $("#cd");
  if (cd) {
    const s = Math.max(0, Math.ceil((due(last) - Date.now()) / 1e3));
    cd.textContent =
      (new Date().getHours() < 8 || new Date().getHours() >= 23
        ? "⏸ night, back at 8 AM · "
        : "") +
      [(s / 3600) | 0, ((s / 60) | 0) % 60, s % 60]
        .map((v) => String(v).padStart(2, 0))
        .join(":");
    cd.classList.toggle("late", s < 900);
  }
  if (me.n >= INIT && !busy && Date.now() >= due(last)) {
    busy = 1;
    penalty().then(() => {
      busy = 0;
      render();
    });
  }
  if (mins() < 1320) rainDone = 0;
  if (!rainOn && !rainDone && (FORCE || mins() >= 1320)) startRain();
  if (rainOn) step();
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
  if (me.n == INIT) {
    gg("Initiation done. Now I own all of you. xoxo");
    post(`${name(me.ch)} finished initiation. I now own their first secrets.`);
  } else {
    snark();
    if (me.n > INIT)
      post(
        "A fresh whisper just landed in my inbox. Someone is feeling brave.",
      );
  }
  render();
}

// ---- chit rain: every secret of the day, one minute each, blood wipe between ----
const rstart = (d) => (FORCE ? T0 : new Date(d + "T22:00:00").getTime()),
  STEP = FORCE ? 15e3 : 6e4;
const blood = () => {
  sfx.sting();
  const b = document.createElement("div");
  b.id = "blood";
  document.body.append(b);
  setTimeout(() => b.remove(), 2400);
};
async function startRain() {
  rainOn = 1;
  const d = FORCE ? day() + "-t" : day(),
    rdoc = doc(db, "rain", d);
  rD = d;
  let r = await getDoc(rdoc);
  if (!r.exists()) {
    const to = rstart(day()),
      raw = (await getDocs(collection(db, "secrets"))).docs
        .map((x) => ({ id: x.id, ...x.data() }))
        .filter((x) => FORCE || (x.t >= to - 864e5 && x.t < to));
    const all = byPlayer(raw).slice(0, 100);
    if (!all.length) {
      rainOn = 0;
      rainDone = 1;
      return;
    }
    await setDoc(rdoc, { ids: all.map((x) => x.id), done: false });
    r = await getDoc(rdoc);
  }
  rq = await Promise.all(
    r
      .data()
      .ids.map(async (id) => ({
        id,
        ...(await getDoc(doc(db, "secrets", id))).data(),
      })),
  );
  if (!FORCE && Date.now() >= rstart(d) + rq.length * STEP) {
    rainOn = 0;
    rainDone = 1;
    return resolve(d);
  }
  rI = -1;
  need = false;
  pend = 0;
  $("#rain").hidden = false;
  document.body.classList.add("lock");
  stopRain = rainSnd();
  rainTimer = setInterval(
    () => snd(800 + Math.random() * 900, "sine", 0.04, 0.03),
    220,
  );
}
const sr = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;
const byPlayer = (a) => {
  const r = sr(seed());
  return a
    .sort((x, y) => x.t - y.t || (x.id < y.id ? -1 : 1))
    .map((s) => [r(), s])
    .sort((x, y) => x[0] - y[0])
    .map((x) => x[1]);
};
function step() {
  // voting is compulsory: the next secret only comes after you vote on this one
  if (!rq.length || pend) return;
  const i = Math.floor((Date.now() - rstart(rD)) / STEP);
  if (FORCE) {
    const k = i % rq.length;
    if (k != rI) {
      rI = k;
      show(k);
    }
    return;
  }
  if (need) {
    $("#rc")?.classList.add("alarm");
    snd(760, "square", 0.12, 0.07);
    navigator.vibrate?.(150);
    return;
  }
  if (i >= rq.length && rI == rq.length - 1) return endRain();
  if (rI < Math.min(i, rq.length - 1)) {
    const k = rI + 1;
    pend = 1;
    if (rI >= 0) {
      rI = k;
      blood();
      setTimeout(async () => {
        await show(k);
        pend = 0;
      }, 1000);
    } else {
      rI = 0;
      show(0).then(() => (pend = 0));
    }
  }
}
async function sync() {
  const p = (await getDoc(doc(db, "priv", uid))).data();
  if (!p) return;
  const d = p.pts - pts;
  pts = p.pts;
  hk = p.hk || {};
  if (pts <= 0 && !me.banned) {
    me.banned = true;
    await updateDoc(doc(db, "users", uid), { banned: true });
    post(`${name(me.ch)} has been banished. Into the coffin they go.`);
    return render();
  }
  if (d) {
    gg(`Your loyalty changed by ${d > 0 ? "+" : ""}${d}.`);
    if (!rainOn && $("#modal").hidden) render();
  }
}
async function show(k) {
  const s = rq[k],
    voted = (
      await getDoc(doc(db, "rain", rD, "votes", s.id + "_" + uid))
    ).exists(),
    ok = s.by != uid && s.about != me.ch,
    t = esc(s.text);
  need = ok && !voted;
  $("#rain").innerHTML =
    `<div class=field>${Array.from({ length: 22 }, () => `<i class=chit style="--x:${Math.random() * 85}%;--d:${(6 + Math.random() * 5) / RAIN_SPEED}s;--s:-${Math.random() * 11}s;--r:${(Math.random() * 16 - 8) | 0}deg;--h:${innerHeight}"><span><b>SPOTTED</b>${t}</span></i>`).join("")}</div>
  <div class=card id=rc><h2>Secret ${k + 1} of ${rq.length}</h2><p>${s.about ? "About " + name(s.about) : "From someone close"}. Tap a chit to read it up close.</p>${voted ? "<p>Vote locked. Nobody will know which way you voted.</p>" : ok ? "<div class=vote><button class=real data-v=real>✔ Genuine</button><button class=fake data-v=fake>✖ Fake</button></div><p class=must>You must vote to continue.</p>" : `<p>${s.by == uid ? "This one is yours" : "This one is about you"}. You get no vote. Pray.</p>`}</div>`;
  sfx.thunder();
}
function endRain() {
  rainOn = 0;
  rainDone = 1;
  clearInterval(rainTimer);
  stopRain?.();
  $("#rain").hidden = true;
  document.body.classList.remove("lock");
  blood();
  resolve(rD);
}
async function resolve(d) {
  // a secret is rejected only if EVERY eligible voter (not author, not subject) said fake
  const rd = doc(db, "rain", d),
    r = await getDoc(rd);
  if (!r.exists() || r.data().done) return;
  const ids = r.data().ids;
  if (!ids || Date.now() < rstart(d) + ids.length * STEP + GRACE) return;
  await updateDoc(rd, { done: true });
  const vs = (await getDocs(collection(db, "rain", d, "votes"))).docs,
    us = (await getDocs(collection(db, "users"))).docs.filter(
      (x) => !x.data().banned,
    );
  let bad = 0;
  for (const id of ids) {
    const ref = doc(db, "secrets", id),
      s = (await getDoc(ref)).data(),
      fk = new Set(
        vs
          .filter((x) => x.id.startsWith(id + "_") && x.data().v == "fake")
          .map((x) => x.id.slice(id.length + 1)),
      );
    const el = us.filter((x) => x.id != s.by && x.data().ch != s.about),
      rej = el.length > 0 && el.every((x) => fk.has(x.id));
    const vt = new Set(
      vs
        .filter((x) => x.id.startsWith(id + "_"))
        .map((x) => x.id.slice(id.length + 1)),
    );
    for (const x of el)
      if (!vt.has(x.id))
        await updateDoc(doc(db, "priv", x.id), { pts: increment(-NOVOTE) });
    if (rej) {
      bad++;
      await updateDoc(doc(db, "priv", s.by), { pts: increment(-REJECT) });
    }
    await updateDoc(ref, { rev: true, verdict: rej ? "rejected" : "genuine" });
  }
  const m = `Tonight's rain revealed ${ids.length} secret${ids.length > 1 ? "s" : ""}. ${bad ? bad + " declared fake, and the liars paid." : "Every one was real."} Find them in the jar.`;
  gg(m);
  post(m);
}
async function capAward() {
  const y = yday(),
    cd = doc(db, "meta", "cap"),
    c = await getDoc(cd);
  if (c.exists() && c.data().for >= y) return;
  const sc = (
    await getDocs(query(collection(db, "scores"), where("day", "==", y)))
  ).docs
    .map((x) => x.data())
    .sort((a, b) => b.s - a.s);
  if (!sc[0]) return;
  const chd = await getDoc(doc(db, "meta", "ch_" + y)),
    w = chd.exists() && chd.data().st == "done" ? chd.data().win : sc[0].uid,
    fresh = !c.exists() || c.data().uid != w;
  const ok = await runTransaction(db, async (t) => {
    const g = await t.get(cd);
    if (g.exists() && g.data().for >= y) return false;
    t.set(cd, { uid: w, for: y });
    return true;
  });
  if (!ok) return;
  if (fresh) {
    await updateDoc(doc(db, "users", w), { gp: GIFT_POOL });
    await updateDoc(doc(db, "priv", w), { pts: increment(CAP_BONUS) });
  }
  post(
    fresh
      ? "A new head wears Georgina's cap today. Watch your backs."
      : "The cap stays on the same head. Of course it does.",
  );
}
async function hack() {
  if (2 - (me.rv?.d == day() ? me.rv.n : 0) < 1)
    return gg("Out of hacks today. Georgina sleeps.");
  hackList = (await getDocs(collection(db, "secrets"))).docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => b.t - a.t)
    .slice(0, 12);
  modal(
    `<h3>${CAP(28)} Hack</h3>${hackList.map((s) => `<p>${esc(s.text)} ${hk[s.id] ? "<b>→ " + name(hk[s.id]) + "</b>" : `<button data-h=${s.id}>Reveal who</button>`}</p>`).join("") || "<p>Nothing to steal yet.</p>"}`,
  );
}
async function reveal(id) {
  const used = me.rv?.d == day() ? me.rv.n : 0;
  if (used >= 2) return gg("Out of hacks today.");
  const s = hackList.find((x) => x.id == id),
    u = await getDoc(doc(db, "users", s.by));
  hk[id] = u.data().ch;
  await updateDoc(doc(db, "priv", uid), { ["hk." + id]: hk[id] });
  me.rv = { d: day(), n: used + 1 };
  await updateDoc(doc(db, "users", uid), { rv: me.rv });
  sfx.sting();
  modal("");
  gg(`${name(u.data().ch)} said: "${s.text}"`);
  post("Someone just used Georgina's cap to peek behind the curtain.");
  render();
}
const ring = () => {
  gg("🚨 Chit rain in 5 minutes. Voting is compulsory.");
  for (let i = 0; i < 8; i++)
    setTimeout(() => {
      snd(880, "square", 0.28, 0.14);
      setTimeout(() => snd(660, "square", 0.28, 0.14), 300);
    }, i * 700);
};
// ---- cap challenge: one per day, the leader can be challenged to any custom game ----
const cref = () => doc(db, "meta", "ch_" + day());
const chHTML = (C, nm, lead) => {
  const L = lead
    ? `<p>👑 Tomorrow's cap master if nothing changes: <b>${nm(lead)}</b></p>`
    : "";
  if (!C)
    return `<section class=card><h3>⚔️ Challenge</h3>${L}${lead && lead != uid ? `<textarea id=cg maxlength=120 placeholder="Pick your own game: arm wrestling, thumb war, chess, anything"></textarea><button id=cc>Challenge ${nm(lead)}</button>` : "<p>One challenge per day. Nobody has challenged yet.</p>"}</section>`;
  const mine = uid == C.from || uid == C.to,
    o = uid == C.from ? C.to : C.from;
  let b = `<p><b>${nm(C.from)}</b> challenged <b>${nm(C.to)}</b>: <i>${esc(C.game)}</i></p>`;
  if (C.st == "pending")
    b +=
      uid == C.to
        ? "<button data-ca=on>Accept</button> <button data-ca=no>Decline</button>"
        : "<p>Waiting for an answer…</p>";
  if (C.st == "no") b += "<p>Declined. The leader keeps the spot.</p>";
  if (C.st == "on")
    b += mine
      ? `<p>Play it for real, then both of you say who won.</p><button data-w=${C.from}>${nm(C.from)} won</button> <button data-w=${C.to}>${nm(C.to)} won</button><p>${C.v?.[uid] ? "Your pick is in. Waiting for " + nm(o) + "." : ""}</p>`
      : "<p>Challenge in progress…</p>";
  if (C.st == "done")
    b += `<p>🏆 ${nm(C.win)} wins and takes tomorrow's cap.</p>`;
  return `<section class=card><h3>⚔️ Challenge</h3>${L}${b}</section>`;
};
async function challenge() {
  const g = $("#cg").value.trim();
  if (g.length < 3) return gg("Describe the game first.");
  if ((await getDoc(cref())).exists())
    return gg("Someone already challenged today.");
  await setDoc(cref(), {
    day: day(),
    from: uid,
    to: leadUid,
    game: g,
    st: "pending",
    v: {},
  });
  post(
    `${name(me.ch)} challenged ${name(roster.find((u) => u.id == leadUid).ch)} for tomorrow's cap.`,
  );
  render();
}
async function chAct(a) {
  await updateDoc(cref(), { st: a });
  post(
    a == "on"
      ? "Challenge accepted. Blood will be spilled."
      : "The leader refused a challenge. Coward.",
  );
  render();
}
async function chWin(w) {
  await updateDoc(cref(), { ["v." + uid]: w });
  const C = (await getDoc(cref())).data(),
    o = C.from == uid ? C.to : C.from;
  if (C.v[o]) {
    if (C.v[o] == w) {
      await updateDoc(cref(), { st: "done", win: w });
      post(
        `${name(roster.find((u) => u.id == w).ch)} won the challenge and takes tomorrow's cap.`,
      );
    } else {
      await updateDoc(cref(), { v: {} });
      gg("You two disagree. Both pick again.");
    }
  }
  render();
}
function giftUI() {
  if (!(me.gp > 0)) return gg("Your gift pool is empty.");
  modal(
    `<h3>${CAP(28)} Gift points</h3><p>Pool left: <b>${me.gp}</b></p><select id=gt>${roster
      .filter((u) => u.id != uid && !u.banned)
      .map((u) => `<option value=${u.id}>${name(u.ch)}</option>`)
      .join(
        "",
      )}</select><input id=ga type=number inputmode=numeric min=1 max=${me.gp} placeholder="How many points?"><button data-g>Gift</button>`,
  );
}
async function gift() {
  const n = Math.floor(+$("#ga").value),
    to = $("#gt").value;
  if (!to || !(n >= 1) || n > me.gp)
    return gg("Pick someone and a valid amount.");
  me.gp -= n;
  await updateDoc(doc(db, "users", uid), { gp: me.gp });
  await updateDoc(doc(db, "priv", to), { pts: increment(n) });
  sfx.drip();
  modal("");
  gg(`Gifted. ${me.gp} left in your pool.`);
  post(
    `The cap master just gifted loyalty to ${name(roster.find((u) => u.id == to).ch)}.`,
  );
  render();
}
async function play() {
  const TEST = /game=/.test(location.search),
    k = day() + "_" + uid;
  if (!TEST && (await getDoc(doc(db, "scores", k))).exists())
    return gg("One try a day, sweetie.");
  gameStart = () => {
    modal(`<h3>${esc(mini.name)}</h3><div id=mg></div>`);
    mini.mount(
      $("#mg"),
      async (s) => {
        if (!TEST) await setDoc(doc(db, "scores", k), { uid, day: day(), s });
        sfx[s ? "drip" : "sting"]();
        gg(`You scored ${s}. The cap is decided at midnight.`);
        setTimeout(() => {
          modal("");
          render();
        }, 2200);
      },
      ctx,
    );
  };
  modal(
    `<h3>${esc(mini.name)}</h3><p>${esc(mini.rules || "")}</p><p>You get one scored try today.</p><button data-s>Start game</button>`,
  );
}

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
    post(`${name(pc.dataset.id)} just walked in. Fresh meat.`);
    return load();
  }
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.t) {
    tab = b.dataset.t;
    scrollTo(0, 0);
    return render();
  }
  if (b.id == "send") send();
  if (b.id == "pl") play();
  if (b.id == "hk") hack();
  if (b.id == "gf") giftUI();
  if (b.id == "cc") challenge();
  if (b.dataset.ca) chAct(b.dataset.ca);
  if (b.dataset.w) chWin(b.dataset.w);
  if (b.dataset.j) {
    const j = jarList.find((x) => x.id == b.dataset.j);
    modal(
      `<h3>${j.about ? "About " + name(j.about) : "A whisper"}</h3><blockquote>${esc(j.text)}</blockquote><p>Verdict: ${j.verdict || "not revealed yet"}</p>${hk[j.id] ? "<p>🧢 Written by <b>" + name(hk[j.id]) + "</b> (only you can see this)</p>" : ""}`,
    );
  }
};
$("#modal").onclick = (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if ("x" in b.dataset) modal("");
  if (b.dataset.h) reveal(b.dataset.h);
  if ("g" in b.dataset) gift();
  if ("s" in b.dataset) gameStart();
};
$("#rain").onclick = async (e) => {
  const c = e.target.closest(".chit");
  if (c) return c.classList.toggle("big");
  const v = e.target.dataset.v,
    s = rq[rI];
  if (!v || !s || s.by == uid || s.about == me.ch) return;
  await setDoc(doc(db, "rain", rD, "votes", s.id + "_" + uid), { v });
  sfx.drip();
  need = false;
  $("#rc").classList.remove("alarm");
  $("#rc").innerHTML =
    "<h2>Vote locked</h2><p>Nobody will know which way you voted. Next secret coming up.</p>";
  step();
};
