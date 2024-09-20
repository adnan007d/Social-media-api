import { authenticate } from "@/middleware/authenticate";
import { Router } from "express";
import multer from "multer";
import { validateBody } from "@/middleware/validation";
import { postCreateSchema } from "@/util/validations";
import { createPost, deletePost, getPost, getPosts, updatePost } from "@/controllers/posts";
import { likePost, unlikePost } from "@/controllers/likes";

const postsRouter = Router();

const upload = multer({ storage: multer.memoryStorage() });
postsRouter.get("/", getPosts);
postsRouter.post(
	"/",
	authenticate,
	upload.single("image"),
	validateBody(postCreateSchema),
	createPost
);

postsRouter.post("/:postId/like", authenticate, likePost);
postsRouter.delete("/:postId/unlike", authenticate, unlikePost);

postsRouter.get("/:id", getPost);
postsRouter.patch(
	"/:id",
	authenticate,
	upload.single("image"),
	validateBody(postCreateSchema.partial()),
	updatePost
);
postsRouter.delete("/:id", authenticate, deletePost);

export default postsRouter;
