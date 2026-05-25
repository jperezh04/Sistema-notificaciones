const WebSocket = require("ws");
const readline = require("readline");

const SERVER_URL = "ws://localhost:8080";

const eventOptions = [
  {
    key: "nueva_nota",
    label: "Nueva nota publicada",
    channel: "notas",
    defaultMessage: "Ya está disponible la nota de Sistemas Distribuidos.",
  },
  {
    key: "correccion_nota",
    label: "Corrección de nota",
    channel: "notas",
    defaultMessage: "Se corrigió una nota registrada anteriormente.",
  },
  {
    key: "promedio_actualizado",
    label: "Promedio actualizado",
    channel: "notas",
    defaultMessage: "El promedio del curso ha sido actualizado.",
  },
  {
    key: "cambio_horario",
    label: "Cambio de horario",
    channel: "horarios",
    defaultMessage: "La clase fue cambiada para otro horario.",
  },
  {
    key: "clase_cancelada",
    label: "Clase cancelada",
    channel: "horarios",
    defaultMessage: "La clase programada ha sido cancelada.",
  },
  {
    key: "aula_cambiada",
    label: "Cambio de aula",
    channel: "horarios",
    defaultMessage: "La clase se realizará en una nueva aula.",
  },
  {
    key: "recordatorio_examen",
    label: "Recordatorio de examen",
    channel: "examenes",
    defaultMessage: "Recuerden que el examen está próximo.",
  },
  {
    key: "examen_programado",
    label: "Examen programado",
    channel: "examenes",
    defaultMessage: "Se ha programado un nuevo examen.",
  },
  {
    key: "examen_reprogramado",
    label: "Examen reprogramado",
    channel: "examenes",
    defaultMessage: "El examen ha sido reprogramado.",
  },
  {
    key: "nueva_tarea",
    label: "Nueva tarea asignada",
    channel: "tareas",
    defaultMessage: "Se ha publicado una nueva tarea.",
  },
  {
    key: "fecha_entrega_cercana",
    label: "Fecha de entrega cercana",
    channel: "tareas",
    defaultMessage: "La fecha de entrega de la tarea está próxima.",
  },
  {
    key: "tarea_actualizada",
    label: "Tarea actualizada",
    channel: "tareas",
    defaultMessage: "Se actualizaron las indicaciones de una tarea.",
  },
  {
    key: "charla_programada",
    label: "Charla programada",
    channel: "eventos",
    defaultMessage: "Se ha programado una charla académica.",
  },
  {
    key: "taller_disponible",
    label: "Taller disponible",
    channel: "eventos",
    defaultMessage: "Hay un taller disponible para inscripción.",
  },
  {
    key: "inscripcion_abierta",
    label: "Inscripción abierta",
    channel: "eventos",
    defaultMessage: "Se abrió la inscripción para un evento universitario.",
  },
  {
    key: "mantenimiento_plataforma",
    label: "Mantenimiento de plataforma",
    channel: "sistema",
    defaultMessage: "La plataforma estará en mantenimiento.",
  },
  {
    key: "caida_servicio",
    label: "Caída de servicio",
    channel: "sistema",
    defaultMessage: "Se ha detectado una caída temporal del servicio.",
  },
  {
    key: "servicio_restaurado",
    label: "Servicio restaurado",
    channel: "sistema",
    defaultMessage: "El servicio ha sido restaurado correctamente.",
  },
  {
    key: "aviso_general",
    label: "Aviso general",
    channel: "general",
    defaultMessage: "Se comunica un aviso general para todos los estudiantes.",
  },
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function sendJSON(socket, data) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
  }
}

function printMenu() {
  console.log("\n==================== PUBLICADOR ====================");

  eventOptions.forEach((event, index) => {
    console.log(`${index + 1}. ${event.label} [${event.channel}]`);
  });

  console.log("0. Salir");
  console.log("====================================================");
}

function getEventByOption(option) {
  const index = Number(option);

  if (Number.isNaN(index)) return null;
  if (index < 1 || index > eventOptions.length) return null;

  return eventOptions[index - 1];
}

async function publishMenu(socket) {
  printMenu();

  const option = await ask("Seleccione una opción: ");

  if (option.trim() === "0") {
    console.log("\nCerrando publicador...");
    socket.close();
    rl.close();
    process.exit();
  }

  const eventData = getEventByOption(option);

  if (!eventData) {
    console.log("\nOpción inválida.");
    return publishMenu(socket);
  }

  console.log(`\nEvento seleccionado : ${eventData.label}`);
  console.log(`Canal asociado      : ${eventData.channel}`);

  const sender = await ask("Emisor, por ejemplo Docente o Coordinación: ");
  const titleInput = await ask(`Título: `);
  const messageInput = await ask(`Mensaje: `);

  const notification = {
    type: "publish",
    event: eventData.key,
    channel: eventData.channel,
    title: titleInput.trim() || eventData.label,
    message: messageInput.trim() || eventData.defaultMessage,
    sender: sender.trim() || "Docente",
    timestamp: new Date().toISOString(),
  };

  sendJSON(socket, notification);

  console.log("\nNotificación enviada al servidor.");
}

function main() {
  console.log("====================================================");
  console.log(" Cliente Publicador - Notificaciones Universitarias");
  console.log("====================================================");

  const socket = new WebSocket(SERVER_URL);

  socket.on("open", () => {
    console.log("\nConectado al servidor WebSocket.");
    publishMenu(socket);
  });

  socket.on("message", async (rawMessage) => {
    let data;

    try {
      data = JSON.parse(rawMessage.toString());
    } catch {
      console.log("[ERROR] Se recibió un mensaje inválido del servidor.");
      return;
    }

    if (data.type === "published") {
      console.log("\n[SERVIDOR] Publicación realizada correctamente.");
      console.log(`[SERVIDOR] ID de notificación: ${data.notification.id}`);
      console.log(`[SERVIDOR] Entregado a ${data.deliveredTo} suscriptor(es).`);

      await publishMenu(socket);
      return;
    }

    if (data.type === "error") {
      console.log(`\n[ERROR] ${data.message}`);
      await publishMenu(socket);
      return;
    }

    if (data.type === "info") {
      console.log(`[INFO] ${data.message}`);
      return;
    }

    if (data.type === "status") {
      console.log("\n[STATUS]", data);
      return;
    }
  });

  socket.on("close", () => {
    console.log("\nConexión cerrada con el servidor.");
  });

  socket.on("error", (error) => {
    console.log("\nNo se pudo conectar al servidor.");
    console.log(`Detalle: ${error.message}`);
    console.log("Verifique que el servidor esté iniciado con: npm start");
    rl.close();
  });

  process.on("SIGINT", () => {
    console.log("\nCerrando publicador...");
    socket.close();
    rl.close();
    process.exit();
  });
}

main();