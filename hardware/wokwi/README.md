# Wiring diagram — Wokwi

Two diagrams live here:

| File | What it shows |
|---|---|
| `diagram-minimal.json` | the four wires between the board and the scanner, and nothing else. This is the one rendered as `docs/img/wiring-minimal.png` |
| `diagram.json` | the full prototype: an RP2040, the scanner, and a breadboard with an LED, a button and a buzzer |

**Saved project:** https://wokwi.com/projects/472807254038722561

## The minimal diagram

The board is rotated (`"rotate": 270`), with the scanner module to its left:

| From | To | Wire |
|---|---|---|
| GM65 VCC | Pico VBUS (5 V) | black |
| GM65 GND | Pico GND | grey |
| GM65 TX | Pico GP1 | orange |
| GM65 RX | Pico GP0 | violet |

Colours are arbitrary. What matters is that the UART crosses over and that GND
goes to a GND pin: wiring GND to a GPIO, or TXD straight to GP0, is the mistake
that is easiest to make and hardest to spot on a picture.

## The full prototype

UART goes directly over jumper wires; power runs through the breadboard rails:

UART goes directly over jumper wires; power runs through the breadboard rails:

| From | To | Colour | Notes |
|------|-------|-------|-------|
| Pico VBUS (5 V) | breadboard + rail (`tp`) | red | 5 V from USB |
| Pico GND | breadboard − rail (`tn`) | black | common ground, connect it first |
| GM65 VCC | + rail | red | the GM65 needs 5 V |
| GM65 GND | − rail | black | |
| GM65 TX | Pico GP1 = RX0 (pin 2) | yellow | UART crosses over |
| GM65 RX | Pico GP0 = TX0 (pin 1) | green | UART crosses over |

Optional parts on the breadboard:

| Part | Columns | Driven by | Notes |
|---------|---------|------------|-------|
| 330 Ω resistor | 7-10 (row b) | GP6 → column 7 (orange) | in series with the LED |
| LED (anode column 10, cathode column 12) | 10-12 (row a) | — | cathode jumpered to the − rail |
| TRIG button | 16-18 (row b) | GP2 → column 16 (violet) | the other leg jumpered to the − rail; the pull-up is internal, in firmware |
| Buzzer (+ column 22, − column 24) | 22-24 (row b) | GP7 → column 22 (cyan) | on a real board drive it through an NPN transistor (1 kΩ to the base) if it draws more than 10 mA |

## The scanner stand-in (`gm65.chip.c`)

The simulation has no model of a real scanner, so `gm65.chip.c` is a stand-in
that periodically pushes an EAN-13 frame over UART. Its pin order matches the
module we use (Waveshare 14810): looking at the connector, **VCC, TXD, RXD,
GND**. If your module orders them differently, change the `pins` array in
`gm65.chip.json` rather than rewiring the diagram, so that the names in the
connections keep meaning what they say.

## The factory harness of the older GM65 module (mind the colours)

On that module the silkscreen next to the JST connector reads
`GND | RXD | TXD | VCC`, the opposite order to the Waveshare unit. Its harness
colours do **not** follow any convention either:

| Wire colour | Module pin | Goes to |
|---|---|---|
| green | VCC | the +5 V rail |
| yellow | GND | the GND rail |
| violet | TXD (transmits) | GP1 = Pico RX |
| blue | RXD (receives) | GP0 = Pico TX |

Go by the pin labels on the module, not by the colours. The module has its own
buzzer and trigger button, so the external LED, button and buzzer in the diagram
are optional.

## Level shifter — deliberately absent

The GM65 signals at **3.3 V** TTL, so a shifter is unnecessary. Add one **only
if** a measurement or your module's datasheet shows 5 V on the scanner's TX (the
RP2040's GPIOs are not 5 V tolerant):

```
scanner TX --[1 kΩ]--*--> GP1 (Pico RX)
                     |
                   [2 kΩ]
                     |
                    GND
```

Do not add a divider "just in case" on a 3.3 V line: 3.3 V × 2/3 is about 2.2 V,
which sits right at the RP2040's logic-high threshold.

## Opening it from scratch

1. https://wokwi.com/projects/new/micropython-pi-pico
2. Replace `main.py` and `diagram.json`, then add `gm65.chip.c` and
   `gm65.chip.json` (the ▼ next to the tabs → *New file…*).

## A simulator limitation (2026-08)

`machine.UART` does not work in Wokwi on `wokwi-pi-pico` (the constructor hangs,
and UART0 additionally collides with the REPL console). The simulation therefore
serves as **a schematic plus a dummy scanner**: `gm65.chip.c` periodically sends
EAN-13 codes and logs them in the **CHIPS CONSOLE** tab. Reception on the Pico
side is tested on real hardware.
