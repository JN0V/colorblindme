/**
 * A drawn garden, used as the default subject.
 *
 * The page has to open showing what it does. Asking for a photo first means
 * the first thing a visitor sees is an empty frame, and the argument this
 * tool exists to make never gets made. A garden is also the right subject:
 * red flowers against green foliage is the canonical confusion, and it is
 * what people actually point at when they say "what does this look like to
 * you?".
 */
export function drawScene(ctx, w, h) {
  const S = 390 / w;              // the scene is authored at 390 wide
  ctx.save();
  ctx.scale(1 / S, 1 / S);
  const H = h * S;
  const sky = H * 0.62, ground = H * 0.62;

  ctx.fillStyle = "#7FB2D9"; ctx.fillRect(0, 0, 390, sky);
  ctx.fillStyle = "#F2C14E"; circle(ctx, 320, H * 0.16, 26);
  ctx.fillStyle = "#6FA84B"; ctx.fillRect(0, ground, 390, H - ground);

  ctx.fillStyle = "#D9CBB2";
  ctx.beginPath();
  ctx.moveTo(0, ground + H * 0.10); ctx.lineTo(390, ground + H * 0.04);
  ctx.lineTo(390, ground + H * 0.16); ctx.lineTo(0, ground + H * 0.23);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = "#EDE3D2"; ctx.fillRect(44, sky * 0.58, 96, ground - sky * 0.58);
  ctx.fillStyle = "#C0503F";
  ctx.beginPath();
  ctx.moveTo(36, sky * 0.58); ctx.lineTo(92, sky * 0.38); ctx.lineTo(148, sky * 0.58);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = "#8B5E3C"; ctx.fillRect(248, sky * 0.68, 13, ground - sky * 0.68);
  ctx.fillStyle = "#4E8C3A";
  circle(ctx, 254, sky * 0.60, 34);
  circle(ctx, 292, sky * 0.68, 22);

  // Red on green is the pair the whole project is about.
  const flowers = [[30, 0.74, "#D1453B"], [74, 0.80, "#E2762F"], [120, 0.75, "#D1453B"],
                   [196, 0.84, "#D96A9A"], [238, 0.79, "#D1453B"], [300, 0.87, "#E2762F"],
                   [348, 0.78, "#D96A9A"]];
  for (const [x, ry, col] of flowers) { ctx.fillStyle = col; circle(ctx, x, H * ry, 9); }
  ctx.restore();
}
function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
