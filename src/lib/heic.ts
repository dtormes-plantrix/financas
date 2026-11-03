// Fotos do iPhone vêm em HEIC, que a IA não lê. Aqui viram JPEG de até ~2000 px. Roda só no servidor.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const decode: (o: { buffer: Uint8Array }) => Promise<{ width: number; height: number; data: Uint8ClampedArray }> = require("heic-decode");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jpeg: { encode: (img: { data: Uint8Array; width: number; height: number }, q: number) => { data: Uint8Array } } = require("jpeg-js");

export async function heicParaJpeg(bytes: Uint8Array, maximo = 2100): Promise<Uint8Array> {
  const img = await decode({ buffer: bytes });
  const passo = Math.max(1, Math.ceil(Math.max(img.width, img.height) / maximo));
  const w = Math.floor(img.width / passo);
  const h = Math.floor(img.height / passo);
  const saida = new Uint8Array(w * h * 4);
  // média de cada bloco passo x passo
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < passo; dy++) {
        let i = ((y * passo + dy) * img.width + x * passo) * 4;
        for (let dx = 0; dx < passo; dx++, i += 4) {
          r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2];
        }
      }
      const n = passo * passo, o = (y * w + x) * 4;
      saida[o] = r / n; saida[o + 1] = g / n; saida[o + 2] = b / n; saida[o + 3] = 255;
    }
  }
  return jpeg.encode({ data: saida, width: w, height: h }, 85).data;
}
