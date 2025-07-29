---
applyTo: "**"
---

## Coding paradigm

- TypeScript. Infer type as much, annotate when necessary
- When import types, prefix them with `type` keyboard. We have `verbatimModuleSyntax` enabled
- Functional core with RxJS
- Effectives are handled on the top layer in main.ts
- Functions over classes, but use class when internal state is complex
- Pure functions are in /src/lib/\*.ts
- Views are templated with lit-html, stored in /src/views/\*.ts

## Workflow

- Do NOT run `npm run dev` for user.
- Do NOT run `npm run build` for user.
- If user provided new information or changed requirements, you must update .github/copilot-instructions.md and .github/instructions/\*.instructions.md to stay up to date.

## Coding style

- Compact and efficient
- Use empty lines judiciously to separate logical blocks
- Minimum comments, only when necessary

## Styling

- Use latest CSS features, including variables, grid, flexbox
- Nesting is ok
- Component specific styles should be in the {component-name}.css file, next to {component-name}.ts
- The component ts file should import its own css file
- Global styles are in /src/main.css

## File organization

/index.html contains the static structure of the UI
/src/main.ts is the main logic of the app.
/src/lib/ contains lower level functions
/src/views/ contains UI components that are dynamically rendered

## main.ts

- Top down organization, high level first, low level later
- Get any static global dom reference first
- Create observable streams and manipulate them in the middle
- Subscribe to all the streams at the end

## RxJS patterns in main.ts

- Use `tap` operator for side effects, keep `subscribe()` callbacks empty
- All side effects should be handled in the pipeline before the final subscription
- Create all the observables but do NOT subscribe.
- In the end, merge all the observables and subscribe once.

## lib/\*.ts

- They should generally be observables, operators, or pure functions

## views/\*.ts

- They should be pure functions that take data and return lit-html templates
  - Input: any observables it depends on
  - Output: lit-html template, and observables if it created new ones for other components to consume
- When approperiate, use native DOM events

## RxJS pattern in views

- You should hide component's internal state within the viewe function
- Use the `/src/lib/observe-directive.ts` to render observable inside the lit template, e.g. `<span>${observe(stream$)}</span>`
