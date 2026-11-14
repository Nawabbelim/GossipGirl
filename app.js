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
const H3 = 1.08e7,
  MISS = 5,
  REJECT = 15,
  FORCE = /rain/.test(location.search),
  $ = (s) => document.querySelector(s);
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
  gg.t = setTimeout(() => (e.className = ""), 5500);
};
const snark = () => gg(SN[(Math.random() * SN.length) | 0]);
const modal = (h) => {
  const m = $("#modal");
  m.hidden = !h;
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
  rs;
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
  const onb = me.n < 10,
    own = capUid == uid,
    left = 2 - (me.rv?.d == day() ? me.rv.n : 0);
  if (onb) tab = "home";
  const head = `<div class=ticker><span>📰 ${feed[0] ? esc(feed[0].text) : "Spotted: nothing yet. Give me something."}</span></div>`;
  const power = own
    ? `<div class=power>${CAP(90)}<div><h3>Georgina's Cap</h3><p>You hold the power. ${left} hack${left == 1 ? "" : "s"} left today.</p><button id=hk>Hack a secret</button></div></div>`
    : "";
  let h = "";
  if (tab == "home")
    h = `<section class=card><div class=row>${av(me.ch)}<div><h2>${name(me.ch)}</h2><p>Loyalty <b class=pts>${pts}</b> <small>only you can see this</small></p></div></div>${power}</section>
  <section class=card><h3>${onb ? `Initiation: secret ${me.n + 1} of 10` : "Spill, sweetie"}</h3>
  <textarea id=tx maxlength=240 placeholder="A secret. A scandal. Someone else's mess."></textarea>
  <select id=ab><option value="">About: myself, or no one in particular</option>${CH.map(([n, id]) => `<option value=${id}>About ${n}</option>`).join("")}</select>
  <button id=send>Whisper to Gossip Girl</button>${onb ? "" : "<p>Next secret due in <b id=cd></b></p>"}</section>`;
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
    h = `<section class=card><h3>${esc(mini.name)}</h3><p>A new game every day. Highest score before midnight steals the cap.</p><button id=pl>Play today's game</button></section>${power}
    <section class=card><h3>Today's scores</h3>${sc.map((s) => `<div class=lb><span>${nm(s.uid)}</span><b>${s.s}</b></div>`).join("") || "<p>No one has played yet.</p>"}</section>`;
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
  if (me.n == 10) {
    gg("Initiation done. Now I own all of you. xoxo");
    post(`${name(me.ch)} finished initiation. I now own ten of their secrets.`);
  } else {
    snark();
    if (me.n > 10)
      post(
        "A fresh whisper just landed in my inbox. Someone is feeling brave.",
      );
  }
  render();
}

// ---- chit rain: a real shower of readable chits, all carrying the same secret ----
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
  rs = (await getDoc(doc(db, "secrets", r.data().sid))).data();
  const t = esc(rs.text);
  const voted = (await getDoc(doc(db, "rain", d, "votes", uid))).exists(),
    eligible = rs.by != uid && rs.about != me.ch;
  $("#rain").hidden = false;
  sfx.thunder();
  stopRain = rainSnd();
  rainTimer = setInterval(
    () => snd(800 + Math.random() * 900, "sine", 0.04, 0.03),
    220,
  );
  $("#rain").innerHTML =
    Array.from(
      { length: 26 },
      () =>
        `<i class=chit style="--x:${Math.random() * 88}%;--d:${7 + Math.random() * 6}s;--s:-${Math.random() * 13}s;--r:${(Math.random() * 40 - 20) | 0}deg"><span><b>SPOTTED</b>${t}</span></i>`,
    ).join("") +
    `<div class=card id=rc><h2>Chit rain</h2><p>${rs.about ? "A secret about " + name(rs.about) : "A secret from someone close"}. Tap any chit to read it up close.</p>${voted ? "<p>Vote locked. Nobody will know which way you voted.</p>" : eligible ? "<button data-v=real>Genuine</button> <button data-v=fake>Fake</button>" : `<p>${rs.by == uid ? "This one is yours" : "This one is about you"}. You don't get a vote. Pray.</p>`}</div>`;
}
function endRain() {
  rainOn = 0;
  clearInterval(rainTimer);
  stopRain?.();
  $("#rain").hidden = true;
  resolve(day());
}
async function resolve(d) {
  // rejected only if EVERY eligible voter (not the author, not the subject) says fake
  const rd = doc(db, "rain", d),
    r = await getDoc(rd);
  if (!r.exists() || r.data().done) return;
  await updateDoc(rd, { done: true });
  const s = (await getDoc(doc(db, "secrets", r.data().sid))).data(),
    fakes = new Set(
      (await getDocs(collection(db, "rain", d, "votes"))).docs
        .filter((x) => x.data().v == "fake")
        .map((x) => x.id),
    );
  const el = (await getDocs(collection(db, "users"))).docs.filter(
      (x) => !x.data().banned && x.id != s.by && x.data().ch != s.about,
    ),
    bad = el.length > 0 && el.every((x) => fakes.has(x.id));
  if (bad) await updateDoc(doc(db, "priv", s.by), { pts: increment(-REJECT) });
  await updateDoc(rd, { verdict: bad ? "rejected" : "genuine" });
  const m = bad
    ? "Last night's secret was declared fake. The liar paid for it."
    : "Last night's secret was real. Someone should be nervous.";
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
  if (sc[0]) {
    await setDoc(cd, { uid: sc[0].uid, for: y });
    post("A new head wears Georgina's cap today. Watch your backs.");
  }
}
async function hack() {
  if (2 - (me.rv?.d == day() ? me.rv.n : 0) < 1)
    return gg("Out of hacks today. Georgina sleeps.");
  hackList = (await getDocs(collection(db, "secrets"))).docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => b.t - a.t)
    .slice(0, 12);
  modal(
    `<h3>${CAP(28)} Hack</h3>${hackList.map((s) => `<p>${esc(s.text)} <button data-h=${s.id}>Reveal who</button></p>`).join("") || "<p>Nothing to steal yet.</p>"}`,
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
  post("Someone just used Georgina's cap to peek behind the curtain.");
  render();
}
async function play() {
  const k = day() + "_" + uid;
  if ((await getDoc(doc(db, "scores", k))).exists())
    return gg("One try a day, sweetie.");
  modal(`<h3>${esc(mini.name)}</h3><div id=mg></div>`);
  mini.mount(
    $("#mg"),
    async (s) => {
      await setDoc(doc(db, "scores", k), { uid, day: day(), s });
      sfx[s ? "drip" : "sting"]();
      gg(`You scored ${s}. The cap is decided at midnight.`);
      setTimeout(() => {
        modal("");
        render();
      }, 2200);
    },
    ctx,
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
    return render();
  }
  if (b.id == "send") send();
  if (b.id == "pl") play();
  if (b.id == "hk") hack();
};
$("#modal").onclick = (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if ("x" in b.dataset) modal("");
  if (b.dataset.h) reveal(b.dataset.h);
};
$("#rain").onclick = async (e) => {
  const c = e.target.closest(".chit");
  if (c) return c.classList.toggle("big");
  const v = e.target.dataset.v;
  if (!v || rs.by == uid || rs.about == me.ch) return;
  await setDoc(doc(db, "rain", day(), "votes", uid), { v });
  sfx.drip();
  e.target.parentElement.innerHTML =
    "<h2>Vote locked</h2><p>Nobody will know which way you voted.</p>";
};
