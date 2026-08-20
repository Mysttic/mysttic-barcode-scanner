# Kanal konfiguracyjny USB CDC (usb_cdc.data) - protokol NDJSON (Etap 5).
# Jedna linia = jeden obiekt JSON. Odpowiedzi zawsze z "ok" i "requestId"
# (echo z zadania, jesli podano). Nieblokujacy poll() - wolno go wolac
# w kazdym obiegu petli glownej.
import json

MAX_LINE_BYTES = 8 * 1024


class CdcProtocol:
    def __init__(self, stream, handlers):
        """stream: usb_cdc.data (lub mock z .in_waiting/.read/.write).
        handlers: mapa {"nazwaKomendy": funkcja(request) -> dict odpowiedzi}."""
        self._stream = stream
        self._handlers = handlers
        self._buf = b""
        self._overflow = False

    def send(self, obj):
        try:
            self._stream.write((json.dumps(obj) + "\n").encode("utf-8"))
        except Exception as e:
            print("CDC: blad wysylki:", e)

    def poll(self):
        stream = self._stream
        if stream is None:
            return
        try:
            waiting = stream.in_waiting
        except Exception:
            return
        if waiting:
            data = stream.read(min(waiting, 256))
            if data:
                self._buf += data
                if len(self._buf) > MAX_LINE_BYTES:
                    # zgub przepelniona linie, odpowiedz bledem po jej koncu
                    self._buf = self._buf[-1:] if self._buf.endswith(b"\n") else b""
                    self._overflow = True
        while b"\n" in self._buf:
            line, _, self._buf = self._buf.partition(b"\n")
            if self._overflow:
                self._overflow = False
                self.send({"ok": False, "error": "wiadomosc przekracza " + str(MAX_LINE_BYTES) + " B"})
                continue
            line = line.strip()
            if line:
                self._dispatch(line)

    def _dispatch(self, line):
        try:
            request = json.loads(line)
        except ValueError:
            self.send({"ok": False, "error": "bledny JSON"})
            return
        if not isinstance(request, dict):
            self.send({"ok": False, "error": "oczekiwany obiekt JSON"})
            return
        request_id = request.get("requestId")
        cmd = request.get("cmd")
        handler = self._handlers.get(cmd)
        if handler is None:
            self.send({"ok": False, "error": "nieznana komenda: " + str(cmd), "requestId": request_id})
            return
        try:
            response = handler(request) or {}
        except Exception as e:
            response = {"ok": False, "error": "blad komendy " + str(cmd) + ": " + str(e)}
        response.setdefault("ok", True)
        if request_id is not None:
            response["requestId"] = request_id
        self.send(response)
