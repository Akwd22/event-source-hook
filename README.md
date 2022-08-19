<div id="top"></div>

<!-- PROJECT TITLE -->
<br />
<div align="center">
  <h3 align="center">Event Source Hook</h3>
  
A library to easily intercept, modify, and simulate [EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) server-sent events.

![build pass](https://img.shields.io/github/workflow/status/Akwd22/event-source-hook/Node.js%20CI)
![latest release](https://img.shields.io/npm/v/event-source-hook?label=release)
![types included](https://img.shields.io/npm/types/event-source-hook)
![total downloads](https://img.shields.io/npm/dt/event-source-hook)

</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#features">Features</a></li>
    <li><a href="#installation">Installation</a></li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#documentation">Documentation</a></li>
  </ol>
</details>

<!-- FEATURES -->

## Features

- [x] Intercept new connections
  - [x] Change connection URL
- [x] Intercept incoming events
  - [x] Modify events (data, origin, id, etc.)
  - [x] Block events
- [x] Simulate incoming events

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- INSTALLATION -->

## Installation

**Install with npm**:

```sh
npm install --save event-source-hook
```

**Install in a browser**:

- download file `browser/eshook.js` or `browser/eshook.min.js`
- import it on your web page

_Note: these scripts are polyfilled, so it should run on every browser supporting `EventSource` API._

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- USAGE -->

## Usage

⚠️ You must **load** and **enable** the library **first**, to be able to spoof native `EventSource` before other libraries or code instantiate it.

### 1. Enable the library after importing it

This applies the patch to the native `EventSource` constructor.

<details>
  <summary>View code</summary>
  <p>

**In Node**:

```js
import ESHook from "event-source-hook";
ESHook.enable();
```

**In a browser**:

```js
// In a browser, the library object is exposed globally.
ESHook.enable();
```

  </p>
</details>

### 2. Intercept new connections

Attach a hook function to listen each new opening connection. You can save `EventSource` instances for later use if you wish.

<details>
  <summary>View code</summary>
  <p>

```js
const connections = [];

ESHook.createHook = (eventSource) => {
  console.log("New connection:", eventSource);
  connections.push(eventSource);
};
```

  </p>
</details>

### 3. Change a connection URL

Attach a hook function to change a connection URL just before a new connection is established.

<details>
  <summary>View code</summary>
  <p>

```js
ESHook.urlHook = (url) => {
  if (url === "http://a-url") {
    url = "http://new-url";
  }

  return url;
};
```

  </p>
</details>

### 4. Simulate an event

You can simulate an incoming `MessageEvent`. It will be handled as if it were an genuine event received from the server.  
It is required to specify on which connection you want to simulate the event.

<details>
  <summary>View code</summary>
  <p>

```js
// Connection where the event should be received.
const eventSource = connections[0];
// Event type: can be anything.
const type = "message";
// Event options.
// See: https://developer.mozilla.org/en-US/docs/Web/API/MessageEvent/MessageEvent#options
const options = {
  data: { foo: "bar" },
  lastEventId: "id",
};

ESHook.simulate(eventSource, type, options);
```

_Note: the `simulated` property is set to `true` on the `MessageEvent` object. Thus, it is possible to detect the simulated event like in section 4 just below._

  </p>
</details>

### 5. Intercept, then modify or block an event

Attach a hook function to listen for incoming `MessageEvent` just before the native `EventSource` receives them.  
_Note: the hook function can be synchronous or asynchronous (see, below examples)._

You can modify all event object's properties (such as `data`, `lastEventId`) as it is mutable.

<details>
  <summary>View code (synchronous)</summary>
  <p>

Return the (modified) event or `null` to block the event.

```js
EventSourceHook.eventHook = (type, event, eventSource) => {
  // Block incoming events with type `message`.
  if (type === "message") {
    return null;
  }

  // Modify incoming events data from URL `https://test`.
  if (eventSource.url === "https://test") {
    const data = JSON.parse(event.data);
    data.foo = "new value";
    event.data = JSON.stringify(data);

    return event;
  }

  // Detect simulated events.
  if (event.simulated) {
    console.log("This event was simulated by the library.");
  }

  // Leave the other events as they are.
  return event;
};
```

  </p>
</details>

<details>
  <summary>View code (asynchronous)</summary>
  <p>

To make the hook function asynchronous, include the optional `result` callback parameter, and call it to return the (modified) event or `null` to block the event.

**Example with a promise**:

```js
EventSourceHook.eventHook = (type, event, eventSource, result) => {
  // Block incoming events with type `message`.
  if (type === "message") {
    result(null);
    return;
  }

  // Modify incoming events data from URL `http://test`.
  if (eventSource.url === "https://test") {
    fetchData().then((data) => {
      event.data = JSON.stringify(data);
      result(event);
    });

    return;
  }

  // Leave the other events as they are.
  result(event);
};
```

**Example with async/await**:

```js
EventSourceHook.eventHook = async (type, event, eventSource, result) => {
  const thing = await something();

  if (thing) {
    event.data = thing;
    result(event);
  } else {
    result(null);
  }
};
```

  </p>
</details>

### Reset hooks

You can disable hooks by setting `null`.

<details>
  <summary>View code</summary>
  <p>

```js
ESHook.urlHook = null;
ESHook.createHook = null;
ESHook.eventHook = null;
...
```

  </p>
</details>

<p align="right">(<a href="#top">back to top</a>)</p>

<!-- DOCUMENTATION -->

## Documentation

View [API docs](<https://github.com/Akwd22/event-source-hook/wiki/API-Documentation-(v2.1.0)>).

<p align="right">(<a href="#top">back to top</a>)</p>
