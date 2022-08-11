import server from "./sse-server";
import client from "./sse-client";

import EventSourceHook from "../src/index";
import { ExtendedMessageEvent, HookedEventSource } from "../src/interfaces";

/* -------------------------------------------------------------------------- */
/*                                   Globals                                  */
/* -------------------------------------------------------------------------- */

/** Client connection used for testing purposes. */
let clientEs: EventSource;
/** Intercepted client connection (should be same as `clientEs`). */
let hookedEs: HookedEventSource;

/* -------------------------------------------------------------------------- */
/*                              Setup & Teardown                              */
/* -------------------------------------------------------------------------- */

beforeAll(async () => {
  EventSourceHook.enable();
  EventSourceHook.onconnect = (es) => (hookedEs = es);

  await server.startServer(3000, "/es");
  clientEs = await client.startClient("http://127.0.0.1:3000/es");
});

afterAll(async () => {
  await client.stopClient();
  await server.stopServer();
});

afterEach(() => {
  clientEs.onmessage = null;
  // @ts-ignore
  clientEs.removeAllListeners();
});

/* -------------------------------------------------------------------------- */
/*                                 Unit Tests                                 */
/* -------------------------------------------------------------------------- */

/* --------------------------------- Events --------------------------------- */

describe("`onconnect` event", () => {
  it.todo("intercepts the opened connection");
});

/* --------------------------------- Methods -------------------------------- */

describe("`simulate` method", () => {
  it.todo("receives the simulated message with default options");
  it.todo("receives the simulated message with proper options");
  it.todo("adds a property `simulated` to `true`");
  it.todo("serializes message data to JSON");
});

describe("`enable` method", () => {
  it.todo("swaps native `EventSource` constructor");
  it.todo("resumes all active hooks");
});

describe("`disable` method", () => {
  it.todo("swaps back native `EventSource` constructor");
  it.todo("pauses all active hooks");
});
