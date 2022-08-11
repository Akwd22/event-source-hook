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

  eventSource.genuineAddEventListener = eventSource.addEventListener;

  // @ts-ignore
  eventSource.addEventListener = (type, listener, options) => {
    eventSource.genuineAddEventListener(
      type,
      (event) => {
        let mutableEvent: MutableMessageEvent | null = null;

        // If a hook is active, get returned event from the hook user function.
        if (EventSourceHook.onmessage) {
          mutableEvent = ToMutableMessageEvent(event as ExtendedMessageEvent);
          mutableEvent = EventSourceHook.onmessage(mutableEvent, eventSource.url, eventSource);
        }

        // If event is null, then we block the message.
        if (mutableEvent !== null) listener(mutableEvent); // TODO : can be an object with handleEvent method.
      },
      options
    );

    eventSource.genuineAddEventListener(type, listener, options);
  };

  // Call the listener after a connection is open.
  if (EventSourceHook.onconnect) EventSourceHook.onconnect(eventSource);

  return eventSource;
}

const EventSourceHook: EventSourceHook = {
  onconnect: null,
  onmessage: null,

  enable() {
    // @ts-ignore
    EventSource = HookedEventSource;
  },

  disable() {
    // @ts-ignore
    EventSource = GenuineEventSource;
  },

  simulate(eventSource, type, options = {}) {
    options.origin = options.origin || new URL(eventSource.url).origin;
    options.data = JSON.stringify(options.data);

    const event = new MessageEvent(type, options) as ExtendedMessageEvent;
    event.simulated = true;

    eventSource.dispatchEvent(event);
  },
};

export default EventSourceHook;
