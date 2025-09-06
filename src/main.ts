import { html, render } from "lit-html";
import { BehaviorSubject, fromEvent, ignoreElements, map, mergeWith, of, tap } from "rxjs";
import { ConnectionsComponent } from "./components/connections/connections.component";
import { loadApiKeys, type ApiKeys } from "./components/connections/storage";
import { OutlineComponent } from "./components/outline/outline.component";
import "./main.css";
import { createComponent } from "./sdk/create-component";
import { observe } from "./sdk/observe-directive";

const Main = createComponent(() => {
  const apiKeys$ = new BehaviorSubject<ApiKeys>(loadApiKeys());
  const paperContent$ = new BehaviorSubject<string | null>(null);
  const isOutlineEmpty$ = new BehaviorSubject<boolean>(false);

  const emptyPlaceholder = paperContent$.pipe(
    map((content) => (content === null ? html`<div class="empty-placeholder">Paste to start</div>` : null)),
  );

  const outlineComponent$ = OutlineComponent({
    apiKeys$,
    paperContent$,
    isEmpty$: isOutlineEmpty$,
  });

  const paste$ = fromEvent<ClipboardEvent>(document, "paste").pipe(
    map((event) => event.clipboardData?.getData("text/plain") ?? ""),
    tap((text) => paperContent$.next(text)),
  );

  const template$ = of(html`
    <header class="app-header">
      <h1>Paper</h1>
      <button commandfor="connection-dialog" command="show-modal">Setup</button>
    </header>
    <main class="main">${observe(emptyPlaceholder)} ${outlineComponent$}</main>
    <dialog class="connection-form" id="connection-dialog">
      <div class="connections-dialog-body">
        ${ConnectionsComponent({ apiKeys$ })}
        <form method="dialog">
          <button>Close</button>
        </form>
      </div>
    </dialog>
  `).pipe(mergeWith(paste$.pipe(ignoreElements())));

  return template$;
});

render(Main(), document.getElementById("app")!);
