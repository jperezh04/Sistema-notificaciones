const WebSocket = require("ws");
const readline = require("readline");

const SERVER_URL = "ws://localhost:8080";

const availableChannels = [
  "notas",
  "horarios",
  "examenes",
  "tareas",
  "eventos",
  "sistema",
  "general",
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let currentClientName = "Estudiante";
let socket = null;

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function sendJSON(data) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
  }
}

function printChannels() {
  console.log("\nCanales disponibles:");

  availableChannels.forEach((channel, index) => {
    console.log(`${index + 1}. ${channel}`);
  });

  console.log("\nPuede escribir:");
  console.log("- todos");
  console.log("- notas,examenes");
  console.log("- 1,3,5");
}

function parseSelectedChannels(input) {
  const cleanInput = input.trim().toLowerCase();

  if (cleanInput === "todos") {
    return availableChannels;
  }

  return cleanInput
    .split(",")
    .map((item) => item.trim())
    .map((item) => {
      const index = Number(item);

      if (!Number.isNaN(index) && index >= 1 && index <= availableChannels.length) {
        return availableChannels[index - 1];
      }

      return item;
    })
    .filter((channel) => availableChannels.includes(channel));
}

function formatNotification(notification) {
  console.log("\n================ NOTIFICACIÓN RECIBIDA ================");
  console.log(`ID       : ${notification.id}`);
  console.log(`Evento   : ${notification.event}`);
  console.log(`Canal    : ${notification.channel}`);
  console.log(`Título   : ${notification.title}`);
  console.log(`Mensaje  : ${notification.message}`);
  console.log(`Emisor   : ${notification.sender}`);
  console.log(`Fecha    : ${notification.timestamp}`);
  console.log("========================================================\n");

  sendJSON({
    type: "ack",
    notificationId: notification.id,
    clientName: currentClientName,
    timestamp: new Date().toISOString(),
  });

  console.log(`[ACK] Confirmación enviada para ${notification.id}`);
}

function formatHistory(notifications) {
  if (!notifications || notifications.length === 0) {
    console.log("\n[HISTORIAL] No hay notificaciones recientes para esos canales.");
    return;
  }

  console.log("\n================ HISTORIAL RECIENTE ================");

  notifications.forEach((notification) => {
    console.log(
      `${notification.id} | ${notification.channel} | ${notification.title} | ${notification.timestamp}`
    );
  });

  console.log("====================================================\n");
}

function printCommandHelp() {
  console.log("\n================ COMANDOS DISPONIBLES ================");
  console.log("/add canal1,canal2       → suscribirse a nuevos canales");
  console.log("/remove canal1,canal2    → eliminar canales suscritos");
  console.log("/miscanales              → ver canales actuales");
  console.log("/canales                 → ver canales disponibles");
  console.log("/help                    → ver comandos");
  console.log("/exit                    → salir");
  console.log("=======================================================\n");
}

function handleCommand(input) {
  const cleanInput = input.trim();

  if (!cleanInput) {
    waitForCommands();
    return;
  }

  if (cleanInput === "/help") {
    printCommandHelp();
    waitForCommands();
    return;
  }

  if (cleanInput === "/canales") {
    printChannels();
    waitForCommands();
    return;
  }

  if (cleanInput === "/miscanales") {
    sendJSON({
      type: "my_channels",
    });

    waitForCommands();
    return;
  }

  if (cleanInput === "/exit") {
    console.log("\nCerrando suscriptor...");
    socket.close();
    rl.close();
    process.exit();
  }

  if (cleanInput.startsWith("/add ")) {
    const channelsInput = cleanInput.replace("/add ", "");
    const channels = parseSelectedChannels(channelsInput);

    if (channels.length === 0) {
      console.log("\nNo se ingresaron canales válidos para agregar.");
      waitForCommands();
      return;
    }

    sendJSON({
      type: "subscribe_add",
      channels,
    });

    waitForCommands();
    return;
  }

  if (cleanInput.startsWith("/remove ")) {
    const channelsInput = cleanInput.replace("/remove ", "");
    const channels = parseSelectedChannels(channelsInput);

    if (channels.length === 0) {
      console.log("\nNo se ingresaron canales válidos para eliminar.");
      waitForCommands();
      return;
    }

    sendJSON({
      type: "unsubscribe",
      channels,
    });

    waitForCommands();
    return;
  }

  console.log("\nComando no reconocido. Escriba /help para ver opciones.");
  waitForCommands();
}

function waitForCommands() {
  rl.question("\nComando del suscriptor > ", handleCommand);
}

async function main() {
  console.log("====================================================");
  console.log(" Cliente Suscriptor - Notificaciones Universitarias");
  console.log("====================================================");

  const clientNameInput = await ask("Ingrese su nombre como suscriptor: ");
  currentClientName = clientNameInput.trim() || "Estudiante";

  printChannels();

  const channelsInput = await ask("\nIngrese los canales iniciales a suscribirse: ");
  const selectedChannels = parseSelectedChannels(channelsInput);

  if (selectedChannels.length === 0) {
    console.log("\nNo se seleccionaron canales válidos. Cerrando cliente.");
    rl.close();
    return;
  }

  socket = new WebSocket(SERVER_URL);

  socket.on("open", () => {
    console.log("\nConectado al servidor WebSocket.");

    sendJSON({
      type: "subscribe",
      clientName: currentClientName,
      channels: selectedChannels,
    });

    console.log(`Suscriptor: ${currentClientName}`);
    console.log(`Canales iniciales: ${selectedChannels.join(", ")}`);

    printCommandHelp();
    waitForCommands();
  });

  socket.on("message", (rawMessage) => {
    let data;

    try {
      data = JSON.parse(rawMessage.toString());
    } catch {
      console.log("[ERROR] Se recibió un mensaje inválido del servidor.");
      return;
    }

    if (data.type === "notification") {
      formatNotification(data);
      return;
    }

    if (data.type === "history") {
      formatHistory(data.notifications);
      return;
    }

    if (data.type === "subscribed") {
      console.log(`[SERVIDOR] ${data.message}`);
      return;
    }

    if (data.type === "subscription_updated") {
      console.log(`[SERVIDOR] ${data.message}`);

      if (data.channels.length === 0) {
        console.log("[SERVIDOR] Actualmente no estás suscrito a ningún canal.");
      } else {
        console.log(`[SERVIDOR] Canales actuales: ${data.channels.join(", ")}`);
      }

      return;
    }

    if (data.type === "my_channels") {
      console.log(`\n[MIS CANALES] ${data.clientName}: ${data.channels.join(", ") || "Ninguno"}`);
      return;
    }

    if (data.type === "ack_received") {
      return;
    }

    if (data.type === "error") {
      console.log(`[ERROR] ${data.message}`);
      return;
    }

    if (data.type === "info") {
      console.log(`[INFO] ${data.message}`);
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
    console.log("\nCerrando suscriptor...");
    socket.close();
    rl.close();
    process.exit();
  });
}

main();