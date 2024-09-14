function* fibo() {
	let a = 0;
	let b = 1;
	while (true) {
		yield a;
		const t = a;
		a = b;
		b = t + b;
	}
}
const fiboGen = fibo();
console.log(fiboGen.next().value);
console.log(fiboGen.next().value);
console.log(fiboGen.next().value);
console.log(fiboGen.next().value);
console.log(fiboGen.next().value);
