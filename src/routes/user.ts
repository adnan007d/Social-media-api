import { getMe, updateMe } from "@/controllers/user";
import { authenticate } from "@/middleware/authenticate";
import { validateBody } from "@/middleware/validation";
import { usersUpdateSchema } from "@/util/validations";
import { Router } from "express";
import multer, { memoryStorage } from "multer";

const userRouter = Router();

userRouter.use(authenticate);

const upload = multer({ storage: memoryStorage() });

userRouter.get("/me", getMe);
userRouter.patch("/me", upload.single("image"), validateBody(usersUpdateSchema), updateMe);

export default userRouter;
