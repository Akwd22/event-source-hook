export interface HookedEventSource extends EventSource {
  /** Map registered event listeners to their proxy. */
  _mapListenerProxy: WeakMap<EventListenerOrEventListenerObject, { [eventType: string]: EventListener }>;

  /**
   * Create a proxy function to be called instead of original event listener.
   * @param listener Listener to be proxied.
   */
  _createEventProxy: (listener: EventListener) => EventListener;

  _nativeAddEventListener: EventTarget["addEventListener"];
  _nativeRemoveEventListener: EventTarget["removeEventListener"];
}

/* ------------------------------ Message Event ----------------------------- */

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

/* --------------------------- Event Hook Function -------------------------- */

export interface HookEventFunctionSync {
  /**
   * Hook function used to modify or block the event just before being received.
   * @param type - Received event type.
   * @param event - Received event object (which is mutable). You might be interested to modify `event.data`.
   * @param eventSource - Connection that received the event.
   * @returns A `MessageEvent` object, or `null` to block.
   */
  (type: string, event: MutableMessageEvent, eventSource: HookedEventSource): MutableMessageEvent | null;
}
export interface HookEventFunctionAsync {
  /**
   * Async hook function used to modify or block the event just before being received.
   * @param type - Received event type.
   * @param event - Received event object (which is mutable). You might be interested to modify `event.data`.
   * @param eventSource - Connection that received the event.
   * @param result - Function to be called to return asynchronously a `MessageEvent` object, or `null` to block
   */
  (type: string, event: MutableMessageEvent, eventSource: HookedEventSource, result: (event: MutableMessageEvent | null) => void): void;
}
export interface HookEventFunction {
  /**
   * Hook function used to modify or block the event just before being received.
   *
   * To make the function asynchronous, include the optional `result` callback parameter,
   * and call it to return the event or `null` to block the event.
   *
   * @param type - Received event type.
   * @param event - Received event object (which is mutable). You might be interested to modify `event.data`.
   * @param eventSource - Connection that received the event.
   * @param result - Optional. Use it to return a result asynchronously.
   * @returns If `result` not included: a `MessageEvent` object, or `null` to block.
   */
  (type: string, event: MutableMessageEvent, eventSource: HookedEventSource, result: (event: MutableMessageEvent | null) => void): MutableMessageEvent | null | void;
}

/* -------------------------- Create Hook Function -------------------------- */

export interface HookCreateFunction {
  /**
   * Hook function used to intercept new instanced `EventSource`.
   * @param eventSource New connection.
   */
  (eventSource: HookedEventSource): void;
}
