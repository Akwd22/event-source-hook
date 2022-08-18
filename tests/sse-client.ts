/** Client connection to the event stream. */
let stream: EventSource | null;
/** Client ID. */
let clientId: number;

/**
 * Connect to the event stream.
 * @returns A promise that resolves to a `EventSource` instance once connected.
 */
export function open(): Promise<EventSource> {
  stream = new EventSource("/es");

  return new Promise((resolve, reject) => {
    if (!stream) {
      reject("Event stream not created.");
      return;
    }

    stream.addEventListener("client-id", (event) => {
      clientId = event.data;
      resolve(stream!);
    });

    stream.addEventListener("error", (error) => {
      reject(error);
    });
  });
}

/**
 * Close the connection to the event stream.
 */
export function close(): void {
  stream?.close();
  stream = null;
}

/**
 * Ask the server to send an event through the event stream.
 * @param type - Event type.
 * @param data - Data to send (automatically serialized to JSON).
 * @param id - Event identifier.
 * @throws {Error} If the event stream is not opened.
 */
export async function sendEvent(type: string, data?: any, id?: string): Promise<void> {
  if (stream?.readyState === stream?.CLOSED) {
    throw new Error("Event stream is not opened");
  }

  await fetch("/event", {
    method: "POST",
    headers: new Headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      clientId: clientId,
      event: {
        type: type || "message",
        data: data || "{}",
        id: id,
      },
    }),
  });
}

export default {
  open,
  close,
  sendEvent,
};
