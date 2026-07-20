const API = "http://localhost:8000";

function appendMessage(role, text, surse = []) {
  const log = document.getElementById("chat-log");

  const sourceLine = surse.length
    ? `<p class="surse">Surse: ${surse.map(s => s.titlu).join(", ")}</p>`
    : "";

  log.insertAdjacentHTML(
    "beforeend",
    `<div class="chat-msg ${role}">
       <p class="who">${role === "user" ? "Tu" : "Asistent"}</p>
       <p>${text}</p>
       ${sourceLine}
     </div>`
  );

  log.scrollTop = log.scrollHeight;
}

async function sendChat() {
  const input = document.getElementById("intrebare");
  const status = document.getElementById("chat-status");
  const intrebare = input.value.trim();

  if (!intrebare) {
    return;
  }

  appendMessage("user", intrebare);
  input.value = "";
  status.textContent = "Se gandeste...";

  try {
    const r = await fetch(`${API}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intrebare }),
    });

    if (!r.ok) {
      status.textContent = `Eroare (${r.status}).`;
      return;
    }

    const data = await r.json();
    appendMessage("assistant", data.raspuns, data.surse);
    status.textContent = "";
  } catch {
    status.textContent = "Asistentul nu raspunde.";
  }
}