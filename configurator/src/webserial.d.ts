// Minimalne deklaracje WebSerial (wystarczajace dla tego projektu).
interface SerialPort {
  open(options: { baudRate: number }): Promise<void>;
  setSignals(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  addEventListener(type: "disconnect", listener: () => void): void;
}

interface Serial {
  requestPort(options?: { filters?: { usbVendorId?: number; usbProductId?: number }[] }): Promise<SerialPort>;
}

interface Navigator {
  serial: Serial;
}
