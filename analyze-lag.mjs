// 分析 v0.0.11 日志：找“光标在动但窗口没动”的卡顿间隔
import fs from "fs";

const file = process.argv[2] || "drag-log.csv";
const raw = fs.readFileSync(file, "utf8").split("\n");
const rows = [];
for (const l of raw) {
  const t = l.trim();
  if (!t || t.startsWith("#")) continue;
  const p = t.split(",").map(Number);
  if (p.length < 17 || p.some(isNaN)) continue;
  rows.push({ t: p[0], wx: p[1], wy: p[2], tx: p[3], ty: p[4], rx: p[7], ry: p[8], cx: p[9], cy: p[10], kx: p[11], ky: p[12], szw: p[13], szh: p[14], sb: p[17] });
}
const n = rows.length;
console.log("事件数:", n, " 时长:", ((rows[n - 1].t - rows[0].t) / 1000).toFixed(2) + "s");
console.log("尺寸范围: w", Math.min(...rows.map(r => r.szw)), "-", Math.max(...rows.map(r => r.szw)), " h", Math.min(...rows.map(r => r.szh)), "-", Math.max(...rows.map(r => r.szh)));
console.log("位置范围: wx", Math.min(...rows.map(r => r.wx)), "-", Math.max(...rows.map(r => r.wx)), " wy", Math.min(...rows.map(r => r.wy)), "-", Math.max(...rows.map(r => r.wy)));
console.log("k 范围: kx", Math.min(...rows.map(r => r.kx)).toFixed(3), "-", Math.max(...rows.map(r => r.kx)).toFixed(3), " ky", Math.min(...rows.map(r => r.ky)).toFixed(3), "-", Math.max(...rows.map(r => r.ky)).toFixed(3));
const sbs = rows.filter(r => typeof r.sb === "number").map(r => r.sb);
if (sbs.length) {
  sbs.sort((a, b) => a - b);
  console.log("setBounds 耗时(ms): p50=", sbs[Math.floor(sbs.length * 0.5)], " p90=", sbs[Math.floor(sbs.length * 0.9)], " max=", sbs[sbs.length - 1], " 均值=", (sbs.reduce((a, b) => a + b, 0) / sbs.length).toFixed(1));
}

// 事件间隔
const gaps = [];
for (let i = 1; i < n; i++) gaps.push(rows[i].t - rows[i - 1].t);
gaps.sort((a, b) => a - b);
console.log("事件间隔(ms): p50=", gaps[Math.floor(gaps.length * 0.5)], " p90=", gaps[Math.floor(gaps.length * 0.9)], " max=", gaps[gaps.length - 1]);

// 卡顿：光标动 >=5px 但窗口动 <=1px 的连续事件段
console.log("\n[卡顿段] 光标在动但窗口几乎不动（连续事件归并）:");
let segs = [];
let cur = null;
for (let i = 1; i < n; i++) {
  const a = rows[i - 1], b = rows[i];
  const cMove = Math.abs(b.rx - a.rx) + Math.abs(b.ry - a.ry);
  const wMove = Math.abs(b.wx - a.wx) + Math.abs(b.wy - a.wy);
  if (cMove >= 5 && wMove <= 1) {
    if (!cur) cur = { start: i - 1, end: i, cSum: 0, wSum: 0 };
    cur.end = i;
    cur.cSum += cMove;
    cur.wSum += wMove;
  } else if (cur) { segs.push(cur); cur = null; }
}
if (cur) segs.push(cur);
console.log("卡顿段数:", segs.length);
segs.slice(0, 10).forEach(s => {
  const a = rows[s.start], b = rows[s.end];
  const dur = b.t - a.t;
  console.log(`  段: evt${s.start}-${s.end} 时长=${dur}ms 光标累计移动=${s.cSum}px 窗口移动=${s.wSum}px 光标(${a.rx},${a.ry})→(${b.rx},${b.ry}) 窗口(${a.wx},${a.wy})→(${b.wx},${b.wy}) k=(${b.kx.toFixed(3)},${b.ky.toFixed(3)})`);
});

// 对照：光标动且窗口也动的正常段
console.log("\n[对照] 前10个正常跟随事件对:");
let shown = 0;
for (let i = 1; i < n && shown < 10; i++) {
  const a = rows[i - 1], b = rows[i];
  const cMove = Math.abs(b.rx - a.rx) + Math.abs(b.ry - a.ry);
  const wMove = Math.abs(b.wx - a.wx) + Math.abs(b.wy - a.wy);
  if (cMove >= 5 && wMove > 1) {
    console.log(`  evt${i}: 光标(${a.rx},${a.ry})→(${b.rx},${b.ry}) 窗口(${a.wx},${a.wy})→(${b.wx},${b.wy}) dt=${b.t - a.t}ms`);
    shown++;
  }
}

// 窗口滞后量：cursor(renderer) 与窗口位置关系 —— 用 (rx-cx) 估计窗口应处位置
console.log("\n[滞后估计] 窗口位置 - 渲染端推算位置(rx-cx)：");
const lag = [];
for (let i = 0; i < n; i++) {
  const r = rows[i];
  lag.push({ x: r.wx - (r.rx - r.cx), y: r.wy - (r.ry - r.cy) });
}
const lx = lag.map(l => l.x), ly = lag.map(l => l.y);
console.log("  x: min=", Math.min(...lx), " max=", Math.max(...lx), " 末尾=", lx[lx.length - 1]);
console.log("  y: min=", Math.min(...ly), " max=", Math.max(...ly), " 末尾=", ly[ly.length - 1]);

// 大间隔（事件流中断 = 潜在卡顿）
console.log("\n[事件间隔 > 60ms 的缺口]");
const bigGaps = [];
for (let i = 1; i < n; i++) {
  const g = rows[i].t - rows[i - 1].t;
  if (g > 60) bigGaps.push({ i, g, a: rows[i - 1], b: rows[i] });
}
console.log("缺口数:", bigGaps.length, " 最大:", bigGaps.length ? Math.max(...bigGaps.map(g => g.g)) : 0, "ms");
bigGaps.slice(0, 15).forEach(g => {
  console.log(
    `  缺口${g.g}ms @evt${g.i}: 光标(${g.a.rx},${g.a.ry})→(${g.b.rx},${g.b.ry}) ` +
    `窗口(${g.a.wx},${g.a.wy})→(${g.b.wx},${g.b.wy})`
  );
});
if (bigGaps.length) {
  const g = bigGaps.reduce((m, x) => x.g > m.g ? x : m, bigGaps[0]);
  console.log("  [最大缺口前后各4个事件]");
  for (let j = Math.max(1, g.i - 4); j < Math.min(n, g.i + 5); j++) {
    const r = rows[j];
    console.log(`    evt${j}: t=${r.t} 光标(${r.rx},${r.ry}) 窗口(${r.wx},${r.wy})`);
  }
}
