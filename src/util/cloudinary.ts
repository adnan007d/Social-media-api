import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from "cloudinary";
import env from "@/env";
import { Readable } from "stream";

cloudinary.config({
	cloud_name: env.CLOUDINARY_CLOUD_NAME,
	api_key: env.CLOUDINARY_API_KEY,
	api_secret: env.CLOUDINARY_API_SECRET
});

export async function uploadStream(file: Express.Multer.File, options: UploadApiOptions) {
	return new Promise<UploadApiResponse>((resolve, reject) => {
		const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
			if (error) {
				return reject(error);
			}
			if (!result) {
				return reject(new Error("cloudinary file upload result was empty"));
			}
			return resolve(result);
		});

		Readable.from(file.buffer).pipe(stream);
	});
}

export default cloudinary;
