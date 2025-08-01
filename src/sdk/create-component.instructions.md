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

## Key Concepts

- **Factory function**: Receives props and returns an Observable<TemplateResult> or TemplateResult
- **Static or reactive**: Return a template directly for static content, or an Observable for reactive content
- **Props are optional**: Use `createComponent(() => ...)` for no props
- **Reactive**: Use RxJS observables for state management when needed
- **Memoized**: Components are automatically memoized based on prop changes
- **Side effects**: Use `mergeWith(effects$.pipe(ignoreElements()))` to handle effects
