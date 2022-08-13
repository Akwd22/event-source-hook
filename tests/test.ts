import server from "./sse-server";
import client from "./sse-client";

import ESHook from "../src/index";
import { ExtendedMessageEvent, HookedEventSource, HookEventFunctionAsync, HookEventFunctionSync } from "../src/interfaces";

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
  ESHook.enable();
  ESHook.openHook = (es) => {
    ESHook.openHook = null;
    hookedEs = es;
  };

  await server.startServer(3000, "/es");
  clientEs = await client.startClient("http://127.0.0.1:3000/es");
});

afterEach(async () => {
  await client.stopClient();
  await server.stopServer();

  ESHook.openHook = null;
  ESHook.eventHook = null;
});

/* -------------------------------------------------------------------------- */
/*                                 Unit Tests                                 */
/* -------------------------------------------------------------------------- */

async function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/* ----------------------------- Connect Hooking ---------------------------- */

describe("# Connect Hook", () => {
  it("intercepts any opened connection", () => {
    expect(hookedEs).toBe(clientEs);
  });
});

/* ------------------------------ Event Hooking ----------------------------- */

describe("# Event Hook", () => {
  describe("## `EventSource.addEventListener()` impl.", () => {
    it("takes a listener function successfully", (done) => {
      clientEs.addEventListener("message", () => done());
      server.sendEvent();
    });

    it("takes a listener object successfully", (done) => {
      clientEs.addEventListener("message", { handleEvent: () => done() });
      server.sendEvent();
    });

    it("throws if a function or object is not passed as a listener", () => {
      // @ts-ignore
      expect(() => clientEs.addEventListener("message1", 1)).toThrowError(TypeError);
      // @ts-ignore
      expect(() => clientEs.addEventListener("message2", null)).toThrowError(TypeError);
      // @ts-ignore
      expect(() => clientEs.addEventListener("message3", true)).toThrowError(TypeError);
      // @ts-ignore
      expect(() => clientEs.addEventListener("message4", "test")).toThrowError(TypeError);

      // @ts-ignore
      expect(() => clientEs.addEventListener("message5", () => {})).not.toThrowError(TypeError);
      // @ts-ignore
      expect(() => clientEs.addEventListener("message6", {})).not.toThrowError(TypeError);
    });
  });

  describe("## `EventSource.removeEventListener()` impl.", () => {
    it("removes passed listener when called", async () => {
      const func = jest.fn();

      clientEs.addEventListener("message", func);
      clientEs.removeEventListener("message", func);
      server.sendEvent();

      await wait(50);
      expect(func).not.toHaveBeenCalled();
    });

    it("removes listener when `EventSource.onmessage` nulled", async () => {
      const func = jest.fn();

      clientEs.onmessage = func;
      clientEs.onmessage = null;
      server.sendEvent();

      await wait(50);
      expect(func).not.toHaveBeenCalled();
    });
  });

  describe("## Hook behaviour", () => {
    it("intercepts any event type - with `EventSource.addEventListener()`", (done) => {
      const type = String(Math.random());
      ESHook.eventHook = () => done();
      clientEs.addEventListener(type, () => {});
      server.sendEvent(type);
    });

    it("intercepts `message` event type - with `EventSource.onmessage`", (done) => {
      ESHook.eventHook = () => done();
      clientEs.onmessage = () => {};
      server.sendEvent("message");
    });

    it("lets the event from being received if not blocked", (done) => {
      ESHook.eventHook = ({}, event, {}) => event;
      clientEs.addEventListener("message", () => done());
      server.sendEvent();
    });

    it("blocks the event from being received if blocked", async () => {
      const func = jest.fn();

      ESHook.eventHook = () => null;
      clientEs.addEventListener("message", func);
      server.sendEvent();

      await wait(50);
      expect(func).not.toHaveBeenCalled();
    });

    it("calls the hook function with proper args", (done) => {
      expect.assertions(4);

      ESHook.eventHook = (type, event, eventSource) => {
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
      };

      clientEs.addEventListener("test", () => {});

      server.sendEvent("test", "data", "id");
    });

    it("unattaches the hook function", (done) => {
      const func = jest.fn();

      ESHook.eventHook = func;
      ESHook.eventHook = null;

      clientEs.addEventListener("message", () => {
        try {
          expect(func).not.toHaveBeenCalled();
          done();
        } catch (err) {
          done(err);
        }
      });

      server.sendEvent();
    });

    it("(async hook) lets the event from being received if not blocked", (done) => {
      ESHook.eventHook = ({}, event, {}, result) => result(event);
      clientEs.addEventListener("message", () => done());
      server.sendEvent();
    });

    it("(async hook) blocks the event from being received if blocked", async () => {
      const func = jest.fn();

      ESHook.eventHook = ({}, {}, {}, result) => result(null);
      clientEs.addEventListener("message", func);
      server.sendEvent();

      await wait(50);
      expect(func).not.toHaveBeenCalled();
    });
  });
});

/* --------------------------------- Methods -------------------------------- */

describe("# `ESHook` Class Methods", () => {
  describe("## `enable()`", () => {
    it("swaps native `EventSource` constructor", () => {
      ESHook.enable();
      expect(EventSource.name).toBe("HookedEventSource");
    });
  });

  describe("## `disable()`", () => {
    it("swaps back native `EventSource` constructor", () => {
      ESHook.disable();
      expect(EventSource.name).toBe("EventSource");
    });
  });

  describe("## `simulate()`", () => {
    it("receives the simulated event with default options", (done) => {
      expect.assertions(4);

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

      ESHook.simulate(hookedEs, "message");
    });

    it("receives the simulated event with proper options", (done) => {
      expect.assertions(4);

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

      ESHook.simulate(hookedEs, "test", { lastEventId: "1", data: "test", origin: "http://test" });
    });

    it("adds a property `simulated` to `true` to event object", (done) => {
      expect.assertions(1);

      clientEs.onmessage = (e: ExtendedMessageEvent) => {
        try {
          expect(e.simulated).toBe(true);
          done();
        } catch (err) {
          done(err);
        }
      };

      ESHook.simulate(hookedEs, "message");
    });

    it("serializes event data to JSON", (done) => {
      expect.assertions(1);

      clientEs.onmessage = (e) => {
        try {
          expect(e.data).toBe(JSON.stringify(["array"]));
          done();
        } catch (err) {
          done(err);
        }
      };

      ESHook.simulate(hookedEs, "message", { data: ["array"] });
    });
  });
});

/* ------------------------------- Properties ------------------------------- */

describe("# `ESHook` Class Properties", () => {
  it("`openHook`", () => {
    const func = () => {};

    expect(ESHook.openHook).toBeNull();

    ESHook.openHook = func;
    expect(ESHook.openHook).toBe(func);

    ESHook.openHook = null;
    expect(ESHook.openHook).toBeNull();
  });

  it("`eventHook`", () => {
    const func = () => {};

    expect(ESHook.eventHook).toBeNull();

    ESHook.eventHook = func;
    expect(ESHook.eventHook).toBe(func);

    ESHook.eventHook = null;
    expect(ESHook.eventHook).toBeNull();
  });

  it("`isEventHookAsync`", () => {
    const funcSync: HookEventFunctionSync = ({}, {}, {}) => null;
    const funcAsync: HookEventFunctionAsync = ({}, {}, {}, result) => {};

    ESHook.eventHook = null;
    expect(ESHook.isEventHookAsync).toBe(false);

    ESHook.eventHook = funcSync;
    expect(ESHook.isEventHookAsync).toBe(false);

    ESHook.eventHook = funcAsync;
    expect(ESHook.isEventHookAsync).toBe(true);
  });

  it("`enabled`", () => {
    // Test by calling enable/disable functions.
    ESHook.enable();
    const fake = EventSource;
    expect(ESHook.enabled).toBe(true);

    ESHook.disable();
    const genuine = EventSource;
    expect(ESHook.enabled).toBe(false);

    // Test without calling enable/disable functions.
    EventSource = fake;
    expect(ESHook.enabled).toBe(true);

    EventSource = genuine;
    expect(ESHook.enabled).toBe(false);
  });
});
