const UPLOAD_API = "http://localhost:8000";

function updateSelectedFile(file) {
  const name = document.getElementById("selected-file-name");
  const meta = document.getElementById("selected-file-meta");

  if (!name || !meta) {
    return;
  }

  if (!file) {
    name.textContent = "Niciun fișier selectat";
    meta.textContent = "Alege un PDF, JPG sau PNG pentru digitizare.";
    return;
  }

  name.textContent = file.name;
  meta.textContent = `${Math.ceil(file.size / 1024)} KB · ${file.type || "fișier"}`;
}

function uploadBusy(isBusy) {
  const button = document.querySelector("button[onclick='upload()']");
  const chooser = document.querySelector(".file-trigger");

  if (button) {
    button.disabled = isBusy;
    button.textContent = isBusy ? "Se procesează..." : "Încarcă și digitizează";
  }

  if (chooser) {
    chooser.classList.toggle("disabled", isBusy);
    chooser.setAttribute("aria-disabled", String(isBusy));
  }
}

async function upload() {
  const input = document.getElementById("file");
  const msg = document.getElementById("upload-msg");

  if (!input || !msg) {
    return;
  }

  if (!input.files.length) {
    msg.textContent = "Alege un fișier.";
    return;
  }

  const file = input.files[0];
  const formData = new FormData();
  formData.append("file", file);

  msg.textContent = "Se încarcă și se digitizează...";
  uploadBusy(true);

  if (typeof setWorkflowProgress === "function") {
    setWorkflowProgress("uploading");
  }

  try {
    const response = await fetch(`${UPLOAD_API}/documente/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();

    msg.textContent = `Document ${String(data.document_id).padStart(3, "0")} încărcat și digitizat.`;
    updateSelectedFile(null);
    input.value = "";
    loadDocs();

    if (typeof setWorkflowProgress === "function") {
      setWorkflowProgress("review");
    }

    if (typeof showDetail === "function") {
      await showDetail(data.document_id);
    }
  } catch {
    msg.textContent = "Încărcarea a eșuat.";
    if (typeof setWorkflowProgress === "function") {
      setWorkflowProgress("idle");
    }
  } finally {
    uploadBusy(false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("file");

  if (!input) {
    return;
  }

  if (typeof setWorkflowProgress === "function") {
    setWorkflowProgress("idle");
  }

  updateSelectedFile(null);
  input.addEventListener("change", () => {
    updateSelectedFile(input.files[0] ?? null);
  });
});
