export function generateUsername() {
	return Math.random().toString(36).substring(7);
}

export function generateEmail() {
	return `${generateUsername()}@example.com`;
}

export const testPassword = "WooW@123";
