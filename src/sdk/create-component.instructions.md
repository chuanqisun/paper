---
applyTo: "**/*.component.ts"
---

# createComponent Quick Reference

A utility to create reactive components using RxJS observables and lit-html templates.

## Basic Usage

### Minimum example (static template)

```typescript
const Hello = createComponent(() => html`<div>Hello World</div>`);

// Usage
html`${Hello()}`;
```

### Component with props (static template)

```typescript
const Greeting = createComponent((props: { name: string }) => html`<div>Hello ${props.name}</div>`);

// Usage
html`${Greeting({ name: "Alice" })}`;
```

### Component without props (observable template)

```typescript
const SimpleComponent = createComponent(() => of(html`<div>Hello World</div>`));
```

### Component with props (observable template)

```typescript
const Greeting = createComponent((props: { name: string }) => of(html`<div>Hello ${props.name}</div>`));
```

## Reactive Component Pattern

Components should follow this structure:

```typescript
export const Counter = createComponent((props: { initial: number }) => {
  // 1. Internal state
  const count$ = new BehaviorSubject<number>(props.initial);

  // 2. Actions (user interactions)
  const increment$ = new Subject<void>();

  // 3. Effects (state changes)
  const incrementEffect$ = increment$.pipe(tap(() => count$.next(count$.value + 1)));

  // 4. Combine state and template
  const template$ = count$.pipe(
    map(
      (count) => html`
        <div>
          <span>${count}</span>
          <button @click=${() => increment$.next()}>+</button>
        </div>
      `,
    ),
    mergeWith(incrementEffect$.pipe(ignoreElements())),
  );

  return template$;
});
```

## Nesting Components

Components can be nested by calling them within templates:

```typescript
const Main = createComponent(() => {
  const template$ = of(html`
    <section>
      <h1>My App</h1>
      ${Counter({ initial: 0 })} ${Counter({ initial: 5 })}
    </section>
  `);
  return template$;
});
```

## External State Hoisting Pattern

To share state between components without coupling, create state in the parent component and pass it to child components:

```typescript
// Child component receives external state
const Counter = createComponent((props: { count$: Observable<number>; onIncrement: () => void }) => {
  const template$ = props.count$.pipe(
    map(
      (count) => html`
        <div>
          <span>Count: ${count}</span>
          <button @click=${props.onIncrement}>+</button>
        </div>
      `,
    ),
  );

  return template$;
});

// Parent component creates and manages state
const App = createComponent(() => {
  // 1. Create state in parent
  const count$ = new BehaviorSubject<number>(0);
  const increment$ = new Subject<void>();

  // 2. Handle effects
  const incrementEffect$ = increment$.pipe(tap(() => count$.next(count$.value + 1)));

  // 3. Pass state to child components
  const template$ = count$.pipe(
    map(
      (count) => html`
        <section>
          <h1>App (Count: ${count})</h1>
          ${Counter({
            count$,
            onIncrement: () => increment$.next(),
          })}
        </section>
      `,
    ),
    mergeWith(incrementEffect$.pipe(ignoreElements())),
  );

  return template$;
});
```

## Key Concepts

- **Factory function**: Receives props and returns an Observable<TemplateResult> or TemplateResult
- **Static or reactive**: Return a template directly for static content, or an Observable for reactive content
- **Props are optional**: Use `createComponent(() => ...)` for no props
- **Reactive**: Use RxJS observables for state management when needed
- **Memoized**: Components are automatically memoized based on prop changes
- **Side effects**: Use `mergeWith(effects$.pipe(ignoreElements()))` to handle effects
