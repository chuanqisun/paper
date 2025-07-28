import { render } from "lit-html";
import { BehaviorSubject, merge, Subject } from "rxjs";
import { debounceTime, distinctUntilChanged, tap } from "rxjs/operators";
import { loadApiKeys, saveApiKeys, type ApiKeys } from "./lib/storage";
import "./main.css";
import { connectionsView } from "./views/connections";
import "./views/connections.css";

// 1. DOM references
const connectionsContent = document.querySelector(".connections-content") as HTMLElement;

// 2. Declare streams
const apiKeys$ = new BehaviorSubject<ApiKeys>(loadApiKeys());
const apiKeyChange$ = new Subject<{ provider: keyof ApiKeys; value: string }>();

const persistKeys$ = apiKeyChange$.pipe(
  debounceTime(300),
  distinctUntilChanged((a, b) => a.provider === b.provider && a.value === b.value),
  tap(({ provider, value }) => {
    const currentKeys = apiKeys$.value;
    const updatedKeys = { ...currentKeys, [provider]: value };
    apiKeys$.next(updatedKeys);
    saveApiKeys(updatedKeys);
  }),
);

const renderConnections$ = apiKeys$.pipe(
  tap((apiKeys) => {
    const connectionsTemplate = connectionsView({
      apiKeys,
      onApiKeyChange: apiKeyChange$,
    });

    render(connectionsTemplate, connectionsContent);
  }),
);

// 3. Start
merge(persistKeys$, renderConnections$).subscribe();
