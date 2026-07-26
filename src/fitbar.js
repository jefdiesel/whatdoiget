// The poster's banner fills its measure: the line runs the full width of the
// sheet, flush at both edges. Scale the type until it does.
//
// This has to wait for the grid to lay out - the sheet's width comes from the
// grid, so measuring too early gives a stale target and the line lands short.

function fit() {
  const bar = document.querySelector('.banner');
  if (!bar || !bar.children.length) return;
  const target = bar.clientWidth;
  if (!target) return;

  let size = 24;
  for (let pass = 0; pass < 6; pass++) {
    bar.style.fontSize = `${size}px`;
    const gap = parseFloat(getComputedStyle(bar).columnGap) || 0;
    const used = [...bar.children].reduce((w, c) => w + c.getBoundingClientRect().width, 0)
      + gap * (bar.children.length - 1);
    if (!used) return;
    const next = size * (target / used);
    if (Math.abs(next - size) < 0.05) break;
    size = Math.max(9, next);
  }
  bar.style.fontSize = `${size}px`;
}

export function fitBanner() {
  // two frames: one for the grid to size the sheet, one to measure against it
  requestAnimationFrame(() => requestAnimationFrame(fit));
}

fitBanner();
addEventListener('resize', fit);
if (document.fonts?.ready) document.fonts.ready.then(fit);
