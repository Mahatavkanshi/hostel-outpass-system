// backend/wsServer.js
const WebSocket = require("ws");
const url = require("url");

// in-memory connection registry: studentId -> { student?: ws, warden?: ws }
const clients = new Map();

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ noServer: true });

  // heartbeat to detect dead connections
  function heartbeat() { this.isAlive = true; }

  wss.on("connection", (ws, req, query) => {
    const role = query.role;          // "student" | "warden"
    const studentId = query.studentId;

    if (!role || !studentId) {
      ws.close(1008, "Missing role or studentId");
      return;
    }

    ws.isAlive = true;
    ws.on("pong", heartbeat);

    // register this socket in the student's private room
    const entry = clients.get(studentId) || {};
    if (role === "student") {
      entry.student = ws;
    } else if (role === "warden") {
      entry.warden = ws;
    }
    clients.set(studentId, entry);

    console.log(`🔗 ${role} connected for studentId=${studentId}`);

    // ✅ only ONE message listener
    ws.on("message", (raw) => {
      let data;
      try { data = JSON.parse(raw); } catch {
        console.error("❌ non-JSON message ignored");
        return;
      }

      const { type, text, sdp, candidate } = data;

      const payload = JSON.stringify({
        from: role,
        type,
        text,
        sdp,
        candidate,
        ts: Date.now()
      });

      const target = (role === "student") ? entry.warden : entry.student;
      if (target && target.readyState === WebSocket.OPEN) {
        target.send(payload);
      }

      // echo back for sender’s UI (only for chat text)
      if (type === "chat" && ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    });

    ws.on("close", () => {
      const current = clients.get(studentId) || {};
      if (role === "student" && current.student === ws) delete current.student;
      if (role === "warden" && current.warden === ws) delete current.warden;
      if (!current.student && !current.warden) {
        clients.delete(studentId);
      } else {
        clients.set(studentId, current);
      }
      console.log(`❌ ${role} disconnected for studentId=${studentId}`);
    });
  });

  // accept upgrades only for /ws
  server.on("upgrade", (req, socket, head) => {
    console.log("🔄 Upgrade request:", req.url);
    const { pathname, query } = url.parse(req.url, true);

    if (pathname !== "/ws") {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, query);
    });
  });

  // heartbeat interval
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      try { ws.ping(); } catch {}
    });
  }, 30000);

  wss.on("close", () => clearInterval(interval));
}

module.exports = { setupWebSocket };
