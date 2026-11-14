// Daily mini-game plug-in. Add or swap games in the G list. Contract: {name, mount(root, finish, ctx)}.
// finish(score) once (higher wins). ctx.seed = same number for everyone today. ctx.daily(key, fn) = fetch once, share with all players.
const rng = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt()};`);

const catcher = {
  name: "Chit Catcher",
  mount(root, finish) {
    let sc = 0,
      t = 20;
    root.innerHTML = `<p>20 seconds. Catch gossip chits (+10). Dodge the skulls (-20).</p><h2>Score <b id=sc>0</b> · <span id=tm>20</span>s</h2><div class=arena></div>`;
    const A = root.querySelector(".arena"),
      up = () => {
        root.querySelector("#sc").textContent = sc;
        root.querySelector("#tm").textContent = t;
      };
    const sp = setInterval(() => {
      const e = document.createElement("button"),
        sk = Math.random() < 0.25;
      e.className = "fl";
      e.textContent = sk ? "💀" : "✉️";
      e.style.cssText = `left:${Math.random() * 85}%;animation-duration:${1.5 + Math.random() * 1.5}s`;
      e.onpointerdown = () => {
        sc = Math.max(0, sc + (sk ? -20 : 10));
        e.remove();
        up();
      };
      e.onanimationend = () => e.remove();
      A.append(e);
    }, 400);
    const tm = setInterval(() => {
      t--;
      up();
      if (t < 1) {
        clearInterval(sp);
        clearInterval(tm);
        A.innerHTML = "";
        finish(sc);
      }
    }, 1e3);
  },
};

const memory = {
  name: "Secret Pairs",
  mount(root, finish, ctx) {
    const E = ["🗝️", "💋", "🔪", "🩸", "🕶️", "🧢"],
      r = rng(ctx.seed),
      d = [...E, ...E]
        .map((v) => [r(), v])
        .sort((a, b) => a[0] - b[0])
        .map((x) => x[1]);
    let open = [],
      mv = 0,
      done = 0,
      lock = 0;
    const t0 = Date.now();
    root.innerHTML = `<p>Match all 6 pairs. Fewer moves and less time means a higher score. Same board for everyone today.</p><div class="mg m">${d.map((v, i) => `<button data-i=${i}>❓</button>`).join("")}</div>`;
    root.onclick = (e) => {
      const b = e.target.closest("button");
      if (!b || lock || b.disabled || open.includes(b)) return;
      b.textContent = d[b.dataset.i];
      open.push(b);
      if (open.length < 2) return;
      mv++;
      const [a, c] = open;
      open = [];
      if (a.textContent == c.textContent) {
        a.disabled = c.disabled = true;
        if (++done == 6)
          finish(
            Math.max(1, Math.round(300 - mv * 10 - (Date.now() - t0) / 500)),
          );
      } else {
        lock = 1;
        setTimeout(() => {
          a.textContent = c.textContent = "❓";
          lock = 0;
        }, 700);
      }
    };
  },
};

const target = {
  name: "Right Target",
  mount(root, finish) {
    const E = ["🗝️", "💋", "🔪", "🩸", "🕶️", "🧢", "🥀", "🕯️", "🎭"],
      q = (s) => root.querySelector(s);
    let sc = 0,
      t = 20,
      want,
      t0;
    root.innerHTML = `<p>Shoot the target that matches. Right +10 (faster = more), wrong -10. 20 seconds.</p><h2>Find <span id=w></span> · Score <b id=sc>0</b> · <span id=tm>20</span>s</h2><div class="mg tg"></div>`;
    const Gd = q(".tg"),
      next = () => {
        const o = [...E].sort(() => Math.random() - 0.5);
        want = o[(Math.random() * 9) | 0];
        q("#w").textContent = want;
        Gd.innerHTML = o.map((v) => `<button>${v}</button>`).join("");
        t0 = Date.now();
      };
    Gd.onpointerdown = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      sc +=
        b.textContent == want
          ? 10 + Math.max(0, (10 - (Date.now() - t0) / 150) | 0)
          : -10;
      q("#sc").textContent = sc;
      next();
    };
    const tm = setInterval(() => {
      q("#tm").textContent = --t;
      if (t < 1) {
        clearInterval(tm);
        finish(Math.max(0, sc));
      }
    }, 1e3);
    next();
  },
};

const knife = {
  name: "Knife Outline",
  mount(root, finish) {
    const P = [
        [30, 150],
        [110, 118],
        [180, 120],
        [270, 120],
        [270, 175],
        [180, 175],
        [180, 165],
        [30, 150],
      ],
      S = [];
    for (let i = 0; i < P.length - 1; i++) {
      const [a, b] = P[i],
        [c, d] = P[i + 1],
        n = Math.ceil(Math.hypot(c - a, d - b) / 6);
      for (let k = 0; k < n; k++)
        S.push([a + ((c - a) * k) / n, b + ((d - b) * k) / n]);
    }
    root.innerHTML = `<p>Trace the knife outline in one go. Cover every part and stay on the line.</p><canvas width=300 height=260 class=cv></canvas><p><button id=ok>Done</button> <button id=rs>Clear</button></p>`;
    const cv = root.querySelector("canvas"),
      x = cv.getContext("2d");
    let U = [],
      dw = 0,
      dn = 0;
    const draw = () => {
      x.clearRect(0, 0, 300, 260);
      x.strokeStyle = "#7a0010";
      x.setLineDash([6, 6]);
      x.lineWidth = 3;
      x.beginPath();
      P.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b)));
      x.stroke();
      x.setLineDash([]);
      x.fillStyle = "#fff";
      U.forEach(([a, b]) => x.fillRect(a - 1.5, b - 1.5, 3, 3));
    };
    const add = (e) => {
      const r = cv.getBoundingClientRect();
      U.push([
        ((e.clientX - r.left) * 300) / r.width,
        ((e.clientY - r.top) * 260) / r.height,
      ]);
      draw();
    };
    cv.onpointerdown = (e) => {
      dw = 1;
      cv.setPointerCapture(e.pointerId);
      add(e);
    };
    cv.onpointermove = (e) => dw && add(e);
    cv.onpointerup = () => (dw = 0);
    root.querySelector("#rs").onclick = () => {
      U = [];
      draw();
    };
    root.querySelector("#ok").onclick = () => {
      if (dn || U.length < 10) return;
      dn = 1;
      const d = (p, l) =>
        Math.min(...l.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1])));
      const cov = S.filter((p) => d(p, U) < 14).length / S.length,
        st = U.filter((p) => d(p, S) > 18).length / U.length;
      finish(Math.round(100 * cov * (1 - st)));
    };
    draw();
  },
};

const toss = {
  name: "Perfect Throw",
  mount(root, finish) {
    let r = 0,
      sc = 0,
      pos = 0,
      dir = 1,
      sp = 1.2,
      raf;
    const q = (s) => root.querySelector(s);
    root.innerHTML = `<p>Stop the blade in the red zone. 5 throws, each one faster.</p><h3>Throw <b id=n>1</b> of 5 · Score <b id=sc>0</b></h3><div class=bar><i class=zone></i><i class=mk></i></div><p><button id=st>Throw!</button></p>`;
    const mk = q(".mk"),
      loop = () => {
        pos += dir * sp;
        if (pos > 100 || pos < 0) {
          dir = -dir;
          pos = Math.max(0, Math.min(100, pos));
        }
        mk.style.left = pos + "%";
        raf = requestAnimationFrame(loop);
      };
    loop();
    q("#st").onpointerdown = () => {
      sc = +(sc + Math.max(0, 20 - Math.abs(pos - 50) * 0.8)).toFixed(1);
      sp *= 1.25;
      q("#sc").textContent = sc;
      if (++r >= 5) {
        cancelAnimationFrame(raf);
        finish(sc);
      } else q("#n").textContent = r + 1;
    };
  },
};

const seq = {
  name: "Bloody Sequence",
  mount(root, finish, ctx) {
    const r = rng(ctx.seed),
      n = [...Array(16)]
        .map((_, i) => i + 1)
        .map((v) => [r(), v])
        .sort((a, b) => a[0] - b[0])
        .map((x) => x[1]);
    let k = 1;
    const t0 = Date.now();
    root.innerHTML = `<p>Tap 1 to 16 in order, as fast as you can. Same board for everyone today.</p><div class="mg sq">${n.map((v) => `<button>${v}</button>`).join("")}</div>`;
    root.querySelector(".sq").onpointerdown = (e) => {
      const b = e.target.closest("button");
      if (!b || b.disabled || +b.textContent != k) return;
      b.disabled = true;
      b.style.opacity = 0.25;
      if (++k > 16)
        finish(Math.max(1, Math.round(1000 - (Date.now() - t0) / 40)));
    };
  },
};

const quick = {
  name: "Quick Draw",
  mount(root, finish) {
    let r = 0,
      tot = 0,
      go = 0,
      t0,
      to;
    root.innerHTML = `<p>Wait for the screen to bleed red, then tap fast. Tap early and the round scores zero. 5 rounds.</p><div class=pad>Wait for it…</div><p>Round <b id=n>1</b> of 5</p>`;
    const pad = root.querySelector(".pad"),
      arm = () => {
        go = 0;
        pad.className = "pad";
        pad.textContent = "Wait for it…";
        to = setTimeout(
          () => {
            go = 1;
            t0 = Date.now();
            pad.className = "pad go";
            pad.textContent = "NOW!";
          },
          1200 + Math.random() * 2500,
        );
      };
    pad.onpointerdown = () => {
      let ms = 800;
      if (go) ms = Math.min(800, Date.now() - t0);
      else clearTimeout(to);
      tot += 800 - ms;
      if (++r >= 5) return finish(Math.round(tot / 10));
      root.querySelector("#n").textContent = r + 1;
      arm();
    };
    arm();
  },
};

// One game per weekday (Sun..Sat). Reorder or swap entries to change the week.
const G = [catcher, memory, target, knife, toss, seq, quick][
  new Date().getDay()
];
export default { name: G.name, mount: G.mount };
