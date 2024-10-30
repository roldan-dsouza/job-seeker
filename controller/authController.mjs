import Joi from "joi";
import { User } from "../model/user.mjs";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { createAccessToken, createRefreshToken } from "../jwtToken.mjs";
import bcrypt from "bcrypt";
import fs from "fs";
import mongoose from "mongoose";
import NodeCache from "node-cache";
import { sendOtp, verifyOtp } from "./otpControl.mjs";
import { checkMissingFieldsInSignUp } from "../middleware/middleware.mjs";
import { fetchNameLocationAndJobTitleFromPdf } from "../functions/userData.mjs";

const cache = new NodeCache();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define user schema for validation

const userSchema2 = Joi.object({
  username: Joi.string().min(3).max(30).required().messages({
    "string.base": "Username must be a string",
    "string.empty": "Username cannot be empty",
    "string.min": "Username must be at least {#limit} characters long",
    "string.max": "Username must be at most {#limit} characters long",
    "any.required": "Username is required",
  }),
  jobTitle: Joi.alternatives().try(
    Joi.string().required().messages({
      "string.base": "Job Title must be a string",
      "string.empty": "Job Title cannot be empty",
      "any.required": "Job Title is required",
    }),
    Joi.array().items(Joi.string()).required().messages({
      "array.base": "Job Title must be an array of strings",
      "any.required": "Job Title is required",
    })
  ),
  location: Joi.string().required().messages({
    "string.base": "Location must be a string",
    "string.empty": "Location cannot be empty",
    "any.required": "Location is required",
  }),
});

const userSchema = Joi.object({
  email: Joi.string()
    .pattern(new RegExp("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"))
    .required()
    .messages({
      "string.base": "Email must be a string",
      "string.empty": "Email cannot be empty",
      "string.pattern.base": "Email must be a valid email format",
      "any.required": "Email is required",
    }),
  password: Joi.string()
    .pattern(new RegExp("^[a-zA-Z0-9]{3,30}$"))
    .required()
    .messages({
      "string.base": "Password must be a string",
      "string.empty": "Password cannot be empty",
      "string.pattern.base": "Password must be 3 to 30 alphanumeric characters",
      "any.required": "Password is required",
    }),
  confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
    "string.base": "Confirm Password must be a string",
    "any.only": "Confirm Password must match the Password",
    "any.required": "Confirm Password is required",
  }),
});

// Set up Multer storage configuration with file filter to only allow PDFs
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../public/uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const newFilename = "PFP_" + uniqueName + path.extname(file.originalname);
    cb(null, newFilename);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype !== "application/pdf") {
    return cb(new Error("Only PDF files are allowed!"), false);
  }
  cb(null, true);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).single("pdfFile");

export const initialSignup = async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res
      .status(500)
      .json({ error: "Database connection issue. Please try again later." });
  }
  const { password, confirmPassword, email } = req.body;
  try {
    await userSchema.validateAsync({
      password,
      confirmPassword,
      email,
    });

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const otpSent = await sendOtp(email);
    if (!otpSent) {
      return res.status(500).json({ error: "Failed to send OTP" });
    }
    cache.set(email, {
      password,
    });
    return res
      .status(200)
      .json({ message: "OTP sent successfully, please verify." });
  } catch (error) {
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }

    /*if (req.file) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error("Failed to delete file:", unlinkErr);
      });
    }*/

    return res.status(500).json({ error: error.message });
  }
};

export const finalSignup = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Resume file is required" });
  }
  const buffer = fs.readFileSync(req.file.path);
  const { email, otp } = req.body;
  if (!email || !otp) {
    if (req.file) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error("Failed to delete file:", unlinkErr);
      });
    }
    return res.status(400).json({ error: "missing fields email or otp" });
  }

  const userData = cache.get(email);
  const otpValid = await verifyOtp(email, otp);
  if (!otpValid) {
    if (userData && userData.pdfAddress) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error("Failed to delete file:", unlinkErr);
      });
    }
    return res.status(400).json({ error: "Invalid or expired OTP" });
  }

  if (!userData) {
    if (req.file) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error("Failed to delete file:", unlinkErr);
      });
    }
    return res.status(400).json({ error: "User data not found or expired" });
  }
  const extractedData = await fetchNameLocationAndJobTitleFromPdf(
    buffer,
    req.ip
  );
  const pdfAddress = fs.readFileSync(req.file.path);
  const hashedPassword = await bcrypt.hash(userData.password, 10);
  const newUser = new User({
    userName: extractedData.name,
    pdfAddress: pdfAddress,
    email: email,
    password: hashedPassword,
    jobTitle: extractedData.jobTitle,
    location: extractedData.location,
  });

  await newUser.save();

  const payload = {
    _id: newUser._id,
    username: newUser.userName,
  };

  const accessToken = await createAccessToken(payload);
  const refreshToken = await createRefreshToken(payload);

  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 15 * 60 * 1000 * 8,
  });

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  return res.status(201).json({ message: "User registered successfully" });
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const payload = {
      _id: user._id,
      username: user.userName,
    };

    const accessToken = await createAccessToken(payload);
    const refreshToken = await createRefreshToken(payload);

    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 15 * 60 * 1000 * 8,
    });

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({ message: "Login successful" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const uploadMiddleware = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, "../public/uploads"));
    },
    filename: (req, file, cb) => {
      const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueName + path.extname(file.originalname));
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed!"), false);
    }
    cb(null, true);
  },
}).single("pdfFile");
