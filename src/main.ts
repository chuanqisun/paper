import { render } from "lit-html";
import { BehaviorSubject } from "rxjs";
import { tap } from "rxjs/operators";
import { loadApiKeys, type ApiKeys } from "./lib/storage";
import "./main.css";
import { connectionsView } from "./views/connections";
import "./views/connections.css";

// 1. DOM references
const connectionsContent = document.querySelector(".connections-content") as HTMLElement;

// 2. Declare streams
const apiKeys$ = new BehaviorSubject<ApiKeys>(loadApiKeys());

const renderConnections$ = apiKeys$.pipe(
  tap(() => {
    const connectionsTemplate = connectionsView({ apiKeys$ });
    render(connectionsTemplate, connectionsContent);
  }),
);

// 3. Start
renderConnections$.subscribe();
