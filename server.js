const express = require("express");
const bodyParser = require("body-parser");
const User = require("./models/user");
const crypto = require("crypto");
const PasswordReset = require("./models/passReset");
const http = require("http");
const cors = require("cors");
const socketIo = require("socket.io");
const signalingServer = require("./services/signaling");
const chatRoutes = require("./routes/chat");
const Chat = require("./models/chat");
//const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const { log } = require("console");
const audioSignal = require("./services/audioSignal");
const videoSignal = require("./services/videoSIgnal");
const connectDB = require("./db.js");
// const callRoutes = require("./routes/call");

const app = express();
const server = http.createServer(app);

// app.use(
//   cors({
//     origin: "*",
//     credentials: true,
//   })
// );

// Define allowed origins
app.use(
  cors({
    origin: "*",      
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
const userSocketMap = new Map();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use("/api/chat", chatRoutes);
app.use("/uploads", express.static("uploads"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use("/api/call", callRoutes);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};
const upload = multer({ storage });

const profileUpload = multer({ storage, fileFilter });

audioSignal(io, userSocketMap);
videoSignal(io, userSocketMap);
connectDB();

const generateResetToken = () => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 5; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

app.get("/api/users/me", async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Error fetching user data" });
  }
});

// app.put("/api/users/me", async (req, res) => {
//   const { firstName, lastName, mobile } = req.body;
//   const token = req.headers.authorization.split(" ")[1];
//   const decoded = jwt.verify(token, process.env.JWT_SECRET);

//   try {
//     const user = await User.findById(decoded.id);

//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     user.firstName = firstName || user.firstName;
//     user.lastName = lastName || user.lastName;
//     user.mobile = mobile || user.mobile;

//     await user.save();
//     res.json(user);
//   } catch (error) {
//     res.status(500).json({ message: "Error updating profile" });
//   }
// });

// Route to update user profile, including image

app.put("/api/users/me", profileUpload.single("avatar"), async (req, res) => {
  const { firstName, lastName, mobile } = req.body;
  const token = req.headers.authorization
    ? req.headers.authorization.split(" ")[1]
    : null;

  if (!token) {
    console.error("Authorization token is missing");
    return res.status(401).json({ message: "Authorization token is missing" });
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded token ID:", decoded.id);

    const user = await User.findById(decoded.id);
    if (!user) {
      console.error("User not found for ID:", decoded.id);
      return res.status(404).json({ message: "User not found" });
    }

    // Update user fields
    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;
    user.mobile = mobile || user.mobile;

    // Check if an avatar file was uploaded
    if (req.file) {
      user.avatar = `uploads/${req.file.filename}`;
      console.log("Avatar uploaded:", user.avatar);
    } else {
      console.log("No avatar uploaded, keeping existing avatar.");
    }

    await user.save();
    console.log("Profile updated successfully");
    res.json({ message: "Profile updated successfully", user });
  } catch (error) {
    console.error("Error updating profile:", error.message, error.stack);
    res
      .status(500)
      .json({ message: `Error updating profile: ${error.message}` });
  }
});

app.post("/api/users", async (req, res) => {
  const { firstName, lastName, email, mobile, password } = req.body;

  try {
    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail) {
      return res
        .status(400)
        .json({ message: "User with this email already exist" });
    }
    const existingUserByMobile = await User.findOne({mobile});
    if (existingUserByMobile) {
      return res
      .status(400)
      .json({ message: "User with this mobile already exist" });
      }

    //const salt = await bcrypt.genSalt(10);
    //const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      firstName,
      lastName,
      email,
      mobile,
      password,
    });

    await newUser.save();

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: "4h",
    });

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: { id: newUser._id, email: newUser.email },
    });
  } catch (error) {
    res
      .status(500)
      .json(`{ message: Error registering user: ${error.message} }`);
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // const isMatch = await bcrypt.compare(password, user.password);
    // if (!isMatch) {
    //   return res.status(400).json({ message: "Invalid email or password" });
    // }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "4h",
    });

    res.json({ token, user: { id: user._id, email: user.email } });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/forgot-password", async (req, res) => {
  const { userName } = req.body;

  try {
    const user = await User.findOne({ userName });

    if (!user) {
      return res.status(404).send("User not found.");
    }

    const resetToken = generateResetToken();

    let passwordReset = await PasswordReset.findOne({ userName });

    if (passwordReset) {
      passwordReset.resetToken = resetToken;
      passwordReset.createdAt = Date.now();
    } else {
      passwordReset = new PasswordReset({
        userName,
        newPassCode: "",
        resetToken,
      });
    }

    await passwordReset.save();
    res
      .status(200)
      .send(
        `Password reset requested. Use this token to reset your password: ${resetToken}`
      );
  } catch (error) {
    res.status(500).send(`Error requesting password reset: ${error.message}`);
  }
});

app.post("/reset-password", async (req, res) => {
  const { userName, newPassCode, resetToken } = req.body;

  if (newPassCode.length !== 4 || isNaN(newPassCode)) {
    return res.status(400).send("PassCode must be a 4-digit number.");
  }

  try {
    const passCodeReset = await PasswordReset.findOne({ userName, resetToken });

    if (!passCodeReset) {
      return res.status(400).send("Invalid or expired token.");
    }

    const user = await User.findOne({ userName });
    user.passCode = newPassCode;
    await user.save();

    await PasswordReset.deleteOne({ userName, resetToken });

    res.status(200).send("Password has been reset successfully.");
  } catch (error) {
    res.status(500).send(`Error resetting password: ${error.message}`);
  }
});
module.exports = (io, userSocketMap) => {
  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    // Register user and map to socket ID
    socket.on("registerUser", (userId) => {
      userSocketMap.set(userId, socket.id);
      console.log(`User ${userId} registered with socket ${socket.id}`);
    });

    // Initiate a call
    socket.on("callUser", ({ userToCall, from, signalData }) => {
      const recipientSocket = userSocketMap.get(userToCall);
      if (recipientSocket) {
        console.log(`Initiating call from ${from} to ${userToCall}`);
        io.to(recipientSocket).emit("callUser", { from, signal: signalData });
      } else {
        console.log(`User ${userToCall} is not available.`);
      }
    });

    // Answer a call
    socket.on("answerCall", ({ to, signal }) => {
      const callerSocket = userSocketMap.get(to);
      if (callerSocket) {
        console.log(`Answering call to ${to}`);
        io.to(callerSocket).emit("callAccepted", signal);
      } else {
        console.log(`Caller ${to} is not connected.`);
      }
    });

    // Handle ICE Candidates
    socket.on("iceCandidate", ({ to, candidate }) => {
      const recipientSocket = userSocketMap.get(to);
      if (recipientSocket) {
        console.log(`Sending ICE candidate to ${to}`);
        io.to(recipientSocket).emit("iceCandidate", { candidate });
      } else {
        console.log(`Recipient ${to} is not available for ICE candidates.`);
      }
    });

    // Handle call rejection
    socket.on("rejectCall", ({ to }) => {
      const recipientSocket = userSocketMap.get(to);
      if (recipientSocket) {
        console.log(`Call rejected by ${socket.id}`);
        io.to(recipientSocket).emit("callRejected");
      }
    });

    // End a call
    socket.on("endCall", ({ to }) => {
      const recipientSocket = userSocketMap.get(to);
      if (recipientSocket) {
        console.log(`Ending call with ${to}`);
        io.to(recipientSocket).emit("callEnded");
      }
    });

    // Handle user disconnect
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      for (const [userId, id] of userSocketMap.entries()) {
        if (id === socket.id) {
          userSocketMap.delete(userId);
          console.log(`User ${userId} disconnected and removed from map.`);
          break;
        }
      }
    });
  });
};


app.get("/users", async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).send(`Error fetching users: ${error.message}`);
  }
});

// app.get("/api/users/me", async (req, res) => {
//   try {
//     const token = req.headers.authorization.split(" ")[1];
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     const user = await User.findById(decoded.id).select("-password");

//     if (!user) return res.status(404).json({ message: "User not found" });
//     res.json(user);
//   } catch (error) {
//     res.status(500).json({ message: "Error fetching user data" });
//   }
// });

// signalingServer(server);
// File upload route
app.post("/api/upload", upload.single("file"), (req, res) => {
  const { senderId, receiverId } = req.body;
  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${
    req.file.filename
  }`;

  const messageData = {
    senderId,
    receiverId,
    message: fileUrl,
    type: getFileType(req.file.mimetype),
  };

  const receiverSocketId = userSocketMap.get(receiverId);
  if (receiverSocketId) {
    io.to(receiverSocketId).emit("receive-message", {
      ...messageData,
      timestamp: new Date(),
    });
  }

  res.status(200).json({ url: fileUrl });
});

const getFileType = (mimeType) => {
  if (mimeType.startsWith("image")) return "image";
  if (mimeType.startsWith("video")) return "video";
  if (mimeType.startsWith("audio")) return "audio";
  return "document";
};

const port = process.env.PORT || 5000;
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
