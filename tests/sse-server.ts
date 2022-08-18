import { IncomingMessage, ServerResponse } from "http";

interface JsonIncomingMessage extends IncomingMessage {
  body?: any;
}

/** Clients connected to the event stream. */
let clients: { [clientId: string]: ServerResponse } = {};
/** Last generated client ID. */
let lastId = 0;

/** Karma middleware for parsing request body in JSON. */
export function JsonParserMiddleware() {
  return async (request: JsonIncomingMessage, response: ServerResponse, next: Function): Promise<void> => {
    const buffers: Uint8Array[] = [];

    for await (const chunk of request) {
      buffers.push(chunk);
    }

    const data = Buffer.concat(buffers).toString();
    if (data) request.body = JSON.parse(data);

    next();
  };
}

/** Karma middleware for setup a testing event stream server. */
export function EventStreamMiddleware() {
  return function (request: JsonIncomingMessage, response: ServerResponse): ServerResponse | void {
    /* ------------------------- Endpoint: event stream ------------------------- */

    if (request.url === "/es") {
      const client = response;
      const id = ++lastId;

      clients[id] = client;
      client.once("close", () => delete clients[id]);

      // Send headers.
      client.writeHead(200, {
        Connection: "keep-alive",
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      });

      // Send client ID.
      client.write(`event: client-id\n`);
      client.write(`data: ${id}\n`);
      client.write(`\n`);

      return;
    }

    /* ------------------- Endpoint: ask server to send event ------------------- */

    if (request.url === "/event") {
      const client = clients[request.body.clientId];

      if (client) {
        const { type, data, id } = request.body.event;

        if (type) client.write(`event: ${type}\n`);
        if (data) client.write(`data: ${JSON.stringify(data)}\n`);
        if (id) client.write(`id: ${id}\n`);
        client.write(`\n`);
      }

      response.writeHead(200);
      return response.end();
    }

    /* ---------------------------- Endpoint: unknown --------------------------- */

    response.writeHead(404);
    return response.end();
  };
}

export default {
  JsonParserMiddleware,
  EventStreamMiddleware,
};
