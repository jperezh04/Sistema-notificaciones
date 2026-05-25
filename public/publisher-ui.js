const SERVER_URL = "ws://localhost:8080";

const eventCatalog = {
  notas: [
    {
      key: "nueva_nota",
      label: "Nueva nota publicada",
      defaultMessage: "Ya está disponible la nota de Sistemas Distribuidos.",
    },
    {
      key: "correccion_nota",
      label: "Corrección de nota",
      defaultMessage: "Se corrigió una nota registrada anteriormente.",
    },
    {
      key: "promedio_actualizado",
      label: "Promedio actualizado",
      defaultMessage: "El promedio del curso ha sido actualizado.",
    },
  ],

  horarios: [
    {
      key: "cambio_horario",
      label: "Cambio de horario",
      defaultMessage: "La clase fue cambiada para otro horario.",
    },
    {
      key: "clase_cancelada",
      label: "Clase cancelada",
      defaultMessage: "La clase programada ha sido cancelada.",
    },
    {
      key: "aula_cambiada",
      label: "Cambio de aula",
      defaultMessage: "La clase se realizará en una nueva aula.",
    },
  ],

  examenes: [
    {
      key: "recordatorio_examen",
      label: "Recordatorio de examen",
      defaultMessage: "Recuerden que el examen está próximo.",
    },
    {
      key: "examen_programado",
      label: "Examen programado",
      defaultMessage: "Se ha programado un nuevo examen.",
    },
    {
      key: "examen_reprogramado",
      label: "Examen reprogramado",
      defaultMessage: "El examen ha sido reprogramado.",
    },
  ],

  tareas: [
    {
      key: "nueva_tarea",
      label: "Nueva tarea asignada",
      defaultMessage: "Se ha publicado una nueva tarea.",
    },
    {
      key: "fecha_entrega_cercana",
      label: "Fecha de entrega cercana",
      defaultMessage: "La fecha de entrega de la tarea está próxima.",
    },
    {
      key: "tarea_actualizada",
      label: "Tarea actualizada",
      defaultMessage: "Se actualizaron las indicaciones de una tarea.",
    },
  ],

  eventos: [
    {
      key: "charla_programada",
      label: "Charla programada",
      defaultMessage: "Se ha programado una charla académica.",
    },
    {
      key: "taller_disponible",
      label: "Taller disponible",
      defaultMessage: "Hay un taller disponible para inscripción.",
    },
    {
      key: "inscripcion_abierta",
      label: "Inscripción abierta",
      defaultMessage: "Se abrió la inscripción para un evento universitario.",
    },
  ],

  sistema: [
    {
      key: "mantenimiento_plataforma",
      label: "Mantenimiento de plataforma",
      defaultMessage: "La plataforma estará en mantenimiento.",
    },
    {
      key: "caida_servicio",
      label: "Caída de servicio",
      defaultMessage: "Se ha detectado una caída temporal del servicio.",
    },
    {
      key: "servicio_restaurado",
      label: "Servicio restaurado",
      defaultMessage: "El servicio ha sido restaurado correctamente.",
    },
  ],

  general: [
    {
      key: "aviso_general",
      label: "Aviso general",
      defaultMessage: "Se comunica un aviso general para todos los estudiantes.",
    },
  ],
};

let publisherSocket = null;

const publisherStatus = document.getElementById("publisherStatus");
const channelSelect = document.getElementById("channelSelect");
const eventSelect = document.getElementById("eventSelect");
const eventTitle = document.getElementById("eventTitle");
const eventMessage = document.getElementById("eventMessage");

function renderChannels() {
  const channels = Object.keys(eventCatalog);

  channelSelect.innerHTML = "";

  channels.forEach((channel) => {
    const option = document.createElement("option");
    option.value = channel;
    option.textContent = channel;
    channelSelect.appendChild(option);
  });

  renderEventsByChannel();
}

function renderEventsByChannel() {
  const selectedChannel = channelSelect.value;
  const events = eventCatalog[selectedChannel] || [];

  eventSelect.innerHTML = "";

  events.forEach((event) => {
    const option = document.createElement("option");
    option.value = event.key;
    option.textContent = event.label;
    eventSelect.appendChild(option);
  });

  updateEventFields();
}

function getSelectedEvent() {
  const selectedChannel = channelSelect.value;
  const events = eventCatalog[selectedChannel] || [];

  return events.find((event) => event.key === eventSelect.value);
}

function updateEventFields() {
  const selectedEvent = getSelectedEvent();

  if (!selectedEvent) return;

  eventTitle.value = selectedEvent.label;
  eventMessage.value = selectedEvent.defaultMessage;
}

function sendJSON(socket, data) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
    return true;
  }

  return false;
}

const toastContainer = document.getElementById("toastContainer");

function showToast(title, message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  toast.innerHTML = `
    <strong>${title}</strong>
    <p>${message}</p>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function connectPublisher() {
  if (publisherSocket && publisherSocket.readyState === WebSocket.OPEN) {
    alert("El publicador ya está conectado.");
    return;
  }

  publisherSocket = new WebSocket(SERVER_URL);

  publisherSocket.addEventListener("open", () => {
    publisherStatus.textContent = "Publicador conectado";
    showToast("Conexión exitosa", "Publicador conectado al servidor WebSocket.", "success");
  });

  publisherSocket.addEventListener("message", (event) => {
    let data;

    try {
      data = JSON.parse(event.data);
    } catch {
      showToast("Error", "Se recibió un mensaje inválido del servidor.", "error");
      return;
    }

    if (data.type === "info") {
      showToast("Información", data.message, "info");
      return;
    }

    if (data.type === "published") {
      showToast("Evento publicado", `Publicado ${data.notification.id}. Entregado a ${data.deliveredTo} suscriptor(es).`, "success");
      return;
    }

    if (data.type === "error") {
      showToast("Error", `Error: ${data.message}`, "error");
    }
  });

  publisherSocket.addEventListener("close", () => {
    publisherStatus.textContent = "Conexión cerrada";
    showToast("Conexión cerrada", "Publicador desconectado del servidor WebSocket.", "info");
  });

  publisherSocket.addEventListener("error", () => {
    publisherStatus.textContent = "Error de conexión";
    showToast("Error", "No se pudo conectar. Verifica que el servidor esté activo con npm start.", "error");
  });
}

function publishEvent() {
  const selectedChannel = channelSelect.value;
  const selectedEvent = getSelectedEvent();

  if (!selectedEvent) {
    alert("Selecciona un evento válido.");
    return;
  }

  const sender = document.getElementById("publisherName").value.trim() || "Docente";
  const title = eventTitle.value.trim() || selectedEvent.label;
  const message = eventMessage.value.trim() || selectedEvent.defaultMessage;

  const payload = {
    type: "publish",
    event: selectedEvent.key,
    channel: selectedChannel,
    title,
    message,
    sender,
    timestamp: new Date().toISOString(),
  };

  const sent = sendJSON(publisherSocket, payload);

  if (!sent) {
    alert("Primero conecta el publicador.");
    return;
  }

  showToast("Evento enviado", `Evento enviado: ${selectedEvent.label} → canal ${selectedChannel}`, "info");
}

document.getElementById("connectPublisherBtn").addEventListener("click", connectPublisher);
document.getElementById("publishBtn").addEventListener("click", publishEvent);

channelSelect.addEventListener("change", renderEventsByChannel);
eventSelect.addEventListener("change", updateEventFields);

renderChannels();