import sse from "./sse-client";
import utils from "./utils";

import ESHook, { ExtendedMessageEvent, HookedEventSource, HookEventFunctionAsync, HookEventFunctionSync } from "../src/index";

/* -------------------------------------------------------------------------- */
/*                           Library Core - Testing                           */
/* -------------------------------------------------------------------------- */

/**
 * This suite tests all core library components such as initialization, enabling,
 * disabling functions which are essentials to the rest of functionalities.
 *
 * ⚠️ If any of these components don't work, "Event Stream Spoofing" tests won't pass.
 */

describe("[LIBRARY CORE]", () => {
  it("should define library class on import", () => {
    expect(ESHook).toBeDefined();
  });

  describe("# `ESHook.enable` method ->", () => {
    it("swaps native `EventSource` constructor", () => {
      expect(EventSource.name).toBe("EventSource");
      ESHook.enable();
      expect(EventSource.name).toBe("HookedEventSource");
    });
  });

  describe("# `ESHook.disable` method ->", () => {
    it("swaps back native `EventSource` constructor", () => {
      ESHook.enable();
      ESHook.disable();
      expect(EventSource.name).toBe("EventSource");
    });
  });

  describe("# `ESHook.resetHooks` method ->", () => {
    it("set hooks function to `null`", () => {
      ESHook.urlHook = () => "";
      ESHook.createHook = () => {};
      ESHook.eventHook = () => {};

      ESHook.resetHooks();

      expect(ESHook.urlHook).toBeNull();
      expect(ESHook.createHook).toBeNull();
      expect(ESHook.eventHook).toBeNull();
    });
  });

  describe("# `ESHook.enabled` property ->", () => {
    it("returns `false` if `EventSource` constructor is the native one", () => {
      // Test by calling disable function.
      ESHook.disable();
      const genuine = EventSource;
      expect(ESHook.enabled).toBe(false);

      // Test without calling disable function.
      EventSource = genuine;
      expect(ESHook.enabled).toBe(false);
    });

    it("returns `true` if `EventSource` constructor is the spoofed one", () => {
      // Test by calling enable function.
      ESHook.enable();
      const fake = EventSource;
      expect(ESHook.enabled).toBe(true);

      // Test without calling enable function.
      EventSource = fake;
      expect(ESHook.enabled).toBe(true);
    });
  });
});

/* -------------------------------------------------------------------------- */
/*                       Event Stream Spoofing - Testing                      */
/* -------------------------------------------------------------------------- */

/**
 * This suite tests event stream spoofing which include: hooks, event simulation.
 *
 * ⚠️ These tests depend on "Library Core" components so these latter must work.
 */

describe("[ES SPOOFING]", () => {
  /** Client connection used for testing purposes. */
  let clientEs: EventSource;

  /* ---------------------------- Setup & Teardown ---------------------------- */

  beforeEach(async () => {
    ESHook.enable();
    clientEs = await sse.open();
  });

  afterEach(async () => {
    ESHook.resetHooks();
    sse.close();
  });

  /* ----------------------- EventSource Implementations ---------------------- */

  // ⚠️ These tests must pass since all next tests use these methods.

  describe("# `EventSource.addEventListener` spoofed method ->", () => {
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

  describe("# `EventSource.removeEventListener` spoofed method ->", () => {
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

  /* -------------------------------- URL Hook -------------------------------- */

  describe("# URL Hook ->", () => {
    let testEs: EventSource | null;

    it("`ESHook.urlHook` property", () => {
      const func = () => "";

      expect(ESHook.urlHook).toBeNull();

      ESHook.urlHook = func;
      expect(ESHook.urlHook).toBe(func);

      ESHook.urlHook = null;
      expect(ESHook.urlHook).toBeNull();
    });

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

  describe("# Create Hook ->", () => {
    it("`ESHook.createHook` property", () => {
      const func = () => {};

      expect(ESHook.createHook).toBeNull();

      ESHook.createHook = func;
      expect(ESHook.createHook).toBe(func);

      ESHook.createHook = null;
      expect(ESHook.createHook).toBeNull();
    });

    it("intercepts any opened connection", async () => {
      let testEs: EventSource;
      let hookedEs: HookedEventSource;

      const [toBeIntercepted, callMe] = utils.promisifyCallback((es: HookedEventSource) => (hookedEs = es));

      ESHook.createHook = callMe;
      testEs = new EventSource("/es");

      await toBeIntercepted;
      expect(testEs).toEqual(hookedEs!);

      testEs.close();
    });
  });

  /* ------------------------------- Event Hook ------------------------------- */

  describe("# Event Hook ->", () => {
    it("`ESHook.eventHook` property", () => {
      const func = () => {};

      expect(ESHook.eventHook).toBeNull();

      ESHook.eventHook = func;
      expect(ESHook.eventHook).toBe(func);

      ESHook.eventHook = null;
      expect(ESHook.eventHook).toBeNull();
    });

    it("`ESHook.isEventHookAsync` property", () => {
      const funcSync: HookEventFunctionSync = ({}, {}, {}) => null;
      const funcAsync: HookEventFunctionAsync = ({}, {}, {}, result) => {};

      ESHook.eventHook = null;
      expect(ESHook.isEventHookAsync).toBe(false);

      ESHook.eventHook = funcSync;
      expect(ESHook.isEventHookAsync).toBe(false);

      ESHook.eventHook = funcAsync;
      expect(ESHook.isEventHookAsync).toBe(true);
    });

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
          expect(clientEs).toBe(eventSource);
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

  /* ----------------------------- Simulate Event ----------------------------- */

  describe("# `ESHook.simulate` method ->", () => {
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

      ESHook.simulate(clientEs, "message");
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

      ESHook.simulate(clientEs, "test", { lastEventId: "1", data: "test", origin: "http://test" });
    });

    it("sets right properties to the event object", (done) => {
      clientEs.onmessage = (event: ExtendedMessageEvent) => {
        try {
          expect(event.simulated).toBe(true);
          expect(event.isTrusted).toBe(true);
          done();
        } catch (err) {
          done.fail(err);
        }
      };

      ESHook.simulate(clientEs, "message");
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

      ESHook.simulate(clientEs, "message", { data: ["array"] });
    });
  });
});
