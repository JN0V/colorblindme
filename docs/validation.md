# Validation

Numbers quoted in the README and in `src/core/staircase.js`, and how they were
obtained. All of it is simulation against a synthetic observer, not a study
with human participants — see the caveat at the end.

## Synthetic observer

For a true severity `s0` and a presented severity `sev`, with `d = sev - s0`:

    P(detect) = 1 / (1 + exp(-(d - 1.0) / 0.8))

A 4-AFC guess floor of 0.25 applies when detection fails. Confidence is
reported as `sure` when `d >= 2.5`, `hint` when detected but closer, and
`guess` when not detected.

## Stimulus validity

Pools of 150 colours per axis fill in roughly 700 draws. Mean difference seen
by a *normal* observer, by presented severity:

| severity | 0.2 | 0.3 | 0.4 | 0.5 | 0.6 | 0.7 | 0.8 | 0.9 | 1.0 |
|----------|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| protan   | 15.4 | 21.3 | 26.4 | 30.9 | 35.0 | 38.8 | 42.2 | 45.5 | 48.6 |
| deutan   | 17.4 | 24.0 | 29.5 | 34.2 | 38.2 | 41.8 | 44.9 | 47.7 | 50.1 |
| tritan   | 11.3 | 14.4 | 17.0 | 20.0 | 23.9 | 29.3 | 35.7 | 42.8 | 49.5 |

CIE76. A just-noticeable difference is about 2.3, so even the lowest severity
presented is comfortably visible to someone with typical colour vision. The
test is therefore not confounded by stimuli that nobody could see.

## Single-axis staircase

400 runs per true severity, 8 reversals, threshold as the mean of the last six:

| true | estimated | bias | sd | trials |
|------|-----------|------|-----|--------|
| 0.2 | 0.31 | +0.11 | 0.07 | 16.1 |
| 0.5 | 0.61 | +0.11 | 0.05 | 14.5 |
| 0.8 | 0.90 | +0.10 | 0.05 | 13.2 |
| 0.9 | 0.95 | +0.05 | 0.05 | 14.1 |

The constant +0.1 offset is the point: an up-down staircase settles where
stepping up and stepping down balance, which is the severity you just barely
*detect*. A faithful simulation wants the one below it, so `Session.result()`
reports `detection` and returns `sev = detection - 1`.

## Interleaved three-axis pass

1200 runs per configuration across five observer profiles (mild, moderate and
severe deutan; moderate protan; typical vision). Retirement rule swept:

| main/side reversals | retire after | median trials | p90 | axis found | severity ±1 | secondary ordered |
|---|---|---|---|---|---|---|
| 8 / 8 | 5 trials, 3 rev, ≤0.2 | 41 | 51 | 100% | 84% | 100% |
| **8 / 5** | **4 trials, 2 rev, ≤0.2** | **36** | **46** | **99%** | **86%** | **99%** |
| 8 / 4 | 4 trials, 2 rev, ≤0.3 | 33 | 42 | 95% | 83% | 94% |
| 8 / 4 | 3 trials, 1 rev, ≤0.3 | 30 | 40 | 92% | 84% | 89% |
| 6 / 4 | 3 trials, 1 rev, ≤0.3 | 27 | 35 | 92% | 74% | 89% |

Shipped configuration is the bold row (`CONFIG` in `staircase.js`). More
aggressive retirement saves three to six trials and costs seven points of axis
identification, which is not worth it for a measurement someone does once.

## First human observation, and what it broke

One colour-blind observer, n=1, so this is an anecdote and not a result. It is
recorded because it falsified a design decision rather than confirming one.

The chromatic screening (six trials per axis at severity 1.0, lowest score
wins) reported **protan**. An independent luminance match on the same observer
returned a red/green ratio of **1.19** — red matched to a *lighter* grey than
green, which is the opposite of the protan signature and close to the factor
of ~1.26 the literature reports for deuteranopes (red luminance rising from
0.168 to 0.211). The screening had picked the wrong axis.

Two causes, both real, and neither caught by the synthetic observer because
the observer model shared the assumption being tested:

1. **Six trials per axis is underpowered** against a 25% chance floor, for the
   two axes whose confusion lines are most alike.
2. **Luminance neutralisation removes the cue that separates them.** It is
   correct for measuring severity and actively wrong for identifying the axis.
   The protocol was doing one job with the other job's stimulus.

The fix is `src/core/luminance.js`: decide protan versus deutan on luminous
efficiency first, then run the chromatic staircases for severity. It is worth
noting the synthetic-observer suite gave 99-100% axis identification while the
first real observer was misclassified — which is the sharpest available
argument for collecting human data.

## What this does not establish

A synthetic observer validates the *procedure* — that the staircase converges,
that the estimator is unbiased once the detection offset is removed, that the
retirement rule does not discard the wrong axis. It says nothing about whether
the psychometric model matches real anomalous trichromats, and the observer
model was written by the same person as the procedure, so it cannot catch a
shared wrong assumption. Human data is needed and has not been collected.
