# Experiment Inventory

A small HTML canvas gathering game. Click trees and rocks in the clearing, then manage a pack that only holds so much weight and volume.

## Play

Live: [https://nattstack.github.io/experiment-inventory/](https://nattstack.github.io/experiment-inventory/)

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 5173
```

Then visit [http://localhost:5173](http://localhost:5173).

## How it works

- **Trees** drop sticks (1 weight, 2 volume). Light, but they eat space.
- **Rocks** drop stones (3 weight, 1 volume). Dense and compact.
- Your pack holds **20 weight** and **16 volume**. Either limit can block a pickup.
- Click an item in the pack to drop one and free space.
- Harvested nodes become stumps or rubble, then grow back.

No build step, no dependencies — just HTML, CSS, and canvas.
