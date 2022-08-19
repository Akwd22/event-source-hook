import sse from "./sse-client";
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

  clientEs = await sse.open();
});

afterEach(() => {
  sse.close();
  ESHook.urlHook = null;
  ESHook.createHook = null;
  ESHook.eventHook = null;
});

/* -------------------------------------------------------------------------- */
/*                                 Unit Tests                                 */
/* -------------------------------------------------------------------------- */

/* -------------------------------- URL Hook -------------------------------- */

describe("# URL Hook", () => {
  let testEs: EventSource | null;

  it("calls the hook function with proper args", (done) => {
    ESHook.urlHook = (url) => {
      expect(url).toBe("the-url");
      done();
      return url;
    };

    testEs = new EventSource("the-url");
  });

  it("changes server URL and it successfully connects to it", (done) => {
    const newUrl = clientEs.url;
    ESHook.urlHook = () => newUrl;

    testEs = new EventSource("/change-me");
    expect(testEs.url).toBe(newUrl);

    // On connect, the testing server automatically send this event.
    testEs.addEventListener("client-id", () => done());
  });

  afterEach(() => {
    testEs?.close();
    testEs = null;
  });
});

/* ------------------------------- Create Hook ------------------------------ */

describe("# Create Hook", () => {
  it("intercepts any opened connection", () => {
    expect(hookedEs).toBe(clientEs as HookedEventSource);
  });
});

/* ------------------------------- Event Hook ------------------------------- */

describe("# Event Hook", () => {
  describe("## `EventSource.addEventListener()` impl.", () => {
    it("takes a listener function successfully", (done) => {
      const type = utils.uniqueString();
      clientEs.addEventListener(type, () => done());
      sse.sendEvent(type);
    });

    it("takes a listener object successfully", (done) => {
      const type = utils.uniqueString();
      clientEs.addEventListener(type, { handleEvent: () => done() });
      sse.sendEvent(type);
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
      const funcOpen = jasmine.createSpy();
      const funcError = jasmine.createSpy();

      clientEs.addEventListener("open", funcOpen);
      clientEs.removeEventListener("open", funcOpen);
      clientEs.addEventListener("error", funcError);
      clientEs.removeEventListener("error", funcError);
      sse.sendEvent("open");
      sse.sendEvent("error");

      await utils.wait(50);
      expect(funcOpen).not.toHaveBeenCalled();
      expect(funcError).not.toHaveBeenCalled();

      // Should removes listener from any other event type.
      const funcAny = jasmine.createSpy();
      const type = utils.uniqueString();

      clientEs.addEventListener(type, funcAny);
      clientEs.removeEventListener(type, funcAny);
      sse.sendEvent(type);

      await utils.wait(50);
      expect(funcAny).not.toHaveBeenCalled();
    });

    it("removes listener when `EventSource.onmessage` nulled", async () => {
      const func = jasmine.createSpy();

      clientEs.onmessage = func;
      clientEs.onmessage = null;
      sse.sendEvent("message");

      await utils.wait(50);
      expect(func).not.toHaveBeenCalled();
    });
  });

  describe("## Hook behaviour", () => {
    it("intercepts any event type - with `EventSource.addEventListener()`", async () => {
      // Should not intercept event types `open` and `error`.
      const funcOpen = jasmine.createSpy();
      const funcError = jasmine.createSpy();

      ESHook.eventHook = (type) => {
        if (type === "open") funcOpen();
        if (type === "error") funcError();
      };

      clientEs.addEventListener("open", () => {});
      clientEs.addEventListener("error", () => {});
      sse.sendEvent("open");
      sse.sendEvent("error");

      await utils.wait(50);
      expect(funcOpen).not.toHaveBeenCalled();
      expect(funcError).not.toHaveBeenCalled();

      // Should intercept any other event type.
      const type = utils.uniqueString();
      const [toBeCalled, callMe] = utils.promisifyCallback();

      ESHook.eventHook = callMe;
      clientEs.addEventListener(type, () => {});
      sse.sendEvent(type);

      await toBeCalled;
    });

    it("intercepts `message` event type - with `EventSource.onmessage`", (done) => {
      ESHook.eventHook = () => done();
      clientEs.onmessage = () => {};
      sse.sendEvent("message");
    });

    it("lets the event from being received if not blocked", (done) => {
      const type = utils.uniqueString();
      ESHook.eventHook = ({}, event, {}) => event;
      clientEs.addEventListener(type, () => done());
      sse.sendEvent(type);
    });

    it("blocks the event from being received if blocked", async () => {
      const type = utils.uniqueString();
      const func = jasmine.createSpy();

      ESHook.eventHook = () => null;
      clientEs.addEventListener(type, func);
      sse.sendEvent(type);

      await utils.wait(50);
      expect(func).not.toHaveBeenCalled();
    });

    it("calls the hook function with proper args", (done) => {
      ESHook.eventHook = (type, event, eventSource) => {
        try {
          expect(type).toBe("test");
          expect(event.data).toBe(JSON.stringify("data"));
          expect(event.lastEventId).toBe("id");
          expect(eventSource).toBe(hookedEs);
          done();
        } catch (err) {
          done.fail(err);
        }

        return null;
      };

      clientEs.addEventListener("test", () => {});
      sse.sendEvent("test", "data", "id");
    });

    it("unattaches the hook function", (done) => {
      const type = utils.uniqueString();
      const func = jasmine.createSpy();

      ESHook.eventHook = func;
      ESHook.eventHook = null;

      clientEs.addEventListener(type, () => {
        try {
          expect(func).not.toHaveBeenCalled();
          done();
        } catch (err) {
          done.fail(err);
        }
      });

      sse.sendEvent(type);
    });

    it("(async hook) lets the event from being received if not blocked", (done) => {
      const type = utils.uniqueString();
      ESHook.eventHook = ({}, event, {}, result) => result(event);
      clientEs.addEventListener(type, () => done());
      sse.sendEvent(type);
    });

    it("(async hook) blocks the event from being received if blocked", async () => {
      const type = utils.uniqueString();
      const func = jasmine.createSpy();

      ESHook.eventHook = ({}, {}, {}, result) => result(null);
      clientEs.addEventListener(type, func);
      sse.sendEvent(type);

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
      clientEs.onmessage = (event) => {
        try {
          expect(event.type).toBe("message");
          expect(event.data).toBeNull();
          expect(event.origin).toBe(new URL(clientEs.url).origin);
          expect(event.lastEventId).toBe("");
          done();
        } catch (err) {
          done.fail(err);
        }
      };

      ESHook.simulate(hookedEs, "message");
    });

    it("receives the simulated event with proper options", (done) => {
      clientEs.addEventListener("test", (event) => {
        try {
          expect(event.type).toBe("test");
          expect(event.data).toBe(JSON.stringify("test"));
          expect(event.origin).toBe("http://test");
          expect(event.lastEventId).toBe("1");
          done();
        } catch (err) {
          done.fail(err);
        }
      });

      ESHook.simulate(hookedEs, "test", { lastEventId: "1", data: "test", origin: "http://test" });
    });

    it("adds a property `simulated` to `true` to event object", (done) => {
      clientEs.onmessage = (event: ExtendedMessageEvent) => {
        try {
          expect(event.simulated).toBe(true);
          done();
        } catch (err) {
          done.fail(err);
        }
      };

      ESHook.simulate(hookedEs, "message");
    });

    it("serializes event data to JSON", (done) => {
      clientEs.onmessage = (event) => {
        try {
          expect(event.data).toBe(JSON.stringify(["array"]));
          done();
        } catch (err) {
          done.fail(err);
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
