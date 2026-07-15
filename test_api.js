const testFetch = async () => {
    for (let i = 2011; i <= 2028; i++) {
        try {
            console.log(`Fetching ${i}...`);
            const start = Date.now();
            const res = await fetch(`https://cal.weruka.dev/api/holidays?year=${i}`);
            console.log(`Year ${i} status: ${res.status} in ${Date.now() - start}ms`);
        } catch (e) {
            console.error(`Year ${i} error:`, e.message);
        }
    }
}
testFetch();
