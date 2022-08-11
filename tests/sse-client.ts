/**
 * Workaround: patches this function to correct the wrong implementation
 * of the `event-source` (https://github.com/EventSource/eventsource) imported library.
 */
EventSource.prototype.dispatchEvent = function dispatchEvent(event) {
  if (!event.type) {
    throw new Error("UNSPECIFIED_EVENT_TYPE_ERR");
  }

  // Invoke event handlers synchronously.
  // @ts-ignore
  this.emit(event.type, event);

  // Return `false` if event was default prevented.
  return !(event.cancelable && event.defaultPrevented);
};

/** Client connection to the event stream. */
let stream: EventSource | null;

/**
 * Connect to an event stream.
 * @param url Server URL that serves the event stream.
 * @returns A promise that resolves to a `EventSource` instance.
 */
export function startClient(url: string): Promise<EventSource> {
  return new Promise((resolve, reject) => {
    stream = new EventSource(url);
    stream.onopen = () => resolve(stream!);
    stream.onerror = (err) => reject(err);
  });
}

/**
 * Close the connection to the event stream.
 */
export function stopClient() {
  stream?.close();
}

export default {
  startClient,
  stopClient,
};
