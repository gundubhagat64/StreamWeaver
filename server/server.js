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

app.post("/upload", (req, res) => {
  uploadFile(req, res, io);
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("join-job", (jobId) => {
    socket.join(jobId);
    console.log(`Socket ${socket.id} joined job ${jobId}`);
  });

  socket.on("job-status", (data) => {
    io.to(data.jobId).emit("job-status", data);
  });
});

connectDB();

server.listen(5000, () => {
  console.log("Server running on port 5000");
});