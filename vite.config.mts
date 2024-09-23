import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	test: {
		reporters: ["verbose"],
		globalSetup: ["./tests/setup.ts"]
	},
	plugins: [tsconfigPaths()]
});
