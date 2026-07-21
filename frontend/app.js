const API = "http://localhost:8000";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]'/g, (character) => {
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

function statusLabel(status) {
  if (status === "validated") {
    return "Validat";
  }

  if (status === "reviewed") {
    return "Verificat";
  }

  return "Nevalidat";
}

function formatDate(iso) {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return iso.slice(0, 10);
  }

  return date.toLocaleDateString("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function setWorkflowProgress(stage) {
  const chip = document.getElementById("workflow-chip");
  const steps = [
    document.getElementById("step-upload"),
    document.getElementById("step-ocr"),
    document.getElementById("step-entities"),
    document.getElementById("step-review"),
    document.getElementById("step-publish"),
  ];

  if (!steps.some(Boolean)) {
    return;
  }

  const stageMap = {
    idle: 0,
    uploading: 1,
    processing: 3,
    review: 4,
    published: 5,
  };

  const activeCount = stageMap[stage] ?? 0;

  steps.forEach((step, index) => {
    if (!step) {
      return;
    }

    step.classList.remove("active", "muted");

    if (index < activeCount) {
      step.classList.add("done");
    }

    if (index + 1 === activeCount && stage !== "idle") {
      step.classList.add("active");
    } else if (index + 1 > activeCount) {
      step.classList.add("muted");
    }
  });

  if (chip) {
    const labels = {
      idle: "Așteaptă încărcarea",
      uploading: "Se încarcă",
      processing: "OCR în curs",
      review: "Validare umană",
      published: "Publicat",
    };

    chip.textContent = labels[stage] ?? labels.idle;
  }
}

async function checkServices() {
  const db = document.getElementById("s-db");
  const ocr = document.getElementById("s-ocr");

  try {
    const h = await (await fetch(`${API}/health`)).json();
    if (db) {
      db.className = h.database === "ok" ? "ok" : "down";
    }
  } catch {
    if (db) {
      db.className = "down";
    }
  }

  try {
    const response = await (await fetch(`${API}/ocr-test`)).json();
    if (ocr) {
      ocr.className = response.ocr_response ? "ok" : "down";
    }
  } catch {
    if (ocr) {
      ocr.className = "down";
    }
  }
}

async function loadDocs() {
  const tbody = document.getElementById("docs");

  if (!tbody) {
    return;
  }

  try {
    const docs = await (await fetch(`${API}/documente`)).json();

    if (!docs.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="msg">Niciun document încă. Încarcă primul scan de mai sus.</td></tr>`;
      return;
    }

    tbody.innerHTML = docs
      .map(
        (doc) => `
          <tr>
            <td class="id" data-clickable onclick='showDetail(${doc.id})'>${String(doc.id).padStart(3, "0")}</td>
            <td data-clickable onclick='showDetail(${doc.id})'>${escapeHtml(doc.titlu)}</td>
            <td><span class="stamp ${doc.status}">${statusLabel(doc.status)}</span></td>
            <td>${escapeHtml(formatDate(doc.created_at))}</td>
            <td><button class="ghost" onclick='deleteDoc(${doc.id}, ${JSON.stringify(doc.titlu)})'>Șterge</button></td>
          </tr>`,
      )
      .join("");
  } catch {
    tbody.innerHTML = `<tr><td colspan="5" class="msg">Backendul nu răspunde.</td></tr>`;
  }
}

async function showDetail(id) {
  const section = document.getElementById("detail-section");
  const out = document.getElementById("detail");

  if (!section || !out) {
    return;
  }

  section.hidden = false;
  out.innerHTML = `<div class="validation-panel"><p class="msg">Se încarcă documentul...</p></div>`;

  try {
    const doc = await (await fetch(`${API}/documente/${id}`)).json();
    const text = doc.text.length ? doc.text[0].continut : "";
    const motor = doc.text.length ? doc.text[0].motor_ocr : "-";
    const entities = doc.entitati
      .map(
        (entity, index) => `
          <div class="entity-row">
            <div class="entity-top">
              <span class="entity-type">${escapeHtml(entity.tip)}</span>
              <strong>${escapeHtml(entity.valoare)}</strong>
            </div>
            <div class="entity-meter" style="--meter:${Math.max(62, 92 - index * 4)}%"></div>
          </div>`,
      )
      .join("");

    out.innerHTML = `
      <div class="validation-panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">Validare umană</p>
            <h3>Verifică transcrierea și entitățile extrase înainte de publicare.</h3>
            <p class="panel-subtitle">Document ${String(doc.id).padStart(3, "0")} · ${escapeHtml(doc.titlu)}</p>
          </div>
          <div class="section-head-meta">
            <span class="stamp ${doc.status}" id="st">${statusLabel(doc.status)}</span>
          </div>
        </div>

        <div class="validation-grid">
          <div class="validation-card">
            <p class="panel-label">Text OCR / HTR</p>
            <textarea id="txt" rows="12">${escapeHtml(text)}</textarea>
            <div class="panel-actions">
              <button class="btn btn-primary" type="button" onclick="saveText(${id})">Salvează transcrierea</button>
              <span class="msg" id="save-msg"></span>
            </div>
          </div>

          <div class="entities-card">
            <p class="panel-label">Entități detectate</p>
            <div class="entity-stack">
              ${entities || '<p class="msg">Nicio entitate detectată.</p>'}
            </div>
          </div>
        </div>

        <div class="panel-actions split">
          <div class="panel-actions">
            <button class="btn btn-secondary" type="button" onclick="setStatus(${id}, 'reviewed')">Marchează verificat</button>
            <button class="btn btn-primary" type="button" onclick="setStatus(${id}, 'validated')">Validează</button>
          </div>
          <button class="close" type="button" onclick="closeDetail()" title="Închide">Închide</button>
        </div>
      </div>
    `;

    if (typeof setWorkflowProgress === "function") {
      setWorkflowProgress(doc.status === "validated" ? "published" : "review");
    }

    section.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {
    out.innerHTML = `<div class="validation-panel"><p class="msg">Documentul nu a putut fi încărcat.</p></div>`;
  }
}

async function setStatus(id, status) {
  try {
    const response = await fetch(`${API}/documente/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    const badge = document.getElementById("st");

    if (badge) {
      badge.textContent = statusLabel(data.status);
      badge.className = `stamp ${data.status}`;
    }

    if (typeof setWorkflowProgress === "function") {
      setWorkflowProgress(data.status === "validated" ? "published" : "review");
    }

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

  if (typeof setWorkflowProgress === "function") {
    setWorkflowProgress("idle");
  }
}

async function saveText(id) {
  const msg = document.getElementById("save-msg");

  if (!msg) {
    return;
  }

  msg.textContent = "Se salvează...";

  try {
    await fetch(`${API}/documente/${id}/text`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ continut: document.getElementById("txt").value }),
    });
    msg.textContent = "Transcriere salvată.";
  } catch {
    msg.textContent = "Salvarea a eșuat.";
  }
}

async function deleteDoc(id, titlu) {
  if (!confirm(`Ștergi documentul ${String(id).padStart(3, "0")} — ${titlu}?`)) {
    return;
  }

  try {
    const response = await fetch(`${API}/documente/${id}`, { method: "DELETE" });

    if (!response.ok) {
      alert(`Ștergerea a eșuat (${response.status}).`);
      return;
    }

    const section = document.getElementById("detail-section");

    if (section) {
      section.hidden = true;
    }

    loadDocs();
  } catch {
    alert("Ștergerea a eșuat.");
  }
}

checkServices();
loadDocs();
