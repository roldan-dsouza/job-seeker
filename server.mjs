import express from "express";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import path from "path";
import "dotenv/config";
import router from "./routes/index.mjs";
import cookieParser from "cookie-parser";
import indexRouter from "./routes/index.mjs";
import cors from "cors";
import helmet from "helmet";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());
app.use("/api", indexRouter);

if (process.env.DEVELOPMENT) {
  mongoose
    .connect(process.env.DATABASE_URL)
    .then(console.log("Connected to database"))
    .catch((error) => {
      error: error.message;
    });
}

app.listen(process.env.PORT, () => {
  console.log(`listening on port ${process.env.PORT}`);
});
