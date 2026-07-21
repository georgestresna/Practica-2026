const API = "http://localhost:8000";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

function appendMessage(role, text, surse = []) {
  const log = document.getElementById("chat-log");

  const sourceLine = surse.length
    ? `<p class="surse">Surse: ${surse.map((s) => escapeHtml(s.titlu)).join(", ")}</p>`
    : "";

  log.insertAdjacentHTML(
    "beforeend",
    `<div class="bubble ${role}">
       <p class="who">${role === "user" ? "Tu" : "Asistent"}</p>
       <p class="msg-text">${escapeHtml(text)}</p>
       ${sourceLine}
     </div>`
  );

  log.scrollTop = log.scrollHeight;
}

function setComposerDisabled(disabled) {
  const input = document.getElementById("intrebare");
  const button = document.getElementById("send-chat-btn");

  if (input) {
    input.disabled = disabled;
  }

  if (button) {
    button.disabled = disabled;
  }
}
function showTypingIndicator() {
  const log = document.getElementById("chat-log");
  
  log.insertAdjacentHTML(
    "beforeend",
    `<div class="bubble assistant" id="typing-bubble">
       <p class="who">Asistent</p>
       <div class="typing-indicator">
         <span></span><span></span><span></span>
       </div>
     </div>`
  );
  
  log.scrollTop = log.scrollHeight;
}

function removeTypingIndicator() {
  const typingBubble = document.getElementById("typing-bubble");
  if (typingBubble) {
    typingBubble.remove();
  }
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
  
  // Aici curatam statusul vechi
  status.textContent = ""; 
  showTypingIndicator();
  
  setComposerDisabled(true);

  try {
    const r = await fetch(`${API}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intrebare }),
    });

    // ștergem casuta cu puncte
    removeTypingIndicator();

    if (!r.ok) {
      status.textContent = `Eroare (${r.status}).`;
      setComposerDisabled(false);
      return;
    }

    const data = await r.json();
    appendMessage("assistant", data.raspuns, data.surse);
  } catch {
    removeTypingIndicator(); 
    status.textContent = "Asistentul nu răspunde.";
  } finally {
    setComposerDisabled(false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("intrebare");
  const button = document.getElementById("send-chat-btn");
  const presets = document.querySelectorAll(".preset-chip");

  if (input) {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendChat();
      }
    });
  }

  if (button) {
    button.addEventListener("click", sendChat);
  }

  presets.forEach((chip) => {
    chip.addEventListener("click", () => {
      if (input) {
        input.value = chip.dataset.prompt || "";
        input.focus();
      }
    });
  });

  appendMessage(
    "assistant",
    "Bun venit. Pune o întrebare despre documentele digitizate și voi răspunde pe baza arhivei disponibile."
  );
});