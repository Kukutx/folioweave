/**
 * Owns the page's object URLs: everything created here is revoked when it is
 * dropped, when the page starts over and when it unmounts.
 */
export class ObjectUrls {
  private readonly live = new Set<string>();

  create(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    this.live.add(url);
    return url;
  }

  revoke(url: string | null | undefined) {
    if (!url || !this.live.delete(url)) return;
    URL.revokeObjectURL(url);
  }

  revokeAll() {
    for (const url of this.live) URL.revokeObjectURL(url);
    this.live.clear();
  }
}
