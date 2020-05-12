const express = require("express");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const port = process.env.PORT || 3000;
app.use(express.static(__dirname + "/public"));

io.on("connection", (socket) => {
  socket.on("new_room", (user_room) => {
    socket.join(user_room);
  });

  socket.on("join_room", (room_to_join) => {
    let existingRooms = io.sockets.adapter.rooms;
    const isRoomHosted = !!existingRooms[room_to_join];
    if (!isRoomHosted) {
      socket.emit("invalid_room", "No such user room exists");
    } else {
      socket.join(room_to_join);
    }
  });

  socket.on("validate_room_to_join", (room_to_join) => {
    let existingRooms = io.sockets.adapter.rooms;
    const isRoomHosted = !!existingRooms[room_to_join];
    if (!isRoomHosted) {
      socket.emit("invalid_room_to_join", "No such user room exists");
    } else {
      socket.emit("valid_room_to_join");
    }
  });

  socket.on("validate_new_room", (room_name) => {
    let existingRooms = io.sockets.adapter.rooms;
    const isRoomHosted = !!existingRooms[room_name];
    if (isRoomHosted) {
      socket.emit("invalid_room_to_create", "Room name is already taken");
    } else {
      socket.emit("valid_room_to_create");
    }
  });

  socket.on("end-call", (room_name) => {
    socket.to(room_name).emit("end-call");
  });

  socket.on("rtc-connect", (data) => {
    if (data.hasOwnProperty("offer")) {
      socket.to(data.room).emit("rtc-connect", { offer: data.offer });
    } else if (data.hasOwnProperty("iceCandidate")) {
      socket
        .to(data.room)
        .emit("rtc-connect", { iceCandidate: data.iceCandidate });
    } else {
      socket.to(data.room).emit("rtc-connect", { answer: data.answer });
    }
  });

  socket.on("disconnect", () => {
    console.log("user disconnected", io.sockets.adapter.rooms);
  });
});

http.listen(port, () => {
  console.log(`Active on ${port}`);
});
