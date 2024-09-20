import { createClient } from "redis";
import env from "@/env";

const redis = createClient({ url: env.REDIS_URL });

export default redis;
