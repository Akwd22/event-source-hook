import { randomUUID } from "crypto";
import jestConfig from "../jest.config";

/**
 * Promisify a callback so the promise resolves once the callback is called.
 * @param callback Function to promisify. Defaults to a no-op function.
 * @param timeout Milliseconds before timeout (reject the promise). Defaults to Jest config `testTimeout`.
 * @returns A promise and a resolver function that wraps the `callback`.
 */
function promisifyCallback(callback?: Function, timeout: number = jestConfig.testTimeout): [Promise<void>, (...args: any[]) => void] {
  let promiseResolve: (value: void) => void;
  let promiseReject: (reason?: any) => void;
  let timer: NodeJS.Timeout;

  const promise = new Promise<void>((resolve, reject) => {
    promiseResolve = resolve;
    promiseReject = reject;
  });

  timer = setTimeout(() => promiseReject("Promise timeout"), timeout);

  const resolver = (...args: any[]) => {
    clearTimeout(timer);
    callback?.(args);
    promiseResolve();
  };

  return [promise, resolver];
}

/**
 * Generate an unique string.
 * @returns An unique string.
 */
function uniqueString(): string {
  return randomUUID();
}

/**
 * Asynchronously wait for a period of time.
 * @param milliseconds - Milliseconds to wait.
 */
function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export default {
  promisifyCallback,
  uniqueString,
  wait,
};
