import { html, render } from "lit-html";
import { BehaviorSubject, map } from "rxjs";
import type { ImageItem } from "./components/canvas/canvas.component";
import { CanvasComponent } from "./components/canvas/canvas.component";
import { ConnectionsComponent } from "./components/connections/connections.component";
import { loadApiKeys, type ApiKeys } from "./components/connections/storage";
import { ContextTrayComponent } from "./components/context-tray/context-tray.component";
import { FluxImageElement } from "./components/generative-image/generative-image";
import "./main-v2.css";
import { createComponent } from "./sdk/create-component";

// Register custom elements
FluxImageElement.define(() => ({
  apiKey: loadApiKeys().together || "",
}));

const Main = createComponent(() => {
  const apiKeys$ = new BehaviorSubject<ApiKeys>(loadApiKeys());
  const images$ = new BehaviorSubject<ImageItem[]>([]);

  const template$ = images$.pipe(
    map(() => {
      return html`
        <header class="app-header">
          <h1>IdeaBoard</h1>
          <button commandfor="connection-dialog" command="show-modal">Setup</button>
        </header>
        <main class="main">${CanvasComponent({ images$, apiKeys$ })}</main>
        ${ContextTrayComponent({ images$, apiKeys$ })}
        <dialog class="connection-form" id="connection-dialog">
          <div class="connections-dialog-body">
            ${ConnectionsComponent({ apiKeys$ })}
            <form method="dialog">
              <button>Close</button>
            </form>
          </div>
        </dialog>
      `;
    }),
  );

  return template$;
});

render(Main(), document.getElementById("app")!);
