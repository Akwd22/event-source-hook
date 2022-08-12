import http from "http";

/** Server instance. */
let server: http.Server | null;
/** Event stream response object. */
let esResponse: http.ServerResponse | null;

/**
 * Start the server that serves the event stream.
 * @param port Server port.
 * @param endpoint URL endpoint of the event stream.
 * @returns A promise that resolves to a `http.Server` once running.
 */
export function startServer(port: number, endpoint: string): Promise<http.Server> {
  server = http.createServer((req, res) => {
    if (req.url === endpoint) {
      esResponse = res;

      res.writeHead(200, {
        Connection: "keep-alive",
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      });

      res.flushHeaders();
    }
  });

  return new Promise((resolve, reject) => {
    server = server!;
    server.once("listening", () => resolve(server!));
    server.once("error", (err) => reject(err));
    server.listen(port);
  });
}

/**
 * Close the server.
 * @returns A promise that resolves when the server is closed.
 */
export function stopServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server ? server.close(() => resolve()) : resolve();
  });
}

/**
 * Send an event through the event stream.
 * @param type Event type.
 * @param data Data to send (automatically serialized to JSON).
 * @param id Event identifier.
 * @throws {Error} If the event stream is not opened.
 */
export function sendEvent(type?: string, data: any = {}, id?: string): void {
  if (!esResponse) {
    throw new Error("Event stream is not opened");
  }

  if (type) esResponse.write(`event: ${type}\n`);
  if (data) esResponse.write(`data: ${JSON.stringify(data)}\n`);
  if (id) esResponse.write(`id: ${id}\n`);
  esResponse.write("\n");
}

export default {
  startServer,
  stopServer,
  sendEvent,
};
