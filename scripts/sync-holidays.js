const fs = require('fs');
const path = require('path');
const https = require('https');

// Helper to fetch data reliably in GitHub Actions (avoids Node 18+ IPv6 fetch timeouts)
const fetchData = (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KalenderkuBot/1.0)' } }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`HTTP status ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject).setTimeout(10000, function() {
        this.destroy();
        reject(new Error('Request Timeout'));
    });
  });
};

// Configure years to sync (2011 to currentYear + 2)
const minYear = 2011;
const maxYear = new Date().getFullYear() + 2;

const dataDir = path.join(__dirname, '..', 'public', 'data');
const sqlFile = path.join(__dirname, 'temp_sync.sql');
const metadataSqlFile = path.join(__dirname, 'temp_metadata.sql');

// Make sure output directories exist
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

async function run() {
  console.log(`Starting holidays sync for years ${minYear} to ${maxYear}...`);
  let hasChanges = false;
  let sqlContent = '';

  for (let year = minYear; year <= maxYear; year++) {
    console.log(`Fetching holidays for year ${year}...`);
    try {
      const apiUrl = process.env.HOLIDAY_API_URL;
      if (!apiUrl) {
        throw new Error("HOLIDAY_API_URL environment variable is not set.");
      }
      let apiData = null;
      try {
        apiData = await fetchData(`${apiUrl}?year=${year}`);
      } catch (e) {
        console.warn(`Failed to fetch from API for year ${year}: ${e.message}`);
        continue;
      }
      if (!Array.isArray(apiData)) {
        console.warn(`Invalid API response format for year ${year}`);
        continue;
      }

      // Format API data to match local structure and D1 expected formats
      const normalizedData = apiData.map(h => ({
        date: h.date,
        name: h.name,
        is_leave_together: h.is_leave_together === true || h.is_leave_together === 1
      })).sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.name.localeCompare(b.name);
      });

      // Check against local JSON file
      const localFilePath = path.join(dataDir, `holidays-${year}.json`);
      let localDataString = '';
      if (fs.existsSync(localFilePath)) {
        localDataString = fs.readFileSync(localFilePath, 'utf8');
      }

      const normalizedDataString = JSON.stringify(normalizedData, null, 2);

      // Process Important Days (fetch from different API)
      let hasImportantChanges = false;
      const importantApiUrl = process.env.IMPORTANT_DAYS_API_URL;
      const importantFilePath = path.join(dataDir, `important_days_${year}.json`);
      let importantOutputString = '';

      if (importantApiUrl) {
        try {
          const importantApiData = await fetchData(`${importantApiUrl}?year=${year}`);
          if (Array.isArray(importantApiData)) {
              const importantDays = importantApiData.filter(h => h.type === 'hari_besar_internasional' || h.type === 'hari_besar_nasional');
              
              let importantLocalDataString = '';
              if (fs.existsSync(importantFilePath)) {
                importantLocalDataString = fs.readFileSync(importantFilePath, 'utf8');
                try {
                  const localParsed = JSON.parse(importantLocalDataString);
                  if (JSON.stringify(localParsed.data) !== JSON.stringify(importantDays)) {
                    hasImportantChanges = true;
                  }
                } catch(e) {
                  hasImportantChanges = true;
                }
              } else {
                hasImportantChanges = true;
              }

              importantOutputString = JSON.stringify({
                metadata: {
                  source: importantApiUrl,
                  filtered_types: ["hari_besar_internasional", "hari_besar_nasional"],
                  year: year,
                  total_records: importantDays.length,
                  generated_at: new Date().toISOString()
                },
                data: importantDays
              }, null, 2);
            }
          }
        } catch (err) {
          console.error(`Error fetching important days for year ${year}:`, err);
        }
      }

      // If data is new or has changed
      if (localDataString !== normalizedDataString) {
        console.log(`Changes detected for year ${year} (holidays). Updating local JSON file and D1 SQL...`);
        fs.writeFileSync(localFilePath, normalizedDataString, 'utf8');
        hasChanges = true;

        // Generate D1 sync statements (Delete existing, then insert new)
        sqlContent += `-- Sync holidays for year ${year}\n`;
        sqlContent += `DELETE FROM holidays WHERE date LIKE '${year}-%';\n`;
        if (normalizedData.length > 0) {
          const values = normalizedData.map(h =>
            `('${h.date}', '${h.name.replace(/'/g, "''")}', ${h.is_leave_together ? 1 : 0})`
          ).join(',\n  ');
          sqlContent += `INSERT INTO holidays (date, name, is_leave_together) VALUES \n  ${values};\n\n`;
        }
      } else {
        console.log(`Year ${year} holidays is already up to date.`);
      }

      if (hasImportantChanges) {
        console.log(`Changes detected for year ${year} (important days). Updating local JSON file...`);
        fs.writeFileSync(importantFilePath, importantOutputString, 'utf8');
        hasChanges = true;
      } else {
        console.log(`Year ${year} important days is already up to date.`);
      }
    } catch (err) {
      console.error(`Error syncing holidays for year ${year}:`, err);
    }
  }

  // If we have SQL statements to execute, write them to temp_sync.sql
  if (sqlContent) {
    fs.writeFileSync(sqlFile, sqlContent, 'utf8');
    console.log(`Generated SQL sync statements in scripts/temp_sync.sql`);
  } else {
    console.log("No database updates needed.");
  }
  
  // Always write metadata SQL (lastChecked = now, lastUpdated only if changed)
  const now = new Date().toISOString();
  let metadataSql = `-- Update metadata\n`;
  metadataSql += `INSERT INTO metadata (key, value) VALUES ('lastChecked', '${now}')\n`;
  metadataSql += `  ON CONFLICT(key) DO UPDATE SET value = excluded.value;\n`;

  if (hasChanges) {
    metadataSql += `INSERT INTO metadata (key, value) VALUES ('lastUpdated', '${now}')\n`;
    metadataSql += `  ON CONFLICT(key) DO UPDATE SET value = excluded.value;\n`;
  }

  fs.writeFileSync(metadataSqlFile, metadataSql, 'utf8');
  console.log(`Generated metadata SQL in scripts/temp_metadata.sql`);

  console.log("Holidays sync run completed.");
}

run();
