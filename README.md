# Sistema de Notificaciones Universitarias - Publish/Subscribe

## Descripción del proyecto

Este proyecto implementa un sistema distribuido de notificaciones universitarias aplicando el patrón de diseño **Publish/Subscribe**.

La idea principal es que un publicador emita eventos académicos, mientras que varios suscriptores reciben las notificaciones en tiempo real mediante **WebSockets**. El servidor actúa como intermediario o broker, recibiendo los eventos publicados y reenviándolos a los clientes que estén suscritos al canal correspondiente.

Este sistema representa un escenario universitario donde se pueden enviar avisos como:

- Nueva nota publicada
- Cambio de horario
- Recordatorio de examen

## Tecnologías utilizadas

- Node.js 22.x
- npm 10.9.3
- WebSockets
- Librería `ws`
- PowerShell / Terminal
- Git y GitHub

## Requisitos previos

Antes de ejecutar el proyecto, verificar las versiones instaladas:

```powershell
node -v
npm -v
```

Versiones recomendadas para el grupo:

```txt
Node.js: 22.x
npm: 10.9.3
```

En caso de necesitar igualar la versión de npm:

```powershell
npm install -g npm@10.9.3
```

## Estructura del proyecto

```txt
sistema-notificaciones-pubsub/
│
├── src/
│   ├── server.js
│   ├── publisher.js
│   └── subscriber.js
│
├── docs/
│   ├── arquitectura.md
│   └── informe.md
│
├── captures/
│
├── package.json
├── package-lock.json
├── README.md
└── .gitignore
```

## Descripción de archivos principales

### `src/server.js`

Contiene el servidor WebSocket.  
Su función principal es recibir conexiones de publicadores y suscriptores, registrar los canales de suscripción y reenviar las notificaciones a los clientes correspondientes.

### `src/publisher.js`

Contiene el cliente publicador.  
Su función es enviar eventos académicos al servidor, por ejemplo, una nueva nota, un cambio de horario o un recordatorio de examen.

### `src/subscriber.js`

Contiene el cliente suscriptor.  
Su función es conectarse al servidor, suscribirse a uno o más canales y recibir las notificaciones en tiempo real.

## Instalación del proyecto

Instalar dependencias:

```powershell
npm ci
```

Si `npm ci` no funciona porque todavía no existe `package-lock.json`, usar:

```powershell
npm install
```

## Dependencias

La dependencia principal del proyecto es:

```txt
ws
```

Para instalarla manualmente:

```powershell
npm install ws
```

## Scripts disponibles

El archivo `package.json` debe tener los siguientes scripts:

```json
"scripts": {
  "start": "node src/server.js",
  "publisher": "node src/publisher.js",
  "subscriber": "node src/subscriber.js"
}
```

## Ejecución del sistema

Para probar el sistema se deben abrir varias terminales.

### Terminal 1: iniciar el servidor

```powershell
npm start
```

### Terminal 2: iniciar un suscriptor

```powershell
npm run subscriber
```

### Terminal 3: iniciar otro suscriptor

```powershell
npm run subscriber
```

### Terminal 4: iniciar el publicador

```powershell
npm run publisher
```

## Formato de mensaje para suscribirse

El suscriptor debe enviar al servidor un mensaje con este formato:

```json
{
  "type": "subscribe",
  "clientName": "Estudiante 01",
  "channels": ["notas", "horarios", "examenes"]
}
```

Ejemplo de suscripción a un solo canal:

```json
{
  "type": "subscribe",
  "clientName": "Estudiante 02",
  "channels": ["notas"]
}
```

## Formato de notificación recibida

Cuando el servidor reenvía una notificación, el suscriptor recibe un mensaje como este:

```json
{
  "type": "notification",
  "event": "cambio_horario",
  "channel": "horarios",
  "title": "Cambio de horario",
  "message": "La clase de Sistemas Distribuidos será a las 5:00 p.m.",
  "sender": "Coordinación Académica",
  "timestamp": "2026-05-24T11:00:00"
}
```

## Flujo de trabajo con Git

Se trabajará con ramas para evitar conflictos y mantener estable la rama principal.

### Ramas principales

```txt
main
integration
```

## Descripción de ramas

```txt
main              → versión estable del proyecto
integration       → rama para probar la integración de todas las partes
feature/server    → desarrollo del servidor WebSocket
feature/publisher → desarrollo del publicador
feature/subscriber→ desarrollo del suscriptor
docs/informe      → documentación e informe técnico
docs/arquitectura → diagrama y explicación arquitectónica
```

## Reglas de trabajo

Antes de empezar a trabajar:

```powershell
git checkout main
git pull origin main
```

Crear una rama nueva:

```powershell
git checkout -b feature/nombre-de-la-rama
```

Guardar cambios:

```powershell
git status
git add .
git commit -m "Descripción clara del cambio"
git push origin feature/nombre-de-la-rama
```

Antes de unir una rama a `integration`, se debe verificar que:

```txt
El código ejecuta sin errores.
No se subió la carpeta node_modules.
Se respetan los formatos JSON definidos.
Se usan los canales establecidos.
Se usan los eventos establecidos.
Los comandos npm funcionan correctamente.
```

## Estado del proyecto

```txt
En desarrollo asdasd
```