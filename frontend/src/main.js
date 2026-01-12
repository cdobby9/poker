import "./style.css";
import { connectWS, onWSMessage } from "./ws";
import { setState, subscribe, getState, addAction } from "./store";
import { renderApp } from "./render";

const root = document.querySelector("#app");

// Prompt for a name (temporary dev)
const displayName =
  localStorage.getItem("displayName") ||
  prompt("Display name?") ||
  "Player";

localStorage.setItem("displayName", displayName);

connectWS({ displayName });

onWSMessage((msg) => {
  setState({ lastMsg: msg });

  if (msg.type === "AUTH_OK") {
    setState({ me: msg.payload });
    addAction(`✓ Authenticated as ${msg.payload.displayName}`);
  }

  if (msg.type === "STATE") {
    setState({ table: msg.payload.table });
    if (msg.payload.table?.lastEvent?.summary) {
      addAction(msg.payload.table.lastEvent.summary);
    }
  }

  if (msg.type === "ERROR") {
    console.warn("[ERROR]", msg.payload);
    addAction(`✗ Error: ${msg.payload.message}`);
    alert(`${msg.payload.code}: ${msg.payload.message}`);
  }
});

subscribe((state) => {
  renderApp(root, state);
});

// initial render
renderApp(root, getState());
