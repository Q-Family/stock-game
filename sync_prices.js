const axios = require('axios');

// These are pulled from your GitHub Secrets automatically
const POLYGON_KEY = process.env.POLYGON_API_KEY;
const JBIN_KEY = process.env.JSONBIN_MASTER_KEY;
const PRICE_BIN_ID = process.env.JSONBIN_PRICE_BIN_ID;

// Your full list of 100 Tickers (ensure these match your app exactly)
const TICKERS = [
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "BRK.B", "LLY", "AVGO",
    "V", "JPM", "WMT", "MA", "UNH", "XOM", "ORCL", "COST", "HD", "PG",
    "ABTV", "ACN", "ADBE", "ADI", "ADM", "ADP", "ADSK", "AEE", "AEP", "AES",
    // ... Add all 100 tickers here to ensure they are all updated in one go
];

async function getMarketData() {
    let attempts = 0;
    let success = false;
    let data = null;
    let dateToFetch = new Date();

    // Loop backwards up to 4 days to find the most recent trading day
    while (attempts < 4 && !success) {
        dateToFetch.setDate(dateToFetch.getDate() - 1);
        const dateStr = dateToFetch.toISOString().split('T')[0];
        
        console.log(`Checking market availability for: ${dateStr}...`);
        
        try {
            const url = `https://api.polygon.io/v2/aggs/grouped/locale/us/market/stocks/${dateStr}?adjusted=true&apiKey=${POLYGON_KEY}`;
            const resp = await axios.get(url);
            
            if (resp.data.results && resp.data.results.length > 0) {
                console.log(`Success! Found data for ${dateStr}`);
                data = {
                    date: dateStr,
                    results: resp.data.results
                };
                success = true;
            } else {
                console.log(`No data for ${dateStr} (Market likely closed).`);
            }
        } catch (err) {
            console.log(`Error on ${dateStr}: ${err.message}`);
        }
        attempts++;
    }
    return data;
}

async function runSync() {
    try {
        const marketData = await getMarketData();
        if (!marketData) throw new Error("Could not find any recent market data.");

        // Create a clean "Price Map"
        const priceMap = {};
        marketData.results.forEach(item => {
            if (TICKERS.includes(item.T)) {
                priceMap[item.T] = item.c; // 'c' is the Closing Price in Polygon's API
            }
        });

        console.log(`Filtered ${Object.keys(priceMap).length} tickers from the bulk set.`);

        // Push to JSONBin
        await axios.put(`https://api.jsonbin.io/v3/b/${PRICE_BIN_ID}`, 
            { 
                lastUpdated: new Date().toLocaleString(),
                marketDate: marketData.date, 
                prices: priceMap 
            },
            { 
                headers: { 
                    'X-Master-Key': JBIN_KEY,
                    'Content-Type': 'application/json'
                } 
            }
        );

        console.log("Master Price Bin updated successfully.");
    } catch (error) {
        console.error("Critical Sync Failure:", error.message);
        process.exit(1); // Tells GitHub the action failed
    }
}

runSync();
