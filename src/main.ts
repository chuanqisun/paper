import { html, render } from "lit-html";
import { BehaviorSubject, filter, fromEvent, ignoreElements, map, mergeWith, of, Subject, tap } from "rxjs";
import { ConnectionsComponent } from "./components/connections/connections.component";
import { loadApiKeys, type ApiKeys } from "./components/connections/storage";
import { AskComponent } from "./components/outline/ask.component";
import type { OutlineItem } from "./components/outline/generate-outline";
import { OutlineComponent } from "./components/outline/outline.component";
import { normalizePastedPaperInput, pickPaperInput, type PaperInput } from "./lib/paper-input";
import "./main.css";
import { createComponent } from "./sdk/create-component";
import { observe } from "./sdk/observe-directive";

const Main = createComponent(() => {
  const apiKeys$ = new BehaviorSubject<ApiKeys>(loadApiKeys());
  const paperInput$ = new BehaviorSubject<PaperInput | null>(null);
  const isOutlineEmpty$ = new BehaviorSubject<boolean>(false);
  const tooltipContent$ = new BehaviorSubject<string | null>(null);
  const itemToAsk$ = new BehaviorSubject<OutlineItem | null>(null);
  const onAsk$ = new Subject<{ item: OutlineItem; question: string }>();

  const setPaperInput = (nextInput: PaperInput | null) => {
    paperInput$.next(nextInput);
  };

  const openFilePicker = async () => {
    setPaperInput(await pickPaperInput());
  };

  const emptyPlaceholder = paperInput$.pipe(
    map((content) =>
      content === null
        ? html`
            <div class="empty-placeholder">
              <button class="empty-placeholder-trigger" type="button" @click=${openFilePicker}>
                Paste or upload to start
              </button>
            </div>
          `
        : null,
    ),
  );

  const outlineComponent$ = OutlineComponent({
    apiKeys$,
    paperInput$,
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
    filter((event) => {
      const target = event.target as HTMLElement;
      return !(target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.contentEditable === "true");
    }),
    map((event) => event.clipboardData?.getData("text/plain") ?? ""),
    map(normalizePastedPaperInput),
    tap(setPaperInput),
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
