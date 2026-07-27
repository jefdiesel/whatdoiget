// The about copy, kept in one place and shown as an overlay on both views
// rather than as a page you navigate away from.
export const ABOUT_HTML = `
  <p class="kicker">Mint</p>

  <h2>The Drop</h2>
  <dl>
    <div class="row"><dt>Edition</dt><dd>180</dd></div>
    <div class="row"><dt>Allowlist</dt><dd>Free WL offered before mint</dd></div>
    <div class="row"><dt>Mint price</dt><dd>0.001978 ETH</dd></div>
    <div class="row"><dt>Mint date</dt><dd>1 August</dd></div>
    <div class="row"><dt>Chain</dt><dd>Ethereum mainnet</dd></div>
    <div class="row"><dt>Artwork</dt><dd>SVG on chain</dd></div>
  </dl>
  <hr>

  <p class="kicker">Buzzcocks · United Artists UP 36348 · February 1978</p>

  <p class="kicker">Statement</p>

  <h2>The Joke Is The Product</h2>
  <p>
    In February 1978 United Artists papered record shops with an advert for a
    Buzzcocks single. Along the bottom, in Malcolm Garrett's condensed caps, it
    described the record it was selling: <em>New Product · Single Item ·
    UP 36348</em>. A song about wanting something and not getting it, filed
    under a catalogue number and moved as stock.
  </p>
  <p>
    That was already a joke, and Garrett was in on it. Punk's house style in
    1978 was the ransom note — torn paper, photocopier grain, deliberate
    illiteracy. He went the opposite way: a modernist grid, Eurostile and
    Univers, the corporate typefaces of annual reports and airport signage, and
    a band name set like a company mark. He made the sleeve look like packaging.
    Aimed at the record industry, that is a far sharper thing to say than any
    amount of scrawl.
  </p>

  <h2>Pointed At The Present</h2>
  <p>
    This edition takes that joke and aims it at the form it now lives in. An NFT
    is the purest available expression of art-as-commodity: a thing whose
    entire apparatus is scarcity, provenance, floor price and rank. Restaging a
    1978 gag about a record being <em>New Product</em> inside the most
    speculative container the art market has produced is not incidental to the
    piece. It is the piece.
  </p>
  <p>
    So the mint is blind. You pay before you know which square you get. The
    artwork is drawn at random when the token is created; there is no preview,
    because a preview would let you choose, and choosing would let you off. You
    buy the question. Everything else — the cut, the eight orientations, the six
    words, the rarity ranks that this very page invites you to sort by — is the
    apparatus that makes it land. The rarity table is part of the joke, not an
    exception to it.
  </p>

  <h2>Reference, Not Reproduction</h2>
  <p>
    This is a design study before it is anything else. The poster was not copied;
    it was taken apart. Measuring it revealed that the whole field is <em>one</em>
    hand-cut square, photocopied and pasted down in eight orientations — every
    arrow and chevron across it is emergent, produced by how neighbours happen to
    line up. No tile contains one. That finding is the work.
  </p>
  <p>
    So nothing here was invented to look right. The cut runs at 21.4°, fitted
    across 61 of the poster's 63 tiles. Ink covers 54.6%. Type sits at a cap
    height of 0.070 with a 0.037 inset. Even the rarity is measured rather than
    assigned: the white region has three edges type can align to, the shortest is
    too short for the longest words, and the 3:2 ratio falls out of the geometry
    without anyone choosing it. The 36 items that reproduce a state Garrett
    actually printed carry his name.
  </p>
  <p>
    What is reproduced is a method, not an image — and the reconstruction is
    offered as commentary on how that method worked and on what the object was
    already saying about itself.
  </p>

  <h2>How It Was Read</h2>
  <p>
    The poster was analysed with Claude Opus 5. Not to generate anything — every
    mark in this edition traces back to a measurement — but to read a 1,125-pixel
    scan closely enough to recover the system underneath it. Pixels were sorted
    into three plates by hue and luminance; the grid pitch was found by scoring
    candidate lattices against colour-transition energy, which put it at 161.5px
    on both axes and so established the tiles were square: 7 across, 9 down, 63
    in all.
  </p>
  <p>
    Then every tile was matched against every other under the eight symmetries of
    a square. They collapsed onto a single master cut at a median agreement of
    0.97, minimum 0.93, across all 63 — which is the finding the whole edition
    rests on. Fitting a line to each tile's ink boundary gave the angle:
    <b>21.4°</b>, or |dx/dy| = 0.3926 ± 0.0111 over 61 tiles. Measuring the cut
    angle across the field returned four distinct clusters rather than two, which
    is only possible with a reflection — that is how mirroring was proved rather
    than assumed.
  </p>
  <p>
    The reading also found what the artist did not intend to be found. The 63
    tiles collapse to only <b>40 distinct states</b>: 23 collisions, one
    arrangement repeated five times. Drawing 63 times at random from a 96-state
    bag predicts about 46 distinct, so the poster is not a designed sequence at
    all — it is a shuffle, pasted down as it came. That is why this edition is
    minted blind. The mechanic was read out of the artefact, not invented for it.
  </p>
  <p>
    It was a conversation, and the corrections mattered more than the
    computation. The first attempt generated a fresh random cut per tile and
    produced confetti — it took a human eye to say the angles all look identical.
    Mirroring was dismissed before it was proved. The claim that every tile
    carries exactly one word came from looking, and only then survived testing at
    63 of 63. Left alone, the analysis would have been confidently wrong in at
    least three places.
  </p>
  <p>
    Everything is checkable. The contract renders all 180 items on chain, and a
    test compares each one byte-for-byte against the renderer this site uses —
    not a sample, not a hash. The derivation of every constant is in
    <code>ANALYSIS.md</code>.
  </p>

  <hr>

  <h2>The Record</h2>
  <p>
    <em>What Do I Get?</em> was released as a single in February 1978 on United
    Artists, catalogue number UP 36348, backed with <em>Oh Shit!</em>. Written by
    Pete Shelley, it reached the lower end of the UK top 40 and became one of the
    band's most durable songs — a pop record about wanting something and not
    getting it, played fast.
  </p>
  <p>
    It was a non-album single, later gathered onto the 1979 compilation
    <em>Singles Going Steady</em>, which is how most people outside Britain first
    heard it.
  </p>

  <div class="listen">
    <a class="btn" target="_blank" rel="noopener"
       href="https://www.youtube.com/watch?v=iMXR7w76VZU">
      Listen on YouTube →
    </a>
  </div>

  <h2>Buzzcocks</h2>
  <p>
    Formed in Bolton in 1976 by Howard Devoto and Pete Shelley, who had met at
    Bolton Institute of Technology. Their first act of consequence was not a
    record but a booking: they organised the Sex Pistols' two 1976 shows at
    Manchester's Lesser Free Trade Hall, gigs whose small audiences went on to
    form a disproportionate share of the city's music for the next decade.
  </p>
  <p>
    In January 1977 they released the <em>Spiral Scratch</em> EP on their own New
    Hormones label — recorded cheaply, sleeved plainly, distributed themselves.
    It is routinely cited as a founding document of British independent
    releasing, the demonstration that a band did not need a label's permission to
    exist on record.
  </p>
  <p>
    Devoto left shortly after to form Magazine. Shelley took over as singer, and
    the band signed to United Artists, where the line-up of Shelley, Steve Diggle,
    Steve Garvey and John Maher made the run of singles this collection comes
    from. Shelley died in 2018.
  </p>

  <h2>Malcolm Garrett</h2>
  <p>
    Garrett designed the Buzzcocks' visual identity from <em>Orgasm Addict</em>
    in 1977 onward, while still a graphic design student at Manchester
    Polytechnic. He had come from studying typography at Reading, and it shows:
    where punk's house style was the ransom note — torn paper, photocopier grain,
    deliberate illiteracy — Garrett went the other way entirely, into clean
    grids, flat colour, and corporate sans-serifs used with total seriousness.
  </p>
  <p>
    The result reads as a critique rather than a rejection. A Buzzcocks sleeve
    looks like packaging for a product, which is precisely the joke a song called
    <em>What Do I Get?</em> is making. The poster this collection is measured
    from carries the line <em>New Product · Single Item</em> across the bottom.
  </p>
  <p>
    He went on to work with Magazine, Simple Minds, Duran Duran and Peter
    Gabriel, founded the studio Assorted iMaGes, and was made a Royal Designer
    for Industry. He remains active in Manchester design circles.
  </p>

  <h2>The Type</h2>
  <p>
    Three faces do the work, and none of them are punk.
  </p>
  <dl>
    <div class="row"><dt>Compacta</dt><dd>Fred Lambert · Letraset · 1963</dd></div>
    <div class="row"><dt>Eurostile</dt><dd>Aldo Novarese · Nebiolo · 1962</dd></div>
    <div class="row"><dt>Univers</dt><dd>Adrian Frutiger · Deberny &amp; Peignot · 1957</dd></div>
  </dl>
  <p>
    The <strong>buzzcocks</strong> wordmark is Compacta Bold — a very condensed
    display face sold as Letraset dry-transfer sheets, the kind you burnished
    down letter by letter with a biro. Garrett modified it, overlapping the two
    Z's into a single diagonal mass so the word reads as one object rather than
    nine letters. That overlap is the logo; everything else about it is off the
    shelf.
  </p>
  <p>
    <strong>Eurostile</strong> and <strong>Univers</strong> carry the smaller
    copy. Both are children of the 1950s and 60s corporate style — Eurostile with
    its squared-off geometry, drawn as an extension of Novarese's earlier
    Microgramma; Univers as Frutiger's systematic family, numbered rather than
    named. Setting a punk single in the typefaces of annual reports and airport
    signage was the point.
  </p>

  <h2>Credit</h2>
  <p>
    The record is by Buzzcocks — Pete Shelley, Steve Diggle, Steve Garvey, John
    Maher — released by United Artists as UP 36348. The poster, the wordmark and
    the visual system are Malcolm Garrett's. This edition is unofficial: an
    homage and a reading, made by someone who took the artwork apart to
    understand how it worked, and not affiliated with or endorsed by any of
    them.
  </p>

  <p class="note">
    Derivation, measurements and method are recorded in <code>ANALYSIS.md</code>.
    This is an unofficial project, not affiliated with or endorsed by Buzzcocks,
    Malcolm Garrett, or United Artists.
  </p>
`;
