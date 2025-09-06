import { html, render } from "lit-html";
import { BehaviorSubject, map, of } from "rxjs";
import { ConnectionsComponent } from "./components/connections/connections.component";
import { loadApiKeys, type ApiKeys } from "./components/connections/storage";
import "./main.css";
import { createComponent } from "./sdk/create-component";

const Main = createComponent(() => {
  const apiKeys$ = new BehaviorSubject<ApiKeys>(loadApiKeys());

  const template$ = of(0).pipe(
    map(() => {
      return html`
        <header class="app-header">
          <h1>Paper</h1>
          <button commandfor="connection-dialog" command="show-modal">Setup</button>
        </header>
        <main class="main"></main>
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
