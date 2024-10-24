import Joi from "joi";
import { user } from "../model/user.mjs";
import multer from "multer";
const userSchema = Joi.object({
  username: Joi.string().min(3).max(30).required().messages({
    "string.base": "Username must be a string",
    "string.empty": "Username cannot be empty",
    "string.min": "Username must be at least {#limit} characters long",
    "string.max": "Username must be at most {#limit} characters long",
    "any.required": "Username is required",
  }),

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

const storage = multer.diskStorage({
  destination: (request, file, cb) => {
    cb(null, "job-application-Tikanga-/public");
  },
  filename: (request, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const newfilename = "PFP_" + uniqueName + path.extname(file.originalname);
    cb(null, newfilename);
  },
});
const upload = multer({ storage: storage });

export const signup = async (req, res, next) => {
  const { username, password, confirmPassword, email } = req.body;

  try {
    // Validate the request body against the user schema
    await userSchema.validateAsync({
      username,
      password,
      confirmPassword,
      email,
    });
    const newUser = user({ username, email });
    return res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    // Handle validation errors
    if (error.isJoi) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Handle other errors (e.g., database errors)
    return res.status(500).json({ error: "Internal server error" });
  }
};
