import server from "./sse-server";
import client from "./sse-client";
import utils from "./utils";

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
  ESHook.createHook = (es) => {
    ESHook.createHook = null;
    hookedEs = es;
  };

  await server.startServer(3000, "/es");
  clientEs = await client.startClient("http://127.0.0.1:3000/es");
});

afterEach(async () => {
  await client.stopClient();
  await server.stopServer();

  ESHook.createHook = null;
  ESHook.eventHook = null;
});

/* -------------------------------------------------------------------------- */
/*                                 Unit Tests                                 */
/* -------------------------------------------------------------------------- */

/* ------------------------------- Create Hook ------------------------------ */

describe("# Create Hook", () => {
  it("intercepts any opened connection", () => {
    expect(hookedEs).toBe(clientEs);
  });
});

/* ------------------------------- Event Hook ------------------------------- */

describe("# Event Hook", () => {
  describe("## `EventSource.addEventListener()` impl.", () => {
    it("takes a listener function successfully", (done) => {
      const type = utils.uniqueString();
      clientEs.addEventListener(type, () => done());
      server.sendEvent(type);
    });

    it("takes a listener object successfully", (done) => {
      const type = utils.uniqueString();
      clientEs.addEventListener(type, { handleEvent: () => done() });
      server.sendEvent(type);
    });

    it("throws if a function or object is not passed as a listener", () => {
      // @ts-ignore
      expect(() => clientEs.addEventListener(utils.uniqueString(), 1)).toThrowError(TypeError);
      // @ts-ignore
      expect(() => clientEs.addEventListener(utils.uniqueString(), null)).toThrowError(TypeError);
      // @ts-ignore
      expect(() => clientEs.addEventListener(utils.uniqueString(), true)).toThrowError(TypeError);
      // @ts-ignore
      expect(() => clientEs.addEventListener(utils.uniqueString(), "test")).toThrowError(TypeError);

      // @ts-ignore
      expect(() => clientEs.addEventListener(utils.uniqueString(), () => {})).not.toThrowError(TypeError);
      // @ts-ignore
      expect(() => clientEs.addEventListener(utils.uniqueString(), {})).not.toThrowError(TypeError);
    });
  });

  describe("## `EventSource.removeEventListener()` impl.", () => {
    it("removes passed listener when called", async () => {
      // Should removes listener from event types `open` and `error`.
      const funcOpen = jest.fn();
      const funcError = jest.fn();

      clientEs.addEventListener("open", funcOpen);
      clientEs.removeEventListener("open", funcOpen);
      clientEs.addEventListener("error", funcError);
      clientEs.removeEventListener("error", funcError);
      server.sendEvent("open");
      server.sendEvent("error");

      await utils.wait(50);
      expect(funcOpen).not.toHaveBeenCalled();
      expect(funcError).not.toHaveBeenCalled();

      // Should removes listener from any other event type.
      const funcAny = jest.fn();
      const type = utils.uniqueString();

      clientEs.addEventListener(type, funcAny);
      clientEs.removeEventListener(type, funcAny);
      server.sendEvent(type);

      await utils.wait(50);
      expect(funcAny).not.toHaveBeenCalled();
    });

    it("removes listener when `EventSource.onmessage` nulled", async () => {
      const func = jest.fn();

      clientEs.onmessage = func;
      clientEs.onmessage = null;
      server.sendEvent("message");

      await utils.wait(50);
      expect(func).not.toHaveBeenCalled();
    });
  });

  describe("## Hook behaviour", () => {
    it("intercepts any event type - with `EventSource.addEventListener()`", async () => {
      // Should not intercept event types `open` and `error`.
      const funcOpen = jest.fn();
      const funcError = jest.fn();

      ESHook.eventHook = (type) => {
        if (type === "open") funcOpen();
        if (type === "error") funcError();
      };

      clientEs.addEventListener("open", () => {});
      clientEs.addEventListener("error", () => {});
      server.sendEvent("open");
      server.sendEvent("error");

      await utils.wait(50);
      expect(funcOpen).not.toHaveBeenCalled();
      expect(funcError).not.toHaveBeenCalled();

      // Should intercept any other event type.
      const type = utils.uniqueString();
      const [toBeCalled, callMe] = utils.promisifyCallback();

      ESHook.eventHook = callMe;
      clientEs.addEventListener(type, () => {});
      server.sendEvent(type);

      await toBeCalled;
    });

    it("intercepts `message` event type - with `EventSource.onmessage`", (done) => {
      ESHook.eventHook = () => done();
      clientEs.onmessage = () => {};
      server.sendEvent("message");
    });

    it("lets the event from being received if not blocked", (done) => {
      const type = utils.uniqueString();
      ESHook.eventHook = ({}, event, {}) => event;
      clientEs.addEventListener(type, () => done());
      server.sendEvent(type);
    });

    it("blocks the event from being received if blocked", async () => {
      const type = utils.uniqueString();
      const func = jest.fn();

      ESHook.eventHook = () => null;
      clientEs.addEventListener(type, func);
      server.sendEvent(type);

      await utils.wait(50);
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
      const type = utils.uniqueString();
      const func = jest.fn();

      ESHook.eventHook = func;
      ESHook.eventHook = null;

      clientEs.addEventListener(type, () => {
        try {
          expect(func).not.toHaveBeenCalled();
          done();
        } catch (err) {
          done(err);
        }
      });

      server.sendEvent(type);
    });

    it("(async hook) lets the event from being received if not blocked", (done) => {
      const type = utils.uniqueString();
      ESHook.eventHook = ({}, event, {}, result) => result(event);
      clientEs.addEventListener(type, () => done());
      server.sendEvent(type);
    });

    it("(async hook) blocks the event from being received if blocked", async () => {
      const type = utils.uniqueString();
      const func = jest.fn();

      ESHook.eventHook = ({}, {}, {}, result) => result(null);
      clientEs.addEventListener(type, func);
      server.sendEvent(type);

      await utils.wait(50);
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

      clientEs.onmessage = (event) => {
        try {
          expect(event.type).toBe("message");
          expect(event.data).toBeNull();
          expect(event.origin).toBe(new URL(clientEs.url).origin);
          expect(event.lastEventId).toBe("");
          done();
        } catch (err) {
          done(err);
        }
      };

      ESHook.simulate(hookedEs, "message");
    });

    it("receives the simulated event with proper options", (done) => {
      expect.assertions(4);

      clientEs.addEventListener("test", (event) => {
        try {
          expect(event.type).toBe("test");
          expect(event.data).toBe(JSON.stringify("test"));
          expect(event.origin).toBe("http://test");
          expect(event.lastEventId).toBe("1");
          done();
        } catch (err) {
          done(err);
        }
      });

      ESHook.simulate(hookedEs, "test", { lastEventId: "1", data: "test", origin: "http://test" });
    });

    it("adds a property `simulated` to `true` to event object", (done) => {
      expect.assertions(1);

      clientEs.onmessage = (event: ExtendedMessageEvent) => {
        try {
          expect(event.simulated).toBe(true);
          done();
        } catch (err) {
          done(err);
        }
      };

      ESHook.simulate(hookedEs, "message");
    });

    it("serializes event data to JSON", (done) => {
      expect.assertions(1);

      clientEs.onmessage = (event) => {
        try {
          expect(event.data).toBe(JSON.stringify(["array"]));
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
  it("`createHook`", () => {
    const func = () => {};

    expect(ESHook.createHook).toBeNull();

    ESHook.createHook = func;
    expect(ESHook.createHook).toBe(func);

    ESHook.createHook = null;
    expect(ESHook.createHook).toBeNull();
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
