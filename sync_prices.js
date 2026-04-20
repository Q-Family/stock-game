const axios = require('axios');

const POLYGON_KEY  = process.env.POLYGON_API_KEY;
const JBIN_KEY     = process.env.JSONBIN_MASTER_KEY;
const PRICE_BIN_ID = process.env.JSONBIN_PRICE_BIN_ID;

// Must match sp100Data[].t in your HTML exactly
const TICKERS = [
    "AAPL","MSFT","NVDA","GOOGL","AMZN","AVGO","META","TSLA","BRK.B","LLY",
    "WMT","JPM","V","ORCL","XOM","MA","JNJ","COST","HD","NFLX",
    "BAC","ABBV","AMD","MU","GE","PG","CVX","WFC","UNH","CSCO",
    "KO","MS","CAT","GS","IBM","MRK","AXP","RTX","PM","CRM",
    "TMUS","TMO","C","MCD","ABT","AMAT","ISRG","LIN","DIS","BX",
    "PEP","INTC","QCOM","SCHW","BA","AMGN","INTU","UBER","BKNG","TJX",
    "VZ","NEE","BLK","TXN","ACN","COF","NOW","GILD","PFE","ADBE",
    "BSX","LOW","UNP","HON","SBUX","DE","SPGI","BMY","MMM","LMT",
    "SYK","REGN","GD","TGT","CME","ADP","MDLZ","NKE","CL","UPS",
    "PLD","FDX","SO","MO","DUK","EMR","PANW","SLB","KLAC","OXY"
];

async function getMarketData() {
    let attempts = 0;
    let dateToFetch = new Date();

    // Walk backwards up to 4 days to find the most recent trading day
    while (attempts < 4) {
        dateToFetch.setDate(dateToFetch.getDate() - 1);
        const dateStr = dateToFetch.toISOString().split('T')[0];
        console.log(`Checking market data for: ${dateStr}...`);

        try {
            const url = `https://api.polygon.io/v2/aggs/grouped/locale/us/market/stocks/${dateStr}?adjusted=true&apiKey=${POLYGON_KEY}`;
            const resp = await axios.get(url);

            if (resp.data.results && resp.data.results.length > 0) {
                console.log(`Found data for ${dateStr} (${resp.data.results.length} stocks)`);
                return { date: dateStr, results: resp.data.results };
            } else {
                console.log(`No data for ${dateStr} — market likely closed`);
            }
        } catch (err) {
            console.log(`Error fetching ${dateStr}: ${err.message}`);
        }
        attempts++;
    }
    return null;
}

async function runSync() {
    try {
        const marketData = await getMarketData();
        if (!marketData) throw new Error('Could not find any recent market data after 4 attempts');

        // Build price map — only include tickers our app uses
        const prices = {};
        marketData.results.forEach(item => {
            if (TICKERS.includes(item.T)) {
                prices[item.T] = item.c;  // c = closing price
            }
        });

        console.log(`Matched ${Object.keys(prices).length} of ${TICKERS.length} tickers`);

        // Write to JSONBin in the exact shape the HTML expects:
        // { date: "2026-04-19", prices: { "AAPL": 198.15, ... } }
        await axios.put(
            `https://api.jsonbin.io/v3/b/${PRICE_BIN_ID}`,
            { date: marketData.date, prices },
            { headers: { 'X-Master-Key': JBIN_KEY, 'Content-Type': 'application/json' } }
        );

        console.log(`Price bin updated — ${Object.keys(prices).length} prices written for ${marketData.date}`);

    } catch (error) {
        console.error('Sync failed:', error.message);
        process.exit(1);
    }
}

runSync();
