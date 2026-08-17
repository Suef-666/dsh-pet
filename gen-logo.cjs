// 生成 dsh-pet 插件 logo.png（64x64 蓝色圆形，纯 Node 无依赖）
const zlib = require("zlib");
const fs = require("fs");

const W = 64, H = 64;
const raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) {
  const row = y * (1 + W * 4);
  raw[row] = 0; // filter none
  for (let x = 0; x < W; x++) {
    const dx = x - (W - 1) / 2, dy = y - (H - 1) / 2;
    const r2 = dx * dx + dy * dy;
    const p = row + 1 + x * 4;
    const rr = (W / 2) * (W / 2);
    if (r2 <= rr * 0.82) {
      // 主体蓝色
      raw[p] = 47; raw[p + 1] = 111; raw[p + 2] = 237; raw[p + 3] = 255;
    } else if (r2 <= rr) {
      // 描边深蓝
      raw[p] = 24; raw[p + 1] = 72; raw[p + 2] = 168; raw[p + 3] = 255;
    } else {
      raw[p] = 0; raw[p + 1] = 0; raw[p + 2] = 0; raw[p + 3] = 0;
    }
  }
}

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 6;  // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);
fs.writeFileSync(__dirname + "/logo.png", png);
console.log("logo.png written:", png.length, "bytes");
