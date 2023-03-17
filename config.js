import mongoose from "mongoose";
import dotenv from "dotenv";
import logger from "./logger.js";


export class Connection {
  async connectMongoDB() {
    dotenv.config();
    return mongoose.connect(process.env.MONGO_URI, {}, (err) => {
      err
      ? logger.error("⛔ Error al conectarse a MongoDB")
      : logger.info("🆗 Conectados a MongoDB")
    });
  }
}
