// Shim: pino/browser.js is CJS (module.exports = pino) but @aztec/bb.js
// does `import { pino } from 'pino'` expecting a named export.
// This shim bridges the gap.
const noop = () => {};
const logger = {
  info: noop,
  debug: noop,
  warn: noop,
  error: noop,
  fatal: noop,
  trace: noop,
  silent: noop,
  child: () => logger,
  level: 'silent',
};
export function pino() {
  return logger;
}
export default pino;
