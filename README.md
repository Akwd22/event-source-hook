# event-source-hook

Easily intercept and modify WebSocket requests and message events.

## Todos

- [x] Test cases.
- [x] Check if it works in browser environment (non-Node).
- [x] Add `addEventListener`, `removeEventListener`, ..., in `EventSourceHook` library object.
- [x] Also spoof native `EventSource`'s `onmessage`.
- [x] Memory leak? since `EventSource`'s is not spoofed`removeEventListener`.
- [x] Check disable function if hook is still active.
- [x] Async hook function.
- [x] Keep track of all opened connections.
