import { signIn, signUp, logout } from "@/controllers/auth";
import { authenticate } from "@/middleware/authenticate";
import { validateBody } from "@/middleware/validation";
import { signUpSchema } from "@/util/validations";
import { Router } from "express";

const authRouter = Router();

authRouter.post("/signup", validateBody(signUpSchema), signUp);
authRouter.post("/signin", signIn);
authRouter.post("/logout", authenticate, logout);
authRouter.post("/forget-password");
authRouter.post("/change-email");
authRouter.post("/change-password");
authRouter.post("/verify-email");

export default authRouter;
