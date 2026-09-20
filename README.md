# Colorblind Me

**Calibrate a colour-blindness simulation to one person's actual vision, then
share it as a link.**

Every colour-blindness simulator on the web shows the same thing: full
dichromacy. But roughly three colour-blind people in four are *anomalous
trichromats* — they still discriminate red and green, just less well. So the
standard simulation overstates the loss, and the people it is shown to come
away thinking the world is grey and sad. It isn't, and the person living in it
has no way to argue back.

This project measures where *your* discrimination actually breaks down, fits
the Machado (2009) severity parameter to it, and gives you a short code you can
hand to your family. They open a link and point their phone at the garden.

Runs entirely in the browser. No server, no account, no build step.

---

## Status

Early, but path 2 runs. The viewer — open a link, point a camera, drag the
divider — is implemented in `src/ui/` with both locales. The measurement
interface (path 1) is not built yet; measurements are currently taken in a
separate prototype and pasted in as a code.

Known gap, stated because it is the interesting one: the axis screening built
on chromatic discrimination was measured picking the WRONG axis on the first
real observer. Protan and deutan confusion lines sit 24 degrees apart in the
median and 9 in the worst decile, and simulation puts axis identification at
48-58% for mild to moderate deficiency against a 50% chance floor. Luminance
decides the axis (`src/core/luminance.js`); the chromatic pass measures
severity and detects tritan, which is genuinely separable. See
`docs/validation.md`.

## How the measurement works

A four-alternative forced-choice task: four squares, one of them the same
colour run through a Machado transform, and you pick the odd one out.

Two properties make it a measurement rather than a quiz:

- **The odd square's luminance is matched to the others on every trial.**
  Without that you answer on brightness — which you perceive normally — instead
  of on colour, and the result flatters your colour vision.
- **The severity that matters is the one you *cannot* see.** If the transform
  only removes information your cones never encoded, the result is
  indistinguishable from the original *to you*. So the calibration looks for
  the strongest transform that still slips past you.

Confidence travels in the same gesture: where you click inside a square says
how sure you were — out at the corner means obvious, in near the middle means
hesitant — and a button in the centre means you see nothing at all. Reaction
time is logged alongside as an independent check on that judgement.

Three staircases, one per confusion axis, run interleaved in a single pass; an
axis that is clearly in the normal range retires early. That costs a few more
trials than screening first and measuring second, and buys the *secondary*
deficiency, which a separate screening discards.

Measured over 1200 simulated observers: median **36 trials**, 90th percentile
46. Primary axis identified in 99% of runs, its severity within one step in
86%, secondary axis correctly ordered in 99%. See `docs/validation.md`.

## Vision codes

    CBM1-D5-P2
    |   |  |
    |   |  +-- secondary: protan, severity 0.2
    |   +----- primary: deutan, severity 0.5
    +--------- format version

The code rides in the URL **fragment** (`…/#p=CBM1-D5-P2`), which browsers
never transmit to a server. On static hosting that is the entire privacy story:
a measurement of someone's vision never leaves their device.

The axis letters are fixed ASCII and are **never localised** — see below.

## Internationalisation

i18n is load-bearing here, not decoration, so it is wired in from the first
commit. Three rules:

1. **Vision codes are never translated.** `P`/`D`/`T` stay ASCII so a code
   shared between a French parent and a German colleague still resolves.
   Localising them would fork the format silently: a valid-looking code
   resolving to the wrong axis.
2. **Numbers are localised.** Severity reads `0,5` in French and `0.5` in
   English, through `Intl.NumberFormat`. It is spoken aloud constantly.
3. **Clinical vocabulary is hand-translated or flagged.** The limitations
   section makes careful claims about what this measurement does *not* prove.
   A machine translation can turn a hedge into a medical assertion. Every
   catalogue declares `_meta.status`, and any locale that is not `reviewed`
   says so in the interface.

**One page, no per-locale directories.** Language is negotiated from `?lang=`,
then a remembered choice, then the browser, and it is swapped **in place** —
nothing navigates.

That last part is not a style preference. The profile being shared rides in the
URL fragment, and an earlier build that served `/en/` and `/fr/` lost it: the
root redirect carried the fragment across carefully, and then the footer's
language links threw it away. Two code paths, one of them guarded. A design
where switching language never navigates cannot have that bug at all.

The cost is weaker per-language search indexing, which is an acceptable trade
for a tool people reach through a link someone sent them.

### Adding a language

1. Copy `src/i18n/locales/en.json` (the source language) to `<code>.json`.
2. Translate. Keep every `{placeholder}` exactly as it appears.
3. Set `_meta.status` honestly: `reviewed` only if a fluent speaker who
   understands the clinical terms has read it. Otherwise `draft` or `machine`.
4. Add an entry to `LOCALES` in `src/i18n/i18n.js` with its text direction.
   That is the whole wiring — there is no directory to create and no page to
   duplicate; the selector picks it up from `LOCALES`.
5. Run `python3 scripts/check_i18n.py` and `python3 scripts/check_ui.py`. CI
   runs both, and a drifted catalogue or an unresolved key fails the build.

RTL locales set `dir: "rtl"`. The measurement arena is radially symmetric so it
needs no mirroring, but the before/after wipe has directional labels: read them
from the document direction, never hard-coded left and right.

## Development

    python3 -m http.server 8000

Then open <http://localhost:8000/>. A plain `file://` open will not work:
catalogues are fetched and ES modules are loaded, neither of which has an
origin under `file://`.

To land straight on a profile, as someone following a shared link would:

    http://localhost:8000/#p=CBM1-D5-P2
    http://localhost:8000/?lang=fr#p=CBM1-D5-P2

Two checks run in CI and are worth running before a commit:

    python3 scripts/check_i18n.py    # catalogues in sync, placeholders intact
    python3 scripts/check_ui.py      # every data-i18n key and selector resolves

## What this is not

It is not a diagnosis. It fits a model to your discrimination; it replaces
neither a Nagel anomaloscope nor a CAD test.

It conveys your *confusions*, not your experience. No image can show what a red
looks like to you, because it would have to travel through someone else's eyes.

And it depends on two screens, not one. You calibrate on yours; the people you
show it to look on theirs, with auto-brightness and night mode and a "vivid"
display profile. This is the real unsolved weakness of the project, and it gets
worse the more people use it. We warn, we offer a gamma check, and we cannot
fix it.

## Prior art

This idea is not new, it just never shipped. Flatla & Gutwin described
personalised CVD simulation at ASSETS '12 — the paper is literally titled *"So
that's what you see"* — and McAlpine & Flatla built an Android app applying it
to a live camera feed in 2016. Their model is richer than ours: it measures
discrimination limits per colour region, including luminance, and covers
acquired and environmental causes, not only inherited ones.

Ours is cruder in exactly one way and better in another: a single severity
scalar per axis is less expressive than their per-region model, but it reduces
to a 3×3 matrix, so it becomes a GPU shader for free. Their non-linear model
needed a 262 144-entry lookup table; the 2016 paper notes a single 512×512
image took 1.3 s without one, and lists shaders as future work.

Reassuringly, they compared the two directly across every RGB666 colour and
found best agreement at Machado severity **0.3**, with a mean difference of
12.46 CIE L\*u\*v\* units for protan and 13.12 for deutan — about 5–6 JND,
against the ~105 JND the u\* and v\* axes span. Substantial agreement. And note
where their *mid-severity* observer landed: 0.3, nowhere near the 1.0 every
off-the-shelf simulator uses.

See `NOTICE` for full citations.

## Licence

Apache-2.0. Chosen over MIT for its explicit patent grant: the methods here are
reimplemented from academic publications, and that clause is free insurance.

The Machado matrices come from colour-science under BSD-3-Clause; see `NOTICE`.
