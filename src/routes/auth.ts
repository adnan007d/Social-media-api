import { signIn, signUp } from "@/controllers/auth";
import { validateBody } from "@/middleware/validation";
import { signUpSchema } from "@/util/validations";
import { Router } from "express";

const authRouter = Router();

authRouter.post("/signup", validateBody(signUpSchema), signUp);
authRouter.post("/signin", signIn);
authRouter.post("/forget-password");
authRouter.post("/change-email");
authRouter.post("/change-password");
authRouter.post("/verify-email");

export default authRouter;
