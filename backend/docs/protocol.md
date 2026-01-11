[1 - Connection]: # 

[1.1 Message Format]: # 
{
  "type": "MESSAGE_TYPE",
  "requestId": "optional-client-generated-id",
  "payload": {}
}

[1.2 Server reply format]: # 
{
  "type": "STATE",
  "requestId": "echoes-client-requestId-if-applicable",
  "payload": {}
}

[1.3 Errors]: # 
{
  "type": "ERROR",
  "requestId": "same-as-request-if-available",
  "payload": {
    "code": "NOT_AUTHENTICATED",
    "message": "Human readable message",
    "details": {}
  }
}



[3 - Core Types]: # 

[3.1 Table State]: # 
{
  "tableId": "tbl_abc123",
  "name": "Friday Night Poker",
  "status": "LOBBY",
  "maxSeats": 6,
  "createdAt": "2026-01-11T15:00:00Z",

  "dealerUserId": "usr_1",
  "handNumber": 0,

  "seats": [
    {
      "seatIndex": 0,
      "userId": "usr_1",
      "displayName": "Charlie",
      "chips": 1500,
      "isConnected": true,
      "isSittingOut": false
    }
  ],

  "buttonSeatIndex": null,
  "smallBlindSeatIndex": null,
  "bigBlindSeatIndex": null,

  "street": "NONE",
  "communityCards": [],

  "pot": 0,
  "currentBet": 0,
  "minRaiseTo": 0,

  "actingSeatIndex": null,
  "actionClockMs": 0,

  "playersInHand": [],
  "playerState": [
    {
      "seatIndex": 0,
      "inHand": false,
      "hasFolded": false,
      "isAllIn": false,
      "stack": 1500,
      "betThisStreet": 0,
      "betThisHand": 0
    }
  ],

  "holeCards": {
    "0": ["AS", "KD"]
  },

  "lastEvent": {
    "eventId": "evt_001",
    "at": "2026-01-11T15:01:10Z",
    "type": "PLAYER_JOINED",
    "summary": "Charlie joined seat 0"
  },

  "version": 1
}

[4 - Client to Server messsages]: # 

[4.1 Auth]: # 
{
  "type": "AUTH",
  "requestId": "r1",
  "payload": { "token": "JWT_OR_SESSION_TOKEN" }
}

[4.2 Join Table]: # 
{
  "type": "JOIN_TABLE",
  "requestId": "r2",
  "payload": { "tableId": "tbl_abc123" }
}

[4.3 Leave Table]: # 
{
  "type": "LEAVE_TABLE",
  "requestId": "r3",
  "payload": { "tableId": "tbl_abc123" }
}

[4.4 Take Seat]: # 
{
  "type": "TAKE_SEAT",
  "requestId": "r4",
  "payload": { "tableId": "tbl_abc123", "seatIndex": 0 }
}

[4.5 Leave Seat]: # 
{
  "type": "LEAVE_SEAT",
  "requestId": "r5",
  "payload": { "tableId": "tbl_abc123" }
}

[4.6 Start Hand]: #
{
  "type": "START_HAND",
  "requestId": "r6",
  "payload": { "tableId": "tbl_abc123" }
}
 
[4.7 Action]: # 
{
  "type": "ACTION",
  "requestId": "r7",
  "payload": {
    "tableId": "tbl_abc123",
    "action": "RAISE",
    "amount": 120
  }
}

[4.8 Request Odds]: # 
{
  "type": "REQUEST_ODDS",
  "requestId": "r8",
  "payload": { "tableId": "tbl_abc123" }
}

[5 - Sever to Client Messages]: # 

[5.1 Auth Ok]: # 
{
  "type": "AUTH_OK",
  "requestId": "r1",
  "payload": { "userId": "usr_1", "displayName": "Charlie" }
}

[5.2 State]: # 
{
  "type": "STATE",
  "payload": { "table": { /* TableState */ } }
}

[5.3 Odds Update]: # 
{
  "type": "ODDS_UPDATE",
  "payload": {
    "tableId": "tbl_abc123",
    "street": "FLOP",
    "heroSeatIndex": 0,
    "winPct": 42.3,
    "tiePct": 3.1,
    "losePct": 54.6,
    "mostLikelyWinMethod": "TWO_PAIR",
    "topOutcomes": [
      { "hand": "PAIR", "pct": 18.0 },
      { "hand": "TWO_PAIR", "pct": 15.2 },
      { "hand": "STRAIGHT", "pct": 6.7 }
    ],
    "simulations": 2000
  }
}

[5.4 Event]: #
{
  "type": "EVENT",
  "payload": {
    "tableId": "tbl_abc123",
    "eventId": "evt_100",
    "type": "PLAYER_ACTION",
    "summary": "Seat 2 raised to 120"
  }
}

