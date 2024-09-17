import env from "@/env";
import pino from "pino";
import pretty from "pino-pretty";
import path from "path";

function getDestination(NODE_ENV: string) {
	switch (NODE_ENV) {
		case "development":
			return 1;
		case "production":
			return env.LOG_FILE;
		case "test":
			return path.join(path.dirname(env.LOG_FILE), "test_" + path.basename(env.LOG_FILE));
		default:
			return 1;
	}
}

const logger = pino(
	pretty({
		sync: env.NODE_ENV === "test",
		ignore: "pid,hostname",
		translateTime: "SYS:standard",
		destination: getDestination(env.NODE_ENV),
		colorize: env.NODE_ENV === "development"
	})
);

export default logger;
