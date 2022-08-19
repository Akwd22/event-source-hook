import { glob } from "glob";
import * as karma from "karma";
import { EventStreamMiddleware, JsonParserMiddleware } from "./tests/sse-server";

function setupBrowsers() {
  // Try to locate browser binaries.
  process.env.CHROMIUM_BIN = glob.sync("node_modules/puppeteer/.chromium_bin/**/+(chrome.exe|chrome|chromium)", { nodir: true, nocase: true })[0];
  process.env.FIREFOX_BIN = glob.sync("node_modules/puppeteer/.firefox_bin/**/+(firefox.exe|firefox)", { nodir: true, nocase: true })[0];

  // Error if binaries not found.
  if (!process.env.CHROMIUM_BIN) throw new Error("Chromium not found. Please type `npm run test:get-chrome` to install it.");
  if (!process.env.FIREFOX_BIN) throw new Error("Firefox not found. Please type `npm run test:get-firefox` to install it.");

  const browsers = ["ChromiumHeadless", "FirefoxHeadless"];
  if (process.platform === "darwin") browsers.push("SafariNative"); // Add Safari on macOS.

  return browsers;
}

export default (config: karma.Config) => {
  config.set({
    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: "",

    // frameworks to use
    // available frameworks: https://www.npmjs.com/search?q=keywords:karma-adapter
    frameworks: ["jasmine", "karma-typescript"],

    // list of names of additional middleware you want the karma server to use
    // middleware will be used in the order listed
    middleware: ["json-parser", "event-stream"],

    // list of plugins to load
    plugins: ["karma-*", { "middleware:json-parser": ["factory", JsonParserMiddleware] }, { "middleware:event-stream": ["factory", EventStreamMiddleware] }],

    // list of files / patterns to load in the browser
    files: ["src/**/*.ts", "tests/**/*.ts"],

    // list of files / patterns to exclude
    exclude: ["src/browser.ts"],

    // preprocess matching files before serving them to the browser
    // available preprocessors: https://www.npmjs.com/search?q=keywords:karma-preprocessor
    preprocessors: {
      "**/*.ts": "karma-typescript",
    },

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://www.npmjs.com/search?q=keywords:karma-reporter
    reporters: ["progress"],

    // web server port
    port: 9876,

    // enable / disable colors in the output (reporters and logs)
    colors: true,

    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_INFO,

    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: false,

    // start these browsers
    // available browser launchers: https://www.npmjs.com/search?q=keywords:karma-launcher
    browsers: setupBrowsers(),
    // browsers: ["ChromeHeadless"],

    // continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: true,

    // concurrency level
    // how many browser instances should be started simultaneously
    concurrency: Infinity,

    // jasmine config
    client: {
      jasmine: {
        random: false,
      },
    },
  });
};
