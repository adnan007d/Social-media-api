import { deleteComment, getCommentsForPost } from "@/controllers/comments";
import { authenticate } from "@/middleware/authenticate";
import { Router } from "express";

const commentsRouter = Router();

commentsRouter.get("/:postId", getCommentsForPost);
commentsRouter.delete("/delete/:commentId", authenticate, deleteComment);

export default commentsRouter;
