import Joi from "joi";

// Define user schema for validation

export const userSchema = Joi.object({
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
