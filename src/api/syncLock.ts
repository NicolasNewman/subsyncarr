class SyncLock {
  private locked = false;
  private lockTime: number | null = null;
  private readonly lockTimeout = 30 * 60 * 1000; // 30 minutes timeout

  tryLock(): boolean {
    if (this.locked && this.lockTime && Date.now() - this.lockTime > this.lockTimeout) {
      console.warn('Sync lock expired, releasing...');
      this.unlock();
    }

    if (this.locked) {
      return false;
    }

    this.locked = true;
    this.lockTime = Date.now();
    return true;
  }

  unlock(): void {
    this.locked = false;
    this.lockTime = null;
  }

  isLocked(): boolean {
    return this.locked;
  }

  getLockDuration(): number | null {
    return this.lockTime ? Date.now() - this.lockTime : null;
  }
}

export default SyncLock;
