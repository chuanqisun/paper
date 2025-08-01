import { html, render } from "lit-html";
import { repeat } from "lit-html/directives/repeat.js";
import { BehaviorSubject } from "rxjs";
import { map } from "rxjs/operators";
import { createComponent } from "./sdk/create-component";
import { Counter } from "./sdk/example.component";

const Main = createComponent(() => {
  const sectionCount$ = new BehaviorSubject<number>(3);
  const template$ = sectionCount$.pipe(
    map(
      (sectionCount) =>
        html` <button @click=${() => sectionCount$.next(Math.max(0, sectionCount - 1))}>Remove Example View</button>
          <button @click=${() => sectionCount$.next(sectionCount + 1)}>Add Example View</button>
          ${repeat(
            [...Array(sectionCount).keys()],
            (i) => i,
            (i) =>
              html`<section>
                <h1>Example View ${i + 1}</h1>
                ${Counter({ initial: i })}
              </section>`,
          )}`,
    ),
  );

  return template$;
});

render(Main(), document.getElementById("app")!);
