import axios from "axios";

const ALPHA_API_KEY = "XCHRXA73EI71XJHG";
const TELEGRAM_BOT_TOKEN = "7512439040:AAExqGQaN-4vC6PnT0f12n6J_vlE3xYQp3k";
const TELEGRAM_CHAT_ID = "573040944";
const MAX_LOG_SIZE = 20;

let alertLog = [];
let alertsEnabled = true;
let currentDate = new Date().toDateString();
let sentAlerts = new Set();
let summarySentToday = false;

const top30 = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK.B", "UNH", "JNJ",
  "XOM", "JPM", "V", "MA", "PG", "AVGO", "HD", "PFE", "MRK", "COST",
  "BAC", "WMT", "DIS", "TSM", "ORCL", "PEP", "KO", "ABBV", "NFLX", "AMD"
];

function logAlert(msg) {
  const now = new Date().toDateString();
  if (now !== currentDate) {
    alertLog = [];
    sentAlerts.clear();
    summarySentToday = false;
    currentDate = now;
  }
  alertLog.unshift({ msg, time: new Date().toLocaleTimeString() });
  if (alertLog.length > MAX_LOG_SIZE) alertLog.pop();
}

async function fetchIntradayChange(symbol) {
  try {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=60min&apikey=${ALPHA_API_KEY}`;
    const res = await axios.get(url, { timeout: 10000 });
    
    // Check for API error messages
    if (res.data.Note) {
      throw new Error(`API Rate limit: ${res.data.Note}`);
    }
    
    if (res.data.Information) {
      throw new Error(`API Info: ${res.data.Information}`);
    }
    
    const data = res.data["Time Series (60min)"];
    if (!data || Object.keys(data).length === 0) {
      throw new Error(`No intraday data for ${symbol}`);
    }
    
    const times = Object.keys(data).sort().reverse();
    if (times.length < 2) {
      throw new Error(`Insufficient data points for ${symbol}`);
    }
    
    const latest = parseFloat(data[times[0]]["4. close"]);
    const compareIndex = Math.min(4, times.length - 1);
    const old = parseFloat(data[times[compareIndex]]["4. close"]);
    
    if (isNaN(latest) || isNaN(old) || old === 0) {
      throw new Error(`Invalid price data for ${symbol}`);
    }
    
    const change = ((latest - old) / old * 100).toFixed(2);
    return { symbol, latest: latest.toFixed(2), old: old.toFixed(2), change };
  } catch (error) {
    console.error(`Error fetching intraday data for ${symbol}:`, error.message);
    throw error;
  }
}

async function fetch72WeekDrop(symbol) {
  try {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY_ADJUSTED&symbol=${symbol}&apikey=${ALPHA_API_KEY}`;
    const res = await axios.get(url, { timeout: 10000 });
    
    // Check for API error messages
    if (res.data.Note) {
      throw new Error(`API Rate limit: ${res.data.Note}`);
    }
    
    if (res.data.Information) {
      throw new Error(`API Info: ${res.data.Information}`);
    }
    
    const data = res.data["Weekly Adjusted Time Series"];
    if (!data || Object.keys(data).length === 0) {
      throw new Error(`No weekly data for ${symbol}`);
    }
    
    const dates = Object.keys(data).slice(0, 104); // Get up to 2 years of data
    if (dates.length < 72) {
      throw new Error(`Insufficient weekly data for ${symbol}`);
    }
    
    const recentDates = dates.slice(0, 8);
    
    // Calculate 72-week high
    const high72 = Math.max(...dates.map(d => parseFloat(data[d]["2. high"])));
    const latest = parseFloat(data[recentDates[0]]["4. close"]);
    
    if (isNaN(high72) || isNaN(latest) || high72 === 0) {
      throw new Error(`Invalid price data for ${symbol}`);
    }
    
    const drop = ((latest - high72) / high72 * 100).toFixed(2);
    return { symbol, latest: latest.toFixed(2), high72: high72.toFixed(2), drop };
  } catch (error) {
    console.error(`Error fetching 72-week data for ${symbol}:`, error.message);
    throw error;
  }
}

async function sendTelegramAlert(message) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message
    }, { timeout: 5000 });
  } catch (error) {
    console.error("Error sending Telegram alert:", error.message);
    throw error;
  }
}

function handleTelegramCommands(text) {
  try {
    if (text === "/status") {
      return alertLog.length
        ? alertLog.slice(0, 5).map(a => `[${a.time}] ${a.msg}`).join("\n")
        : "📭 No alerts today.";
    }
    if (text === "/summary") {
      return "✅ Monitoring top 30 stocks every 10 minutes. Alerts enabled.";
    }
    if (text === "/toggle") {
      alertsEnabled = !alertsEnabled;
      return `Alerts are now ${alertsEnabled ? "ENABLED" : "DISABLED"} 🚦`;
    }
    return "Unknown command. Available: /status, /summary, /toggle";
  } catch (error) {
    console.error("Error handling Telegram command:", error.message);
    return "Error processing command.";
  }
}

// Add delay function to prevent API rate limiting
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default async function handler(req, res) {
  try {
    // Handle Telegram webhook commands
    if (req.method === "POST" && req.body?.message?.text?.startsWith("/")) {
      const response = handleTelegramCommands(req.body.message.text.trim());
      await sendTelegramAlert(response);
      return res.status(200).json({ ok: true });
    }

    let alerts = [];
    let gainers = 0, losers = 0;
    let processedCount = 0;
    let errors = [];

    console.log(`Starting stock analysis for ${top30.length} symbols...`);

    for (const symbol of top30) {
      try {
        // Add delay to prevent API rate limiting (Alpha Vantage allows 5 calls per minute for free tier)
        if (processedCount > 0 && processedCount % 5 === 0) {
          console.log(`Processed ${processedCount} symbols, waiting 60 seconds...`);
          await delay(60000); // Wait 1 minute after every 5 calls
        }

        // Check intraday changes
        try {
          const data = await fetchIntradayChange(symbol);
          const drop = parseFloat(data.change);
          
          if (drop <= -3) {
            const msg = `${symbol} dropped ${drop}% in 4 hrs! 💰$${data.old} → $${data.latest}`;
            if (!sentAlerts.has(msg)) {
              sentAlerts.add(msg);
              logAlert(msg);
              if (alertsEnabled) await sendTelegramAlert("⚠️ " + msg);
              alerts.push(msg);
            }
            losers++;
          } else if (drop >= 3) {
            gainers++;
          }
        } catch (intradayError) {
          errors.push(`Intraday error for ${symbol}: ${intradayError.message}`);
        }

        // Small delay between different API calls for same symbol
        await delay(1000);

        // Check 72-week drops
        try {
          const dropData = await fetch72WeekDrop(symbol);
          const drop = parseFloat(dropData.drop);
          
          if (drop <= -35) {
            const msg = `${symbol} down ${drop}% from 72w high! 📉 $${dropData.high72} → $${dropData.latest}`;
            if (!sentAlerts.has(msg)) {
              sentAlerts.add(msg);
              logAlert(msg);
              if (alertsEnabled) await sendTelegramAlert("🔻 " + msg);
              alerts.push(msg);
            }
          }
        } catch (weeklyError) {
          errors.push(`Weekly error for ${symbol}: ${weeklyError.message}`);
        }

        processedCount++;
        console.log(`Processed ${processedCount}/${top30.length}: ${symbol}`);
        
        // Small delay between symbols
        await delay(500);
        
      } catch (error) {
        errors.push(`General error for ${symbol}: ${error.message}`);
        console.error(`Error processing ${symbol}:`, error.message);
      }
    }

    // Send summary if enabled and not sent today
    if (!summarySentToday && alertsEnabled) {
      summarySentToday = true;
      const summary = `🧠 AI Summary:\nMarket activity detected with ${gainers} gainers and ${losers} losers today.\nProcessed: ${processedCount}/${top30.length} symbols`;
      await sendTelegramAlert(summary);
    }

    console.log(`Analysis complete. Alerts: ${alerts.length}, Errors: ${errors.length}`);

    res.status(200).json({ 
      success: true, 
      alerts, 
      alertLog,
      stats: {
        processed: processedCount,
        total: top30.length,
        gainers,
        losers,
        errors: errors.length
      },
      errors: errors.slice(0, 5) // Return first 5 errors for debugging
    });

  } catch (error) {
    console.error("Handler error:", error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      alertLog
    });
  }
}
