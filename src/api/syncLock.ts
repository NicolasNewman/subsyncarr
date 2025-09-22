class SyncLock {
  private locked = false;

  tryLock(): boolean {
    if (this.locked) {
      return false;
    }

    this.locked = true;
    return true;
  }

  unlock(): void {
    this.locked = false;
  }

  isLocked(): boolean {
    return this.locked;
  }
}

export default SyncLock;
