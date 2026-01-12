import { send } from "./ws";
import { CONFIG } from "./config";

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function renderApp(root, state) {
  const table = state.table;

  // ✅ compute these BEFORE any template uses them
  const myUserId = state.me?.userId ?? null;
  const isDealer = !!(table?.dealerUserId && myUserId && table.dealerUserId === myUserId);

  root.innerHTML = "";

  root.appendChild(el(`
    <div class="app">
      <header class="header">
        <div>
          <h1>Private Hold'em</h1>
          <p class="muted">Table: <strong>${table?.tableId ?? "—"}</strong></p>
        </div>

        <div style="display:flex; gap:8px; align-items:center;">
          ${isDealer ? `<button class="btn" id="startHandBtn">Start hand</button>` : ``}
          <div class="pill">WS: live</div>
        </div>
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
      ${table?.status === "IN_HAND" ? `
  <section class="actionbar">
    <button id="foldBtn" ${!isMyTurn ? "disabled" : ""}>Fold</button>
    <button id="checkCallBtn" ${!isMyTurn ? "disabled" : ""}>
      ${toCall === 0 ? "Check" : `Call ${toCall}`}
    </button>
    <button id="raise10Btn" ${!isMyTurn ? "disabled" : ""}>Raise +10</button>
    <button id="raise50Btn" ${!isMyTurn ? "disabled" : ""}>Raise +50</button>
  </section>
` : ``}

    </div>
  `));

  


  // Wire dealer button
  const startBtn = root.querySelector("#startHandBtn");
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      send("START_HAND", { tableId: CONFIG.DEFAULT_TABLE_ID });
    });
  }

  // Seats render
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

  const mySeatIndex =
    table?.seats?.find(s => s.userId === state.me?.userId)?.seatIndex ?? null;

  const myPS =
    table?.playerState?.find(p => p.seatIndex === mySeatIndex) ?? null;

  const toCall = myPS ? Math.max(0, (table.currentBet || 0) - (myPS.betThisStreet || 0)) : 0;
  const isMyTurn = table?.status === "IN_HAND" && mySeatIndex !== null && table.actingSeatIndex === mySeatIndex;

const foldBtn = root.querySelector("#foldBtn");
if (foldBtn) foldBtn.addEventListener("click", () => {
  send("ACTION", { tableId: CONFIG.DEFAULT_TABLE_ID, action: "FOLD" });
});

const checkCallBtn = root.querySelector("#checkCallBtn");
if (checkCallBtn) checkCallBtn.addEventListener("click", () => {
  send("ACTION", { tableId: CONFIG.DEFAULT_TABLE_ID, action: toCall === 0 ? "CHECK" : "CALL" });
});

const raise10Btn = root.querySelector("#raise10Btn");
if (raise10Btn) raise10Btn.addEventListener("click", () => {
  send("ACTION", { tableId: CONFIG.DEFAULT_TABLE_ID, action: "RAISE", amount: 10 });
});

const raise50Btn = root.querySelector("#raise50Btn");
if (raise50Btn) raise50Btn.addEventListener("click", () => {
  send("ACTION", { tableId: CONFIG.DEFAULT_TABLE_ID, action: "RAISE", amount: 50 });
});


    seatsDiv.appendChild(node);
  }
}
