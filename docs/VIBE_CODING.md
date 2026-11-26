# Vibe coding with Rangular

Rangular is the vibe coding first framework for mobile apps. You
describe the app, an AI writes it, and the framework checks the
work. This page is the loop, written for the person directing the
AI, not for the AI.

## The loop

1. **Start.** `rg init my-app --app` creates the app. Inside it sits
   an `AGENTS.md` written for your AI: the subset, the rules, and
   the verify loop, in the file your tool reads first.
2. **Describe.** Tell the AI what the app should do, screen by
   screen. It writes Angular-style components: classes, templates,
   services. If you know Angular, you can read everything it writes.
3. **Verify.** The AI runs `rg verify`. Strict build, doctor,
   tests, render check, one verdict. Every problem arrives as a
   coded diagnostic with a written fix, so the AI repairs its own
   work without you reading compiler output.
4. **Look.** `rg preview` renders the app as a web page at phone
   width. The preview is a promise: what works there works in the
   app. Judge the design with your eyes, describe the change, and
   loop back to step 3.
5. **Ship.** `rg build` writes the React Native code, and the app
   runs on Expo like any other. The code is yours, plain `.tsx`,
   no lock-in to a hosted service.

## What the framework does for the loop

- **It catches what vibe coding misses.** A handler that names a
  missing method, a prop that does not exist, a style value off the
  design scale, a state read that would see yesterday's value: each
  is named at compile time, with its fix. See the benchmark in
  [BENCHMARK.md](BENCHMARK.md) for the four classic mistakes, side
  by side with raw React Native.
- **It refuses quietly wrong output.** In a scaffolded app, strict
  mode is on: warnings fail the build. Nothing is dropped or
  snapped in silence.
- **It repairs the mechanical.** `rg fix` applies the fixes whose
  outcome is already known, snapped values, dead styles, a renamed
  prop, and reports the rest for judgment.
- **It speaks data.** Every command takes `--json`. Your AI never
  has to parse prose to know whether the app is clean.

## What you still do

Verification is a floor, not the building. The framework cannot
tell whether the app is the app you meant. Look at the preview.
Read the screens. Say what is wrong in plain words, and let the
loop carry the rest.
