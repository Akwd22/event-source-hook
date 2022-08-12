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

beforeEach(async () => {
  EventSourceHook.enable();
  EventSourceHook.onconnect = (es) => (hookedEs = es);

  await server.startServer(3000, "/es");
  clientEs = await client.startClient("http://127.0.0.1:3000/es");
});

afterEach(async () => {
  await client.stopClient();
  await server.stopServer();

  EventSourceHook.onconnect = null;
  EventSourceHook.hookEvent(false);
});

/* -------------------------------------------------------------------------- */
/*                                 Unit Tests                                 */
/* -------------------------------------------------------------------------- */

/* --------------------------------- Events --------------------------------- */

describe("`onconnect` event", () => {
  it("intercepts the opened connection", () => {
    expect(hookedEs).toBe(clientEs);
  });
});

describe("`hookEvent` method", () => {
  it("intercepts the default event type (with `addEventListener`)", (done) => {
    EventSourceHook.hookEvent(() => done());
    clientEs.addEventListener("message", () => {});
    server.sendEvent();
  });

  it("intercepts the default event type (with `onconnect`)", (done) => {
    EventSourceHook.hookEvent(() => done());
    clientEs.onmessage = () => {};
    server.sendEvent();
  });

  it("intercepts any event type", (done) => {
    EventSourceHook.hookEvent(() => done());
    clientEs.addEventListener("test", () => {});
    server.sendEvent("test");
  });

  it("also works with listener object passed to `addEventListener`", (done) => {
    let called = false;

    clientEs.addEventListener("message", {
      handleEvent: () => {
        called = true;
        done();
      },
    });

    setTimeout(() => {
      if (!called) done("Object listener should be called");
    }, 100);

    server.sendEvent();
  });

  it("lets the event from being received if not blocked", (done) => {
    let called = false;

    EventSourceHook.hookEvent((type, event, eventSource) => event);

    clientEs.addEventListener("message", () => {
      called = true;
      done();
    });

    setTimeout(() => {
      if (!called) done("Event should not be blocked");
    }, 100);

    server.sendEvent();
  });

  it("blocks the event from being received if asked", (done) => {
    let called = false;

    EventSourceHook.hookEvent(() => null);

    clientEs.addEventListener("message", () => {
      called = true;
      done("Event should be blocked and not received");
    });

    setTimeout(() => {
      if (!called) done();
    }, 100);

    server.sendEvent();
  });

  it("calls the hook function with proper args", (done) => {
    EventSourceHook.hookEvent((type, event, eventSource) => {
      try {
        expect(type).toBe("test");
        expect(event.data).toBe(JSON.stringify("data"));
        expect(event.lastEventId).toBe("id");
        expect(eventSource).toBe(hookedEs);
        done();
      } catch (err) {
        done(err);
      }

      return null;
    });

    clientEs.addEventListener("test", () => {});

    server.sendEvent("test", "data", "id");
  });

  it("unattaches the hook function", (done) => {
    let called = false;

    EventSourceHook.hookEvent(() => {
      called = true;
      done("Hook function should not be called");
      return null;
    });

    EventSourceHook.hookEvent(false);

    clientEs.addEventListener("message", () => {
      if (!called) done();
    });

    server.sendEvent();
  });

  it("removes original listener when `removeEventListener` called", (done) => {
    let called = false;

    const func = () => {
      called = true;
      done("Listener should be removed thus not called");
    };

    clientEs.addEventListener("message", func);
    clientEs.removeEventListener("message", func);

    setTimeout(() => {
      if (!called) done();
    }, 100);

    server.sendEvent();
  });

  it("removes original listener when `onmessage` nulled", (done) => {
    let called = false;

    const func = () => {
      called = true;
      done("Listener should be removed thus not called");
    };

    clientEs.onmessage = func;
    clientEs.onmessage = null;

    setTimeout(() => {
      if (!called) done();
    }, 100);

    server.sendEvent();
  });

  it("throws an exception if a function or object is not passed to 2nd param `addEventListener`", () => {
    // @ts-ignore
    expect(() => clientEs.addEventListener("message", 1)).toThrowError(TypeError);
    // @ts-ignore
    expect(() => clientEs.addEventListener("message", undefined)).toThrowError(TypeError);
    // @ts-ignore
    expect(() => clientEs.addEventListener("message", null)).toThrowError(TypeError);
    // @ts-ignore
    expect(() => clientEs.addEventListener("message", "test")).toThrowError(TypeError);
    // @ts-ignore
    expect(() => clientEs.addEventListener("message", true)).toThrowError(TypeError);

    // @ts-ignore
    expect(() => clientEs.addEventListener("message", () => {})).not.toThrowError(TypeError);
    // @ts-ignore
    expect(() => clientEs.addEventListener("message", {})).not.toThrowError(TypeError);
  });
});

/* --------------------------------- Methods -------------------------------- */

describe("`simulate` method", () => {
  it("receives the simulated message with default options", (done) => {
    clientEs.onmessage = (e) => {
      try {
        expect(e.type).toBe("message");
        expect(e.data).toBeNull();
        expect(e.origin).toBe(new URL(clientEs.url).origin);
        expect(e.lastEventId).toBe("");
        done();
      } catch (err) {
        done(err);
      }
    };

    EventSourceHook.simulate(hookedEs, "message");
  });

  it("receives the simulated message with proper options", (done) => {
    clientEs.addEventListener("test", (e) => {
      try {
        expect(e.type).toBe("test");
        expect(e.data).toBe(JSON.stringify("test"));
        expect(e.origin).toBe("http://test");
        expect(e.lastEventId).toBe("1");
        done();
      } catch (err) {
        done(err);
      }
    });

    EventSourceHook.simulate(hookedEs, "test", { lastEventId: "1", data: "test", origin: "http://test" });
  });

  it("adds a property `simulated` to `true`", (done) => {
    clientEs.onmessage = (e: ExtendedMessageEvent) => {
      try {
        expect(e.simulated).toBe(true);
        done();
      } catch (err) {
        done(err);
      }
    };

    EventSourceHook.simulate(hookedEs, "message");
  });

  it("serializes message data to JSON", (done) => {
    clientEs.onmessage = (e) => {
      try {
        expect(e.data).toBe(JSON.stringify(["array"]));
        done();
      } catch (err) {
        done(err);
      }
    };

    EventSourceHook.simulate(hookedEs, "message", { data: ["array"] });
  });
});

describe("`enable` method", () => {
  it("swaps native `EventSource` constructor", () => {
    EventSourceHook.enable();
    expect(EventSource.name).toBe("HookedEventSource");
  });

  it.todo("resumes all active hooks");
});

describe("`disable` method", () => {
  it("swaps back native `EventSource` constructor", () => {
    EventSourceHook.disable();
    expect(EventSource.name).toBe("EventSource");
  });

  it.todo("pauses all active hooks");
});
