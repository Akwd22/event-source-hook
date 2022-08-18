import { ExtendedMessageEvent, HookedEventSource, HookEventFunction, HookEventFunctionAsync, HookEventFunctionSync, HookCreateFunction, MutableMessageEvent } from "./interfaces";

const NativeEventSource = EventSource;

/**
 * Create a mutable message event from an immutable message event with the same property values.
 * @param messageEvent - Immutable native `MessageEvent`.
 * @returns `messageEvent` but mutable.
 */
function ToMutableMessageEvent(messageEvent: ExtendedMessageEvent): MutableMessageEvent {
  const self = {} as MutableMessageEvent;

  self.bubbles = messageEvent.bubbles || false;
  self.cancelable = messageEvent.cancelable || false;
  self.cancelBubble = messageEvent.cancelBubble || false;
  self.composed = messageEvent.composed || false;
  self.currentTarget = messageEvent.currentTarget || null;
  self.data = messageEvent.data || null;
  self.defaultPrevented = messageEvent.defaultPrevented || false;
  self.eventPhase = messageEvent.eventPhase || 0;
  self.isTrusted = messageEvent.isTrusted || false;
  self.lastEventId = messageEvent.lastEventId || "";
  self.origin = messageEvent.origin || "";
  self.ports = (messageEvent.ports as MessagePort[]) || [];
  self.returnValue = messageEvent.returnValue || true;
  self.simulated = messageEvent.simulated || false;
  self.source = messageEvent.source || null;
  self.srcElement = messageEvent.srcElement || null;
  self.target = messageEvent.target || null;
  self.timeStamp = messageEvent.timeStamp || performance.now();
  self.type = messageEvent.type || "message";
  Object.setPrototypeOf(self, Object.getPrototypeOf(messageEvent));

  return self;
}

/**
 * Create a spoofed `EventSource` object for hook. Swapped with the native `EventSource`.
 * @constructor
 */
function HookedEventSource(url: string | URL, eventSourceInitDict?: EventSourceInit): HookedEventSource {
  const es = new NativeEventSource(url, eventSourceInitDict) as HookedEventSource;

  es._mapListenerProxy = new WeakMap();
  es._nativeAddEventListener = es.addEventListener;
  es._nativeRemoveEventListener = es.removeEventListener;

  /* ----------------------- Spoof `addEventListener()` ----------------------- */

  es._createEventProxy = function (listener) {
    return function (event: Event) {
      // If no hook function, directly call listener.
      if (!ESHook.eventHook) {
        return listener(event);
      }

      const mutableEvent = ToMutableMessageEvent(event as ExtendedMessageEvent);

      const callback = (mutableEvent: MutableMessageEvent | null) => {
        if (mutableEvent === null) return; // If the event is null, then block the event.
        listener(mutableEvent);
      };

      if (ESHook.isEventHookAsync) {
        (ESHook.eventHook as HookEventFunctionAsync)(mutableEvent.type, mutableEvent, es, callback);
      } else {
        callback((ESHook.eventHook as HookEventFunctionSync)(mutableEvent.type, mutableEvent, es));
      }
    };
  };

  // @ts-ignore
  es.addEventListener = function (type, listener, options) {
    // Ignore these types that are not event message.
    if (type === "open" || type === "error") {
      return this._nativeAddEventListener(type, listener, options);
    }

    // Throw error if wrong listener type like official impl.
    if (!["function", "object"].includes(typeof listener)) {
      throw new TypeError("Failed to execute 'addEventListener' on 'EventTarget': parameter 2 is not of type 'Object'.");
    }

    // Get event handler function if listener is an object.
    if (typeof listener === "object") {
      listener = listener.handleEvent;
      if (typeof listener !== "function") return;
    }

    // Proxy function to be called instead of listener.
    const proxy = this._createEventProxy(listener);
    this._nativeAddEventListener(type, proxy, options);

    // Store (listener -> proxy) to be able to remove the listener later.
    const proxies = this._mapListenerProxy.get(listener) ?? {};
    proxies[type] = proxy;
    this._mapListenerProxy.set(listener, proxies);
  };

  /* ---------------------- Spoof `removeEventListener()` --------------------- */

  // @ts-ignore
  es.removeEventListener = function (type, listener, options) {
    // Ignore these types that are not event message.
    if (type === "open" || type === "error") {
      return this._nativeRemoveEventListener(type, listener, options);
    }

    const proxies = this._mapListenerProxy.get(listener);
    const proxy = proxies?.[type];

    if (proxy) {
      this._nativeRemoveEventListener(type, proxy, options);
      delete proxies[type];
    }
  };

  /* ---------------------------- Spoof `onmessage` --------------------------- */

  Object.defineProperty(es, "onmessage", {
    get: function () {
      return this._onmessage;
    },
    set: function (listener) {
      if (typeof listener === "function") {
        this.addEventListener("message", listener);
      } else {
        listener = null;
      }

      this.removeEventListener("message", this._onmessage);

      this._onmessage = listener;
    },
  });

  es.onmessage = null;

  /* -------------------------------------------------------------------------- */

  // Call the create hook function before returning the instance.
  ESHook.createHook?.(es);

  return es;
}

/** Library `event-source-hook` static class that provides `EventSource` hooking utilities. */
class ESHook {
  private static _createHook: HookCreateFunction | null = null;
  private static _eventHook: HookEventFunction | null = null;

  /* ------------------------------- Properties ------------------------------- */

  /** Hook function invoked when a new `EventSource` is instanced. */
  static get createHook() {
    return this._createHook;
  }

  /** Hook function invoked when a new `EventSource` is instanced. */
  static set createHook(func) {
    this._createHook = typeof func === "function" ? func : null;
  }

  /** Hook function invoked just before an event is received on any connection. */
  static get eventHook() {
    return this._eventHook;
  }

  /** Hook function invoked just before an event is received on any connection. */
  static set eventHook(func) {
    this._eventHook = typeof func === "function" ? func : null;
  }

  /** Is the provided event hook function async? */
  static get isEventHookAsync() {
    return typeof this._eventHook === "function" && this._eventHook.length >= 4;
  }

  /** Is the native `EventSource` spoofed by the library? */
  static get enabled() {
    return EventSource.name === "HookedEventSource";
  }

  /* --------------------------------- Methods -------------------------------- */

  /**
   * Swap the native `EventSource` constructor with a spoofed one.
   * Any opened connections will be spoofed by the library while enabled.
   */
  static enable() {
    // @ts-ignore
    EventSource = HookedEventSource;
  }

  /**
   * Swap the native `EventSource` constructor back in.
   * Any opened connections while disabled will not be spoofed by the library even after re-enabling.
   * @note Hook event function will still be called while disabled.
   */
  static disable() {
    // @ts-ignore
    EventSource = NativeEventSource;
  }

  /**
   * Simulate a received event. It will be handled as if it was an authentic event received from the server.
   * @note The `simulated` property is set to `true` on the `MessageEvent` object.
   * @param eventSource - Connection where the event should be received.
   * @param type - Event type. Use `message` if you want a non-typed event (default type).
   * @param options - Options to be passed to the event (such as data).
   */
  static simulate(eventSource: EventSource | HookedEventSource, type: string, options: MessageEventInit = {}): void {
    options.origin = options.origin ?? new URL(eventSource.url).origin;
    options.data = JSON.stringify(options.data);

    const event = new MessageEvent(type, options) as ExtendedMessageEvent;
    event.simulated = true;

    eventSource.dispatchEvent(event);
  }
}

export default ESHook;
