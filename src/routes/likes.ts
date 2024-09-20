import { likePost, unlikePost } from "@/controllers/likes";
import { authenticate } from "@/middleware/authenticate";
import { Router } from "express";

const likesRouter = Router();

likesRouter.post("/:postId", authenticate, likePost);
likesRouter.delete("/:postId", authenticate, unlikePost);

export default likesRouter;
