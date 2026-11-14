// Daily mini-game plug-in. Add or swap games in the G list. Contract: {name, mount(root, finish, ctx)}.
// finish(score) once (higher wins). ctx.seed = same number for everyone today. ctx.daily(key, fn) = fetch once, share with all players.
const rng = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt()};`);
const FB = [
  {
    q: "Who was revealed as Gossip Girl in the series finale?",
    a: "Dan Humphrey",
    o: ["Dan Humphrey", "Nate Archibald", "Georgina Sparks", "Jenny Humphrey"],
  },
  {
    q: "What is Chuck Bass's hotel called?",
    a: "The Empire",
    o: ["The Empire", "The Palace", "The Plaza", "The Ritz"],
  },
  {
    q: "Which school do the main characters attend?",
    a: "Constance Billard",
    o: ["Constance Billard", "St. Jude's", "Hogwarts", "Dalton"],
  },
];

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
      e.onclick = () => {
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

const trivia = {
  name: "Spill or Spare Quiz",
  async mount(root, finish, ctx) {
    root.textContent = "Loading today's questions…";
    const dec = (h) => {
      const t = document.createElement("textarea");
      t.innerHTML = h;
      return t.value;
    };
    const Q = await ctx.daily("quiz", async () => {
      try {
        const j = await (
          await fetch(
            "https://opentdb.com/api.php?amount=5&category=14&type=multiple",
          )
        ).json();
        return j.results.map((q) => ({
          q: dec(q.question),
          a: dec(q.correct_answer),
          o: [...q.incorrect_answers, q.correct_answer].map(dec),
        }));
      } catch {
        return FB;
      }
    });
    let i = 0,
      sc = 0,
      t0 = Date.now();
    const show = () => {
      if (i >= Q.length) return finish(sc);
      const q = Q[i],
        r = rng(ctx.seed + i),
        o = q.o
          .map((v) => [r(), v])
          .sort((a, b) => a[0] - b[0])
          .map((x) => x[1]);
      t0 = Date.now();
      root.innerHTML = `<p>Question ${i + 1} of ${Q.length}. Faster answers score more.</p><h3>${esc(q.q)}</h3><div class=q>${o.map((v) => `<button>${esc(v)}</button>`).join("")}</div>`;
      root.querySelectorAll(".q button").forEach(
        (b) =>
          (b.onclick = () => {
            if (b.textContent == q.a)
              sc += 50 + Math.max(0, (50 - (Date.now() - t0) / 400) | 0);
            i++;
            show();
          }),
      );
    };
    show();
  },
};

// const G = [catcher, memory, trivia][Math.floor(Date.now() / 864e5) % 3];
const G = catcher; // tempp
export default { name: G.name, mount: G.mount };
