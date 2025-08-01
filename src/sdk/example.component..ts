import { html } from "lit-html";
import { BehaviorSubject, combineLatest, ignoreElements, map, merge, mergeWith, Subject, tap } from "rxjs";
import { createComponent } from "./create-component";
import "./example.component.css";

export const Counter = createComponent((props: { initial: number }) => {
  // Internal state
  const count$ = new BehaviorSubject<number>(props.initial);

  // Actions
  const increment$ = new Subject<void>();
  const decrement$ = new Subject<void>();
  const reset$ = new Subject<void>();

  // Effects
  const incrementEffect$ = increment$.pipe(tap(() => count$.next(count$.value + 1)));
  const decrementEffect$ = decrement$.pipe(tap(() => count$.next(count$.value - 1)));
  const resetEffect$ = reset$.pipe(tap(() => count$.next(0)));
  const effects$ = merge(incrementEffect$, decrementEffect$, resetEffect$).pipe(ignoreElements());

  // Template observable that combines state and automatically subscribes to effects
  const state$ = combineLatest([count$]).pipe(map(([count]) => ({ count })));
  const template$ = state$.pipe(
    tap({
      subscribe: () => console.log(`Will mount`),
      next: () => console.log(`Will render`),
      finalize: () => console.log(`Will unmount`),
    }),
    map(
      ({ count }) => html`
        <div class="example-view">
          <h2>Counter Example</h2>
          <div class="counter-display">
            <span class="count-value">${count}</span>
          </div>
          <menu class="counter-controls">
            <button @click=${() => decrement$.next()}>-</button>
            <button @click=${() => increment$.next()}>+</button>
            <button @click=${() => reset$.next()}>Reset</button>
          </menu>
        </div>
      `,
    ),
    mergeWith(effects$),
  );

  return template$;
});
