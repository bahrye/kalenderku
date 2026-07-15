const https = require('https');
const fs = require('fs');
const path = require('path');

const startYear = 2024;
const endYear = 2027; // Fetch up to 2027
const years = Array.from({length: endYear - startYear + 1}, (_, i) => startYear + i);

const outDir = path.join(__dirname, 'public', 'data');
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

const fetchData = (year) => {
    return new Promise((resolve, reject) => {
        https.get(`https://cal.weruka.dev/api/holidays?year=${year}`, { headers: { 'User-Agent': 'NodeJS' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
};

const main = async () => {
    for (const year of years) {
        console.log(`Fetching data for ${year}...`);
        try {
            const data = await fetchData(year);
            const filtered = data.filter(h => h.type === 'hari_besar_internasional' || h.type === 'hari_besar_nasional');
            
            // Format data differently from original
            const outputData = {
                metadata: {
                    source: "https://cal.weruka.dev/api/holidays",
                    filtered_types: ["hari_besar_internasional", "hari_besar_nasional"],
                    year: year,
                    total_records: filtered.length,
                    generated_at: new Date().toISOString()
                },
                data: filtered
            };
            
            // Give it a different name
            const fileName = `important_days_${year}.json`;
            const filePath = path.join(outDir, fileName);
            
            fs.writeFileSync(filePath, JSON.stringify(outputData, null, 2));
            console.log(`Saved ${year} data to ${filePath}`);
            
        } catch (err) {
            console.error(`Error fetching year ${year}:`, err.message);
        }
    }
    console.log('All done!');
};

main();
