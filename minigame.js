// Daily mini-game plug-in. To swap the game, replace this file.
// Contract: export default { name, mount(root, finish) }; call finish(score 0-100) exactly once.
const N = 7,
  MAX = 14;
export default {
  name: "Blockade Run",
  mount(root, finish) {
    let r = N - 1,
      c = 3,
      mv = 0,
      end = 0;
    const W = new Set();
    const near = (a, b) => Math.abs(a - r) + Math.abs(b - c) == 1;
    const draw = () => {
      root.innerHTML = `<p>Reach the top row before they box you in. Every step, a blockade drops. Moves left: <b>${MAX - mv}</b></p><div class=mg style="--n:${N}">${Array.from(
        { length: N * N },
        (_, i) => {
          const a = (i / N) | 0,
            b = i % N,
            k = a + "," + b;
          return `<button data-k="${k}" class="${W.has(k) ? "w" : ""} ${a == r && b == c ? "me" : ""} ${a == 0 ? "goal" : ""} ${!W.has(k) && near(a, b) ? "ok" : ""}">${a == r && b == c ? "🔪" : W.has(k) ? "✖" : ""}</button>`;
        },
      ).join("")}</div>`;
    };
    root.onclick = (e) => {
      const k = e.target.closest("button")?.dataset.k;
      if (!k || end) return;
      const [a, b] = k.split(",").map(Number);
      if (W.has(k) || !near(a, b)) return;
      r = a;
      c = b;
      mv++;
      if (r == 0) {
        end = 1;
        draw();
        return finish((MAX - mv + 1) * 10);
      }
      for (let t = 0; t < 30; t++) {
        // drop a blockade somewhere ahead of you
        const x = (Math.random() * (r + 1)) | 0,
          y = (Math.random() * N) | 0,
          kk = x + "," + y;
        if (!(x == r && y == c) && !W.has(kk)) {
          W.add(kk);
          break;
        }
      }
      const free = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dr, dc]) => {
        const x = r + dr,
          y = c + dc;
        return x >= 0 && x < N && y >= 0 && y < N && !W.has(x + "," + y);
      });
      draw();
      if (mv >= MAX || !free) {
        end = 1;
        finish(0);
      }
    };
    draw();
  },
};
