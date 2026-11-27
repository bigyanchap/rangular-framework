# Verification

Rangular is built for AI-driven software factories with rigorous
verification at every step. This page is the contract behind that
sentence: what is checked, where, and what a clean run promises.

## The promise

Nothing fails silently. Every construct the compiler cannot carry
produces a coded diagnostic with a concrete fix. Every check a human
would otherwise have to remember is a command that either passes or
names what is wrong. A build is not done when it compiles; it is
done when the gate is clean.

## The layers

1. **Compile-time diagnostics.** 81 codes, registered in
   `DIAGNOSTIC_CODES` in the compiler and listed in the catalog.
   They cover template structure, unknown elements and icons,
   unknown props on known elements (`GEN_UNKNOWN_PROP`), event
   bindings that name a missing method (`TPL_HANDLER`), unsupported
   CSS and off-scale values, unsupported method constructs, route
   problems, and the stale-read pattern (`GEN_FIELD_REREAD`): a
   method that assigns a field, reads it, and assigns it again.
   Codes are a stable contract: a code, once shipped, is never
   renamed or reused for a different meaning.

2. **Strict mode.** `rg build --strict` turns every warning into a
   failure. A scaffolded app carries `rangular.json` with strict on,
   so a dropped declaration or a snapped value stops the build
   instead of quietly changing the page. `--no-strict` relaxes one
   run.

3. **Doctor.** `rg doctor` lints what compilation cannot judge:
   raw hex colours outside the theme, off-scale values in source,
   images without declared size, loose text, and tap targets under
   the minimum size. A deliberate exception is written in the code
   itself, as a `doctor: allow-hex` comment, never in a side file.

4. **One gate.** `rg verify` runs the strict build, the doctor, the
   app's own test script when it has one, and a render of the root
   preview, and exits with the verdict. With `--json` the whole
   result, stages and diagnostics, arrives as one data object, so a
   pipeline or an AI loop consumes the gate without parsing prose.

5. **Mechanical fixes.** `rg fix` applies the repairs whose outcome
   the compiler already knows: off-scale values written back
   snapped, unsupported style properties removed with a comment
   naming what was taken out, and a prop renamed when the catalog
   holds exactly one near match. Everything else is reported, never
   touched.

6. **Runtime prevention.** Some failures cannot be caught by a
   diagnostic alone, because the code is legal and the shape only
   breaks on a device. The framework prevents those shapes at
   runtime. A screen inside another screen is the proven case: on
   Android, two vertical scrollers on one page fought each other,
   and the tutorial's Lesson 25 flickered at a steady cadence when
   scrolled down, starting once the Best Practice text passed under
   the title. The framework now renders the inner screen as a flat
   themed region with no scroller of its own, so the shape cannot
   occur in any app built with it. The browser preview renders the
   same embedded region, so what the author sees is what the phone
   runs. Prevention, not detection after the fact, is the point:
   anything known to cause trouble at runtime, or in rapid coding,
   is stopped before it reaches a device.

## In a pipeline

A factory line needs three things from a framework: the gate runs
headless, the verdict is an exit code, and the findings are data.
`rg verify --json` is all three. A minimal CI step:

```sh
npm install -g @rangular-framework/cli
rg verify --json > verify.json
```

The step fails when the gate fails. `verify.json` carries every
diagnostic with its code, file, line and fix, ready for a dashboard,
a ticket, or the next AI pass.

## What a clean run promises, and what it does not

A clean `rg verify` promises: the app compiles under strict rules,
no construct was dropped or snapped quietly, every handler names a
real method, every prop exists, no known stale-read pattern is
present, the doctor finds nothing, the app's tests pass, and the
root page renders. It does not promise the app is correct in its
logic, kind in its design, or wanted by anyone. Verification is the
floor a factory stands on, not the building.
