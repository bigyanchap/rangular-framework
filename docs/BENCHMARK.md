# Benchmark: one app, two toolchains, four seeded mistakes

This page reports a small, controlled comparison run on 2026-11-26.
It is a demonstration, not a statistic: one app, one author, one run
of each toolchain. The method is written out in full so anyone can
rerun it and get their own numbers.

## The app

A team settings page, specified once and built twice:

- A header band with a title and a subtitle.
- A notifications switch, on by default.
- A list of four team members, name and role.
- An input and an Add button that appends a member.
- A line counting the members.
- A Save button that counts the members, reports the count, and
  shows a Saved line.

## The seeded mistakes

The same four author mistakes were written into both builds, in each
toolchain's own idiom. They are the mistakes an AI author plausibly
makes on a first pass:

- M1, a handler typo: the Save control calls `sav`, the method is
  named `save`.
- M2, a wrong prop: the Add control carries `colour` where the prop
  is `color`.
- M3, an off-design value: a top margin of 7px, off the spacing scale
  (4, 8, 12, 16, 20, 24, 32).
- M4, a stale state read: the save logic sets the total, reads the
  total to report it, then sets it again from the read. The read sees
  the value from before the save, so the reported count and the
  final total are both wrong.

## The gates

Each build was judged only by its own toolchain's standard gate:

- Rangular: `rg verify` (strict build, doctor, render check).
- Raw React Native: `tsc --noEmit` with the Expo TypeScript config,
  then `npx expo export --platform android` to prove it bundles.

## Results

| Mistake | Rangular gate | React Native gate |
| --- | --- | --- |
| M1 handler typo | Named: TPL_HANDLER, an error | Named: TS2552 |
| M2 wrong prop | Named: GEN_UNKNOWN_PROP, an error, with the near match | Named: TS2322 |
| M3 off-scale 7px | Named: STYLE_OFF_SCALE and DOC_OFF_SCALE | Silent: no scale exists to violate |
| M4 stale read | Named: GEN_FIELD_REREAD | Silent: the bug ships |

The Rangular build's first pass also drew three doctor findings for
raw hex colours in its styles, a design discipline the raw build has
no equivalent of.

Fix rounds to a clean gate:

- Rangular: 2 rounds. `rg fix` applied two of the repairs itself
  (the prop rename and the snapped margin). The handler name, the
  assign-once rewrite and the deliberate-palette note were applied
  by hand from the diagnostics' own fix lines. The final verify is
  clean, and all four mistakes are gone.
- React Native: 1 round. Both named errors were corrected by hand.
  The final type check is clean and the app bundles, with M3 and M4
  still inside it.

## What this does and does not show

TypeScript is genuinely good at the two name mistakes; the table
says so. The difference the run shows is coverage: the Rangular gate
also covers the design scale and the stale-read behaviour class,
which the React Native gate leaves silent, and it attaches a written
fix to every finding, two of which it applied on its own.

The author of both builds knows the Rangular subset well. A cold
author would make more first-pass mistakes against Rangular, and
fewer against React Native, which its author has seen far more of.
That is exactly the condition the gate exists for: the claim is not
that mistakes stop happening, it is that every mistake the framework
can see is named, with its fix, before a phone ever runs the code.
