const fs = require('fs');
const path = require('path');
const https = require('https');

const minYear = 2024;
const maxYear = new Date().getFullYear() + 2;

const dataDir = path.join(__dirname, '..', 'public', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const fetchData = (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
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

async function run() {
  console.log(`Starting important days sync from ${minYear} to ${maxYear}...`);
  
  for (let year = minYear; year <= maxYear; year++) {
    console.log(`Fetching important days for ${year}...`);
    try {
      const apiData = await fetchData(`https://cal.weruka.dev/api/holidays?year=${year}`);
      
      const importantDays = apiData.filter(h => h.type === 'hari_besar_internasional' || h.type === 'hari_besar_nasional');
      
      const importantOutputString = JSON.stringify({
        metadata: {
          source: 'https://cal.weruka.dev/api/holidays',
          filtered_types: ["hari_besar_internasional", "hari_besar_nasional"],
          year: year,
          total_records: importantDays.length,
          generated_at: new Date().toISOString()
        },
        data: importantDays
      }, null, 2);

      const filePath = path.join(dataDir, `important_days_${year}.json`);
      fs.writeFileSync(filePath, importantOutputString, 'utf8');
      console.log(`Saved ${year} to ${filePath}`);
      
    } catch (err) {
      console.error(`Error fetching year ${year}:`, err.message);
    }
  }
  console.log("Important days sync completed! You can now commit and push the JSON files.");
}

run();
