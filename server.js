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

  socket.on("validate_call_to_join", (room_name) => {
    let existingRooms = io.sockets.adapter.rooms;
    const doesRoomExist = !!existingRooms[room_name];
    if (doesRoomExist) {
      const isRoomFull = existingRooms[room_name].length >= 2;
      if (isRoomFull) {
        socket.emit("invalid_call_to_join", "Room is full, please try later");
      } else {
        socket.to(room_name).emit("is-call-hosted", socket.id);
      }
    } else {
      socket.emit("invalid_call_to_join", "Room does not exist");
    }
  });

  socket.on("call-status-response", (isHosted, socketIdOfRequester) => {
    if (isHosted) {
      socket.to(socketIdOfRequester).emit("valid_call_to_join");
    } else {
      socket
        .to(socketIdOfRequester)
        .emit("invalid_call_to_join", "Call is not hosted");
    }
  });

  socket.on("end-call", (room_name, isHost) => {
    socket.to(room_name).emit("end-call");
    if (!isHost) {
      socket.leave(room_name);
    } else {
      let existingRooms = io.sockets.adapter.rooms;
      let hostRoom = existingRooms[room_name];
      let nonHostSocketId = Object.keys(hostRoom.sockets).find(
        (socketId) => socketId != socket.id
      );
      io.sockets.sockets[nonHostSocketId].leave(room_name);
    }
    console.log(io.sockets.adapter.rooms);
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
