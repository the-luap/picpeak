/** A run owns its waits; cancelling wakes every waiter and clears its timer. */
function createInterruptibleSleep() {
  let cancelled = false;
  const waiters = new Set();
  return {
    sleep(ms) {
      if (cancelled) return Promise.resolve();
      return new Promise(resolve => {
        const finish = () => {
          clearTimeout(timer);
          waiters.delete(finish);
          resolve();
        };
        const timer = setTimeout(finish, ms);
        waiters.add(finish);
      });
    },
    cancel() {
      cancelled = true;
      for (const finish of waiters) finish();
    },
  };
}

module.exports = { createInterruptibleSleep };
