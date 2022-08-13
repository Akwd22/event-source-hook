<div id="top"></div>

<!-- PROJECT TITLE -->
<br />
<div align="center">
  <h3 align="center">Event Source Hook</h3>
  
  Easily intercept, modify, and simulate [EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) server-sent message events.
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#installation">Installation</a></li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#documentation">Documentation</a></li>
  </ol>
</details>

<!-- ROADMAP -->

## Roadmap

- [ ] Test cases
- [ ] Check if it works in browser environment (non-Node)
- [ ] Add `addEventListener`, `removeEventListener`, ..., in `EventSourceHook` library object
- [ ] Also spoof native `EventSource`'s `onmessage`
- [ ] Memory leak? since `EventSource`'s is not spoofed`removeEventListener`
- [ ] Check disable function if hook is still active
- [ ] Async hook function
- [ ] Keep track of all opened connections

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- Installation -->

## Installation

Install with npm:

```sh
npm install --save event-source-hook
```

In a browser: soon.

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- USAGE -->

## Usage

### 1. Enable the library after importing it

This applies the patch to the native `EventSource` object.

```js
import EventSourceHook from "event-source-hook"; // or, if in a browser, it will be automatically exposed globally.
EventSourceHook.enable();
```

### 2. Hook the connections

Attach a hook to listen each new connection with an `EventSource`. You can save the `EventSource` instances for later use if you wish.

```js
const connections = [];

EventSourceHook.onconnect = (eventSource) => {
  console.log("New connection:", eventSource);
  connections.push(eventSource);
};
```

### 3. Simulate a message

You can simulate a received message event. It will be handled as if it were an authentic message received from the server.  
It is required to specify on which connection we want to simulate the message.

```js
const data = {
  foo: "foo",
  bar: "bar",
};

EventSourceHook.simulate(connections[0], data);
```

The `simulated` property is set to `true` on the `MessageEvent` object. Thus, it is possible to detect the simulated message like in section 4 just below.

### 4. Intercept, then modify or block a message event

Attach a hook to listen for incoming message events just before the native `EventSource` receives them.

```js
EventSourceHook.onmessage = (event, url, eventSource) => {
  // Block a message from being received.
  if (url === "https://foo") {
    return null;
  }

  // Modify a message data before being received by listeners.
  if (url === "https://bar") {
    const obj = JSON.parse(event.data);
    obj.foo = "new value";

    event.data = JSON.stringify(obj.foo);
    return event;
  }

  // Detect simulated message events.
  if (event.simulated) {
    console.log("This event was simulated by the library.");
  }

  // Leave the other messages as they are.
  return event;
};
```

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- Documentation -->

## Documentation

Below, the TypeScript documentation:

```ts
interface EventSourceHook {
  /**
   * Fires when a connection is opened.
   * @param eventSource `EventSource` object bound to the connection.
   */
  onconnect: ((eventSource: EventSource) => void) | null;

  /**
   * Fires when a message event is received from the server.
   * Invoked before calling the native `EventSource`'s `onmessage` event handler.
   *
   * This method must return an event whose properties can be modified as well.
   * You might be interested in modifying, `event.data` or `event.origin` usually.
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
}

interface IMutableMessageEvent extends MessageEvent {
  /**
   * Tell that this event is simulated.
   */
  simulated: boolean;
}
```

<p align="right">(<a href="#top">back to top</a>)</p>
