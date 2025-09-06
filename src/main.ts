import { html, render } from "lit-html";
import { BehaviorSubject, fromEvent, ignoreElements, map, mergeWith, of, Subject, tap } from "rxjs";
import { ConnectionsComponent } from "./components/connections/connections.component";
import { loadApiKeys, type ApiKeys } from "./components/connections/storage";
import { AskComponent } from "./components/outline/ask.component";
import type { OutlineItem } from "./components/outline/generate-outline";
import { OutlineComponent } from "./components/outline/outline.component";
import "./main.css";
import { createComponent } from "./sdk/create-component";
import { observe } from "./sdk/observe-directive";

const Main = createComponent(() => {
  const apiKeys$ = new BehaviorSubject<ApiKeys>(loadApiKeys());
  const paperContent$ = new BehaviorSubject<string | null>(null);
  const isOutlineEmpty$ = new BehaviorSubject<boolean>(false);
  const tooltipContent$ = new BehaviorSubject<string | null>(null);
  const itemToAsk$ = new BehaviorSubject<OutlineItem | null>(null);
  const onAsk$ = new Subject<{ item: OutlineItem; question: string }>();

  const emptyPlaceholder = paperContent$.pipe(
    map((content) => (content === null ? html`<div class="empty-placeholder">Paste to start</div>` : null)),
  );

  const outlineComponent$ = OutlineComponent({
    apiKeys$,
    paperContent$,
    isEmpty$: isOutlineEmpty$,
    tooltipContent$,
    itemToAsk$,
    onAsk$,
  });

  const askComponent$ = AskComponent({
    itemToAsk$,
    onAsk$,
  });

  const paste$ = fromEvent<ClipboardEvent>(document, "paste").pipe(
    map((event) => event.clipboardData?.getData("text/plain") ?? ""),
    map((content) => (content.trim() ? content : null)),
    tap((text) => paperContent$.next(text)),
  );

  const template$ = of(html`
    <header class="app-header">
      <h1>Paper</h1>
      <button commandfor="connection-dialog" command="show-modal">Setup</button>
    </header>
    <main class="main">${observe(emptyPlaceholder)} ${outlineComponent$}</main>
    <footer class="app-footer">${observe(tooltipContent$)}</footer>
    <dialog class="connection-form" id="connection-dialog">
      <div class="connections-dialog-body">
        ${ConnectionsComponent({ apiKeys$ })}
        <form method="dialog">
          <button>Close</button>
        </form>
      </div>
    </dialog>
    <dialog class="ask-dialog" id="ask-dialog">
      <div class="ask-dialog-body">${askComponent$}</div>
    </dialog>
  `).pipe(mergeWith(paste$.pipe(ignoreElements())));

  return template$;
});

render(Main(), document.getElementById("app")!);
