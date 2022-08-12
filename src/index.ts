import { ExtendedMessageEvent, MutableMessageEvent, HookedEventSource, EventSourceHook } from "./interfaces";

const GenuineEventSource = EventSource;

/**
 * Create a mutable message event from an immutable message event with the same property values.
 * @param messageEvent Immutable native `MessageEvent`.
 */
function ToMutableMessageEvent(messageEvent: ExtendedMessageEvent): MutableMessageEvent {
  const self: MutableMessageEvent = Object.create(Object.getPrototypeOf(messageEvent));

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
  // @ts-ignore
  self.ports = messageEvent.ports || new Array(0);
  self.returnValue = messageEvent.returnValue || true;
  self.simulated = messageEvent.simulated || false;
  self.source = messageEvent.source || null;
  self.srcElement = messageEvent.srcElement || null;
  self.target = messageEvent.target || null;
  self.timeStamp = messageEvent.timeStamp || performance.now();
  self.type = messageEvent.type || "message";

  return self;
}

/**
 * Create a modified `EventSource` object for hook. Swapped with the native `EventSource`.
 * @constructor
 */
function HookedEventSource(url: string | URL, eventSourceInitDict?: EventSourceInit): HookedEventSource {
  const eventSource = new GenuineEventSource(url, eventSourceInitDict) as HookedEventSource;

  /* --------------------------- removeEventListener -------------------------- */

  eventSource.mapListenerProxy = new WeakMap();
  eventSource.genuineRemoveEventListener = eventSource.removeEventListener;

  // @ts-ignore
  eventSource.removeEventListener = function (type, listener, options) {
    const proxies = this.mapListenerProxy.get(listener);
    const proxy = proxies?.[type];

    if (proxy) {
      this.genuineRemoveEventListener(type, proxy, options);
      delete proxies[type];
    }
  };

  /* ---------------------------- addEventListener ---------------------------- */

  eventSource.genuineAddEventListener = eventSource.addEventListener;

  // @ts-ignore
  eventSource.addEventListener = (type, listener, options) => {
    if (!["function", "object"].includes(typeof listener)) {
      throw new TypeError("Failed to execute 'addEventListener' on 'EventTarget': parameter 2 is not of type 'Object'.");
    }

    if (typeof listener === "object") {
      listener = listener.handleEvent;
      if (typeof listener !== "function") return;
    }

    const proxy = (event: Event) => {
      if (!EventSourceHook.eventListener) {
        listener(event);
        return;
      }

      // If a hook is active, get returned event from the hook user function.
      let mutableEvent: MutableMessageEvent | null;
      mutableEvent = ToMutableMessageEvent(event as ExtendedMessageEvent);
      mutableEvent = EventSourceHook.eventListener(mutableEvent.type, mutableEvent, eventSource);

      // If the event is null, then we block the message.
      if (mutableEvent !== null) listener(mutableEvent);
    };

    eventSource.genuineAddEventListener(type, proxy, options);

    // Store (listener -> proxy) to map.
    const proxies = eventSource.mapListenerProxy.get(listener) ?? {};
    proxies[type] = proxy;
    eventSource.mapListenerProxy.set(listener, proxies);
  };

  /* -------------------------------- onmessage ------------------------------- */

  Object.defineProperty(eventSource, "onmessage", {
    get: function () {
      return this._onmessage;
    },
    set: function (listener) {
      if (typeof listener === "function") {
        eventSource.addEventListener("message", listener);
      } else {
        listener = null;
      }

      eventSource.removeEventListener("message", eventSource.onmessage!);

      this._onmessage = listener;
    },
  });

  eventSource.onmessage = null;

  /* ------------------------------- connection ------------------------------- */

  // Call the listener after a connection is open.
  if (EventSourceHook.onconnect) EventSourceHook.onconnect(eventSource);

  return eventSource;
}

const EventSourceHook: EventSourceHook = {
  onconnect: null,
  eventListener: null,

  hookEvent(listener) {
    this.eventListener = typeof listener === "function" ? listener : null;
  },

  enable() {
    // @ts-ignore
    EventSource = HookedEventSource;
  },

  disable() {
    // @ts-ignore
    EventSource = GenuineEventSource;
  },

  simulate(eventSource, type, options = {}) {
    options.origin = options.origin ?? new URL(eventSource.url).origin;
    options.data = JSON.stringify(options.data);

    const event = new MessageEvent(type, options) as ExtendedMessageEvent;
    event.simulated = true;

    eventSource.dispatchEvent(event);
  },
};

export default EventSourceHook;
