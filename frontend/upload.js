const UPLOAD_API = "http://localhost:8000";

async function upload() {
  const input = document.getElementById("file");
  const msg = document.getElementById("upload-msg");

  if (!input.files.length) {
    msg.textContent = "Alege un fisier.";
    return;
  }

  msg.textContent = "Se incarca si se digitizeaza...";
  const fd = new FormData();
  fd.append("file", input.files[0]);

  try {
    const r = await fetch(`${UPLOAD_API}/documente/upload`, { method: "POST", body: fd });
    const d = await r.json();
    msg.textContent = `Document ${String(d.document_id).padStart(3, "0")} adaugat.`;
    input.value = "";
    loadDocs();
  } catch {
    msg.textContent = "Incarcarea a esuat.";
  }
}
