const WebSocket = require("ws");

const PORT = 8080;
const HISTORY_LIMIT = 5;

const allowedChannels = [
  "notas",
  "horarios",
  "examenes",
  "tareas",
  "eventos",
  "sistema",
  "general",
];

const eventCatalog = {
  nueva_nota: {
    channel: "notas",
    defaultTitle: "Nueva nota publicada",
  },
  correccion_nota: {
    channel: "notas",
    defaultTitle: "Corrección de nota",
  },
  promedio_actualizado: {
    channel: "notas",
    defaultTitle: "Promedio actualizado",
  },

  cambio_horario: {
    channel: "horarios",
    defaultTitle: "Cambio de horario",
  },
  clase_cancelada: {
    channel: "horarios",
    defaultTitle: "Clase cancelada",
  },
  aula_cambiada: {
    channel: "horarios",
    defaultTitle: "Cambio de aula",
  },

  recordatorio_examen: {
    channel: "examenes",
    defaultTitle: "Recordatorio de examen",
  },
  examen_programado: {
    channel: "examenes",
    defaultTitle: "Examen programado",
  },
  examen_reprogramado: {
    channel: "examenes",
    defaultTitle: "Examen reprogramado",
  },

  nueva_tarea: {
    channel: "tareas",
    defaultTitle: "Nueva tarea asignada",
  },
  fecha_entrega_cercana: {
    channel: "tareas",
    defaultTitle: "Fecha de entrega cercana",
  },
  tarea_actualizada: {
    channel: "tareas",
    defaultTitle: "Tarea actualizada",
  },

  charla_programada: {
    channel: "eventos",
    defaultTitle: "Charla programada",
  },
  taller_disponible: {
    channel: "eventos",
    defaultTitle: "Taller disponible",
  },
  inscripcion_abierta: {
    channel: "eventos",
    defaultTitle: "Inscripción abierta",
  },

  mantenimiento_plataforma: {
    channel: "sistema",
    defaultTitle: "Mantenimiento de plataforma",
  },
  caida_servicio: {
    channel: "sistema",
    defaultTitle: "Caída de servicio",
  },
  servicio_restaurado: {
    channel: "sistema",
    defaultTitle: "Servicio restaurado",
  },

  aviso_general: {
    channel: "general",
    defaultTitle: "Aviso general",
  },
};

const wss = new WebSocket.Server({ port: PORT });

const clients = new Map();
const notificationHistory = new Map();
const ackRegistry = new Map();

const stats = {
  totalConnections: 0,
  totalPublished: 0,
  totalDelivered: 0,
  totalAcks: 0,
};

let notificationCounter = 1;

for (const channel of allowedChannels) {
  notificationHistory.set(channel, []);
}

function generateClientId() {
  return `CLIENT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function generateNotificationId() {
  const id = String(notificationCounter).padStart(4, "0");
  notificationCounter++;
  return `NOTIF-${id}`;
}

function sendJSON(socket, data) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
  }
}

function parseMessage(rawMessage) {
  try {
    return JSON.parse(rawMessage.toString());
  } catch {
    return null;
  }
}

function validateChannels(channels) {
  if (!Array.isArray(channels)) return [];

  return channels
    .map((channel) => String(channel).trim().toLowerCase())
    .filter((channel) => allowedChannels.includes(channel));
}

function getClientCountByRole(role) {
  let count = 0;

  for (const clientData of clients.values()) {
    if (clientData.role === role) {
      count++;
    }
  }

  return count;
}

function saveNotificationToHistory(notification) {
  const channelHistory = notificationHistory.get(notification.channel);

  if (!channelHistory) return;

  channelHistory.push(notification);

  if (channelHistory.length > HISTORY_LIMIT) {
    channelHistory.shift();
  }
}

function getHistoryForChannels(channels) {
  const result = [];
  const addedIds = new Set();

  for (const channel of channels) {
    const channelHistory = notificationHistory.get(channel) || [];

    for (const notification of channelHistory) {
      if (!addedIds.has(notification.id)) {
        result.push(notification);
        addedIds.add(notification.id);
      }
    }
  }

  return result;
}

function shouldReceiveNotification(clientData, notification) {
  if (clientData.role !== "subscriber") return false;

  const subscribedToSpecificChannel = clientData.channels.includes(notification.channel);
  const subscribedToGeneral = clientData.channels.includes("general");
  const notificationIsGeneral = notification.channel === "general";

  return subscribedToSpecificChannel || subscribedToGeneral || notificationIsGeneral;
}

function broadcastNotification(notification) {
  let deliveredCount = 0;

  for (const [socket, clientData] of clients.entries()) {
    if (shouldReceiveNotification(clientData, notification)) {
      sendJSON(socket, notification);
      deliveredCount++;

      console.log(
        `[DELIVERY] ${notification.id} enviado a ${clientData.name} (${clientData.channels.join(", ")})`
      );
    }
  }

  stats.totalDelivered += deliveredCount;
  return deliveredCount;
}

function printStats() {
  console.log("--------------- ESTADO DEL SERVIDOR ---------------");
  console.log(`Suscriptores conectados : ${getClientCountByRole("subscriber")}`);
  console.log(`Publicadores conectados : ${getClientCountByRole("publisher")}`);
  console.log(`Conexiones totales      : ${stats.totalConnections}`);
  console.log(`Notificaciones enviadas : ${stats.totalPublished}`);
  console.log(`Entregas realizadas     : ${stats.totalDelivered}`);
  console.log(`ACK recibidos           : ${stats.totalAcks}`);
  console.log("----------------------------------------------------");
}

function handleSubscribe(socket, clientId, message) {
  const clientName = message.clientName || "Estudiante";
  const channels = validateChannels(message.channels);

  if (channels.length === 0) {
    sendJSON(socket, {
      type: "error",
      message: "No se enviaron canales válidos para la suscripción.",
    });
    return;
  }

  clients.set(socket, {
    id: clientId,
    role: "subscriber",
    name: clientName,
    channels,
  });

  console.log(`[SUBSCRIBE] ${clientName} se suscribió a: ${channels.join(", ")}`);

  sendJSON(socket, {
    type: "subscribed",
    message: `Suscripción correcta para ${clientName}.`,
    channels,
  });

  const history = getHistoryForChannels(channels);

  sendJSON(socket, {
    type: "history",
    message: "Historial reciente de los canales suscritos.",
    total: history.length,
    notifications: history,
  });

  printStats();
}

function handlePublish(socket, clientId, message) {
  const { event, title, message: content, sender } = message;

  if (!eventCatalog[event]) {
    sendJSON(socket, {
      type: "error",
      message: "Evento no reconocido.",
    });
    return;
  }

  const expectedChannel = eventCatalog[event].channel;
  const receivedChannel = message.channel;

  if (receivedChannel && receivedChannel !== expectedChannel) {
    sendJSON(socket, {
      type: "error",
      message: `El evento "${event}" debe publicarse en el canal "${expectedChannel}".`,
    });
    return;
  }

  if (!content || !content.trim()) {
    sendJSON(socket, {
      type: "error",
      message: "El mensaje de la notificación no puede estar vacío.",
    });
    return;
  }

  const publisherName = sender && sender.trim() ? sender.trim() : "Docente";

  clients.set(socket, {
    id: clientId,
    role: "publisher",
    name: publisherName,
    channels: [],
  });

  const notification = {
    type: "notification",
    id: generateNotificationId(),
    event,
    channel: expectedChannel,
    title: title && title.trim() ? title.trim() : eventCatalog[event].defaultTitle,
    message: content.trim(),
    sender: publisherName,
    timestamp: message.timestamp || new Date().toISOString(),
  };

  saveNotificationToHistory(notification);
  ackRegistry.set(notification.id, new Set());

  stats.totalPublished++;

  console.log(
    `[PUBLISH] ${notification.id} | ${notification.event} | Canal: ${notification.channel} | Emisor: ${notification.sender}`
  );

  const deliveredCount = broadcastNotification(notification);

  sendJSON(socket, {
    type: "published",
    message: "Notificación publicada correctamente.",
    deliveredTo: deliveredCount,
    notification,
  });

  printStats();
}

function handleAck(socket, message) {
  const clientData = clients.get(socket);

  if (!clientData || clientData.role !== "subscriber") {
    sendJSON(socket, {
      type: "error",
      message: "Solo los suscriptores pueden enviar ACK.",
    });
    return;
  }

  const notificationId = message.notificationId;

  if (!notificationId || !ackRegistry.has(notificationId)) {
    sendJSON(socket, {
      type: "error",
      message: "ACK inválido. No existe la notificación indicada.",
    });
    return;
  }

  const ackSet = ackRegistry.get(notificationId);

  if (!ackSet.has(clientData.id)) {
    ackSet.add(clientData.id);
    stats.totalAcks++;

    console.log(
      `[ACK] ${clientData.name} confirmó recepción de ${notificationId}`
    );
  }

  sendJSON(socket, {
    type: "ack_received",
    message: `ACK registrado para ${notificationId}.`,
  });
}

function handleAddSubscription(socket, message) {
  const clientData = clients.get(socket);

  if (!clientData || clientData.role !== "subscriber") {
    sendJSON(socket, {
      type: "error",
      message: "Solo los suscriptores pueden agregar canales.",
    });
    return;
  }

  const newChannels = validateChannels(message.channels);

  if (newChannels.length === 0) {
    sendJSON(socket, {
      type: "error",
      message: "No se enviaron canales válidos para agregar.",
    });
    return;
  }

  const updatedChannels = [...new Set([...clientData.channels, ...newChannels])];

  clients.set(socket, {
    ...clientData,
    channels: updatedChannels,
  });

  console.log(
    `[SUBSCRIBE_ADD] ${clientData.name} ahora está suscrito a: ${updatedChannels.join(", ")}`
  );

  sendJSON(socket, {
    type: "subscription_updated",
    message: "Canales agregados correctamente.",
    channels: updatedChannels,
  });

  const history = getHistoryForChannels(newChannels);

  sendJSON(socket, {
    type: "history",
    message: "Historial reciente de los nuevos canales agregados.",
    total: history.length,
    notifications: history,
  });

  printStats();
}

function handleUnsubscribe(socket, message) {
  const clientData = clients.get(socket);

  if (!clientData || clientData.role !== "subscriber") {
    sendJSON(socket, {
      type: "error",
      message: "Solo los suscriptores pueden eliminar canales.",
    });
    return;
  }

  const channelsToRemove = validateChannels(message.channels);

  if (channelsToRemove.length === 0) {
    sendJSON(socket, {
      type: "error",
      message: "No se enviaron canales válidos para eliminar.",
    });
    return;
  }

  const updatedChannels = clientData.channels.filter(
    (channel) => !channelsToRemove.includes(channel)
  );

  clients.set(socket, {
    ...clientData,
    channels: updatedChannels,
  });

  console.log(
    `[UNSUBSCRIBE] ${clientData.name} salió de: ${channelsToRemove.join(", ")}`
  );

  sendJSON(socket, {
    type: "subscription_updated",
    message: "Canales eliminados correctamente.",
    channels: updatedChannels,
  });

  printStats();
}

function handleMyChannels(socket) {
  const clientData = clients.get(socket);

  if (!clientData || clientData.role !== "subscriber") {
    sendJSON(socket, {
      type: "error",
      message: "No hay información de suscripción disponible.",
    });
    return;
  }

  sendJSON(socket, {
    type: "my_channels",
    clientName: clientData.name,
    channels: clientData.channels,
  });
}

wss.on("connection", (socket) => {
  const clientId = generateClientId();
  stats.totalConnections++;

  clients.set(socket, {
    id: clientId,
    role: "unknown",
    name: "Sin nombre",
    channels: [],
  });

  console.log(`[CONNECT] Cliente conectado: ${clientId}`);

  sendJSON(socket, {
    type: "info",
    message: "Conexión establecida con el servidor WebSocket.",
  });

  socket.on("message", (rawMessage) => {
    const message = parseMessage(rawMessage);

    if (!message) {
      sendJSON(socket, {
        type: "error",
        message: "Formato de mensaje inválido. Se esperaba JSON.",
      });
      return;
    }

    if (message.type === "subscribe") {
      handleSubscribe(socket, clientId, message);
      return;
    }

    if (message.type === "publish") {
      handlePublish(socket, clientId, message);
      return;
    }

    if (message.type === "ack") {
      handleAck(socket, message);
      return;
    }

    if (message.type === "subscribe_add") {
        handleAddSubscription(socket, message);
        return;
    }

    if (message.type === "unsubscribe") {
        handleUnsubscribe(socket, message);
        return;
    }

    if (message.type === "my_channels") {
        handleMyChannels(socket);
        return;
    }
    
    if (message.type === "status") {
      sendJSON(socket, {
        type: "status",
        stats,
        subscribers: getClientCountByRole("subscriber"),
        publishers: getClientCountByRole("publisher"),
      });
      return;
    }

    sendJSON(socket, {
      type: "error",
      message: "Tipo de mensaje no reconocido.",
    });
  });

  socket.on("close", () => {
    const clientData = clients.get(socket);

    if (clientData) {
      console.log(`[DISCONNECT] ${clientData.name} salió del sistema.`);
    }

    clients.delete(socket);
    printStats();
  });

  socket.on("error", (error) => {
    console.log(`[ERROR] Error con cliente ${clientId}: ${error.message}`);
  });
});

console.log("====================================================");
console.log(" Servidor Publish/Subscribe iniciado");
console.log(` WebSocket escuchando en ws://localhost:${PORT}`);
console.log(" Canales:", allowedChannels.join(", "));
console.log("====================================================");