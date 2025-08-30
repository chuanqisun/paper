import { html, render } from "lit-html";
import { BehaviorSubject } from "rxjs";
import "./canvas.css";
import { ConnectionsComponent } from "./components/connections/connections.component";
import { loadApiKeys, type ApiKeys } from "./components/connections/storage";
import { FluxImageElement } from "./components/generative-image/generative-image";
import { createComponent } from "./sdk/create-component";

// Register custom elements
FluxImageElement.define(() => ({
  apiKey: loadApiKeys().together || "",
}));

const Main = createComponent(() => {
  const apiKeys$ = new BehaviorSubject<ApiKeys>(loadApiKeys());

  return html`
    <menu>
      <button commandfor="connection-dialog" command="show-modal">Open Dialog</button>
    </menu>
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
});

render(Main(), document.getElementById("app")!);
