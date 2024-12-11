const mongoose = require("mongoose");
require("dotenv").config();
const connectDB = async () => {
  await mongoose
    .connect(process.env.MONGO_URL)
    .then((conn) => {
      console.log(`DB Connection Successful to : ${conn.connection.host}`);
    })
    .catch((err) => {
      console.log(`DB Connection Error: ${err.message}`);
    });
};
module.exports = connectDB;
