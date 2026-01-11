import { send } from "./ws";
import { CONFIG } from "./config";

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function renderApp(root, state) {
  const table = state.table;

  root.innerHTML = "";
  root.appendChild(el(`
    <div class="app">
      <header class="header">
        <div>
          <h1>Private Hold'em</h1>
          <p class="muted">Table: <strong>${table?.tableId ?? "—"}</strong></p>
        </div>
        <div class="pill">WS: live</div>
      </header>

      <section class="card">
        <h2>Seats</h2>
        <div class="seats" id="seats"></div>
      </section>

      <section class="card">
        <h2>Last event</h2>
        <p class="muted">${table?.lastEvent?.summary ?? "—"}</p>
      </section>

      <section class="card">
        <h2>Debug</h2>
        <pre class="pre">${JSON.stringify(table, null, 2)}</pre>
      </section>
    </div>
  `));

  const seatsDiv = root.querySelector("#seats");

  const seats = table?.seats ?? [];
  for (let i = 0; i < 6; i++) {
    const seat = seats[i];
    const taken = seat && seat.userId;

    const node = el(`
      <button class="seat ${taken ? "taken" : "open"}">
        <div class="seat-title">Seat ${i}</div>
        <div class="seat-body">
          ${taken
            ? `<div><strong>${seat.displayName}</strong></div>
               <div class="muted">${seat.chips} chips</div>`
            : `<div class="muted">Empty</div>
               <div class="muted small">Tap to sit</div>`
          }
        </div>
      </button>
    `);

    if (!taken) {
      node.addEventListener("click", () => {
        send("TAKE_SEAT", { tableId: CONFIG.DEFAULT_TABLE_ID, seatIndex: i });
      });
    } else {
      node.disabled = true;
    }

    seatsDiv.appendChild(node);
  }
}
