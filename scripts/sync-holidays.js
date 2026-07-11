const fs = require('fs');
const path = require('path');

// Configure years to sync (2011 to currentYear + 2)
const minYear = 2011;
const maxYear = new Date().getFullYear() + 2;

const dataDir = path.join(__dirname, '..', 'public', 'data');
const sqlFile = path.join(__dirname, 'temp_sync.sql');

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
      const response = await fetch(`https://libur.deno.dev/api?year=${year}`);
      if (!response.ok) {
        console.warn(`Failed to fetch from API for year ${year}: HTTP ${response.status}`);
        continue;
      }
      const apiData = await response.json();
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

      // If data is new or has changed
      if (localDataString !== normalizedDataString) {
        console.log(`Changes detected for year ${year}. Updating local JSON file and D1 SQL...`);
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
        console.log(`Year ${year} is already up to date.`);
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
  
  // Write metadata with last update time
  const metadata = { lastUpdated: new Date().toISOString() };
  fs.writeFileSync(path.join(dataDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');

  console.log("Holidays sync run completed.");
}

run();
