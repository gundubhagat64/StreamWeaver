require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const connectDB = require("./config/db");
const uploadFile = require("./upload");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:5173" }
});

app.post("/upload", uploadFile);

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
});

connectDB();

server.listen(5000, () => {
  console.log("Server running on port 5000");
});