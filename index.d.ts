declare const EventSourceHook: {
  /**
   * Fires when a connection is opened.
   * @param eventSource `EventSource` object bound to the connection.
   */
  onconnect: ((eventSource: EventSource) => void) | null;
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
  onmessage: ((event: IMutableMessageEvent, url: string, eventSource: EventSource) => IMutableMessageEvent | null) | null;

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
   * @note The `simulated` property is set to `true` on the `MessageEvent` object.
   * @param eventSource `EventSource` connection where the message event should be simulated.
   * @param data Any serializable JSON data.
   */
  simulate(eventSource: EventSource, data: any): void;
};

export interface IMutableMessageEvent extends MessageEvent {
  bubbles: boolean;
  cancelBubble: boolean;
  cancelable: boolean;
  currentTarget: EventTarget | null;
  data: any;
  defaultPrevented: boolean;
  eventPhase: number;
  lastEventId: string;
  origin: string;
  path: any;
  ports: MessagePort[];
  returnValue: boolean;
  source: MessageEventSource | null;
  srcElement: EventTarget | null;
  target: EventTarget | null;
  timeStamp: number;
  type: string;

  /**
   * Tell that this event is simulated.
   */
  simulated: boolean;
}

export default EventSourceHook;
