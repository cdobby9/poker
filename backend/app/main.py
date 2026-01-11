from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

app = FastAPI()

# Dev CORS: allow local frontend dev server
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

html = """
<!DOCTYPE html>
<html>
    <head>
        <title>Chat</title>
    </head>
    <body>
        <h1>WebSocket Chat</h1>
        <form action="" onsubmit="sendMessage(event)">
            <input type="text" id="messageText" autocomplete="off"/>
            <button>Send</button>
        </form>
        <ul id='messages'>
        </ul>
        <script>
            var ws = new WebSocket("ws://localhost:8000/ws");
            ws.onmessage = function(event) {
                var messages = document.getElementById('messages')
                var message = document.createElement('li')
                var content = document.createTextNode(event.data)
                message.appendChild(content)
                messages.appendChild(message)
            };
            function sendMessage(event) {
                var input = document.getElementById("messageText")
                ws.send(input.value)
                input.value = ''
                event.preventDefault()
            }
        </script>
    </body>
</html>
"""

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/")
async def get():
    return HTMLResponse(html)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    while True:
        data = await websocket.receive_text()
        await websocket.send_text(f"Message text was: {data}")

# Simple in-memory table manager
class TableManager:
    def __init__(self):
        self.tables = {}

    def create_table(self, name, columns):
        if name in self.tables:
            raise ValueError(f"Table '{name}' already exists.")
        self.tables[name] = {
            "columns": list(columns),
            "rows": []
        }

    def drop_table(self, name):
        if name not in self.tables:
            raise KeyError(f"Table '{name}' does not exist.")
        del self.tables[name]

    def insert(self, table_name, row):
        table = self._get_table(table_name)
        missing = set(table["columns"]) - set(row.keys())
        if missing:
            raise ValueError(f"Missing columns: {missing}")
        table["rows"].append(row)

    def select_all(self, table_name):
        table = self._get_table(table_name)
        return list(table["rows"])

    def select_where(self, table_name, predicate):
        table = self._get_table(table_name)
        return [row for row in table["rows"] if predicate(row)]

    def delete_where(self, table_name, predicate):
        table = self._get_table(table_name)
        before = len(table["rows"])
        table["rows"] = [r for r in table["rows"] if not predicate(r)]
        return before - len(table["rows"])

    def _get_table(self, name):
        if name not in self.tables:
            raise KeyError(f"Table '{name}' does not exist.")
        return self.tables[name]

# API models
class Item(BaseModel):
    name: str
    price: float

@app.get("/users/{user_id}")
def read_user(user_id: str):
    return {"user_id": user_id}

@app.post("/items/")
def create_item(item: Item):
    return item
