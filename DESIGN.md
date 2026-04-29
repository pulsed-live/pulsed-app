# PULSED × Virginia Highland Porchfest — Design System

## Brand collaboration

PULSED (the real-time map app) is co-branded with Virginia Highland District Association
(VHDA) Porchfest 2026. The design merges PULSED's tech-minimal identity with VHDA's
earthy, neighborhood-warm palette.

---

## Color palette

### VHDA official colors (from PF_Colors-ForKent.pdf)

| Token       | Hex       | Usage                        |
|-------------|-----------|------------------------------|
| Ivory       | `#E9E8E4` | Page background, panel fills |
| Navy        | `#426368` | 4 PM slot, borders, text     |
| Teal        | `#619882` | 1 PM slot, GPS dot           |
| Teal-blue   | `#619cab` | 11 AM slot                   |
| Brick Red   | `#c25534` | 12 PM slot                   |
| Gold        | `#C17C2E` | 3 PM slot                    |
| Dusty Purple| `#7A525B` | 2 PM slot                    |
| Olive       | `#787342` | 5 PM slot                    |
| Near-black  | `#1b2424` | 7 PM slot, headings in popups|
| Warm Gray   | `#81817f` | 10 AM slot                   |

### PULSED brand colors

| Token        | Hex       | Usage                          |
|--------------|-----------|--------------------------------|
| PULSED Orange| `#ff8c00` | Wordmark, CTA buttons, live badge, glow |

---

## Time-slot pin colors

Each hour-long time slot gets a distinct VHDA color. Live pins pulse with their
slot color; the ripple animation inherits the same hue automatically.

| UTC Hour | EDT Slot | Color     | Name         |
|----------|----------|-----------|--------------|
| 14       | 10 AM    | `#81817f` | warm gray    |
| 15       | 11 AM    | `#619cab` | teal-blue    |
| 16       | 12 PM    | `#c25534` | brick red    |
| 17       | 1 PM     | `#619882` | teal-green   |
| 18       | 2 PM     | `#7A525B` | dusty purple |
| 19       | 3 PM     | `#C17C2E` | gold         |
| 20       | 4 PM     | `#426368` | dark navy    |
| 21       | 5 PM     | `#787342` | olive        |
| 23       | 7 PM     | `#1b2424` | near-black   |

Non-live statuses use universal colors:

| Status      | Color     |
|-------------|-----------|
| scheduled   | `#888`    |
| cancelled   | `#e03c3c` |

---

## Typography

| Use             | Font                   | Weight   |
|-----------------|------------------------|----------|
| UI chrome       | JetBrains Mono         | 400, 600, 700 |
| Band names      | Montserrat             | 600      |
| Genre / address | Montserrat             | 400, 500 |
| PULSED wordmark | JetBrains Mono         | 700      |

Montserrat is per the VHDA organizer's font spec. JetBrains Mono gives PULSED its
tech-map personality in chrome/labels.

---

## Panel surfaces

All floating UI panels use a warm ivory base:

```
background:      rgba(233, 232, 228, 0.94)
border:          1px solid rgba(66, 99, 104, 0.14)
box-shadow:      0 2px 12px rgba(66, 99, 104, 0.10)
backdrop-filter: blur(14px)
border-radius:   10px (panels) / 8px (compact strips) / 14px (popups)
```

---

## Layout

```
┌─────────────────────────────────────────────────────┐
│ [PULSED × PF logo]         [set count / live count] │ ← top 14px
│ [legend: live·by-time | scheduled | cancelled]      │ ← top 72px
│                                                     │
│                  MAP                                │
│                                                     │
│      [ ↑ popup floats here when a pin is tapped ]   │ ← bottom 80px
│                                                     │
│      [botanical SVG]           [botanical SVG]      │ ← corners
├─────────────────────────────────────────────────────┤
│  ● live now  │ Rock │ Jazz │ Folk │ Blues │ R&B … » │ ← filter bar
└─────────────────────────────────────────────────────┘
```

### Zoom controls

Leaflet's zoom controls are pushed up to `bottom: 68px` via CSS override so they
sit above the filter bar:
```css
.leaflet-bottom.leaflet-right { bottom: 68px !important; right: 12px !important; }
```

### Leaflet attribution

Styled to blend with the VHDA palette rather than the default white bar:
```css
.leaflet-control-attribution {
  font-family: 'JetBrains Mono', monospace;
  font-size: 8px;
  color: rgba(66,99,104,0.45);
  background: rgba(233,232,228,0.82);
  border-radius: 6px 0 0 0;
}
```

---

## Botanical corner overlays

Two SVG fern illustrations sit at the bottom corners of the map to frame the view
and soften the Leaflet attribution. Both use `pointer-events: none` so they never
interfere with map interaction.

- Bottom-left: VHDA Navy (`#426368`) stems, opacity 0.22
- Bottom-right: VHDA Teal (`#619882`) stems, opacity 0.22, mirrored via `scaleX(-1)`

---

## Logos

| File                       | Use                                    |
|----------------------------|----------------------------------------|
| `public/pf26-logo-navy.png`  | Header on ivory/light backgrounds    |
| `public/pf26-logo-ivory.png` | Future dark-mode or dark panel use   |

Logo height in header: 22px, opacity 0.82.

---

## Filter bar

- Pinned to bottom of viewport (`position: absolute; bottom: 0`)
- Horizontal scroll with `overflow-x: auto`; scrollbar hidden via CSS
- Right-edge fade mask: `linear-gradient(to right, black 88%, transparent 100%)`
- Background matches panel ivory for visual continuity

---

## Popup

Pops up 80px from the bottom edge (above the filter bar) when a venue pin is tapped.
Band name uses Montserrat 600 at 18px on near-black `#1b2424`.
Buttons use PULSED orange for primary CTA; navy-tint border for secondary.
