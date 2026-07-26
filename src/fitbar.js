// The poster's banner is set to fill its measure - the type is sized so the line
// runs edge to edge. CSS cannot do that on its own, so scale the footer's font
// size until the line fills the bar. Two passes converge because the gaps scale
// with the font size too.

function fit() {
  const bar = document.querySelector('footer');
  if (!bar) return;
  const style = getComputedStyle(bar);
  const pad = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const target = bar.clientWidth - pad;

  let size = 40;
  for (let pass = 0; pass < 3; pass++) {
    bar.style.fontSize = `${size}px`;
    const used = [...bar.children].reduce(
      (w, c) => w + c.getBoundingClientRect().width, 0)
      + parseFloat(getComputedStyle(bar).columnGap || 0) * (bar.children.length - 1);
    if (!used) break;
    size = Math.min(70, Math.max(13, size * (target / used)));
  }
  bar.style.fontSize = `${size}px`;
}

fit();
addEventListener('resize', fit);
// webfonts can land after first paint and change the measure
if (document.fonts?.ready) document.fonts.ready.then(fit);
