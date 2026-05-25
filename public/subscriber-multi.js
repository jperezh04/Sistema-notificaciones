const SERVER_URL = "ws://localhost:8080";

const channels = [
    "notas", "horarios", "examenes", "tareas", "eventos", "sistema", "general",
];

const subscribers = new Map();
let subscriberIdCounter = 1;

const toggleFormBtn = document.getElementById("toggleFormBtn");
const addSubForm = document.getElementById("addSubscriberForm");
const newSubName = document.getElementById("newSubName");
const newSubChannels = document.getElementById("newSubChannels");
const addSubscriberBtn = document.getElementById("addSubscriberBtn");
const subscribersGrid = document.getElementById("subscribersGrid");
const subscriberCount = document.getElementById("subscriberCount");
const toastContainer = document.getElementById("toastContainer");

// ── Toast ─────────────────────────────────────────────────────
function showToast(title, message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<strong>${title}</strong><p>${message}</p>`;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// ── Channel checkboxes in new-sub form ────────────────────────
function renderFormChannels() {
    newSubChannels.innerHTML = "";
    channels.forEach((ch) => {
        const label = document.createElement("label");
        label.className = "checkbox-item";
        label.innerHTML = `<input type="checkbox" value="${ch}" /><span>${ch}</span>`;
        newSubChannels.appendChild(label);
    });
}

function getFormSelectedChannels() {
    return Array.from(newSubChannels.querySelectorAll("input:checked")).map(i => i.value);
}

// ── sendJSON ──────────────────────────────────────────────────
function sendJSON(socket, data) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
        return true;
    }
    return false;
}

function updateCount() {
    subscriberCount.textContent = subscribers.size;
}

// ── Build subscriber card ─────────────────────────────────────
function createSubscriberCard(id, name) {
    const card = document.createElement("div");
    card.className = "subscriber-card";
    card.id = `sub-card-${id}`;

    card.innerHTML = `
    <div class="subscriber-card-header">
      <div class="subscriber-card-name">
        <span class="status-dot" id="dot-${id}"></span>
        <span id="name-${id}">${name}</span>
      </div>
      <div class="subscriber-card-controls">
        <button class="ghost" title="Ver mis boletines" onclick="requestMyChannels(${id})">Ver boletines</button>
        <button class="ghost danger" title="Desconectar" onclick="disconnectSubscriber(${id})">Quitar</button>
      </div>
    </div>

    <div class="subscriber-card-body">
      <div style="font-size:12px; color:var(--text-muted); margin-bottom:10px;" id="status-${id}">Conectando...</div>

      <div class="subscriber-channels-tags" id="tags-${id}">
        <span class="channel-tag none">sin canales</span>
      </div>

      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px; align-items:center;">
        <select id="chSel-${id}" style="flex:1; min-width:110px; font-size:13px; padding:7px 10px;">
          ${channels.map(ch => `<option value="${ch}">${ch}</option>`).join("")}
        </select>
        <button class="outline" style="font-size:12px; padding:7px 12px;" onclick="addChannel(${id})">Agregar</button>
        <button class="danger" style="font-size:12px; padding:7px 12px;" onclick="removeChannel(${id})">Quitar</button>
      </div>

      <div style="font-size:11px; font-weight:600; color:var(--text-muted); letter-spacing:0.8px; text-transform:uppercase; margin-bottom:6px;">
        Notificaciones
        <span id="notif-count-${id}" style="color:var(--blue); margin-left:4px;">0</span>
      </div>
      <div class="sub-notifications" id="notifs-${id}">
        <div class="empty">Sin notificaciones aun.</div>
      </div>
    </div>
  `;

    return card;
}

// ── Update channel tags ───────────────────────────────────────
function updateChannelTags(id, chList) {
    const container = document.getElementById(`tags-${id}`);
    if (!container) return;
    if (!chList || chList.length === 0) {
        container.innerHTML = `<span class="channel-tag none">sin canales</span>`;
    } else {
        container.innerHTML = chList.map(ch => `<span class="channel-tag">${ch}</span>`).join("");
    }
}

// ── Status dot + text ─────────────────────────────────────────
function setStatus(id, text, dotClass = "") {
    const dot = document.getElementById(`dot-${id}`);
    const statusEl = document.getElementById(`status-${id}`);
    if (dot) {
        dot.className = "status-dot";
        if (dotClass) dot.classList.add(dotClass);
    }
    if (statusEl) statusEl.textContent = text;
    const card = document.getElementById(`sub-card-${id}`);
    if (card) card.classList.toggle("active", dotClass === "connected");
}

// ── Add notification to card ──────────────────────────────────
function addNotifToCard(id, notification) {
    const container = document.getElementById(`notifs-${id}`);
    if (!container) return;

    const empty = container.querySelector(".empty");
    if (empty) empty.remove();

    const item = document.createElement("div");
    item.className = "sub-notification-item";
    item.innerHTML = `
    <strong>${notification.title}</strong>
    <div style="font-size:12px; color:var(--text-muted); margin:3px 0;">${notification.message}</div>
    <div class="sub-meta">
      ${notification.id} &middot; ${notification.channel} &middot; ${notification.sender} &middot; ${new Date(notification.timestamp).toLocaleTimeString()}
    </div>
  `;
    container.prepend(item);

    const sub = subscribers.get(id);
    if (sub) {
        sub.notifications++;
        const countEl = document.getElementById(`notif-count-${id}`);
        if (countEl) countEl.textContent = sub.notifications;
    }
}

// ── Add subscriber ────────────────────────────────────────────
function addSubscriber() {
    const name = newSubName.value.trim() || `Estudiante ${subscriberIdCounter}`;
    const selectedChannels = getFormSelectedChannels();

    if (selectedChannels.length === 0) {
        showToast("Error", "Selecciona al menos un boletin.", "error");
        return;
    }

    const id = subscriberIdCounter++;

    subscribers.set(id, {
        id, name, socket: null, channels: [], notifications: 0,
    });

    const empty = document.getElementById("emptyState");
    if (empty) empty.remove();

    const card = createSubscriberCard(id, name);
    subscribersGrid.appendChild(card);
    updateCount();

    connectSubscriber(id, name, selectedChannels);

    // Reset form
    newSubName.value = "";
    newSubChannels.querySelectorAll("input:checked").forEach(i => i.checked = false);
    addSubForm.classList.add("hidden");
    toggleFormBtn.textContent = "+ Nuevo suscriptor";
}

// ── Connect subscriber WebSocket ──────────────────────────────
function connectSubscriber(id, name, initialChannels) {
    setStatus(id, "Conectando...", "connecting");

    let socket;
    try {
        socket = new WebSocket(SERVER_URL);
    } catch (e) {
        setStatus(id, "Error al crear WebSocket", "error");
        return;
    }

    const sub = subscribers.get(id);
    sub.socket = socket;

    socket.addEventListener("open", () => {
        setStatus(id, `Conectado como ${name}`, "connected");
        sendJSON(socket, {
            type: "subscribe",
            clientName: name,
            channels: initialChannels,
        });
    });

    socket.addEventListener("message", (event) => {
        let data;
        try { data = JSON.parse(event.data); } catch { return; }

        if (data.type === "info") return;

        if (data.type === "subscribed") {
            sub.channels = data.channels;
            updateChannelTags(id, data.channels);
            setStatus(id, `Suscrito a: ${data.channels.join(", ")}`, "connected");
            showToast(name, `Suscrito a: ${data.channels.join(", ")}`, "success");
            return;
        }

        if (data.type === "subscription_updated") {
            sub.channels = data.channels;
            updateChannelTags(id, data.channels);
            setStatus(id, `Boletines: ${data.channels.join(", ") || "ninguno"}`, "connected");
            return;
        }

        if (data.type === "my_channels") {
            showToast(`${name} — boletines`, data.channels.join(", ") || "ninguno", "info");
            return;
        }

        if (data.type === "history") {
            if (data.notifications && data.notifications.length > 0) {
                [...data.notifications].reverse().forEach(n => addNotifToCard(id, n));
            }
            return;
        }

        if (data.type === "notification") {
            addNotifToCard(id, data);
            // ACK
            sendJSON(socket, {
                type: "ack",
                notificationId: data.id,
                clientName: name,
                timestamp: new Date().toISOString(),
            });
            showToast(name, `${data.title} [${data.channel}]`, "info");
            return;
        }

        if (data.type === "error") {
            setStatus(id, `Error: ${data.message}`, "error");
        }
    });

    socket.addEventListener("close", () => {
        setStatus(id, "Desconectado", "error");
    });

    socket.addEventListener("error", () => {
        setStatus(id, "Error de conexion. Verifica que el servidor este activo.", "error");
        showToast("Error", `No se pudo conectar ${name} al servidor.`, "error");
    });
}

// ── Add channel ───────────────────────────────────────────────
function addChannel(id) {
    const sub = subscribers.get(id);
    if (!sub) return;
    const channel = document.getElementById(`chSel-${id}`).value;
    const sent = sendJSON(sub.socket, { type: "subscribe_add", channels: [channel] });
    if (!sent) showToast("Error", "El suscriptor no esta conectado.", "error");
}

// ── Remove channel ────────────────────────────────────────────
function removeChannel(id) {
    const sub = subscribers.get(id);
    if (!sub) return;
    const channel = document.getElementById(`chSel-${id}`).value;
    const sent = sendJSON(sub.socket, { type: "unsubscribe", channels: [channel] });
    if (!sent) showToast("Error", "El suscriptor no esta conectado.", "error");
}

// ── Request my channels ───────────────────────────────────────
function requestMyChannels(id) {
    const sub = subscribers.get(id);
    if (!sub) return;
    const sent = sendJSON(sub.socket, { type: "my_channels" });
    if (!sent) showToast("Error", "El suscriptor no esta conectado.", "error");
}

// ── Disconnect subscriber ─────────────────────────────────────
function disconnectSubscriber(id) {
    const sub = subscribers.get(id);
    if (!sub) return;

    if (sub.socket) sub.socket.close();
    subscribers.delete(id);

    const card = document.getElementById(`sub-card-${id}`);
    if (card) card.remove();

    updateCount();
    showToast("Suscriptor eliminado", `${sub.name} fue desconectado.`, "warning");

    if (subscribers.size === 0) {
        const emptyDiv = document.createElement("div");
        emptyDiv.id = "emptyState";
        emptyDiv.style.cssText = "grid-column:1/-1; text-align:center; padding:36px 0; color:var(--text-dim); font-size:13px; font-style:italic;";
        emptyDiv.textContent = "No hay suscriptores. Agrega uno con el boton de arriba.";
        subscribersGrid.appendChild(emptyDiv);
    }
}

// ── Toggle form ───────────────────────────────────────────────
toggleFormBtn.addEventListener("click", () => {
    const hidden = addSubForm.classList.contains("hidden");
    addSubForm.classList.toggle("hidden", !hidden);
    toggleFormBtn.textContent = hidden ? "Cancelar" : "+ Nuevo suscriptor";
});

addSubscriberBtn.addEventListener("click", addSubscriber);

renderFormChannels();