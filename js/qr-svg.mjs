import qrcodegen from './vendor/qrcodegen.mjs';

export function qrSvg(url) {
  const qr = qrcodegen.QrCode.encodeText(url, qrcodegen.QrCode.Ecc.MEDIUM);
  const border = 4;
  const size = qr.size + border * 2;
  const cells = [];
  for (let y = 0; y < qr.size; y += 1) {
    for (let x = 0; x < qr.size; x += 1) {
      if (qr.getModule(x, y)) cells.push(`M${x + border},${y + border}h1v1h-1z`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="Scan with your phone camera" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${cells.join('')}" fill="#191919"/></svg>`;
}
