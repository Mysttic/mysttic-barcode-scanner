// Warstwa komunikacji WebSerial + NDJSON (Etap 7).
// Jedno polaczenie, ciagly odczyt, dopasowanie odpowiedzi po requestId,
// eventy (np. "scan") przez callback.

type Json = Record<string, unknown>;

export class DeviceLink {
  private port: SerialPort | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: Json) => void; timer: number }>();
  private buf = "";
  onEvent: (obj: Json) => void = () => {};
  onDisconnect: () => void = () => {};

  get connected(): boolean {
    return this.port !== null;
  }

  async connect(): Promise<void> {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    // CircuitPython wysyla dane po CDC tylko przy ustawionym DTR.
    try {
      await port.setSignals({ dataTerminalReady: true, requestToSend: true });
    } catch {
      /* niektore mostki nie wspieraja setSignals - sprobuj bez */
    }
    this.port = port;
    port.addEventListener("disconnect", () => void this.disconnect());
    this.writer = port.writable!.getWriter();
    this.reader = port.readable!.getReader();
    void this.readLoop();
  }

  async disconnect(): Promise<void> {
    const { reader, writer, port } = this;
    this.port = null;
    this.reader = null;
    this.writer = null;
    for (const [, p] of this.pending) clearTimeout(p.timer);
    this.pending.clear();
    try { await reader?.cancel(); } catch { /* juz zamkniety */ }
    try { reader?.releaseLock(); } catch { /* ok */ }
    try { writer?.releaseLock(); } catch { /* ok */ }
    try { await port?.close(); } catch { /* ok */ }
    this.onDisconnect();
  }

  private async readLoop(): Promise<void> {
    const decoder = new TextDecoder();
    while (this.reader) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await this.reader.read();
      } catch {
        break;
      }
      if (chunk.done) break;
      this.buf += decoder.decode(chunk.value, { stream: true });
      let idx: number;
      while ((idx = this.buf.indexOf("\n")) >= 0) {
        const line = this.buf.slice(0, idx).trim();
        this.buf = this.buf.slice(idx + 1);
        if (!line) continue;
        let obj: Json;
        try {
          obj = JSON.parse(line);
        } catch {
          console.warn("niepoprawna linia z urządzenia:", line);
          continue;
        }
        const rid = obj.requestId;
        if (typeof rid === "number" && this.pending.has(rid)) {
          const p = this.pending.get(rid)!;
          this.pending.delete(rid);
          clearTimeout(p.timer);
          p.resolve(obj);
        } else {
          this.onEvent(obj);
        }
      }
    }
  }

  async command(cmd: string, extra: Json = {}, timeoutMs = 4000): Promise<Json> {
    if (!this.writer) throw new Error("brak połączenia");
    const requestId = this.nextId++;
    const payload = JSON.stringify({ cmd, requestId, ...extra }) + "\n";
    const promise = new Promise<Json>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`timeout komendy ${cmd}`));
      }, timeoutMs);
      this.pending.set(requestId, { resolve, timer });
    });
    await this.writer.write(new TextEncoder().encode(payload));
    return promise;
  }
}
