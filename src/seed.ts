import fs from "fs";
import readline from "readline";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import postgres from "postgres";
import env from "@/env";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import { migrate } from "drizzle-orm/postgres-js/migrator";

// Using the same hash for all password to reduce time to generate users
const password = bcrypt.hashSync("WooW@123", 10);
const content = "Lorem ipsum dolor sit amet consectetur adipiscing elit.";
const url =
	"https://res.cloudinary.com/duujhdhts/image/upload/v1726734352/profile/0ac8f4ad-0510-4d87-bfe7-7799ea8e9ebe";
const public_id = "profile/0ac8f4ad-0510-4d87-bfe7-7799ea8e9ebe";
const usersFile = "users.csv";
const imagesFile = "images.csv";
const postsFile = "posts.csv";
const likesFile = "likes.csv";
const commentsFile = "comments.csv";
const noOfUsers = 1e4;
const chanceOfUserImage = 0.5; // 50% chance of user having an image
const noOfPost = { min: 1, max: 5 }; // Min and Max number of posts per user
const chanceOfPostImage = 0.7; // 70% chance of post having an image
const likesPerPost = { min: 10, max: 100 }; // Number of likes per post
const commentsPerPost = { min: 10, max: 20 }; // Number of comments per post

const dbWriteBatchSize = 1e3;

// function runGC() {
// 	if (global.gc) {
// 		global.gc();
// 	} else {
// 		console.warn("No GC hook! Start your program as `node --expose-gc file.js`.");
// 	}
// }

function checkIfAllFilesExists() {
	const files = [usersFile, imagesFile, postsFile, likesFile, commentsFile];
	const exists = files.every((file) => fs.existsSync(file));
	// remove the images file if any of the other files is missing
	if (!exists && fs.existsSync(imagesFile)) {
		fs.unlinkSync(imagesFile);
	}

	return exists;
}

async function confirmation() {
	return new Promise((resolve, reject) => {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout
		});

		rl.question(
			`This will delete the database ${env.DEV_DB_NAME} if exists and create a fresh copy and seed it. Are you sure you want to continue? (yes/no): `,
			(answer) => {
				if (answer === "yes") {
					rl.close();
					resolve(null);
				} else {
					rl.close();
					reject("Aborted");
					process.exit(0);
				}
			}
		);
	});
}

async function main() {
	await confirmation();
	await connectAndMigrate();
	if (checkIfAllFilesExists()) {
		return;
	}

	console.log("Generating users");
	let { userIds, usersWithImageids } = await generateUsers(noOfUsers);
	console.log(`Generated ${userIds.length} users`);
	// console.log(`Memory usage: after generate users: ${process.memoryUsage().rss / 1024 / 1024} MB`);
	// console.log("Waiting for 5 seconds for gc to collect");
	// runGC();
	// await new Promise((resolve) => setTimeout(resolve, 5000));
	console.log("Generating user images");
	// console.log(`Memory usage after GC: ${process.memoryUsage().rss / 1024 / 1024} MB`);
	// console.log("Generating user images");
	await generateImages(usersWithImageids, "profile");
	console.log(`Generated ${usersWithImageids.length} users with images`);
	usersWithImageids = [];
	// console.log(`Memory usage: after generate images: ${process.memoryUsage().rss / 1024 / 1024} MB`);
	// console.log("Waiting for 5 seconds for gc to collect");
	// runGC();
	// await new Promise((resolve) => setTimeout(resolve, 5000));
	// console.log(`Memory usage after GC: ${process.memoryUsage().rss / 1024 / 1024} MB`);
	//
	console.log("Generating posts");
	let { postIds, imageIds } = await generatePosts(userIds);
	console.log(`Generated ${postIds.length} posts`);
	// console.log(`Memory usage: after generate posts: ${process.memoryUsage().rss / 1024 / 1024} MB`);
	// console.log("Waiting for 5 seconds for gc to collect");
	// runGC();
	// await new Promise((resolve) => setTimeout(resolve, 5000));
	// console.log(`Memory usage before GC: ${process.memoryUsage().rss / 1024 / 1024} MB`);

	console.log("Generating post images");
	await generateImages(imageIds, "post");
	console.log(`Generated ${imageIds.length} post images`);
	imageIds = [];

	// console.log(`Memory usage: after generate images: ${process.memoryUsage().rss / 1024 / 1024} MB`);
	// console.log("Waiting for 5 seconds for gc to collect");
	// runGC();
	// await new Promise((resolve) => setTimeout(resolve, 5000));
	// console.log(`Memory usage after GC: ${process.memoryUsage().rss / 1024 / 1024} MB`);

	console.log("Generating likes and comments");
	await generateLikesAndComment(postIds, userIds);
	// await generateLikes(postIds, userIds);
	//
	// await generateComments(postIds, userIds);
	postIds = [];
	userIds = [];
	// console.log(`Memory usage: after generate likes: ${process.memoryUsage().rss / 1024 / 1024} MB`);
	// console.log("Waiting for 5 seconds for gc to collect");
	// runGC();
	// await new Promise((resolve) => setTimeout(resolve, 5000));
	// console.log(`Memory usage after GC: ${process.memoryUsage().rss / 1024 / 1024} MB`);
}

main()
	.then(async () => {
		await dbSeed();
		console.log("Done seeding");
		process.exit(0);
	})
	.catch(console.error);

async function dbSeed() {
	console.log("Done seeding", process.memoryUsage());

	console.log(`Memory usage: ${process.memoryUsage().rss / 1024 / 1024} MB`);
	const db = await connectDB();
	console.log(`Memory usage: after connect db: ${process.memoryUsage().rss / 1024 / 1024} MB`);

	console.log("Inserting data into database");
	console.log("Inserting users");
	await insertUsers(db);
	console.log("Inserting posts");
	await insertPosts(db);
	console.log("Inserting images");
	await insertImages(db);
	console.log("Inserting likes");
	await insertLikes(db);
	console.log("Inserting comments");
	await insertComments(db);
}

async function connectAndMigrate() {
	// Creating a temporary db to connect as we cannot drop the db which is currently in use
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const options: postgres.Options<any> = {
		database: env.DEV_DB_NAME,
		host: env.DB_HOST,
		port: env.DB_PORT,
		username: env.DB_USER,
		password: env.DB_PASS
	};
	let sql = postgres(options);
	const tempDB = `test_${env.DEV_DB_NAME}`;
	await sql.unsafe(`DROP DATABASE IF EXISTS "${tempDB}"`);
	await sql.unsafe(`CREATE DATABASE "${tempDB}"`);
	await sql.end();
	console.log("Temporary database created");
	options.database = tempDB;
	sql = postgres(options);
	await sql.unsafe(`DROP DATABASE IF EXISTS "${env.DEV_DB_NAME}"`);
	await sql.unsafe(`CREATE DATABASE "${env.DEV_DB_NAME}"`);
	console.log("Database created");
	await sql.end();
	sql = postgres({
		database: env.DEV_DB_NAME,
		host: env.DB_HOST,
		port: env.DB_PORT,
		username: env.DB_USER,
		password: env.DB_PASS
	});
	const db = drizzle(sql, { schema });
	console.log("Migrating database");
	await migrate(db, { migrationsFolder: "./migrations" });
	console.log("Database migrated");
	sql.end();
}
async function connectDB() {
	console.log("Connecting to database");
	const sql = postgres({
		database: env.DEV_DB_NAME,
		host: env.DB_HOST,
		port: env.DB_PORT,
		username: env.DB_USER,
		password: env.DB_PASS
	});
	const db = drizzle(sql, { schema });
	console.log("Migrating database");
	await migrate(db, { migrationsFolder: "./migrations" });
	console.log("Database migrated");
	return db;
}

function generateUsers(n: number) {
	const w = fs.createWriteStream(usersFile, { flags: "w" });
	w.write("id,email,username,role,email_verified,password,created_at,updated_at\n");

	const userIds = [] as string[];
	const usersWithImageids = [] as string[];
	return new Promise<{ userIds: string[]; usersWithImageids: string[] }>((resolve, reject) => {
		function write() {
			let canWrite = true;
			while (canWrite && n > 0) {
				const { id, str, userWithImageId } = createUserString();
				if (userWithImageId) {
					usersWithImageids.push(userWithImageId);
				}
				canWrite = w.write(str);
				userIds.push(id);
				if (n % 1e5 === 0) console.log(`current progress: ${1e6 - n} users`);
				--n;
			}
			if (n > 0) {
				w.once("drain", write);
			} else {
				w.close();
			}
		}
		w.on("close", () => resolve({ userIds, usersWithImageids }));
		w.on("error", reject);
		write();
	});
}

function createUserString() {
	const date = getRandomDateFromPastYear();
	const id = randomUUID();
	const email = `${generateUsername()}@example.com`;
	const username = generateUsername();
	const role = "user";
	const email_verified = false;
	const created_at = date;
	const updated_at = date;
	const userWithImageId = Math.random() < chanceOfUserImage ? id : null;
	return {
		id,
		str: `${id},${email},${username},${role},${email_verified},${password},${created_at},${updated_at}\n`,
		userWithImageId
	};
}

function generatePosts(userIds: string[]) {
	const postIds = [] as string[];
	const imageIds = [] as string[];
	const w = fs.createWriteStream(postsFile, { flags: "w" });
	w.write("id,user_id,content,created_at,updated_at\n");
	let i = 0;
	return new Promise<{ postIds: string[]; imageIds: string[] }>((resolve) => {
		function write() {
			let canWrite = true;
			while (canWrite && i < userIds.length) {
				const { str, imageIds: Iids, ids } = generatePostString(userIds[i]!);
				canWrite = w.write(str);
				imageIds.push(...Iids);
				postIds.push(...ids);
				if (i % 1e5 === 0) {
					console.log(`current progres ${postIds.length} posts`);
				}
				++i;
			}
			if (i < userIds.length) {
				w.once("drain", write);
			} else {
				w.close();
			}
		}
		write();
		w.on("close", () => resolve({ postIds, imageIds }));
	});
}

function generatePostString(userId: string) {
	let noOfPosts = Math.floor(Math.random() * (noOfPost.max - noOfPost.min + 1)) + noOfPost.min;
	let str = "";
	const imageIds = [] as string[];
	const ids = [] as string[];
	while (noOfPosts--) {
		const date = getRandomDateFromPastYear();
		const id = randomUUID();
		str += `${id},${userId},${content},${date},${date}\n`;
		if (Math.random() < chanceOfPostImage) {
			imageIds.push(id);
		}
		ids.push(id);
	}
	return { str, imageIds, ids };
}

async function generateLikesAndComment(postIds: string[], userIds: string[]) {
	fs.writeFileSync(likesFile, "id,user_id,post_id,created_at,updated_at\n");
	fs.writeFileSync(commentsFile, "id,user_id,post_id,content,created_at,updated_at\n");
	let likesCount = 0;
	let commentsCount = 0;
	while (postIds.length) {
		const postId = postIds.shift()!;
		const ln =
			Math.floor(Math.random() * (likesPerPost.max - likesPerPost.min + 1)) + likesPerPost.min;
		likesCount += await generateLikeForUsers(postId, userIds, ln);
		const cn =
			Math.floor(Math.random() * (commentsPerPost.max - commentsPerPost.min + 1)) +
			commentsPerPost.min;
		commentsCount += await generateCommentForUsers(postId, userIds, cn);
	}
	console.log(`${likesCount} likes generated`);
	console.log(`${commentsCount} comments generated`);
}

function generateImages(ref_ids: string[], type: "profile" | "post") {
	const w = fs.createWriteStream(imagesFile, { flags: "a" });
	if (!fs.existsSync(imagesFile)) {
		w.write("id,type,url,public_id,ref_id,created_at,updated_at\n");
	}
	let i = 0;

	return new Promise((resolve, reject) => {
		function write() {
			let canWrite = true;
			while (canWrite && i < ref_ids.length) {
				const str = generateImageString(ref_ids[i]!, type);
				canWrite = w.write(str);
				if (i % 1e5 === 0) console.log(`current progress ${i} images`);

				++i;
			}
			if (i < ref_ids.length) {
				w.once("drain", write);
			} else {
				w.close();
			}
		}
		w.on("close", () => resolve(null));
		w.on("error", reject);
		write();
	});
}

function generateImageString(ref_id: string, type: "profile" | "post") {
	const date = getRandomDateFromPastYear();
	const id = randomUUID();
	return `${id},${type},${url},${public_id},${ref_id},${date},${date}\n`;
}

async function generateLikeForUsers(post_id: string, user_ids: string[], n: number) {
	const w = fs.createWriteStream(likesFile, { flags: "a" });
	let i = 0;
	let likesCount = 0;
	const users = [] as string[];
	return new Promise<number>((resolve, reject) => {
		function write() {
			let canWrite = true;
			while (canWrite && i < n) {
				const str = generateLikeString(post_id, getUser());
				canWrite = w.write(str);
				++likesCount;
				++i;
			}
			if (i < n) {
				w.once("drain", write);
			} else {
				w.close();
			}
		}
		w.on("close", () => resolve(likesCount));
		w.on("error", reject);
		write();

		function getUser() {
			const user = user_ids[Math.floor(Math.random() * user_ids.length)]!;
			if (users.includes(user)) {
				return getUser();
			}
			users.push(user);
			return user;
		}
	});
}

function generateLikeString(post_id: string, user_id: string) {
	const date = getRandomDateFromPastYear();
	const id = randomUUID();
	return `${id},${user_id},${post_id},${date}\n`;
}

function generateCommentForUsers(post_id: string, user_ids: string[], n: number) {
	const w = fs.createWriteStream(commentsFile, { flags: "a" });
	let i = 0;
	let commentsCount = 0;
	return new Promise<number>((resolve, reject) => {
		function write() {
			let canWrite = true;
			while (canWrite && i < n) {
				const str = generateCommentString(
					post_id,
					user_ids[Math.floor(Math.random() * user_ids.length)]!
				);
				canWrite = w.write(str);
				++commentsCount;
				++i;
			}
			if (i < n) {
				w.once("drain", write);
			} else {
				w.close();
			}
		}
		w.on("close", () => resolve(commentsCount));
		w.on("error", reject);
		write();
	});
}

function generateCommentString(post_id: string, user_id: string) {
	const date = getRandomDateFromPastYear();
	const id = randomUUID();
	return `${id},${user_id},${post_id},${content},${date},${date}\n`;
}

function generateUsername() {
	return Math.random().toString(36).substring(2, 15);
}

async function insertUsers(db: Awaited<ReturnType<typeof connectDB>>) {
	const r = fs.createReadStream("users.csv");
	const rl = readline.createInterface({
		input: r,
		crlfDelay: Infinity
	});

	const users = [] as schema.InsertUser[];
	let linesRead = 0;

	return new Promise((resolve, reject) => {
		rl.on("line", async (line) => {
			if (linesRead++ === 0) return; // Skip the header
			const [id, email, username, role, email_verified, password, created_at, updated_at] = line
				.trim()
				.split(",");
			users.push({
				id: id!,
				email: email!,
				username: username!,
				role: role as "user",
				email_verified: email_verified === "true",
				password: password!,
				created_at: new Date(created_at!),
				updated_at: new Date(updated_at!)
			});

			if (linesRead % 1e5 === 0) {
				console.log(`Inserted ${linesRead} users`);
			}

			if (users.length >= dbWriteBatchSize) {
				rl.pause();
				await db.insert(schema.usersTable).values(users.splice(0, dbWriteBatchSize));
				rl.resume();
			}
		});

		rl.on("close", async () => {
			if (users.length > 0) {
				await db.insert(schema.usersTable).values(users);
			}
			console.log(`Inserted ${linesRead} users`);
			resolve(null);
		});

		rl.on("error", reject);
	});
}

async function insertPosts(db: Awaited<ReturnType<typeof connectDB>>) {
	const r = fs.createReadStream("posts.csv");
	const rl = readline.createInterface({
		input: r,
		crlfDelay: Infinity
	});
	const posts = [] as (typeof schema.postsTable.$inferInsert)[];
	let linesRead = 0;

	return new Promise((resolve, reject) => {
		rl.on("line", async (line) => {
			if (linesRead++ === 0) return; // Skip the header
			const [id, user_id, content, created_at, updated_at] = line.trim().split(",");
			posts.push({
				id: id!,
				user_id: user_id!,
				content: content!,
				created_at: new Date(created_at!),
				updated_at: new Date(updated_at!)
			});

			if (linesRead % 1e5 === 0) {
				console.log(`Inserted ${linesRead} posts`);
			}

			if (posts.length >= dbWriteBatchSize) {
				rl.pause();
				await db.insert(schema.postsTable).values(posts.splice(0, dbWriteBatchSize));
				rl.resume();
			}
		});
		rl.on("close", async () => {
			if (posts.length > 0) {
				await db.insert(schema.postsTable).values(posts);
			}
			console.log(`Inserted ${linesRead} posts`);
			resolve(null);
		});
		rl.on("error", reject);
	});
}

async function insertImages(db: Awaited<ReturnType<typeof connectDB>>) {
	const r = fs.createReadStream("images.csv");
	const rl = readline.createInterface({
		input: r,
		crlfDelay: Infinity
	});
	const images = [] as schema.InsertImage[];
	let linesRead = 0;

	return new Promise((resolve, reject) => {
		rl.on("line", async (line) => {
			if (linesRead++ === 0) return; // Skip the header
			const [id, type, url, public_id, ref_id, created_at, updated_at] = line.trim().split(",");
			images.push({
				id: id!,
				type: type as "profile" | "post",
				url: url!,
				public_id: public_id!,
				ref_id: ref_id!,
				created_at: new Date(created_at!),
				updated_at: new Date(updated_at!)
			});
			if (linesRead % 1e5 === 0) {
				console.log(`Inserted ${linesRead} images`);
			}

			if (images.length >= dbWriteBatchSize) {
				rl.pause();
				await db.insert(schema.imagesTable).values(images.splice(0, dbWriteBatchSize));
				rl.resume();
			}
		});
		rl.on("close", async () => {
			if (images.length > 0) {
				await db.insert(schema.imagesTable).values(images);
			}
			console.log(`Inserted ${linesRead} images`);
			resolve(null);
		});
		rl.on("error", reject);
	});
}

async function insertLikes(db: Awaited<ReturnType<typeof connectDB>>) {
	const r = fs.createReadStream("likes.csv");
	const rl = readline.createInterface({
		input: r,
		crlfDelay: Infinity
	});
	const likes = [] as (typeof schema.likesTable.$inferInsert)[];
	let linesRead = 0;

	return new Promise((resolve, reject) => {
		rl.on("line", async (line) => {
			if (linesRead++ === 0) return; // Skip the header
			const [id, user_id, post_id, created_at] = line.trim().split(",");
			likes.push({
				id: id!,
				user_id: user_id!,
				post_id: post_id!,
				created_at: new Date(created_at!)
			});

			if (linesRead % 1e5 === 0) {
				console.log(`Inserted ${linesRead} likes`);
			}

			if (likes.length >= dbWriteBatchSize) {
				rl.pause();
				try {
					await db
						.insert(schema.likesTable)
						.values(likes.splice(0, dbWriteBatchSize))
						.onConflictDoNothing({
							target: [schema.likesTable.user_id, schema.likesTable.post_id]
						});
				} catch (error) {
					console.log(error);
					console.log("continuing");
				}
				rl.resume();
			}
		});
		rl.on("close", async () => {
			if (likes.length > 0) {
				await db.insert(schema.likesTable).values(likes);
			}
			console.log(`Inserted ${linesRead} likes`);
			resolve(null);
		});
		rl.on("error", reject);
	});
}

async function insertComments(db: Awaited<ReturnType<typeof connectDB>>) {
	const r = fs.createReadStream("comments.csv");
	const rl = readline.createInterface({
		input: r,
		crlfDelay: Infinity
	});
	const comments = [] as (typeof schema.commentTable.$inferInsert)[];
	let linesRead = 0;

	return new Promise((resolve, reject) => {
		rl.on("line", async (line) => {
			if (linesRead++ === 0) return; // Skip the header
			const [id, user_id, post_id, content, created_at, updated_at] = line.trim().split(",");
			comments.push({
				id: id!,
				user_id: user_id!,
				post_id: post_id!,
				content: content!,
				created_at: new Date(created_at!),
				updated_at: new Date(updated_at!)
			});

			if (linesRead % 1e5 === 0) {
				console.log(`Inserted ${linesRead} comments`);
			}

			if (comments.length >= dbWriteBatchSize) {
				rl.pause();
				await db.insert(schema.commentTable).values(comments.splice(0, dbWriteBatchSize));
				rl.resume();
			}
		});
		rl.on("close", async () => {
			if (comments.length > 0) {
				await db.insert(schema.commentTable).values(comments);
			}
			console.log(`Inserted ${linesRead} comments`);
			resolve(null);
		});
		rl.on("error", reject);
	});
}

function getRandomDateFromPastYear() {
	const today = new Date();
	const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
	const timeDiff = today.getTime() - oneYearAgo.getTime();
	const randomTime = Math.random() * timeDiff;
	const randomDate = new Date(today.getTime() - randomTime);
	return randomDate.toISOString();
}
