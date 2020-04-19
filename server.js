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
    socket.join(room_to_join);
  });

  socket.on("rtc-connect", (data) => {
    console.log("data", data);
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
