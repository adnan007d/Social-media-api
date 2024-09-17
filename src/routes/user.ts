import { getMe } from "@/controllers/user";
import { authenticate } from "@/middleware/authenticate";
import { Router } from "express";

const userRouter = Router();

userRouter.use(authenticate);

userRouter.get("/me", getMe);

export default userRouter;
