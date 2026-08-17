// 深入分析 drag-log.csv：尺寸增长与移动的关联
import fs from "fs";

const file = process.argv[2] || "drag-log.csv";
const raw = fs.readFileSync(file, "utf8").split("\n");
const rows = [];
for (const l of raw) {
  const t = l.trim();
  if (!t || t.startsWith("#")) continue;
  const p = t.split(",").map(Number);
  if (p.length < 17 || p.some(isNaN)) continue;
  rows.push({ t: p[0], wx: p[1], wy: p[2], tx: p[3], ty: p[4], rx: p[7], ry: p[8], cx: p[9], cy: p[10], kx: p[11], ky: p[12], szw: p[13], szh: p[14] });
}
const n = rows.length;
console.log("总事件数:", n);

// 1) 尺寸增量分布
const tally = (a) => { const m = {}; for (const v of a) m[v] = (m[v] || 0) + 1; return m; };
const dSzW = [], dSzH = [], dPos = [], dCur = [];
for (let i = 1; i < n; i++) {
  dSzW.push(rows[i].szw - rows[i - 1].szw);
  dSzH.push(rows[i].szh - rows[i - 1].szh);
  dPos.push(Math.abs(rows[i].wx - rows[i - 1].wx) + Math.abs(rows[i].wy - rows[i - 1].wy));
  dCur.push(Math.abs(rows[i].rx - rows[i - 1].rx) + Math.abs(rows[i].ry - rows[i - 1].ry));
}
console.log("\n[尺寸增量分布] 宽:", JSON.stringify(tally(dSzW)));
console.log("[尺寸增量分布] 高:", JSON.stringify(tally(dSzH)));

// 2) 尺寸增长 vs 窗口是否移动（无位置变化的纯增长事件有多少）
let growNoMove = 0, growWithMove = 0, noGrow = 0;
for (let i = 1; i < n; i++) {
  const g = (rows[i].szw - rows[i - 1].szw) + (rows[i].szh - rows[i - 1].szh);
  if (g > 0) { if (dPos[i - 1] === 0) growNoMove++; else growWithMove++; }
  else noGrow++;
}
console.log(`\n[增长与移动] 有增长且窗口动了: ${growWithMove}，有增长但窗口没动: ${growNoMove}，无增长: ${noGrow}`);

// 3) 尺寸增长 vs 光标是否移动
let growCurStill = 0, growCurMove = 0;
for (let i = 1; i < n; i++) {
  const g = (rows[i].szw - rows[i - 1].szw) + (rows[i].szh - rows[i - 1].szh);
  if (g > 0) { if (dCur[i - 1] === 0) growCurStill++; else growCurMove++; }
}
console.log(`[增长与光标] 有增长且光标动了: ${growCurMove}，有增长但光标没动: ${growCurStill}`);

// 4) 尺寸增量 vs 位置增量散点（前80个事件明细）
console.log("\n[前80事件明细] 格式: 窗口dx,dy | 尺寸dw,dh | 光标drx,dry | 目标tx,ty | kx,ky");
for (let i = 1; i <= 80; i++) {
  const a = rows[i - 1], b = rows[i];
  const dx = b.wx - a.wx, dy = b.wy - a.wy;
  const sdw = b.szw - a.szw, sdh = b.szh - a.szh;
  const crx = b.rx - a.rx, cry = b.ry - a.ry;
  console.log(`${dx},${dy} | ${sdw},${sdh} | ${crx},${cry} | ${b.tx},${b.ty} | ${b.kx.toFixed(3)},${b.ky.toFixed(3)}`);
}

// 5) 增长率分段
console.log("\n[每100事件窗口尺寸与位置]");
for (let s = 0; s < n; s += 100) {
  const e = Math.min(s + 100, n - 1);
  console.log(`evt ${s}-${e}: size=(${rows[s].szw},${rows[s].szh})→(${rows[e].szw},${rows[e].szh}) pos=(${rows[s].wx},${rows[s].wy})→(${rows[e].wx},${rows[e].wy}) cur=(${rows[s].rx},${rows[s].ry})→(${rows[e].rx},${rows[e].ry})`);
}

// 6) 最后一个 3 秒：光标静止段后尺寸是否继续增长
const last = rows[n - 1];
console.log(`\n[末尾] 最后事件: size=(${last.szw},${last.szh}) pos=(${last.wx},${last.wy}) cur=(${last.rx},${last.ry}) k=(${last.kx.toFixed(3)},${last.ky.toFixed(3)})`);
