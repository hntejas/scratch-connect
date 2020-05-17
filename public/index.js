const ROOM_JOIN_BTN = document.getElementById("join-now");
const ROOM_USERNAME_INPUT = document.getElementById("username");
const ROOM_REGISTRATION_SECTION = document.getElementById("room_registration");
const ROOM_CONFERENCE_SECTION = document.getElementById("room_conference");
const VIDEO_APP_SECTION = document.getElementById("video_app_section");
const ACTION_TOOL_BAR = document.getElementById("actions-toolbar");
const START_CALL_BTN = document.getElementById("start_call_btn");
const JOIN_CALL_BTN = document.getElementById("join_call_btn");
const JOIN_ROOM_BTN = document.getElementById("join_room_btn");
const ROOM_TO_JOIN_INPUT = document.getElementById("roomname_to_call");
const LOADER_ELEMENT = document.getElementById("loader");
const CLIENT_VIDEO_ELEMENT = document.getElementById("client-video-display");
const REMOTE_VIDEO_ELEMENT = document.getElementById("remote-video-display");
const TOOLBAR_SECTION = document.getElementById("call_action_toolbar");
const JOIN_CALL_FORM = document.getElementById("join_call_form");
const TOGGLE_VIDEO_BTN = document.getElementById("toggle_video");
const TOGGLE_AUDIO_BTN = document.getElementById("toggle_audio");
const TOGGLE_SCREEN_SHARE_BTN = document.getElementById("toogle_share_screen");
const HANGUP_CALL_BTN = document.getElementById("hangup_call");
const BACK_BTN = document.getElementById("back_btn");

const sections = {
  room_registration: ROOM_REGISTRATION_SECTION,
  room_conference: ROOM_CONFERENCE_SECTION,
};
const mediaConstraints = {
  video: true,
  audio: true,
};
const stunConfiguration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};
const mediaTracks = {
  audioTrack: null,
  videoTrack: null,
  screenShareTrack: null,
};
const userCallStatus = {
  isAudioEnabled: true,
  isVideoEnabled: true,
  isScreenShareEnabled: false,
  isCallHosted: false,
};

let USER_ROOM;
let ROOM_TO_JOIN;
let socket = io();
let peer;
let offer;
let LOCAL_STREAM = new MediaStream();
let REMOTE_STREAM = new MediaStream();
let isInCall = false;
dragElement(CLIENT_VIDEO_ELEMENT);
toggleLoader(false);
toggleJoinCallForm(false);
initiateSocketListeners();

ROOM_JOIN_BTN.disabled = true;

ROOM_USERNAME_INPUT.addEventListener("input", () => {
  if (ROOM_USERNAME_INPUT.value.length > 1) {
    ROOM_JOIN_BTN.disabled = false;
  }
});

ROOM_JOIN_BTN.addEventListener("click", () => {
  socket.emit("validate_new_room", ROOM_USERNAME_INPUT.value);
});

START_CALL_BTN.addEventListener("click", () => {
  initiatePeerConnection();
  displayMessage(
    "Share your room name " + USER_ROOM + " and ask your friend to join"
  );
  ROOM_TO_JOIN = USER_ROOM;
  toggleActionMenu(false);
  toggleLoader(true);
});

JOIN_CALL_BTN.addEventListener("click", () => {
  initiatePeerConnection();
  toggleActionMenu(false);
  toggleJoinCallForm(true);
});

JOIN_ROOM_BTN.addEventListener("click", () => {
  ROOM_TO_JOIN = ROOM_TO_JOIN_INPUT.value;
  if (ROOM_TO_JOIN === USER_ROOM) {
    displayMessage("Please enter a valid room to join");
  } else {
    initiatePeerConnection();
    socket.emit("validate_call_to_join", ROOM_TO_JOIN);
  }
});

BACK_BTN.addEventListener("click", () => {
  toggleJoinCallForm(false);
  toggleActionMenu(true);
});

TOGGLE_VIDEO_BTN.addEventListener("click", () => {
  userCallStatus.isVideoEnabled = !userCallStatus.isVideoEnabled;
  let videoTracks = LOCAL_STREAM.getVideoTracks();
  videoTracks.forEach((track) => {
    track.enabled = userCallStatus.isVideoEnabled;
  });
  TOGGLE_VIDEO_BTN.style.color = userCallStatus.isVideoEnabled
    ? "#1979f8"
    : "red";
  TOGGLE_VIDEO_BTN.title = userCallStatus.isVideoEnabled
    ? "Turn Off Video"
    : "Turn On Video";
});

TOGGLE_AUDIO_BTN.addEventListener("click", () => {
  LOCAL_STREAM.getAudioTracks().forEach((track) => {
    track.enabled = !userCallStatus.isAudioEnabled;
    userCallStatus.isAudioEnabled = !userCallStatus.isAudioEnabled;
  });
  TOGGLE_AUDIO_BTN.style.color = userCallStatus.isAudioEnabled
    ? "#1979f8"
    : "red";
  TOGGLE_AUDIO_BTN.title = userCallStatus.isAudioEnabled ? "Mute" : "Unmute";
});

TOGGLE_SCREEN_SHARE_BTN.addEventListener("click", () => {
  if (userCallStatus.isScreenShareEnabled) {
    switchVideoTrack(mediaTracks.videoTrack, LOCAL_STREAM);
    mediaTracks.screenShareTrack.stop();
    userCallStatus.isScreenShareEnabled = false;
    toggleScreenShareButtonProps();
  } else {
    navigator.mediaDevices &&
      navigator.mediaDevices
        .getDisplayMedia()
        .then((screenStream) => {
          var screenVideoTrack = screenStream.getVideoTracks()[0];
          mediaTracks.screenShareTrack = screenVideoTrack;
          switchVideoTrack(screenVideoTrack, screenStream);
          userCallStatus.isScreenShareEnabled = true;
          toggleScreenShareButtonProps();
          screenVideoTrack.addEventListener("ended", () => {
            switchVideoTrack(mediaTracks.videoTrack, LOCAL_STREAM);
            userCallStatus.isScreenShareEnabled = false;
            toggleScreenShareButtonProps();
          });
        })
        .catch((e) => {
          displayMessage("Unable to Share");
          console.log(e);
        });
  }
});

HANGUP_CALL_BTN.addEventListener("click", () => {
  console.log(ROOM_TO_JOIN, USER_ROOM);
  const isHost = ROOM_TO_JOIN === USER_ROOM;
  socket.emit("end-call", ROOM_TO_JOIN, isHost);
  endCall();
});

async function recreateOffer() {
  LOCAL_STREAM.getTracks().forEach((track) =>
    peer.addTrack(track, LOCAL_STREAM)
  );
  offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  socket.emit("rtc-connect", { room: ROOM_TO_JOIN, offer: offer });
}

async function initiatePeerConnection() {
  peer = new RTCPeerConnection(stunConfiguration);
  LOCAL_STREAM.getTracks().forEach((track) => {
    peer.addTrack(track, LOCAL_STREAM);
    if (track.kind === "audio") {
      mediaTracks.audioTrack = track;
    }
    if (track.kind === "video") {
      mediaTracks.videoTrack = track;
    }
  });
  offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  userCallStatus.isCallHosted = true;
  peer.onicecandidate = function (event) {
    if (event.candidate) {
      socket.emit("rtc-connect", {
        room: ROOM_TO_JOIN,
        iceCandidate: event.candidate,
      });
    }
  };
  peer.addEventListener("track", async (event) => {
    console.log("track added");
    REMOTE_STREAM.addTrack(event.track, REMOTE_STREAM);
    REMOTE_VIDEO_ELEMENT.play();
  });
  peer.addEventListener("connectionstatechange", (event) => {
    if (peer.connectionState === "connected") {
      setupUIHandlers();
      toggleLoader(false);
      isInCall = true;
    }
    console.log(peer.connectionState);
    if (peer.connectionState == "disconnected") {
      displayMessage("Oops, user has disconnected");
      REMOTE_VIDEO_ELEMENT.load();
      endCall();
    }
  });
  peer.addEventListener("iceconnectionstatechange", (event) => {
    console.log("icestate", peer.iceConnectionState);
    if (peer.iceConnectionState === "connected") {
      ACTION_TOOL_BAR.style.visibility = "visible";
      toggleLoader(false);
    }
    if (peer.iceConnectionState == "disconnected") {
      displayMessage("Oops, user has disconnected");
      endCall();
    }
  });
}

async function initiateCall() {
  socket.on("rtc-connect", async (message) => {
    console.log(message);
    if (message.answer) {
      const remoteDesc = new RTCSessionDescription(message.answer);
      await peer.setRemoteDescription(remoteDesc);
      console.log(peer);
    }
  });
  offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  socket.emit("rtc-connect", { room: ROOM_TO_JOIN, offer: offer });
  console.log(peer);
}

function initiateSocketListeners() {
  socket.on("invalid_room_to_create", (message) => {
    displayMessage(message);
  });
  socket.on("valid_room_to_create", () => {
    USER_ROOM = ROOM_USERNAME_INPUT.value;
    initiateConferenceSection(
      sections.room_registration,
      sections.room_conference
    );
    initiatePeerConnection();
    socket.emit("new_room", USER_ROOM);
  });
  socket.on("invalid_room_to_join", (message) => {
    endCall();
    displayMessage(message);
  });
  socket.on("valid_room_to_join", () => {
    socket.emit("join_room", ROOM_TO_JOIN);
    initiateCall();
  });
  socket.on("end-call", () => {
    console.log("endcall");
    endCall();
  });
  socket.on("is-call-hosted", (socketIdOfRequester) => {
    let isHosted = userCallStatus.isCallHosted;
    socket.emit("call-status-response", isHosted, socketIdOfRequester);
  });
  socket.on("valid_call_to_join", () => {
    toggleJoinCallForm(false);
    socket.emit("join_room", ROOM_TO_JOIN);
    initiateCall();
  });
  socket.on("invalid_call_to_join", (message) => {
    displayMessage(message);
  });
  socket.on("rtc-connect", async (message) => {
    console.log("onreceive", message);
    if (message.offer) {
      peer.setRemoteDescription(new RTCSessionDescription(message.offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit("rtc-connect", { room: ROOM_TO_JOIN, answer: answer });
    }
    if (message.iceCandidate && peer.currentRemoteDescription) {
      try {
        await peer.addIceCandidate(message.iceCandidate);
      } catch (e) {
        console.error("Error adding received ice candidate", e);
      }
    }
  });
}

function initiateConferenceSection(currentSection, nextSection) {
  createRoom(USER_ROOM);
  navigator.mediaDevices
    .getUserMedia(mediaConstraints)
    .then((stream) => {
      currentSection.hidden = true;
      nextSection.hidden = false;
      CLIENT_VIDEO_ELEMENT.srcObject = stream;
      CLIENT_VIDEO_ELEMENT.play();
      REMOTE_VIDEO_ELEMENT.srcObject = REMOTE_STREAM;
      LOCAL_STREAM = stream;
    })
    .catch((error) => {
      console.error("Error accessing media devices.", error);
    });
}

function endCall() {
  window.location.reload(); // To be fixed
  peer.close();
  isInCall = false;
  peer = null;
  REMOTE_VIDEO_ELEMENT.srcObject = null;
  ROOM_TO_JOIN = "";
  toggleActionMenu(true);
  console.log(peer);
}

function createRoom(roomName) {
  socket.emit("new_room", roomName);
}

function switchVideoTrack(track, stream) {
  let videoSender = peer
    .getSenders()
    .find((sender) => sender.track.kind == "video");
  videoSender.replaceTrack(track);

  CLIENT_VIDEO_ELEMENT.srcObject = stream;
  CLIENT_VIDEO_ELEMENT.play();
}

function dragElement(elmnt) {
  var pos1 = 0,
    pos2 = 0,
    pos3 = 0,
    pos4 = 0;

  elmnt.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    // get the mouse cursor position at startup:
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // call a function whenever the cursor moves:
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    // calculate the new cursor position:
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // set the element's new position:
    elmnt.style.top = elmnt.offsetTop - pos2 + "px";
    elmnt.style.left = elmnt.offsetLeft - pos1 + "px";
  }

  function closeDragElement() {
    // stop moving when mouse button is released:
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

function displayMessage(message) {
  // Get the snackbar DIV
  var x = document.getElementById("snackbar");

  x.innerHTML = message;
  // Add the "show" class to DIV
  x.className = "show";

  // After 10 seconds, remove the show class from DIV
  setTimeout(function () {
    x.className = x.className.replace("show", "");
  }, 3000);
}

function toggleActionMenu(shouldDisplay) {
  TOOLBAR_SECTION.style.display = !shouldDisplay ? "none" : "initial";
}

function toggleLoader(shouldDisplay) {
  LOADER_ELEMENT.style.display = !shouldDisplay ? "none" : "initial";
}

function toggleJoinCallForm(shouldDisplay) {
  JOIN_CALL_FORM.style.display = !shouldDisplay ? "none" : "initial";
}

function setupUIHandlers() {
  VIDEO_APP_SECTION.addEventListener("mouseover", () => {
    if (isInCall) {
      ACTION_TOOL_BAR.style.visibility = "visible";
    }
  });

  VIDEO_APP_SECTION.addEventListener("mouseleave", () => {
    ACTION_TOOL_BAR.style.visibility = "hidden";
  });

  VIDEO_APP_SECTION.addEventListener("touchend", () => {
    if (isInCall) {
      ACTION_TOOL_BAR.style.visibility =
        ACTION_TOOL_BAR.style.visibility == "hidden" ? "visible" : "hidden";
    }
  });

  VIDEO_APP_SECTION.addEventListener("mouseleave", () => {
    ACTION_TOOL_BAR.style.visibility = "hidden";
  });
}

function toggleScreenShareButtonProps() {
  console.log(userCallStatus);
  TOGGLE_SCREEN_SHARE_BTN.style.color = userCallStatus.isScreenShareEnabled
    ? "red"
    : "#1979f8";
  TOGGLE_SCREEN_SHARE_BTN.title = userCallStatus.isScreenShareEnabled
    ? "Stop Screen Share"
    : "Share Screen";
}

// ACTION_TOOL_BAR.addEventListener("mouseover", () => {
//   ACTION_TOOL_BAR.style.visibility = "visible";
// });

// ACTION_TOOL_BAR.addEventListener("mouseleave", () => {
//   ACTION_TOOL_BAR.style.visibility = "visible";
// });
