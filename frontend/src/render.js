import { send } from "./ws";
import { CONFIG } from "./config";

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function renderApp(root, state) {
  const table = state.table;
  const me = state.me;
  const seats = table?.seats ?? [];
  const dealerUserId = table?.dealerUserId;
  const dealerSeat = seats.find(s => s.userId === dealerUserId);
  const actionLog = state.actionLog ?? [];
  const gamePhase = table?.gamePhase ?? "waiting";
  const currentPlayerUserId = table?.currentPlayerUserId;

  root.innerHTML = "";
  
  // Create main structure with header
  const mainEl = el(`
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
      </header>

      <div class="table-container">
        <div class="dealer-seat ${dealerSeat ? "occupied" : "empty"}">
          <div class="dealer-label">D</div>
        </div>
        <div class="table">
          <div class="community-cards" id="community-cards">
            <div class="community-card"></div>
            <div class="community-card"></div>
            <div class="community-card"></div>
            <div class="community-card"></div>
            <div class="community-card"></div>
          </div>
          <div class="pot-display">
            <div class="pot-label">POT</div>
            <div class="pot-amount">$${table?.pot ?? 0}</div>
          </div>
          <div class="card-area card-seat-1"></div>
          <div class="card-area card-seat-2"></div>
          <div class="card-area card-seat-3"></div>
          <div class="card-area card-seat-4"></div>
          <div class="card-area card-seat-5"></div>
          <div class="card-area card-seat-6"></div>
          <div class="seats-grid" id="seats"></div>
        </div>
      </div>

      <div class="controls-section">
        <button class="btn btn-primary" id="start-game">Start Game</button>
        <button class="btn btn-secondary" id="leave-table">Leave Table</button>
        <button class="btn btn-secondary" id="settings">⚙️ Settings</button>
      </div>

      <div class="actions-section" id="actions-section"></div>

      <div class="info-row">
        <div class="info-section">
          <h3>Last Event</h3>
          <p id="last-event">${table?.lastEvent?.summary ?? "Waiting for players..."}</p>
        </div>
        <div class="action-log">
          <h3>Action Log</h3>
          <div class="action-log-content" id="action-log"></div>
        </div>
      </div>

      <div class="debug-section" id="debug"></div>
    </div>
  `);
  
  root.appendChild(mainEl);

  // Render 6 player seats
  const seatsDiv = root.querySelector("#seats");
  
  // Seat numbering: 1 is to the right of dealer, going clockwise
  const seatNumberMap = [6, 1, 2, 3, 4, 5];
  
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
