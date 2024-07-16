import express from "express";
import { WebSocketServer, WebSocket, Server } from "ws";
import url from "url";
import { createClient } from "redis";
import { ExtWebSocket } from "./@types/types";


const app = express();
const redisCli = createClient();

const startServer = async () => {
  try {
    await redisCli.connect();
    console.log("Connected to Redis");

    let server = app.listen(8080, () => {
      console.log("Server is started at 8080");
    });

    return server;
  } catch (error) {
    console.log(`Failed to connect to the Redis server, ${error}`);
  }
};

// starting a server to connect the redis server and start the  http server
startServer().then((server) => {
  const wss = new WebSocketServer({ server: server });

  const clientsWsConnections = new Map<string, WebSocket>();

  wss.on("connection", (ws: ExtWebSocket, req) => {
    const parameters = url.parse(req.url!, true);
    const userId: string = parameters.query.id as string;
    console.log(userId);

    // Mapping the users id with the websocket connection in the clientsWsConnections
    clientsWsConnections.set(userId, ws);
    const mapObj = Object.fromEntries(clientsWsConnections);
    const jsonString = JSON.stringify(mapObj);

    ws.userId = userId;

    ws.on("message", async (data, isBinary) => {
      const { recepientId, message,senderId,timeDate } = JSON.parse(data.toString());
      // console.log(data.toString());
      // console.log(JSON.parse(jsonString));

      // Send the message to redis queue to store in database
      await redisCli.lPush("messages", JSON.stringify({ recepientId, message,senderId,timeDate }));

      if (clientsWsConnections.has(recepientId)) {
        const receipientWs = clientsWsConnections.get(recepientId);
        receipientWs?.send(
          JSON.stringify({
            message: message,
            senderId,
            recepientId,
            timeDate
          }),
          { binary: isBinary }
        );
      } else {
        ws.send(JSON.stringify({ error: "User is not found" }), {
          binary: isBinary,
        });
      }
    });

    ws.on("error", console.error);

    // ws.send(
    //   JSON.stringify({
    //     message: "connection is made",
    //     senderId: userId,
    //     recepientId:userId,
    //     timeDate:'Apna time ayega'
    //   })
    // );

    ws.on("close", () => {
      if (ws.userId) {
        clientsWsConnections.delete(ws.userId);
        console.log(`User ${ws.userId} disconnected`);
      }
    });
  });
});
