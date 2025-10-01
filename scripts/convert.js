const fs = require("fs");
const csv = require("csv-parser");

const results = new Map(); // key = city+country, value = city object

fs.createReadStream(__dirname + "/worldcities.csv")
  .pipe(csv())
  .on("data", (row) => {
    if (row.population && !isNaN(row.population)) {
      const key = `${row.city},${row.country}`;

      const cityObj = {
        name: row.city,
        lat: parseFloat(row.lat),
        lng: parseFloat(row.lng),
        population: parseInt(row.population, 10),
      };

      if (!results.has(key)) {
        results.set(key, cityObj);
      } else {
        // keep the one with the larger population
        const existing = results.get(key);
        if (cityObj.population > existing.population) {
          results.set(key, cityObj);
        }
      }
    }
  })
  .on("end", () => {
    // Convert map to array
    const cities = Array.from(results.values());

    // Step 1: sort by population (desc)
    cities.sort((a, b) => b.population - a.population);

    // Step 2: keep top 1000
    const topCities = cities.slice(0, 1000);

    // Step 3: sort alphabetically
    topCities.sort((a, b) => a.name.localeCompare(b.name));

    // Step 4: final output without population
    const finalOutput = topCities.map(({ name, lat, lng }) => ({
      name,
      lat,
      lng,
    }));

    fs.writeFileSync(
      __dirname + "/top_1000_cities.json",
      JSON.stringify(finalOutput, null, 2),
      "utf-8"
    );

    console.log(
      "✅ Saved top_1000_cities.json with",
      finalOutput.length,
      "unique cities (alphabetical order)"
    );
  });
