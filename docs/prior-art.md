# Prior art and sources

This project stands on three bodies of work. None of it is ours, none of their
code is used here, and all of it is reimplemented from published descriptions.
This file is the full record; `NOTICE` carries the short form.

---

## The simulation model — Machado, Oliveira & Fernandes

> Machado, G. M., Oliveira, M. M. & Fernandes, L. A. F. (2009).
> *A Physiologically-based Model for Simulation of Color Vision Deficiency.*
> IEEE Transactions on Visualization and Computer Graphics, **15**(6), 1291–1298.
> <https://doi.org/10.1109/TVCG.2009.113>

What we take: the severity-parameterised matrices in `src/core/machado.js`.

Why this model and not another. Brettel & Mollon (1997) and Viénot, Brettel &
Mollon (1999) both model *dichromacy* — an all-or-nothing collapse. Machado is
the first to handle normal vision, anomalous trichromacy and dichromacy in one
continuum, which is the entire premise of this project: most colour-blind
people sit somewhere in the middle, and a tool that can only render the
endpoint misrepresents them.

A note on fidelity: the published equations (17) and (18) on page 1295 contain
a known typo. We do not implement the equations — we use the pre-computed
matrices redistributed by colour-science, which are correct — so the erratum
does not reach this code. Anyone re-deriving the matrices from the paper should
be aware of it.

Matrices redistributed from **colour-science** (BSD-3-Clause), dataset
`CVD_MATRICES_MACHADO2010` — <https://github.com/colour-science/colour>

---

## Personalised simulation — Flatla & Gutwin

> Flatla, D. R. & Gutwin, C. (2010). *Individual models of color
> differentiation to improve interpretability of information visualization.*
> CHI '10. <https://doi.org/10.1145/1753326.1753715>

> Flatla, D. R. & Gutwin, C. (2012). *SSMRecolor: improving recoloring tools
> with situation-specific models of color differentiation.*
> CHI '12. <https://doi.org/10.1145/2207676.2208388>

> Flatla, D. R. & Gutwin, C. (2012). *"So that's what you see": building
> understanding with personalized simulations of colour vision deficiency.*
> ASSETS '12.

The idea this project exists to apply. Flatla & Gutwin built the first
individual model of colour differentiation (ICD), calibrated in situ rather
than assumed from a diagnosis, and showed it could drive a *personalised*
simulation whose purpose was to help other people understand what someone with
impaired colour vision actually sees. The 2012 ASSETS title is, word for word,
the reaction this tool is built to produce.

Their model is richer than ours in three ways worth stating plainly:

- it measures discrimination limits **per region of colour space**, not one
  scalar per axis;
- those limits include **luminance** — how much lightness must be added or
  removed before a difference registers — which our protocol deliberately
  neutralises;
- it is **situation-specific**, covering acquired and environmental causes
  (ambient light, display quality), not only inherited deficiency.

What we have instead is reducibility: a single severity per axis collapses to a
3×3 matrix, and therefore to a GPU shader.

---

## Real-time mobile — McAlpine & Flatla

> McAlpine, R. & Flatla, D. R. (2016). *Real-Time Mobile Personalized
> Simulations of Impaired Colour Vision.* ASSETS '16, 181–189.
> <https://doi.org/10.1145/2982142.2982170>

An Android app that calibrates an individual and applies the personalised
simulation to a live camera feed — the closest existing work to what this
project is for. Because their model is non-linear they precomputed a lookup
table over every RGB666 colour and drove it with OpenCV and RenderScript; the
paper reports 1.3 s for a single 512×512 image without the LUT, and lists
shaders as future work.

Their validation is the most useful result here for us. Comparing their
personalised simulation against Machado's across every RGB666 colour, best
agreement fell at **Machado severity 0.3**, with a mean difference of 12.46
CIE L\*u\*v\* units for protan and 13.12 for deutan — roughly 5–6 JND, against
the ~105 JND spanned by the u\* and v\* axes. They call it substantial
agreement.

Two things follow. A scalar severity is a defensible approximation of the full
per-region model, not a shortcut to apologise for. And their *mid-severity*
observer matched 0.3 — nowhere near the 1.0 that every off-the-shelf simulator
applies.

---

## Test methodology

The four-alternative forced-choice task on a luminance-neutralised field
follows the principle of the Colour Assessment & Diagnosis (CAD) test developed
at City, University of London: dynamic luminance masking so that chromatic
discrimination is measured in isolation, rather than brightness cues being
mistaken for colour vision.

The adaptive staircase with confidence weighting is standard psychophysics, not
attributable to any single source.

---

## To verify before first release

- The ASSETS '12 DOI is not recorded here; confirm it against the ACM record.
- Author name spelling for the 2016 paper appears as both *McAlpine* and
  *MacAlpine* across sources, and author order varies. Confirm against the ACM
  record before this file is quoted anywhere.
