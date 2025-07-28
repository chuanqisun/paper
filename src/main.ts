import { render } from "lit-html";
import { BehaviorSubject, merge, of, Subject } from "rxjs";
import { catchError, debounceTime, distinctUntilChanged, mergeMap, tap } from "rxjs/operators";
import { loadApiKeys, saveApiKeys, type ApiKeys } from "./lib/storage";
import { testConnection } from "./lib/test-connections";
import "./main.css";
import { connectionsView } from "./views/connections";
import "./views/connections.css";

// 1. DOM references
const connectionsContent = document.querySelector(".connections-content") as HTMLElement;

// 2. Declare streams
const apiKeys$ = new BehaviorSubject<ApiKeys>(loadApiKeys());
const apiKeyChange$ = new Subject<{ provider: keyof ApiKeys; value: string }>();
const testConnection$ = new Subject<{ provider: "openai" | "together" }>();
const testResults$ = new BehaviorSubject<{ openai?: string; together?: string }>({});
const testLoading$ = new BehaviorSubject<boolean>(false);

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

const handleTestConnection$ = testConnection$.pipe(
  tap(() => {
    testLoading$.next(true);
  }),
  mergeMap(({ provider }) =>
    testConnection({
      provider,
      apiKeys: apiKeys$.value,
    }).pipe(
      tap((result) => {
        const currentResults = testResults$.value;
        testResults$.next({ ...currentResults, [provider]: result });
        testLoading$.next(false);
      }),
      catchError((error) => {
        const currentResults = testResults$.value;
        testResults$.next({ ...currentResults, [provider]: `Error: ${error.message}` });
        testLoading$.next(false);
        return of(null);
      }),
    ),
  ),
);

const renderConnections$ = merge(apiKeys$, testResults$, testLoading$).pipe(
  tap(() => {
    const connectionsTemplate = connectionsView({
      apiKeys: apiKeys$.value,
      onApiKeyChange: apiKeyChange$,
      onTestConnection: testConnection$,
      testResults: testResults$.value,
      testLoading: testLoading$.value,
    });

    render(connectionsTemplate, connectionsContent);
  }),
);

// 3. Start
merge(persistKeys$, handleTestConnection$, renderConnections$).subscribe();
