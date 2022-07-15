const GenuineEventSource = EventSource;

/**
 * Create a mutable message event from an immutable message event with the same property values.
 * @param {MessageEvent} messageEvent Immutable native `MessageEvent`.
 * @constructor
 */
function MutableMessageEvent(messageEvent) {
  this.bubbles = messageEvent.bubbles || false;
  this.cancelBubble = messageEvent.cancelBubble || false;
  this.cancelable = messageEvent.cancelable || false;
  this.currentTarget = messageEvent.currentTarget || null;
  this.data = messageEvent.data || null;
  this.defaultPrevented = messageEvent.defaultPrevented || false;
  this.eventPhase = messageEvent.eventPhase || 0;
  this.lastEventId = messageEvent.lastEventId || "";
  this.origin = messageEvent.origin || "";
  this.path = messageEvent.path || new Array(0);
  this.ports = messageEvent.parts || new Array(0);
  this.returnValue = messageEvent.returnValue || true;
  this.source = messageEvent.source || null;
  this.srcElement = messageEvent.srcElement || null;
  this.target = messageEvent.target || null;
  this.timeStamp = messageEvent.timeStamp || null;
  this.type = messageEvent.type || "message";
  this.simulated = messageEvent.simulated || false;
  this.__proto__ = messageEvent.__proto__ || MessageEvent.__proto__;
}

/**
 * Create a modified `EventSource` object for hook. Swapped with the native `EventSource`.
 * @param {string | URL} url
 * @param {EventSourceInit | undefined} eventSourceInitDict
 * @constructor
 */
function FakeEventSource(url, eventSourceInitDict) {
  const eventSource = new GenuineEventSource(url, eventSourceInitDict);

  eventSource.genuineAddEventListener = eventSource.addEventListener;
  eventSource.addEventListener = (type, listener, optionsOrUseCapture) => {
    // Only spoof message type event.
    if (type === "message") {
      eventSource.genuineAddEventListener("message", (event) => {

          // If a hook is active, get returned event from the hook user function.
          if (EventSourceHook.onmessage) {
            event = new MutableMessageEvent(event);
            event = EventSourceHook.onmessage(event, eventSource.url, eventSource);
          }

          // If event is null, then we block the message.
          if (event !== null) listener(event); // TODO : can be an object with handleEvent method.

        },
        optionsOrUseCapture
      );

      return;
    }

    eventSource.genuineAddEventListener(type, listener, optionsOrUseCapture);
  };

  // Call the listener after a connection is open.
  if (EventSourceHook.onconnect) EventSourceHook.onconnect(eventSource);

  return eventSource;
}

const EventSourceHook = {
  onconnect: null,
  onmessage: null,

  enable() {
    EventSource = FakeEventSource;
  },
  disable() {
    EventSource = GenuineEventSource;
  },
  simulate(eventSource, data) {
    const e = new MessageEvent("message", { data: JSON.stringify(data) });

    e.bubbles = false;
    e.cancelBubble = false;
    e.cancelable = false;
    e.currentTarget = eventSource;
    e.defaultPrevented = false;
    e.eventPhase = 2;
    e.path = [];
    e.returnValue = true;
    e.srcElement = eventSource;
    e.target = eventSource;
    e.simulated = true; // Tell that this event is simulated.

    eventSource.dispatchEvent(e);
  },
};

module.exports = EventSourceHook;
