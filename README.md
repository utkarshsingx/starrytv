# Starry — The Underdog Edition

Two presentations of the same library.

**Boring mode** (`/`) — 100 under-read books across 20 genres, each with a short review and links
to buy or borrow. Plain monospace text. Prints, crawls, reads aloud.

**Not boring mode** (`/tv`) — the same site as a CRT television you can actually tune. Twelve
channels of poems, film scenes, records, animals, strange history, fake commercials, surreal weather
and very short stories, plus one channel that broadcasts the book library itself.

Built after the pattern of Shopify's Editions "TV mode", but from scratch and with none of their
assets, copy or marks.

---

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # -> dist/
npm run preview
```

No API keys, no backend, no accounts. It is a static site; `dist/` deploys anywhere.

`vercel.json` and `public/_redirects` are included so `/tv` resolves on Vercel, Netlify and
Cloudflare Pages. On any other host, point unmatched routes at `index.html`.

---

## The two files you will actually edit

Everything else derives from these. Neither contains any logic.

### `src/content/books.data.ts`

The library. Twenty genres, five books each:

```ts
{
  title: 'The Blue Fox',
  author: 'Sjón',
  year: 2003,
  origin: 'Iceland, tr. Victoria Cribb',
  hook: 'A priest hunts a fox across a glacier; the fox has opinions.',
  review: '…45–70 words…',
  underdog: 'Won the Nordic Council prize and then quietly vanished in English.',
  tags: ['iceland', 'novella', 'folk tale'],
}
```

No `id` field — it is derived from genre + title. No link field either; links are built as *searches*
against Bookshop, WorldCat, Open Library and Goodreads (`src/lib/links.ts`). A hand-written product
URL rots the moment an edition goes out of print, and a search does not.

Add, remove or rewrite freely. Genres can be added or dropped; the nav, the counts, the search index
and the LIBRARY channel all follow.

### `src/content/programmes.data.ts`

The programming. One entry per channel, seven segments each:

```ts
{
  num: 4, slug: 'music', name: 'MUSIC', kind: 'track',
  programmes: [{
    heading: 'Alice Coltrane — Journey in Satchidananda',
    subheading: 'Impulse!, 1971',
    lines: ['…', '…'],
    footer: 'A harp, a tanpura, and Pharoah Sanders being gentle.',
    durationSec: 28,
  }],
}
```

`kind` decides how the compositor styles the card — typography, palette, layout, and any moving
decoration (the spectrum bars on MUSIC, the drifting rain on WEATHER, the rotating starburst on
ADVERTS). The kinds live in `src/types.ts`; the styling for each is a small object in
`src/tv/engine/compositor.ts`.

Channel colours and blurbs are in `src/content/channels.ts`. That file also builds **channel 10,
LIBRARY**, which is generated from `books.data.ts` rather than written — add a book and it is on
television without touching the programming.

---

## How the television works

It is "Path B": composite to a 2D canvas, then push that canvas through one fullscreen WebGL
shader. No 3D scene, no Blender, no GLTF pipeline — roughly 90% of the visual payoff for a fraction
of the work, and it degrades cleanly.

```
schedule.ts    what is on air right now (pure function of wall clock)
      │
compositor.ts  paint it: card, station bug, clock, captions, OSD → 640×480 canvas
      │
crt.ts         one fragment shader: warp, grille, scanlines, bloom, static, collapse
      │
CrtScreen.tsx  one rAF loop tying it together
```

A few decisions worth knowing about:

**The schedule is a pure function of the clock.** Nothing about playback is stored. `nowPlaying()`
computes what is showing from `Date.now()`, so everyone who loads the page at the same second sees
the same frame, and tuning away and back drops you into wherever the programme has got to. Each
channel gets a stable hash-derived phase offset so they are not all at the top of their schedules at
once.

**The OSD is drawn inside the canvas, not over it.** The channel number, the volume bar, the station
bug and the captions all go into the same bitmap as the picture, so the shader warps and scanlines
them too. HTML overlaid on the canvas never gets that treatment and the eye notices immediately.
This is the single detail that does the most work.

**State lives outside React.** The render loop reads Zustand non-reactively via `tvState()`, so
turning the volume up does not re-render anything sixty times a second. Only the side panel
subscribes.

**Sound is synthesised, not loaded.** No audio files ship — see the next section.

**It gets out of the way when it should.** `prefers-reduced-motion` kills the static bursts, the
ident wipe, the line-by-line reveal and most of the warp. If WebGL is missing or the context is
lost, the shader drops out and the flat canvas shows instead — the picture goes flat, the site keeps
working. A rolling FPS estimate drops shader quality on slow devices, and the loop stops entirely
when the tab is hidden.

**The Boring Edition is never unmounted.** It is the document; the TV is an overlay on top of it. The
real content is in the DOM from first paint, for crawlers, for screen readers, and for anyone whose
GPU has decided today is not the day. The canvas also carries an `aria-live` region announcing each
programme, because a canvas is otherwise opaque to assistive technology.

---

## The sound

Not one audio file ships. Every noise the site makes is synthesised at the moment it is needed,
which keeps the bundle honest and — more usefully — lets the flyback whine actually track the state
of the tube rather than being a loop that happens to be playing.

```
src/tv/engine/audio/synth.ts   oscillators, envelopes, filtered noise, FM bells
src/tv/engine/audio/bed.ts     renders a channel's ambient bed from a spec
src/tv/engine/audio/index.ts   the buses, the electronics, and every event
src/content/beds.data.ts       the twelve beds, as data  ← third file to edit
```

**Routing.** `master → { tvBus → { bedBus, sfxBus }, elecBus, pageBus }`. Two of those placements
are deliberate: `elecBus` hangs off master rather than the TV bus, because muting a television does
not stop its flyback transformer whining and neither does turning the volume down — putting the
electronics behind the volume knob is the biggest realism miss available here. `pageBus` is
independent for the same reason in reverse: the Boring Edition has no volume knob.

**Every channel sounds different.** Each has an ambient bed — a drone, a noise texture, and one or
two sparse melodic layers — specified as data in `beds.data.ts`. CINEMA is an empty auditorium
twenty minutes early. ARCHIVE has a 3 Hz projector shutter. WEATHER is rain on a window. NIGHT is
almost nothing at all. Beds crossfade on tune and duck when a programme changes.

Three things to know before editing one:

- Repeat intervals within a bed are deliberately coprime (13s against 26s against a 20s filter LFO)
  and the engine jitters each one, so no two layers ever line up twice. Round them all to multiples
  of four and you will hear a bar line, which is the thing that becomes unbearable.
- `pulse` is the one layer that ignores the scale — it takes a literal `freq`. Retune the root and
  you must retune any pulse by hand or it will sit at some arbitrary interval underneath everything.
- Beds play under text people are reading. If you cannot decide, the answer is quieter and slower.

**The electronics.** The 15.734 kHz line whistle is real NTSC. It carries four modulations — field
rate AM, two beam-current breathing LFOs and a slow pitch drift — because a static sine reads as
tinnitus and a modulated one reads as a machine. It gets no second harmonic: 2 × 15734 is above
Nyquist at both 44.1 and 48 kHz, so it would alias down into an audible tone that sounds nothing
like a television. Under it sit amplifier hiss and a mains hum bed, which carry "the set is on" for
everyone who cannot hear 15.7 kHz.

**Events are sequences, not sounds.** Power-on is a relay slamming with three contact bounces, the
degauss coil jumping against the glass and buzzing as the thermistor heats, the flyback climbing
from 6.2 kHz to line rate, and the amplifier thumping — about two seconds end to end. Changing
channel is the audio cutting *first*, then snow, then two opposed sync sweeps (one rising sweep
sounds like a musical gesture; two opposed ones sound like a machine hunting), then tear ticks, then
a lock.

**Anti-fatigue is most of the design.** The keypad's noise band is randomised on every press. The
volume detent puts its pitch motion in a filter centre rather than an oscillator, so it can never
land on a scale degree, and its gain *falls* slightly as level rises. The captions blips sit at a
ratio of 1.42 — deliberately missing a fourth and a fifth — so they never sound like a jingle. The
search keystroke has nothing above 3 kHz, is rate-limited to one per 35 ms, and only the space bar
sounds different.

**The Boring Edition is nearly silent, on purpose.** Paper and cheap office hardware: a drawer
divider for a genre jump, a membrane key for a keystroke, a solenoid and a motor for print. There is
deliberately no hover sound — every other sound on that page corresponds to something that
physically moved, and hover is the only one with no moving part behind it.

**There is an off switch**, in the top bar of both modes, and it persists. The site now makes noise
in places people will not expect it, and the honest answer to that is a visible control rather than
a quieter tick.

---

## Putting real video on it

The channels ship as text cards, but any programme can carry a real video file instead:

```ts
{
  heading: 'Station ident',
  // …
  media: {
    src: '/media/ident.mp4',
    poster: '/media/ident.jpg',
    captions: [{ lang: 'en', label: 'English', src: '/media/ident.en.vtt' }],
  },
}
```

Drop the file in `public/media/` and it plays. `engine/video.ts` handles it: two `<video>` elements
ping-ponged so the next programme preloads while the current one is on air, playback slaved to the
broadcast clock rather than to the element, `playsInline` set (without it iOS goes fullscreen native
and the whole illusion disappears), and `crossOrigin="anonymous"` set (without it a cross-origin
video taints the canvas and you get a silent black screen).

Captions come from the browser's own WebVTT parser via `<track>`. The native caption *renderer* is
bypassed — frames go into a WebGL texture — but `activeCues` still fires, so we get parsed,
correctly-timed cue text for free and draw it into the canvas ourselves.

Encode lower than feels right. The CRT shader destroys fine detail anyway, which is a gift: you can
ship at half the bitrate you would normally accept.

```bash
ffmpeg -i in.mov -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p \
  -vf "scale=960:-2" -c:a aac -b:a 96k -movflags +faststart out.mp4
```

---

## Controls

| Key | |
|---|---|
| `↑` `↓` | change channel |
| `←` `→` | volume |
| `0`–`9` | tune directly (two digits) |
| `M` | mute |
| `C` | captions |
| `G` | channel guide |
| `P` | power |
| `Esc` | close the guide, then leave TV mode |

Plus the on-screen handset and the TV's own front panel. Every route goes through one `press()`
in `useRemoteControl.ts`, so the click sound and the state change cannot drift apart.

Channels are deep-linkable: `/tv?ch=07`.

---

## Not built yet

**The phone-as-remote QR trick.** It needs a realtime backend — Firebase RTDB is what Shopify used;
Cloudflare Durable Objects is the better fit if this is ever hosted on Cloudflare. The plug point
already exists: every control path is a `Command` in `src/tv/useRemoteControl.ts`, so a transport
would only have to deliver those. Session ids need to be unguessable and expire, or you have built a
public API for changing strangers' channels.

**A real 3D set.** `Path C` in the reference notes — Blender → GLB → React Three Fiber, with the CRT
effect as a material on the screen mesh rather than a post-pass, so real specular highlights layer
over the picture. Worth doing only if the flat version is already good, and it should keep this
version as the low-quality fallback tier.

---

## Credits

The power-on and power-off transitions and the floor reflection are adapted from
**[jesseweb.com](https://github.com/JesseWebDotCom/jesseweb-com)** by Jesse M. Torres, MIT licensed.
The keyframe timings and shapes are theirs; the implementation is reworked to drive our shader
uniforms, so the animation happens inside the tube — picking up the barrel warp, the aperture grille
and the vignette — rather than as a DOM element sitting on top of the glass.

```
MIT License

Copyright (c) 2026 Jesse M. Torres

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

No audio was taken from that project — it has no sound files, and its Web Audio is a noise loop and
a single power-off sweep. Ours is described above.

---

## Content notes

All reviews and all channel writing are original to this project. The poems on channel 2 are
public-domain and credited on screen. Channel 3 describes film scenes rather than showing them, and
channel 9's commercials are for products that have never existed — no real brands appear.

Every book was fact-checked against the web for existence, authorship and publication year before it
went in.
