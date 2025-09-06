import { html, render } from "lit-html";
import { BehaviorSubject, from, fromEvent, ignoreElements, map, mergeWith, of, scan, switchMap, tap } from "rxjs";
import { ConnectionsComponent } from "./components/connections/connections.component";
import { loadApiKeys, type ApiKeys } from "./components/connections/storage";
import "./main.css";
import { createComponent } from "./sdk/create-component";
import { observe } from "./sdk/observe-directive";

const Main = createComponent(() => {
  const apiKeys$ = new BehaviorSubject<ApiKeys>(loadApiKeys());
  const paperContent$ = new BehaviorSubject<string | null>(null);
  const outline$ = new BehaviorSubject<string[]>([]);

  const emptyPlaceholder = paperContent$.pipe(
    map((content) => (content === null ? html`<div class="empty-placeholder">Paste to start</div>` : null)),
  );

  const scanContent$ = paperContent$.pipe(
    switchMap((content) => {
      if (content === null) {
        return [];
      }
      const lines = content.split("\n").filter((line) => line.trim().length > 0);
      return from(lines);
    }),
    scan((acc, line) => {
      return [...acc, line];
    }, [] as string[]),
    tap((lines) => outline$.next(lines)),
  );

  const outlineView$ = outline$.pipe(
    map((lines) => {
      return html`<div>${lines.map((line) => html`<div>${line}</div>`)}</div>`;
    }),
  );

  const paste$ = fromEvent<ClipboardEvent>(document, "paste").pipe(
    map((event) => event.clipboardData?.getData("text/plain") ?? ""),
    tap((text) => paperContent$.next(text)),
  );

  const template$ = of(html`
    <header class="app-header">
      <h1>Paper</h1>
      <button commandfor="connection-dialog" command="show-modal">Setup</button>
    </header>
    <main class="main">${observe(emptyPlaceholder)} ${observe(outlineView$)}</main>
    <dialog class="connection-form" id="connection-dialog">
      <div class="connections-dialog-body">
        ${ConnectionsComponent({ apiKeys$ })}
        <form method="dialog">
          <button>Close</button>
        </form>
      </div>
    </dialog>
  `).pipe(mergeWith(scanContent$.pipe(ignoreElements()), paste$.pipe(ignoreElements())));

  return template$;
});

render(Main(), document.getElementById("app")!);
