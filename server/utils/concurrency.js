class Semaphore {
  constructor(maxConcurrent = 1) {
    this.max = Math.max(1, maxConcurrent);
    this.active = 0;
    this.queue = [];
  }

  acquire() {
    return new Promise((resolve) => {
      const tryAcquire = () => {
        if (this.active < this.max) {
          this.active += 1;
          resolve(() => this.release());
        } else {
          this.queue.push(tryAcquire);
        }
      };
      tryAcquire();
    });
  }

  release() {
    this.active -= 1;
    const next = this.queue.shift();
    if (next) next();
  }

  async run(task) {
    const release = await this.acquire();
    try {
      return await task();
    } finally {
      release();
    }
  }
}

class TimeoutError extends Error {
  constructor(message = 'Operation timed out.') {
    super(message);
    this.name = 'TimeoutError';
    this.code = 'PROCESSING_TIMEOUT';
  }
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

module.exports = { Semaphore, TimeoutError, withTimeout };
