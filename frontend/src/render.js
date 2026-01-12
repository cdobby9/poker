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
        <div class="header-left">
          <h1>🎰 Poker</h1>
          <p>Table: <strong>${table?.tableId ?? "—"}</strong> • You: <strong>${me?.displayName ?? "—"}</strong></p>
        </div>
        <div class="header-middle">
          <div class="game-phase ${gamePhase}">
            <span class="phase-label">${gamePhase.toUpperCase()}</span>
          </div>
        </div>
        <div class="header-status">
          <div class="status-indicator">
            <div class="status-dot"></div>
            <span>Connected</span>
          </div>
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
    const isMySeat = taken && seat.userId === me?.userId;
    const isCurrentTurn = taken && seat.userId === currentPlayerUserId;
    const displaySeatNumber = seatNumberMap[i];
    
    // Determine blind indicator
    let blindIndicator = "";
    if (taken && seat.userId === dealerUserId) blindIndicator = "D";
    else if (taken && table?.smallBlindUserId === seat.userId) blindIndicator = "SB";
    else if (taken && table?.bigBlindUserId === seat.userId) blindIndicator = "BB";

    const node = el(`
      <div class="seat-wrapper ${isCurrentTurn ? "active-turn" : ""}" data-seat="${i}">
        <button class="seat ${taken ? "taken" : "open"} ${isMySeat ? "my-seat" : ""} ${seat?.folded ? "folded" : ""} ${seat?.allIn ? "all-in" : ""}">
          ${taken
            ? `<div class="seat-content">
                 <div class="seat-player-name">${seat.displayName}</div>
                 <div class="seat-status">
                   ${seat.folded ? '<span class="badge folded">FOLDED</span>' : ''}
                   ${seat.allIn ? '<span class="badge all-in">ALL IN</span>' : ''}
                 </div>
                 <div class="seat-chips">$${seat.chips}</div>
                 ${seat.currentBet > 0 ? `<div class="seat-bet">Bet: $${seat.currentBet}</div>` : ''}
                 ${blindIndicator ? `<div class="blind-indicator">${blindIndicator}</div>` : ''}
               </div>`
            : `<div class="empty-label">Seat ${displaySeatNumber}</div>`
          }
        </button>
        ${isCurrentTurn ? '<div class="turn-highlight"></div>' : ''}
      </div>
    `);

    if (!taken) {
      node.querySelector("button").addEventListener("click", () => {
        send("TAKE_SEAT", { tableId: CONFIG.DEFAULT_TABLE_ID, seatIndex: i });
      });
    } else {
      node.querySelector("button").disabled = true;
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

  // Render action buttons (stub for now, will connect to backend)
  const actionsSection = root.querySelector("#actions-section");
  if (me?.userId === currentPlayerUserId) {
    actionsSection.innerHTML = `
      <div class="action-buttons">
        <button class="btn btn-action fold-btn" id="fold-btn">Fold</button>
        <button class="btn btn-action check-btn" id="check-btn">Check</button>
        <button class="btn btn-action call-btn" id="call-btn">Call</button>
        <button class="btn btn-action raise-btn" id="raise-btn">Raise</button>
        <button class="btn btn-action all-in-btn" id="all-in-btn">All In</button>
      </div>
    `;
    
    // Add stub event listeners
    root.querySelector("#fold-btn")?.addEventListener("click", () => {
      console.log("Fold clicked - ready to connect to backend");
      send("FOLD", { tableId: CONFIG.DEFAULT_TABLE_ID });
    });
    root.querySelector("#check-btn")?.addEventListener("click", () => {
      console.log("Check clicked - ready to connect to backend");
      send("CHECK", { tableId: CONFIG.DEFAULT_TABLE_ID });
    });
    root.querySelector("#call-btn")?.addEventListener("click", () => {
      console.log("Call clicked - ready to connect to backend");
      send("CALL", { tableId: CONFIG.DEFAULT_TABLE_ID });
    });
    root.querySelector("#raise-btn")?.addEventListener("click", () => {
      console.log("Raise clicked - ready to connect to backend");
      send("RAISE", { tableId: CONFIG.DEFAULT_TABLE_ID, amount: 100 });
    });
    root.querySelector("#all-in-btn")?.addEventListener("click", () => {
      console.log("All In clicked - ready to connect to backend");
      send("ALL_IN", { tableId: CONFIG.DEFAULT_TABLE_ID });
    });
  }

  // Add game control event listeners
  root.querySelector("#start-game")?.addEventListener("click", () => {
    console.log("Start game clicked");
    send("START_GAME", { tableId: CONFIG.DEFAULT_TABLE_ID });
  });

  root.querySelector("#leave-table")?.addEventListener("click", () => {
    send("LEAVE_TABLE", { tableId: CONFIG.DEFAULT_TABLE_ID });
  });

  root.querySelector("#settings")?.addEventListener("click", () => {
    console.log("Settings clicked");
  });

  // Render action log
  const actionLogDiv = root.querySelector("#action-log");
  actionLogDiv.innerHTML = actionLog
    .slice(-5)
    .reverse()
    .map(log => `<div class="log-entry">${log}</div>`)
    .join("");

  // Update last event
  const lastEventDiv = root.querySelector("#last-event");
  if (lastEventDiv && table?.lastEvent?.summary) {
    lastEventDiv.textContent = table.lastEvent.summary;
  }

  // Render debug info
  const debugDiv = root.querySelector("#debug");
  debugDiv.textContent = JSON.stringify({ table, me, gamePhase }, null, 2);
}
