---
applyTo: "**"
---

## Coding paradigm

- Functional core with RxJS
- Effectives are handled on the top layer in main.ts
- Functions over classes, but use class when internal state is complex
- Pure functions are in /src/lib/\*.ts
- Views are templated with lit-html, stored in /src/views/\*.ts

## Coding style

- Compact and efficient
- Use empty lines judiciously to separate logical blocks
- Minimum comments, only when necessary

## Styling

- Use latest CSS features, including variables, grid, flexbox
- Nesting is ok

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

## lib/\*.ts

- They should generally be observables, operators, or pure functions

## views/\*.ts

- They should be pure functions that take data and return lit-html templates
- They can take observables as a way communicate to the outside
- When approperiate, use native DOM events
