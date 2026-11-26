# Rangular for teams and companies

An adoption brief for organizations evaluating Rangular as the way
their people, and their AI agents, build mobile apps.

## What it is

A standalone transpiler. Teams write Angular-style TypeScript and
templates; Rangular compiles to plain React Native `.tsx` that runs
on Expo and Hermes like any other React Native code. There is no
runtime service, no hosted build, and no proprietary output format:
the generated code is yours, readable and ejectable at any time.

## Why factories adopt it

An AI-driven software factory has one recurring problem: generated
code that almost works, failing silently in ways a human reviewer
finds late. Rangular is built against that problem.

- **Verification at every step.** 80 coded diagnostics with written
  fixes, strict mode on by default in scaffolded apps, a polish
  linter (`rg doctor`), one headless gate (`rg verify`) whose
  verdict is an exit code and whose findings arrive as JSON, and a
  mechanical fixer (`rg fix`) for the repairs that need no judgment.
  The full contract is in [VERIFICATION.md](VERIFICATION.md), and a
  measured comparison is in [BENCHMARK.md](BENCHMARK.md).
- **A small, stable surface.** The whole language an author, human
  or AI, may use is the generated catalog: 76 tags, 70 primitives,
  the design tokens, the icon set. Diagnostic codes, once shipped,
  are never renamed or reused. A factory can pin its training, its
  prompts and its dashboards to the catalog and the codes.
- **Deterministic output.** The same source compiles to the same
  generated code, byte for byte. Generated files are never edited
  by hand; a freshness check is a rebuild and a diff.
- **Angular skills transfer.** The authoring model is Angular:
  components, templates, dependency injection, services, reactive
  forms, routing. Teams with Angular people, and models trained on
  Angular's large public corpus, start productive.

## Operating it

- **CI**: one step, `rg verify --json`, fails the pipeline when the
  gate fails and archives the findings as data.
- **Review**: humans review source (`.ts`, `.html`, `.css`), never
  generated output. The compiler's diagnostics are the first
  reviewer; people judge intent and design.
- **Exceptions**: a deliberate deviation is written in the code, for
  example a `doctor: allow-hex` comment, where a reviewer sees it,
  not in a config file nobody opens.

## Terms and posture

- **License**: Apache 2.0, free for everyone, including large
  enterprises, with no per-seat or per-build fees.
- **Security**: the compiler treats author code as trusted and data
  as never becoming code; the posture and past audits are recorded
  in the repo's `SECURITY.md`.
- **Limits, stated plainly**: Rangular is a subset of Angular, by
  design. What it does not carry, and what to do instead, is listed
  in [BY_DESIGN.md](BY_DESIGN.md). The preview promises parity with
  the app for everything inside the subset.

## A sensible pilot

Pick one small internal app. Scaffold it, let your usual AI tooling
write it under the shipped `AGENTS.md`, gate it with `rg verify` in
CI from day one, and count two numbers for a month: findings the
gate caught before review, and review comments about generated
code. Those two numbers are the adoption case, whichever way they
fall.
