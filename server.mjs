import express from "express";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import path from "path";
import "dotenv/config";
import cookieParser from "cookie-parser";
import indexRouter from "./routes/index.mjs";
import cors from "cors";
import helmet from "helmet";
import signedUserRouter from "./routes/signedInUser.mjs";
import bodyParser from "body-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

if (process.env.NODE_ENV == "DEVELOPMENT") {
  mongoose
    .connect(process.env.DATABASE_URL)
    .then(console.log("Connected to database"))
    .catch((error) => {
      error: error.message;
    });
}

//app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "./public")));
app.use("/api", indexRouter);
app.use("/api/signed", signedUserRouter);

app.listen(process.env.PORT, () => {
  console.log(`listening on port ${process.env.PORT}`);
});
