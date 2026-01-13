import { send } from "./ws";
import { CONFIG } from "./config";

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function renderLobby(root, state) {
  const me = state.me;
  const tables = state.tables ?? [];

  root.innerHTML = "";

  const lobbyEl = el(`
    <div class="lobby">
      <header class="lobby-header">
        <h1>🎰 Poker Lobby</h1>
        <p>Welcome, <strong>${me?.displayName ?? "—"}</strong></p>
      </header>

      <div class="lobby-content">
        <h2>Select a Table</h2>
        <div class="tables-grid" id="tables-grid"></div>
      </div>
    </div>
  `);

  root.appendChild(lobbyEl);

  const tablesGrid = root.querySelector("#tables-grid");
  
  tables.forEach((table) => {
    const playerList = table.players && table.players.length > 0 
      ? table.players.map(p => `<li>${p}</li>`).join('')
      : '<li class="empty-players">No players yet</li>';
    
    const tableCard = el(`
      <div class="table-card">
        <div class="table-card-header">
          <h3>${table.name}</h3>
        </div>
        <div class="table-card-body">
          <button class="btn btn-primary join-btn" data-table-id="${table.tableId}">
            Join Table
          </button>
        </div>
        <div class="table-card-info">
          <div class="info-row">
            <span class="info-label">👥 Players:</span>
            <span class="info-value">${table.playerCount} / ${table.maxSeats}</span>
          </div>
          <div class="players-list">
            <div class="players-label">In Lobby:</div>
            <ul>${playerList}</ul>
          </div>
        </div>
      </div>
    `);

    const joinBtn = tableCard.querySelector(".join-btn");
    joinBtn.addEventListener("click", () => {
      send("JOIN_TABLE", { tableId: table.tableId });
    });

    tablesGrid.appendChild(tableCard);
  });
}

function renderTable(root, state) {
  const table = state.table;
  const me = state.me;
  const seats = table?.seats ?? [];
  const mySeatIndex = seats.findIndex(s => s?.userId && s.userId === me?.userId);
  const actingSeatIndex = table?.actingSeatIndex ?? null;
  const isMyTurn = (mySeatIndex !== -1 && actingSeatIndex === mySeatIndex);
  const dealerUserId = table?.dealerUserId;
  const dealerSeat = seats.find(s => s.userId === dealerUserId);
  const actionLog = state.actionLog ?? [];
  const gamePhase = table?.gamePhase ?? "waiting";

  root.innerHTML = "";
  
  // Create main structure with action log sidebar
  const mainEl = el(`
    <div class="app table-view">
      <div class="main-content">
        <header class="header">
          <div class="header-left">
            <h1>🎰 ${table?.name ?? "Poker"}</h1>
            <p>You: <strong>${me?.displayName ?? "—"}</strong></p>
          </div>
          <div class="header-right">
            <button class="btn btn-secondary btn-sm" id="leave-table">Leave Table</button>
          </div>
        </header>

        <div class="table-container">
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
            <div class="seats-grid" id="seats"></div>
          </div>
          <div class="dealer-controls-container" id="dealer-controls-container"></div>
        </div>

        <div class="bottom-section">
          <div class="actions-section" id="actions-section"></div>
        </div>
      </div>

      <div class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <h3>Action Log</h3>
          <button class="sidebar-toggle" id="sidebar-toggle">◀</button>
        </div>
        <div class="action-log-content" id="action-log"></div>
      </div>
    </div>
  `);
  
  root.appendChild(mainEl);

  // Render 6 player seats
  const seatsDiv = root.querySelector("#seats");
  const myHoleCards = state.myHoleCards ?? [];
  const psBySeat = new Map((table?.playerState ?? []).map(ps => [ps.seatIndex, ps]));
  const handInProgress = table?.status === "IN_HAND";
  
  // Seat numbering: 1 is to the right of dealer, going clockwise
  const seatNumberMap = [6, 1, 2, 3, 4, 5];
  
  for (let i = 0; i < 6; i++) {
    const seat = seats[i];
    const taken = seat && seat.userId;
    const isMySeat = taken && seat.userId === me?.userId;
    const isCurrentTurn = taken && actingSeatIndex === i;
    const displaySeatNumber = seatNumberMap[i];
    const isInHand = taken && handInProgress && table?.playersInHand?.includes(i);
    const ps = psBySeat.get(i);
    const inHand = handInProgress && !!ps?.inHand;
    const folded = !!ps?.hasFolded;
    const allIn = !!ps?.isAllIn;
    const betThisStreet = ps?.betThisStreet ?? 0;
    const shownStack = handInProgress && ps ? ps.stack : seat.chips;
    
    // Determine blind indicator
    let blindIndicator = "";
    if (taken && seat.userId === dealerUserId) blindIndicator = "D";
    else if (taken && table?.smallBlindSeatIndex === i) blindIndicator = "SB";
    else if (taken && table?.bigBlindSeatIndex === i) blindIndicator = "BB";

    const node = el(`
      <div class="seat-wrapper ${isCurrentTurn ? "active-turn" : ""}" data-seat="${i}">
        <button class="seat ${taken ? "taken" : "open"} ${isMySeat ? "my-seat" : ""} ${seat?.folded ? "folded" : ""} ${seat?.allIn ? "all-in" : ""}">
          ${taken
            ? `<div class="seat-content">
                 <div class="seat-player-name">${seat.displayName}</div>
                 <div class="seat-status">
                   ${seat.folded ? '<span class="badge folded">FOLDED</span>' : ''}
                   ${seat.allIn ? '<span class="badge all-in">ALL IN</span>' : ''}
                   ${folded ? `<div class="seat-status folded">FOLDED</div>` : ''}
                   ${allIn ? `<div class="seat-status allin">ALL-IN</div>` : ''}
                 </div>
                 <div class="seat-chips">$${shownStack}</div>
                 ${betThisStreet > 0 ? `<div class="seat-bet">Bet: $${betThisStreet}</div>` : ''}
                 ${blindIndicator ? `<div class="blind-indicator">${blindIndicator}</div>` : ''}
               </div>`
            : `<div class="empty-label">Seat ${displaySeatNumber}</div>`
          }
        </button>
        ${isCurrentTurn ? '<div class="turn-highlight"></div>' : ''}
        ${isMySeat && myHoleCards.length > 0 ? `
          <div class="player-hole-cards">
            ${myHoleCards.map(card => `<div class="mini-card">${card}</div>`).join('')}
          </div>
        ` : isInHand && !isMySeat ? `
          <div class="player-hole-cards">
            <div class="mini-card card-back"></div>
            <div class="mini-card card-back"></div>
          </div>
        ` : ''}
      </div>
    `);

    if (!taken) {
      node.querySelector("button").addEventListener("click", () => {
        send("TAKE_SEAT", { tableId: table?.tableId, seatIndex: i });
      });
    } else {
      node.querySelector("button").disabled = true;
    }

    seatsDiv.appendChild(node);
  }

  // Render community cards
  const communityCardsDiv = root.querySelector("#community-cards");
  const communityCards = table?.communityCards ?? [];
  communityCardsDiv.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    const card = communityCards[i];
    const cardEl = el(`
      <div class="community-card ${card ? '' : 'card-back'}">
        ${card || ''}
      </div>
    `);
    communityCardsDiv.appendChild(cardEl);
  }

  // Render action buttons (stub for now, will connect to backend)
  const actionsSection = root.querySelector("#actions-section");
  if (isMyTurn) {
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
      send("ACTION", { tableId: table?.tableId, action: "FOLD" });
    });
    root.querySelector("#check-btn")?.addEventListener("click", () => {
      console.log("Check clicked - ready to connect to backend");
      send("ACTION", { tableId: table?.tableId, action: "CHECK" });
    });
    root.querySelector("#call-btn")?.addEventListener("click", () => {
      console.log("Call clicked - ready to connect to backend");
      send("ACTION", { tableId: table?.tableId, action: "CALL" });
    });
    root.querySelector("#raise-btn")?.addEventListener("click", () => {
      console.log("Raise clicked - ready to connect to backend");
      send("ACTION", { tableId: table?.tableId, action: "RAISE", amount: 100 });
    });
    root.querySelector("#all-in-btn")?.addEventListener("click", () => {
      console.log("All In clicked - ready to connect to backend");
      const mySeat = seats.find(s => s.userId === me?.userId);
      if (mySeat) {
        send("ACTION", { tableId: table?.tableId, action: "RAISE", amount: mySeat.chips });
      }
    });
  }

  // Render dealer controls
  const dealerControlsContainer = root.querySelector("#dealer-controls-container");
  const isDealer = me?.userId === dealerUserId;
  const seatedCount = seats.filter(s => s.userId).length;
  const canStartHand = isDealer && seatedCount >= 2 && table?.status !== "IN_HAND";
  
  if (isDealer) {
    dealerControlsContainer.innerHTML = `
      <div class="dealer-controls">
        <div class="dealer-badge">👑 DEALER CONTROLS</div>
        <button 
          class="btn btn-primary btn-deal" 
          id="deal-btn"
          ${!canStartHand ? 'disabled' : ''}
          title="${!canStartHand && seatedCount < 2 ? 'Need at least 2 players' : !canStartHand && table?.status === 'IN_HAND' ? 'Hand already in progress' : 'Start a new hand'}">
          🃏 Deal Hand
        </button>
        ${!canStartHand && seatedCount < 2 ? '<div class="dealer-hint">Waiting for players...</div>' : ''}
        ${!canStartHand && table?.status === 'IN_HAND' ? '<div class="dealer-hint">Hand in progress</div>' : ''}
      </div>
    `;
    
    root.querySelector("#deal-btn")?.addEventListener("click", () => {
      if (canStartHand) {
        send("START_HAND", { tableId: table?.tableId });
      }
    });
  } else {
    if (dealerControlsContainer) dealerControlsContainer.innerHTML = "";
  }

  // Add game control event listeners
  root.querySelector("#leave-table")?.addEventListener("click", () => {
    send("LEAVE_TABLE", { tableId: table?.tableId });
  });

  // Sidebar toggle functionality
  const sidebar = root.querySelector("#sidebar");
  const sidebarToggle = root.querySelector("#sidebar-toggle");
  sidebarToggle?.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    sidebarToggle.textContent = sidebar.classList.contains("collapsed") ? "▶" : "◀";
  });

  root.querySelector("#all-in-btn")?.addEventListener("click", () => {
    const ps = psBySeat.get(mySeatIndex);
    if (!ps) return;
    send("ACTION", { tableId: table?.tableId, action: "RAISE", amount: ps.stack });
  });

  root.querySelector("#raise-btn")?.addEventListener("click", () => {
    const amt = parseInt(prompt("Raise amount (chips to add):") || "0", 10);
    if (amt > 0) send("ACTION", { tableId: table?.tableId, action: "RAISE", amount: amt });
  });



  // Render action log
  const actionLogDiv = root.querySelector("#action-log");
  actionLogDiv.innerHTML = actionLog
    .slice(-20)
    .reverse()
    .map(log => `<div class="log-entry">${log}</div>`)
    .join("");
}

export function renderApp(root, state) {
  if (state.view === "lobby") {
    renderLobby(root, state);
  } else {
    renderTable(root, state);
  }
}
