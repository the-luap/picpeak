jest.mock('../../src/utils/logger', () => ({ error: jest.fn() }));
const { scheduledTask } = require('../../src/services/scheduledTask');
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
it('starts once, skips overlap and drains the accepted run on stop', async () => {
  let finish;
  const work = jest.fn(() => new Promise(resolve => { finish = resolve; }));
  const task = scheduledTask(work, { interval: 100 });
  task.start(); task.start();
  expect(jest.getTimerCount()).toBe(1);
  await jest.advanceTimersByTimeAsync(300);
  expect(work).toHaveBeenCalledTimes(1);
  let stopped = false;
  const stop = task.stop().then(() => { stopped = true; });
  await Promise.resolve(); expect(stopped).toBe(false);
  finish(); await stop; expect(stopped).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
  await jest.advanceTimersByTimeAsync(1000); expect(work).toHaveBeenCalledTimes(1);
});
it('cancels a delayed first run and can restart cleanly', async () => {
  const work = jest.fn(); const task = scheduledTask(work, { interval: 100, initialDelay: 10 });
  task.start(); await task.stop(); await jest.advanceTimersByTimeAsync(200); expect(work).not.toHaveBeenCalled();
  task.start(); await jest.advanceTimersByTimeAsync(10); expect(work).toHaveBeenCalledTimes(1);
  await task.stop();
});
