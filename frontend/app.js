const API = "http://localhost:8000";

async function checkServices() {
  try {
    const h = await (await fetch(`${API}/health`)).json();
    document.getElementById("s-db").className = h.database === "ok" ? "ok" : "down";
  } catch {
    document.getElementById("s-db").className = "down";
  }

  try {
    const o = await (await fetch(`${API}/ocr-test`)).json();
    document.getElementById("s-ocr").className = o.ocr_response ? "ok" : "down";
  } catch {
    document.getElementById("s-ocr").className = "down";
  }
}

async function loadDocs() {
  const tb = document.getElementById("docs");

  if (!tb) {
    return;
  }

  try {
    const docs = await (await fetch(`${API}/documente`)).json();
    if (!docs.length) {
      tb.innerHTML = `<tr><td colspan="5" class="msg">Niciun document. Incarca primul scan mai sus.</td></tr>`;
      return;
    }

    tb.innerHTML = docs
      .map(
        d => `
      <tr>
        <td class="id" data-clickable onclick="showDetail(${d.id})">${String(d.id).padStart(3, "0")}</td>
        <td data-clickable onclick="showDetail(${d.id})">${d.titlu}</td>
        <td><span class="stamp ${d.status}">${d.status}</span></td>
        <td class="mono">${d.created_at.slice(0, 10)}</td>
        <td><button class="ghost" onclick="deleteDoc(${d.id}, '${d.titlu.replace(/'/g, "\\'")}')">Sterge</button></td>
      </tr>`,
      )
      .join("");
  } catch {
    tb.innerHTML = `<tr><td colspan="5" class="msg">Backendul nu raspunde.</td></tr>`;
  }
}

async function showDetail(id) {
  const sec = document.getElementById("detail-section");
  const out = document.getElementById("detail");

  if (!sec || !out) {
    return;
  }

  sec.hidden = false;
  out.innerHTML = `<p class="msg">Se incarca...</p>`;

  try {
    const doc = await (await fetch(`${API}/documente/${id}`)).json();
    const text = doc.text.length ? doc.text[0].continut : "";
    const motor = doc.text.length ? doc.text[0].motor_ocr : "-";
    const ents = doc.entitati
      .map(e => `<li><span class="tip">${e.tip}</span><span>${e.valoare}</span></li>`)
      .join("");

    out.innerHTML = `
      <div class="detail-head">
        <span class="num">${String(doc.id).padStart(3, "0")}</span>
        <span class="titlu">${doc.titlu}</span>
        <span class="stamp ${doc.status}" id="st">${doc.status}</span>
        <button class="close" onclick="closeDetail()" title="Inchide">×</button>
      </div>

      <div class="actions">
        <button onclick="setStatus(${id}, 'reviewed')">Marcheaza verificat</button>
        <button onclick="setStatus(${id}, 'validated')">Valideaza</button>
        <button onclick="setStatus(${id}, 'raw')">Reia verificarea</button>
      </div>

      <p class="label">Transcriere — motor: ${motor}</p>
      <textarea id="txt" rows="7">${text}</textarea>
      <p><button onclick="saveText(${id})">Salveaza transcrierea</button>
         <span class="msg" id="save-msg"></span></p>

      <p class="label">Entitati identificate</p>
      <ul class="ent-list">${ents || '<li class="msg">Nicio entitate.</li>'}</ul>
    `;

    sec.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {
    out.innerHTML = `<p class="msg">Documentul nu a putut fi incarcat.</p>`;
  }
}

async function setStatus(id, status) {
  try {
    const r = await fetch(`${API}/documente/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const d = await r.json();
    const el = document.getElementById("st");

    if (!el) {
      loadDocs();
      return;
    }

    el.textContent = d.status;
    el.className = `stamp ${d.status}`;
    loadDocs();
  } catch {
    alert("Statusul nu a putut fi schimbat.");
  }
}

function closeDetail() {
  const section = document.getElementById("detail-section");

  if (section) {
    section.hidden = true;
  }
}

async function saveText(id) {
  const msg = document.getElementById("save-msg");
  msg.textContent = "Se salveaza...";

  try {
    await fetch(`${API}/documente/${id}/text`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ continut: document.getElementById("txt").value }),
    });
    msg.textContent = "Transcriere salvata.";
  } catch {
    msg.textContent = "Salvarea a esuat.";
  }
}

async function deleteDoc(id, titlu) {
  if (!confirm(`Stergi documentul ${String(id).padStart(3, "0")} — ${titlu}?`)) return;

  try {
    const r = await fetch(`${API}/documente/${id}`, { method: "DELETE" });
    if (!r.ok) {
      alert(`Stergerea a esuat (${r.status}).`);
      return;
    }

    document.getElementById("detail-section").hidden = true;
    loadDocs();
  } catch {
    alert("Stergerea a esuat.");
  }
}

checkServices();
loadDocs();