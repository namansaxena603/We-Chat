const socket = io();

document.addEventListener("DOMContentLoaded", function () {
  const roomList = document.getElementById("room-list");

  const roomNameInput = document.getElementById("roomName");

  socket.emit("getRooms");
  socket.on("availableRooms", (rooms) => {
    roomList.innerHTML = "";
    rooms.forEach((room) => {
      const li = document.createElement("li");
      li.className = "list-group-item";
      li.textContent = room;
      li.addEventListener("click", () => {
        roomNameInput.value = room;
      });
      roomList.appendChild(li);
    });
  });

  document.getElementById("room-form").addEventListener("submit", function (e) {
    e.preventDefault();

    const roomName = document.getElementById("roomName").value.trim();
    if (roomName) {
      socket.emit("join room", roomName);
      localStorage.setItem("roomName", roomName);
      document.getElementById("room-selection").style.display = "none";
      document.getElementById("chat-application").style.display = "block";
    }
  });

  document
    .getElementById("message-form")
    .addEventListener("submit", function (e) {
      e.preventDefault();

      const messageInput = document.getElementById("exampleInputText");
      const message = messageInput.value.trim();
      const userName = document.getElementById("username").value;
      const roomName = localStorage.getItem("roomName");

      if (message && roomName) {
        socket.emit("chat message", {
          userName: userName,
          message: message,
          room: roomName,
        });
        messageInput.value = "";
      }
      messageInput.focus();
    });

  socket.on("room list", function (rooms) {
    console.log("Rooms received:", rooms);
    const roomList = document.getElementById("room-list");
    roomList.innerHTML = "";
    rooms.forEach((room) => {
      const roomItem = document.createElement("li");
      roomItem.textContent = room;
      roomItem.classList.add("list-group-item");
      roomItem.addEventListener("click", function () {
        socket.emit("join room", room);
        localStorage.setItem("roomName", room);
        document.getElementById("roomName").value = room;
        document.getElementById("room-selection").style.display = "none";
        document.getElementById("chat-application").style.display = "block";
      });
      roomList.appendChild(roomItem);
    });
  });

  socket.on("connect_error", (err) => {
    console.error("Connection Error:", err.message);
    alert("Connection failed. Please try again later.");
  });

  socket.on("joined room", (roomName) => {
    alert(`Successfully joined room: ${roomName}`);
  });

  document.getElementById("leave-room").addEventListener("click", () => {
    const roomName = localStorage.getItem("roomName");
    if (roomName) {
      socket.emit("leave room", roomName);
      localStorage.removeItem("roomName");
      document.getElementById("room-selection").style.display = "block";
      document.getElementById("chat-application").style.display = "none";
    }
  });

  socket.on("chat message", function (data) {
    const output = document.getElementById("output");
    const messageElement = document.createElement("div");
    messageElement.classList.add("card", "my-2");
    messageElement.innerHTML = `
      <div class="card-body rounded" style="background-color: whitesmoke">
        <h5 class="card-title py-1" style=" color : goldenrod">${data.userName}
        
        </h5>
        <hr >
        <p class="card-text text-dark" >${data.message}</p>
      </div>
    `;
    output.appendChild(messageElement);
    output.scrollTop = output.scrollHeight;
  });
});
