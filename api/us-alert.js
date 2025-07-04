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

// Simple HTML page for browser access
const HTML_PAGE = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stock Alert Bot Status</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            color: #333;
            margin-bottom: 30px;
        }
        .status {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .status-card {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            border-left: 4px solid #007bff;
        }
        .status-card h3 {
            margin: 0 0 10px 0;
            color: #333;
        }
        .status-card p {
            margin: 5px 0;
            color: #666;
        }
        .alerts {
            background: #fff3cd;
            padding: 15px;
            border-radius: 5px;
            border-left: 4px solid #ffc107;
        }
        .btn {
            background: #007bff;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            margin: 5px;
        }
        .btn:hover {
            background: #0056b3;
        }
        .loading {
            text-align: center;
            padding: 20px;
        }
        .error {
            background: #f8d7da;
            color: #721c24;
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
        }
        .success {
            background: #d4edda;
            color: #155724;
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 Stock Alert Bot</h1>
            <p>Monitoring Top 30 Stocks for Significant Changes</p>
        </div>
        
        <div class="status">
            <div class="status-card">
                <h3>📊 Current Status</h3>
                <p id="status">Loading...</p>
                <p id="lastUpdate">Last Update: Loading...</p>
            </div>
            
            <div class="status-card">
                <h3>📈 Market Summary</h3>
                <p id="gainers">Gainers: Loading...</p>
                <p id="losers">Losers: Loading...</p>
                <p id="processed">Processed: Loading...</p>
            </div>
            
            <div class="status-card">
                <h3>🔔 Alert Settings</h3>
                <p id="alertStatus">Alerts: Loading...</p>
                <p>Monitoring: ${top30.length} stocks</p>
                <button class="btn" onclick="toggleAlerts()">Toggle Alerts</button>
            </div>
        </div>
        
        <div class="alerts">
            <h3>📋 Recent Alerts</h3>
            <div id="alertsList">Loading alerts...</div>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
            <button class="btn" onclick="runAnalysis()">🔄 Run Analysis</button>
            <button class="btn" onclick="refreshData()">🔄 Refresh Data</button>
        </div>
        
        <div id="results"></div>
    </div>

    <script>
        let data = {};
        
        async function fetchData() {
            try {
                const response = await fetch('/api/stock-bot?action=status');
                const result = await response.json();
                data = result;
                updateUI();
            } catch (error) {
                console.error('Error fetching data:', error);
                document.getElementById('results').innerHTML = 
                    '<div class="error">Error loading data: ' + error.message + '</div>';
            }
        }
        
        async function runAnalysis() {
            document.getElementById('results').innerHTML = 
                '<div class="loading">🔄 Running analysis... This may take several minutes due to API rate limits.</div>';
            
            try {
                const response = await fetch('/api/stock-bot', { method: 'POST' });
                const result = await response.json();
                
                if (result.success) {
                    document.getElementById('results').innerHTML = 
                        '<div class="success">✅ Analysis completed successfully!</div>';
                    fetchData(); // Refresh data
                } else {
                    document.getElementById('results').innerHTML = 
                        '<div class="error">❌ Analysis failed: ' + result.error + '</div>';
                }
            } catch (error) {
                document.getElementById('results').innerHTML = 
                    '<div class="error">❌ Error running analysis: ' + error.message + '</div>';
            }
        }
        
        async function toggleAlerts() {
            try {
                const response = await fetch('/api/stock-bot?action=toggle');
                const result = await response.json();
                fetchData(); // Refresh data
                document.getElementById('results').innerHTML = 
                    '<div class="success">✅ ' + result.message + '</div>';
            } catch (error) {
                document.getElementById('results').innerHTML = 
                    '<div class="error">❌ Error toggling alerts: ' + error.message + '</div>';
            }
        }
        
        function refreshData() {
            fetchData();
            document.getElementById('results').innerHTML = 
                '<div class="success">✅ Data refreshed</div>';
        }
        
        function updateUI() {
            document.getElementById('status').textContent = 
                data.alertsEnabled ? '🟢 Active' : '🔴 Disabled';
            document.getElementById('lastUpdate').textContent = 
                'Last Update: ' + new Date().toLocaleString();
            document.getElementById('gainers').textContent = 
                'Gainers: ' + (data.stats?.gainers || 0);
            document.getElementById('losers').textContent = 
                'Losers: ' + (data.stats?.losers || 0);
            document.getElementById('processed').textContent = 
                'Processed: ' + (data.stats?.processed || 0) + '/' + (data.stats?.total || 30);
            document.getElementById('alertStatus').textContent = 
                'Alerts: ' + (data.alertsEnabled ? 'Enabled' : 'Disabled');
            
            const alertsList = document.getElementById('alertsList');
            if (data.alertLog && data.alertLog.length > 0) {
                alertsList.innerHTML = data.alertLog.slice(0, 10).map(alert => 
                    '<p><strong>[' + alert.time + ']</strong> ' + alert.msg + '</p>'
                ).join('');
            } else {
                alertsList.innerHTML = '<p>📭 No alerts today.</p>';
            }
        }
        
        // Auto-refresh every 30 seconds
        setInterval(fetchData, 30000);
        
        // Initial load
        fetchData();
    </script>
</body>
</html>
`;

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
    
    const dates = Object.keys(data).slice(0, 104);
    if (dates.length < 72) {
      throw new Error(`Insufficient weekly data for ${symbol}`);
    }
    
    const recentDates = dates.slice(0, 8);
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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default async function handler(req, res) {
  try {
    // Handle GET requests - return HTML page or status
    if (req.method === "GET") {
      const action = req.query.action;
      
      if (action === "status") {
        return res.status(200).json({
          success: true,
          alertsEnabled,
          alertLog,
          stats: {
            processed: 0,
            total: top30.length,
            gainers: 0,
            losers: 0,
            errors: 0
          },
          timestamp: new Date().toISOString()
        });
      }
      
      if (action === "toggle") {
        alertsEnabled = !alertsEnabled;
        return res.status(200).json({
          success: true,
          message: `Alerts are now ${alertsEnabled ? "ENABLED" : "DISABLED"}`,
          alertsEnabled
        });
      }
      
      // Return HTML page for browser access
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(HTML_PAGE);
    }

    // Handle Telegram webhook commands
    if (req.method === "POST" && req.body?.message?.text?.startsWith("/")) {
      const response = handleTelegramCommands(req.body.message.text.trim());
      await sendTelegramAlert(response);
      return res.status(200).json({ ok: true });
    }

    // Handle POST requests - run analysis
    if (req.method === "POST") {
      let alerts = [];
      let gainers = 0, losers = 0;
      let processedCount = 0;
      let errors = [];

      console.log(`Starting stock analysis for ${top30.length} symbols...`);

      for (const symbol of top30) {
        try {
          // Add delay to prevent API rate limiting
          if (processedCount > 0 && processedCount % 5 === 0) {
            console.log(`Processed ${processedCount} symbols, waiting 60 seconds...`);
            await delay(60000);
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
        errors: errors.slice(0, 5)
      });
    }

  } catch (error) {
    console.error("Handler error:", error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      alertLog,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
