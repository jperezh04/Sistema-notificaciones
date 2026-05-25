const SERVER_URL = "ws://localhost:8080";

const channels = [
  "notas",
  "horarios",
  "examenes",
  "tareas",
  "eventos",
  "sistema",
  "general",
];

let subscriberSocket = null;
let currentSubscriberName = "Estudiante";

const subscriberChannels = document.getElementById("subscriberChannels");
const subscriberStatus = document.getElementById("subscriberStatus");
const notificationsContainer = document.getElementById("notifications");
const historyContainer = document.getElementById("history");

function renderChannels() {
  subscriberChannels.innerHTML = "";

  channels.forEach((channel) => {
    const item = document.createElement("label");
    item.className = "checkbox-item";

    item.innerHTML = `
      <input type="checkbox" value="${channel}" />
      <span>${channel}</span>
    `;

    subscriberChannels.appendChild(item);
  });
}

function getSelectedChannels() {
  return Array.from(
    document.querySelectorAll("#subscriberChannels input:checked")
  ).map((checkbox) => checkbox.value);
}

function sendJSON(socket, data) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
    return true;
  }

  return false;
}

function clearEmpty(container) {
  const empty = container.querySelector(".empty");
  if (empty) empty.remove();
}

function addNotification(notification) {
  clearEmpty(notificationsContainer);

  const item = document.createElement("div");
  item.className = "notification-card";

  item.innerHTML = `
    <strong>${notification.title}</strong>
    <p>${notification.message}</p>
    <div class="notification-meta">
      ID: ${notification.id} |
      Evento: ${notification.event} |
      Canal: ${notification.channel} |
      Emisor: ${notification.sender} |
      Fecha: ${notification.timestamp}
    </div>
  `;

  notificationsContainer.prepend(item);
}

function addHistory(notifications) {
  historyContainer.innerHTML = "";

  if (!notifications || notifications.length === 0) {
    historyContainer.innerHTML = `<p class="empty">No hay historial reciente para tus boletines.</p>`;
    return;
  }

  notifications.forEach((notification) => {
    const item = document.createElement("div");
    item.className = "history-item";

    item.innerHTML = `
      <strong>${notification.id}</strong> - ${notification.title}
      <div class="notification-meta">
        Canal: ${notification.channel} |
        Evento: ${notification.event} |
        Fecha: ${notification.timestamp}
      </div>
    `;

    historyContainer.appendChild(item);
  });
}

function connectSubscriber() {
  currentSubscriberName =
    document.getElementById("subscriberName").value.trim() || "Estudiante";

  const selectedChannels = getSelectedChannels();

  if (selectedChannels.length === 0) {
    alert("Selecciona al menos un boletín para suscribirte.");
    return;
  }

  if (subscriberSocket && subscriberSocket.readyState === WebSocket.OPEN) {
    alert("El suscriptor ya está conectado.");
    return;
  }

  subscriberStatus.textContent = "Intentando conectar...";

  try {
    subscriberSocket = new WebSocket(SERVER_URL);
  } catch (error) {
    subscriberStatus.textContent = "No se pudo crear la conexión WebSocket.";
    console.error(error);
    return;
  }

  subscriberSocket.addEventListener("open", () => {
    subscriberStatus.textContent = `Conectado como ${currentSubscriberName}`;

    sendJSON(subscriberSocket, {
      type: "subscribe",
      clientName: currentSubscriberName,
      channels: selectedChannels,
    });
  });

  subscriberSocket.addEventListener("message", (event) => {
    let data;

    try {
      data = JSON.parse(event.data);
    } catch {
      subscriberStatus.textContent = "El servidor envió un mensaje inválido.";
      return;
    }

    if (data.type === "info") {
      console.log("[INFO]", data.message);
      return;
    }

    if (data.type === "subscribed") {
      subscriberStatus.textContent =
        `${data.message} Boletines: ${data.channels.join(", ")}`;
      return;
    }

    if (data.type === "subscription_updated") {
      subscriberStatus.textContent =
        `Boletines actuales: ${data.channels.join(", ") || "Ninguno"}`;
      return;
    }

    if (data.type === "my_channels") {
      subscriberStatus.textContent =
        `Mis boletines: ${data.channels.join(", ") || "Ninguno"}`;
      return;
    }

    if (data.type === "history") {
      addHistory(data.notifications);
      return;
    }

    if (data.type === "notification") {
      addNotification(data);

      sendJSON(subscriberSocket, {
        type: "ack",
        notificationId: data.id,
        clientName: currentSubscriberName,
        timestamp: new Date().toISOString(),
      });

      return;
    }

    if (data.type === "error") {
      subscriberStatus.textContent = `Error: ${data.message}`;
    }
  });

  subscriberSocket.addEventListener("close", () => {
    subscriberStatus.textContent = "Conexión cerrada";
  });

  subscriberSocket.addEventListener("error", (error) => {
    subscriberStatus.textContent =
      "Error de conexión. Verifica que el servidor esté iniciado con npm start.";
    console.error("WebSocket error:", error);
  });
}

function addChannels() {
  const selectedChannels = getSelectedChannels();

  if (selectedChannels.length === 0) {
    alert("Selecciona boletines para agregar.");
    return;
  }

  const sent = sendJSON(subscriberSocket, {
    type: "subscribe_add",
    channels: selectedChannels,
  });

  if (!sent) {
    alert("Primero conecta el suscriptor.");
  }
}

function removeChannels() {
  const selectedChannels = getSelectedChannels();

  if (selectedChannels.length === 0) {
    alert("Selecciona boletines para eliminar.");
    return;
  }

  const sent = sendJSON(subscriberSocket, {
    type: "unsubscribe",
    channels: selectedChannels,
  });

  if (!sent) {
    alert("Primero conecta el suscriptor.");
  }
}

function requestMyChannels() {
  const sent = sendJSON(subscriberSocket, {
    type: "my_channels",
  });

  if (!sent) {
    alert("Primero conecta el suscriptor.");
  }
}

document.getElementById("connectSubscriberBtn").addEventListener("click", connectSubscriber);
document.getElementById("addChannelsBtn").addEventListener("click", addChannels);
document.getElementById("removeChannelsBtn").addEventListener("click", removeChannels);
document.getElementById("myChannelsBtn").addEventListener("click", requestMyChannels);

renderChannels();