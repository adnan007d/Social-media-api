import { deleteComment, getCommentsForPost, postComment } from "@/controllers/comments";
import { authenticate } from "@/middleware/authenticate";
import { validateBody } from "@/middleware/validation";
import { postCommentBodySchema } from "@/util/validations";
import { Router } from "express";

const commentsRouter = Router();

commentsRouter.get("/:postId", getCommentsForPost);
commentsRouter.post("/:postId", authenticate, validateBody(postCommentBodySchema), postComment);
commentsRouter.delete("/delete/:commentId", authenticate, deleteComment);

export default commentsRouter;
