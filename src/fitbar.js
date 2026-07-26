// The poster's banner is set to fill its measure. Scale the footer's type until
// the line runs edge to edge. Two passes converge, because the gaps and the
// padding are in em and move with the font size.

function fit() {
  const bar = document.querySelector('footer');
  if (!bar) return;
  let size = 30;
  for (let pass = 0; pass < 4; pass++) {
    bar.style.fontSize = `${size}px`;
    const cs = getComputedStyle(bar);
    const target = bar.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const gaps = parseFloat(cs.columnGap || 0) * (bar.children.length - 1);
    const used = [...bar.children].reduce((w, c) => w + c.getBoundingClientRect().width, 0) + gaps;
    if (!used || !target) return;
    size = Math.max(11, size * (target / used));
  }
  bar.style.fontSize = `${size}px`;
}

fit();
addEventListener('resize', fit);
if (document.fonts?.ready) document.fonts.ready.then(fit);
