from __future__ import annotations

import json
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, Optional, Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware



# App setup ----------------------------


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}


# In-memory data ----------------------------

def now_iso() -> str:
    # simple ISO-ish (good enough for dev)
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def make_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


@dataclass
class Seat:
    seatIndex: int
    userId: Optional[str] = None
    displayName: Optional[str] = None
    chips: int = 0
    isConnected: bool = False
    isSittingOut: bool = False

    def to_public(self) -> Dict[str, Any]:
        return {
            "seatIndex": self.seatIndex,
            "userId": self.userId,
            "displayName": self.displayName,
            "chips": self.chips,
            "isConnected": self.isConnected,
            "isSittingOut": self.isSittingOut,
        }


@dataclass
class TableState:
    tableId: str
    name: str = "Friday Night Poker"
    status: str = "LOBBY"
    maxSeats: int = 6
    createdAt: str = field(default_factory=now_iso)

    dealerUserId: Optional[str] = None
    handNumber: int = 0

    seats: list[Seat] = field(default_factory=list)

    # gameplay fields (placeholders for now)
    buttonSeatIndex: Optional[int] = None
    smallBlindSeatIndex: Optional[int] = None
    bigBlindSeatIndex: Optional[int] = None

    street: str = "NONE"
    communityCards: list[str] = field(default_factory=list)

    pot: int = 0
    currentBet: int = 0
    minRaiseTo: int = 0

    actingSeatIndex: Optional[int] = None
    actionClockMs: int = 0

    playersInHand: list[int] = field(default_factory=list)
    playerState: list[Dict[str, Any]] = field(default_factory=list)

    holeCards: Dict[str, list[str]] = field(default_factory=dict) 
    lastEvent: Dict[str, Any] = field(default_factory=dict)

    version: int = 1

    def to_public(self) -> Dict[str, Any]:
        return {
            "tableId": self.tableId,
            "name": self.name,
            "status": self.status,
            "maxSeats": self.maxSeats,
            "createdAt": self.createdAt,
            "dealerUserId": self.dealerUserId,
            "handNumber": self.handNumber,
            "seats": [s.to_public() for s in self.seats],
            "buttonSeatIndex": self.buttonSeatIndex,
            "smallBlindSeatIndex": self.smallBlindSeatIndex,
            "bigBlindSeatIndex": self.bigBlindSeatIndex,
            "street": self.street,
            "communityCards": self.communityCards,
            "pot": self.pot,
            "currentBet": self.currentBet,
            "minRaiseTo": self.minRaiseTo,
            "actingSeatIndex": self.actingSeatIndex,
            "actionClockMs": self.actionClockMs,
            "playersInHand": self.playersInHand,
            "playerState": self.playerState,
            "lastEvent": self.lastEvent,
            "version": self.version,
        }


# tableId -> TableState
TABLES: Dict[str, TableState] = {}

# tableId -> set of WebSocket connections currently subscribed
TABLE_SUBSCRIBERS: Dict[str, Set[WebSocket]] = {}

# websocket -> session info
SESSIONS: Dict[WebSocket, Dict[str, Any]] = {}


def get_or_create_table(table_id: str) -> TableState:
    if table_id not in TABLES:
        t = TableState(tableId=table_id)
        t.seats = [Seat(seatIndex=i) for i in range(t.maxSeats)]
        TABLES[table_id] = t
        TABLE_SUBSCRIBERS[table_id] = set()
    return TABLES[table_id]


async def send(ws: WebSocket, msg_type: str, payload: Dict[str, Any], request_id: Optional[str] = None):
    msg = {"type": msg_type, "payload": payload}
    if request_id is not None:
        msg["requestId"] = request_id
    await ws.send_text(json.dumps(msg))


async def send_error(ws: WebSocket, code: str, message: str, request_id: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
    await send(
        ws,
        "ERROR",
        {
            "code": code,
            "message": message,
            "details": details or {},
        },
        request_id=request_id,
    )


async def broadcast_state(table_id: str):
    table = TABLES[table_id]
    payload = {"table": table.to_public()}
    dead: list[WebSocket] = []
    for ws in TABLE_SUBSCRIBERS.get(table_id, set()):
        try:
            await send(ws, "STATE", payload)
        except Exception:
            dead.append(ws)

    for ws in dead:
        TABLE_SUBSCRIBERS[table_id].discard(ws)


def bump_event(table: TableState, event_type: str, summary: str):
    table.version += 1
    table.lastEvent = {
        "eventId": make_id("evt"),
        "at": now_iso(),
        "type": event_type,
        "summary": summary,
    }

def find_ps(table: TableState, seat_index: int) -> Optional[Dict[str, Any]]:
    for ps in table.playerState:
        if ps["seatIndex"] == seat_index:
            return ps
    return None


def next_seat_in_hand(table: TableState, current: int) -> Optional[int]:
    if not table.playersInHand:
        return None

    ordered = sorted(table.playersInHand)
    if current not in ordered:
        # fallback
        for idx in ordered:
            ps = find_ps(table, idx)
            if ps and ps["inHand"] and (not ps["hasFolded"]) and (not ps["isAllIn"]):
                return idx
        return None

    start_i = ordered.index(current)
    for offset in range(1, len(ordered) + 1):
        idx = ordered[(start_i + offset) % len(ordered)]
        ps = find_ps(table, idx)
        if ps and ps["inHand"] and (not ps["hasFolded"]) and (not ps["isAllIn"]):
            return idx

    return None


def active_players(table: TableState) -> list[Dict[str, Any]]:
    return [ps for ps in table.playerState if ps.get("inHand") and (not ps.get("hasFolded"))]




# WS endpoint ----------------------------

@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()

    # Create a session for this socket
    SESSIONS[ws] = {
        "userId": None,
        "displayName": None,
        "tableId": None,
    }

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
                msg_type = msg.get("type")
                request_id = msg.get("requestId")
                payload = msg.get("payload") or {}
            except Exception:
                await send_error(ws, "BAD_MESSAGE", "Invalid JSON message.")
                continue

            # --- AUTH (v1: we accept any token and fake identity) ---
            if msg_type == "AUTH":
                # In v1 dev, accept token and generate userId/displayName.
                # Later replace with real JWT validation via REST login.
                token = payload.get("token")
                if not token:
                    await send_error(ws, "NOT_AUTHENTICATED", "Missing token.", request_id=request_id)
                    continue

                # simple fake identity derived from token
                user_id = make_id("usr")
                display_name = payload.get("displayName") or "Player"
                SESSIONS[ws]["userId"] = user_id
                SESSIONS[ws]["displayName"] = display_name

                await send(ws, "AUTH_OK", {"userId": user_id, "displayName": display_name}, request_id=request_id)
                continue

            # Require auth for everything else
            if not SESSIONS[ws].get("userId"):
                await send_error(ws, "NOT_AUTHENTICATED", "Authenticate first using AUTH.", request_id=request_id)
                continue

            # --- JOIN_TABLE ---
            if msg_type == "JOIN_TABLE":
                table_id = payload.get("tableId")
                if not table_id:
                    await send_error(ws, "INVALID_REQUEST", "Missing tableId.", request_id=request_id)
                    continue

                table = get_or_create_table(table_id)

                # subscribe
                TABLE_SUBSCRIBERS[table_id].add(ws)
                SESSIONS[ws]["tableId"] = table_id

                # mark connected if they already have a seat
                user_id = SESSIONS[ws]["userId"]
                for seat in table.seats:
                    if seat.userId == user_id:
                        seat.isConnected = True

                bump_event(table, "PLAYER_JOINED_TABLE", f"{SESSIONS[ws]['displayName']} joined table")
                await broadcast_state(table_id)
                continue

            # LEAVE_TABLE ----------------------------
            if msg_type == "LEAVE_TABLE":
                table_id = payload.get("tableId") or SESSIONS[ws].get("tableId")
                if not table_id or table_id not in TABLES:
                    await send_error(ws, "TABLE_NOT_FOUND", "Table not found.", request_id=request_id)
                    continue

                TABLE_SUBSCRIBERS[table_id].discard(ws)
                if SESSIONS[ws].get("tableId") == table_id:
                    SESSIONS[ws]["tableId"] = None

                table = TABLES[table_id]
                bump_event(table, "PLAYER_LEFT_TABLE", f"{SESSIONS[ws]['displayName']} left table")
                await broadcast_state(table_id)
                continue

            # require that they are in a table
            table_id = payload.get("tableId") or SESSIONS[ws].get("tableId")
            if not table_id or table_id not in TABLES:
                await send_error(ws, "NOT_IN_TABLE", "Join a table first.", request_id=request_id)
                continue
            table = TABLES[table_id]

            # TAKE_SEAT ----------------------------
            if msg_type == "TAKE_SEAT":
                seat_index = payload.get("seatIndex")
                if seat_index is None or not isinstance(seat_index, int):
                    await send_error(ws, "INVALID_REQUEST", "seatIndex must be an integer.", request_id=request_id)
                    continue
                if seat_index < 0 or seat_index >= table.maxSeats:
                    await send_error(ws, "SEAT_OUT_OF_RANGE", "seatIndex out of range.", request_id=request_id)
                    continue

                user_id = SESSIONS[ws]["userId"]
                display_name = SESSIONS[ws]["displayName"]

                # If user already seated elsewhere, block for now (simpler v1)
                for s in table.seats:
                    if s.userId == user_id:
                        await send_error(ws, "ALREADY_SEATED", "You are already seated.", request_id=request_id)
                        break
                else:
                    seat = table.seats[seat_index]
                    if seat.userId is not None:
                        await send_error(ws, "SEAT_TAKEN", "That seat is already taken.", request_id=request_id)
                    else:
                        seat.userId = user_id
                        seat.displayName = display_name
                        seat.chips = 1500  # dev default; later load from DB
                        seat.isConnected = True
                        bump_event(table, "PLAYER_TOOK_SEAT", f"{display_name} took seat {seat_index}")
                        await broadcast_state(table_id)
                
                if table.dealerUserId is None:
                    table.dealerUserId = user_id
                    bump_event(table, "DEALER_ASSIGNED", f"{display_name} is dealer")


                continue

            # LEAVE_SEAT ----------------------------
            if msg_type == "LEAVE_SEAT":
                user_id = SESSIONS[ws]["userId"]
                display_name = SESSIONS[ws]["displayName"]

                removed = False
                for s in table.seats:
                    if s.userId == user_id:
                        s.userId = None
                        s.displayName = None
                        s.chips = 0
                        s.isConnected = False
                        s.isSittingOut = False
                        removed = True
                        break

                if not removed:
                    await send_error(ws, "NOT_SEATED", "You are not seated.", request_id=request_id)
                else:
                    bump_event(table, "PLAYER_LEFT_SEAT", f"{display_name} left their seat")
                    await broadcast_state(table_id)

                continue


            # START_HAND ----------------------------

            if msg_type == "START_HAND":
                user_id = SESSIONS[ws]["userId"]
                display_name = SESSIONS[ws]["displayName"]

                if table.dealerUserId != user_id:
                    await send_error(ws, "NOT_AUTHORIZED", "Only the dealer can start a hand.", request_id=request_id)
                    continue

                # Need at least 2 seated players
                seated = [s for s in table.seats if s.userId is not None]
                if len(seated) < 2:
                    await send_error(ws, "INVALID_STATE", "Need at least 2 players seated.", request_id=request_id)
                    continue

                table.status = "IN_HAND"
                table.handNumber += 1
                table.street = "PREFLOP"
                table.pot = 0
                table.currentBet = 0
                table.minRaiseTo = 0
                table.communityCards = []

                table.playersInHand = [s.seatIndex for s in seated]

                table.playerState = []
                for s in seated:
                    table.playerState.append({
                        "seatIndex": s.seatIndex,
                        "inHand": True,
                        "hasFolded": False,
                        "isAllIn": False,
                        "stack": s.chips,
                        "betThisStreet": 0,
                        "betThisHand": 0
                    })

                # ToDo: proper blinds - currently first player left of button
                table.actingSeatIndex = min(table.playersInHand)

                bump_event(table, "HAND_STARTED", f"Hand #{table.handNumber} started by {display_name}")
                await broadcast_state(table_id)

                continue

            # ACTION ----------------------------
            if msg_type == "ACTION":
                user_id = SESSIONS[ws]["userId"]
                display_name = SESSIONS[ws]["displayName"]

                if table.status != "IN_HAND":
                    await send_error(ws, "HAND_NOT_ACTIVE", "No hand is active.", request_id=request_id)
                    continue

                # find your seat
                my_seat = None
                for s in table.seats:
                    if s.userId == user_id:
                        my_seat = s.seatIndex
                        break
                if my_seat is None:
                    await send_error(ws, "NOT_SEATED", "You must be seated to act.", request_id=request_id)
                    continue

                if table.actingSeatIndex != my_seat:
                    await send_error(ws, "NOT_YOUR_TURN", "It is not your turn.", request_id=request_id)
                    continue

                ps = find_ps(table, my_seat)
                if not ps or ps.get("hasFolded") or (not ps.get("inHand")):
                    await send_error(ws, "INVALID_ACTION", "You cannot act right now.", request_id=request_id)
                    continue

                action = payload.get("action")
                amount = payload.get("amount", 0)

                to_call = max(0, int(table.currentBet) - int(ps["betThisStreet"]))

                if action == "FOLD":
                    ps["hasFolded"] = True
                    bump_event(table, "PLAYER_ACTION", f"{display_name} folded")

                elif action == "CHECK":
                    if to_call != 0:
                        await send_error(ws, "INVALID_ACTION", "Cannot check when facing a bet.", request_id=request_id)
                        continue
                    bump_event(table, "PLAYER_ACTION", f"{display_name} checked")

                elif action == "CALL":
                    pay = min(int(ps["stack"]), to_call)
                    ps["stack"] -= pay
                    ps["betThisStreet"] += pay
                    ps["betThisHand"] += pay
                    table.pot += pay
                    if ps["stack"] == 0:
                        ps["isAllIn"] = True
                    bump_event(table, "PLAYER_ACTION", f"{display_name} called {pay}")

                elif action in ("BET", "RAISE"):
                    if not isinstance(amount, int) or amount <= 0:
                        await send_error(ws, "INVALID_AMOUNT", "amount must be a positive integer.", request_id=request_id)
                        continue

                    # v1: amount = chips added in this action
                    add = min(int(amount), int(ps["stack"]))
                    ps["stack"] -= add
                    ps["betThisStreet"] += add
                    ps["betThisHand"] += add
                    table.pot += add

                    # update currentBet to highest betThisStreet
                    if ps["betThisStreet"] > table.currentBet:
                        table.currentBet = ps["betThisStreet"]

                    if ps["stack"] == 0:
                        ps["isAllIn"] = True

                    bump_event(table, "PLAYER_ACTION", f"{display_name} raised {add}")

                else:
                    await send_error(ws, "INVALID_ACTION", "Unknown action.", request_id=request_id)
                    continue

                # if only one active player remains, end hand and award pot
                actives = active_players(table)
                if len(actives) == 1:
                    winner = actives[0]
                    win_seat = winner["seatIndex"]

                    # return winnings to their seat chips: stack + pot
                    for s in table.seats:
                        if s.seatIndex == win_seat:
                            s.chips = int(winner["stack"]) + int(table.pot)
                            break

                    table.status = "LOBBY"
                    table.street = "NONE"
                    table.communityCards = []
                    table.currentBet = 0
                    table.minRaiseTo = 0
                    table.actingSeatIndex = None
                    table.playersInHand = []
                    table.playerState = []
                    table.pot = 0

                    bump_event(table, "HAND_ENDED", f"{display_name} wins (everyone folded)")
                    await broadcast_state(table_id)
                    continue

                # rotate turn
                table.actingSeatIndex = next_seat_in_hand(table, my_seat)
                table.version += 1
                await broadcast_state(table_id)
                continue

            # Anything else for now
            await send_error(ws, "NOT_IMPLEMENTED", f"{msg_type} not implemented yet.", request_id=request_id)

    except WebSocketDisconnect:
        # Cleanup: remove socket from any table subscription
        table_id = SESSIONS.get(ws, {}).get("tableId")
        if table_id and table_id in TABLE_SUBSCRIBERS:
            TABLE_SUBSCRIBERS[table_id].discard(ws)

            # mark their seat disconnected if seated
            user_id = SESSIONS.get(ws, {}).get("userId")
            table = TABLES.get(table_id)
            if table and user_id:
                for seat in table.seats:
                    if seat.userId == user_id:
                        seat.isConnected = False
                        bump_event(table, "PLAYER_DISCONNECTED", f"{seat.displayName} disconnected")
                        # broadcast disconnect
                        try:
                            await broadcast_state(table_id)
                        except Exception:
                            pass

    finally:
        SESSIONS.pop(ws, None)
