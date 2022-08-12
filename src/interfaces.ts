export interface ExtendedMessageEvent extends MessageEvent {
  /** Tell that this event is simulated. */
  simulated?: boolean;
}

export interface MutableMessageEvent extends ExtendedMessageEvent {
  bubbles: MessageEvent["bubbles"];
  cancelable: MessageEvent["cancelable"];
  cancelBubble: MessageEvent["cancelBubble"];
  composed: MessageEvent["composed"];
  currentTarget: MessageEvent["currentTarget"];
  data: MessageEvent["data"];
  defaultPrevented: MessageEvent["defaultPrevented"];
  eventPhase: MessageEvent["eventPhase"];
  isTrusted: MessageEvent["isTrusted"];
  lastEventId: MessageEvent["lastEventId"];
  origin: MessageEvent["origin"];
  ports: MessagePort[];
  returnValue: MessageEvent["returnValue"];
  source: MessageEvent["source"];
  srcElement: MessageEvent["srcElement"];
  target: MessageEvent["target"];
  timeStamp: MessageEvent["timeStamp"];
  type: MessageEvent["type"];
}

export interface HookedEventSource extends EventSource {
  mapListenerProxy: WeakMap<EventListenerOrEventListenerObject, { [eventType: string]: EventListener }>;
  genuineAddEventListener: EventTarget["addEventListener"];
  genuineRemoveEventListener: EventTarget["removeEventListener"];
}

export type HookEventFunctionSync = (type: string, event: MutableMessageEvent, eventSource: HookedEventSource) => MutableMessageEvent | null;
export type HookEventFunctionAsync = (type: string, event: MutableMessageEvent, eventSource: HookedEventSource, result: (event: MutableMessageEvent | null) => void) => void;

export type HookEventFunction = (
  type: string,
  event: MutableMessageEvent,
  eventSource: HookedEventSource,
  result: (event: MutableMessageEvent | null) => void
) => MutableMessageEvent | null | void;

export interface EventSourceHook {
  /**
   * Fires when a connection is opened.
   * @param eventSource `EventSource` object bound to the connection.
   */
  onconnect: ((eventSource: HookedEventSource) => void) | null;

  /**
   * Fires when a message event is received from the server.
   * Invoked before calling the native `EventSource`'s `onmessage` event handler.
   *
   * This method must return an event whose properties can be modified as well. You might be interested in modifying, `event.data` or `event.origin` usually.
   *
   * If you want to block the message event from being received, then return `null`.
   *
   * @param event Received mutable message event.
   * @param url Source URL.
   * @param eventSource `EventSource` object bound to the connection.
   * @returns A mutable `MessageEvent` object, or `null` to block.
   */
  // onmessage: ((event: MutableMessageEvent, url: string, eventSource: HookedEventSource) => MutableMessageEvent | null) | null;

  eventListener: HookEventFunction | null;

  hookEvent(listener: HookEventFunction | false): void;

  /**
   * Enable server-sent events hook (by swapping the native `EventSource` constructor).
   * @note Not enabled by default.
   */
  enable(): void;

  /**
   * Disable server-sent events hook (by swapping the native `EventSource` constructor back in).
   */
  disable(): void;

  /**
   * Simulate a received message event. It will be handled as if it were an authentic message received from the server.
   * @note The `simulated` property is set to `true` on the `eventSource` object.
   * @param eventSource `EventSource` connection where the message event should be simulated.
   * @param type Event type. Use `message` if you want a non-typed event.
   * @param options Options to be passed to the event (such as data).
   */
  simulate(eventSource: EventSource | HookedEventSource, type: string, options?: MessageEventInit): void;
}
