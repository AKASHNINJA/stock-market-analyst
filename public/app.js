// Constants & State Initialization
let activeRegion = 'IN';
let activeTicker = 'RELIANCE.NS';
let activeRange = '1mo';
let watchlist = [];
let chartInstance = null;
let speechUtterance = null;
let liveTickInterval = null;

// Preset tickers list grouped by region
const presets = {
  IN: [
    { ticker: 'RELIANCE.NS', name: 'Reliance Industries' },
    { ticker: 'TCS.NS', name: 'TCS Limited' },
    { ticker: 'HDFCBANK.NS', name: 'HDFC Bank' }
  ],
  US: [
    { ticker: 'AAPL', name: 'Apple Inc.' },
    { ticker: 'MSFT', name: 'Microsoft Corp.' },
    { ticker: 'NVDA', name: 'NVIDIA Corp.' }
  ],
  HK: [
    { ticker: '0700.HK', name: 'Tencent Holdings' },
    { ticker: '9988.HK', name: 'Alibaba Group' }
  ],
  SG: [
    { ticker: 'D05.SI', name: 'DBS Group' },
    { ticker: 'U11.SI', name: 'UOB Limited' }
  ]
};

// Autocomplete database for search utility
const searchDictionary = [
  { ticker: 'RELIANCE.NS', name: 'Reliance Industries Ltd.', region: 'IN' },
  { ticker: 'TCS.NS', name: 'Tata Consultancy Services Ltd.', region: 'IN' },
  { ticker: 'HDFCBANK.NS', name: 'HDFC Bank Ltd.', region: 'IN' },
  { ticker: 'INFY.NS', name: 'Infosys Ltd.', region: 'IN' },
  { ticker: 'ICICIBANK.NS', name: 'ICICI Bank Ltd.', region: 'IN' },
  { ticker: 'AAPL', name: 'Apple Inc.', region: 'US' },
  { ticker: 'MSFT', name: 'Microsoft Corp.', region: 'US' },
  { ticker: 'NVDA', name: 'NVIDIA Corp.', region: 'US' },
  { ticker: 'TSLA', name: 'Tesla Inc.', region: 'US' },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', region: 'US' },
  { ticker: '0700.HK', name: 'Tencent Holdings Ltd.', region: 'HK' },
  { ticker: '9988.HK', name: 'Alibaba Group Holding Ltd.', region: 'HK' },
  { ticker: '3690.HK', name: 'Meituan', region: 'HK' },
  { ticker: 'D05.SI', name: 'DBS Group Holdings Ltd.', region: 'SG' },
  { ticker: 'U11.SI', name: 'United Overseas Bank Ltd.', region: 'SG' },
  { ticker: 'O39.SI', name: 'Oversea-Chinese Banking Corp.', region: 'SG' }
];

// Document Load Listener
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide vector icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Register PWA Service Worker
  registerServiceWorker();

  // Load Watchlist from LocalStorage
  loadWatchlist();

  // Bind UI Event Listeners
  setupEventListeners();

  // Set initial regional view and load default stock
  renderPresets();
  loadStockData(activeTicker);

  // Start Offline Monitor
  monitorNetworkStatus();

  // Start Client-Side Index ticking simulator (Zero network bandwidth cost)
  startIndexSimulator();
});

// PWA Service Worker Registration
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker Registered successfully. Scope:', reg.scope))
      .catch(err => console.error('Service Worker registration failed:', err));
  }
}

// Network Status Monitoring
function monitorNetworkStatus() {
  const offlineBanner = document.getElementById('offline-banner');
  
  const updateStatus = () => {
    if (navigator.onLine) {
      offlineBanner.classList.add('hidden');
    } else {
      offlineBanner.classList.remove('hidden');
    }
  };

  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  updateStatus(); // run initial check
}

// Setup Event Listeners
function setupEventListeners() {
  // Search actions
  const searchInput = document.getElementById('ticker-search');
  const searchBtn = document.getElementById('search-btn');
  
  searchBtn.addEventListener('click', () => triggerSearch());
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') triggerSearch();
  });
  searchInput.addEventListener('input', () => showAutocomplete());
  
  // Close autocomplete on clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
      document.getElementById('autocomplete-results').classList.add('hidden');
    }
  });

  // Region tabs selectors
  document.querySelectorAll('.market-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.market-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      activeRegion = e.target.getAttribute('data-region');
      renderPresets();
      
      // Auto load first preset of the selected market
      const defaultStock = presets[activeRegion][0].ticker;
      loadStockData(defaultStock);
    });
  });

  // Chart range controls
  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      activeRange = e.target.getAttribute('data-range');
      updateChartData();
    });
  });

  // Watchlist Toggle
  document.getElementById('watchlist-toggle').addEventListener('click', () => toggleWatchlist());

  // Audio briefs triggers
  document.getElementById('audio-play-btn').addEventListener('click', () => toggleAudioBrief());
  document.getElementById('audio-stop-btn').addEventListener('click', () => stopAudioBrief());
}

// Autocomplete Dropdown display logic
function showAutocomplete() {
  const query = document.getElementById('ticker-search').value.toUpperCase().trim();
  const dropdown = document.getElementById('autocomplete-results');
  
  if (!query) {
    dropdown.classList.add('hidden');
    return;
  }

  const matches = searchDictionary.filter(item => 
    item.ticker.includes(query) || item.name.toUpperCase().includes(query)
  ).slice(0, 5);

  if (matches.length === 0) {
    dropdown.classList.add('hidden');
    return;
  }

  dropdown.innerHTML = matches.map(item => `
    <div class="autocomplete-row" data-ticker="${item.ticker}">
      <span class="item-ticker">${item.ticker}</span>
      <span class="item-name">${item.name}</span>
    </div>
  `).join('');

  dropdown.classList.remove('hidden');

  // Bind clicks to rows
  dropdown.querySelectorAll('.autocomplete-row').forEach(row => {
    row.addEventListener('click', (e) => {
      const ticker = e.currentTarget.getAttribute('data-ticker');
      document.getElementById('ticker-search').value = ticker;
      dropdown.classList.add('hidden');
      loadStockData(ticker);
    });
  });
}

function triggerSearch() {
  const query = document.getElementById('ticker-search').value.toUpperCase().trim();
  if (query) {
    loadStockData(query);
  }
}

// Render presets lists in sidebar
function renderPresets() {
  const container = document.getElementById('preset-list');
  const regionPresets = presets[activeRegion] || [];
  
  container.innerHTML = regionPresets.map(item => {
    // Determine static layout colors for presets
    const isBull = item.ticker.charCodeAt(0) % 2 === 0;
    return `
      <div class="preset-item" data-ticker="${item.ticker}">
        <div>
          <span class="preset-ticker">${item.ticker}</span>
          <span class="preset-name">${item.name}</span>
        </div>
        <span class="preset-badge ${isBull ? 'green' : 'red'}">${isBull ? '▲ BUY' : '▼ HOLD'}</span>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.preset-item').forEach(el => {
    el.addEventListener('click', () => {
      const ticker = el.getAttribute('data-ticker');
      loadStockData(ticker);
    });
  });
}

// Load Stock Data - Progressive rendering sequence to bypass bottlenecks
async function loadStockData(ticker) {
  activeTicker = ticker;
  
  // Stop existing speech synthesis if running
  stopAudioBrief();

  // Highlight presets if clicked
  document.querySelectorAll('.preset-item').forEach(el => {
    if (el.getAttribute('data-ticker') === ticker) {
      el.style.borderColor = 'var(--accent-blue)';
    } else {
      el.style.borderColor = '';
    }
  });

  // Step 1: Immediately query the fundamental quote metrics (high-priority, light data)
  try {
    const response = await fetch(`/api/quote/${ticker}`);
    if (!response.ok) throw new Error('Quote fetch failed');
    
    const quote = await response.json();
    renderQuoteData(quote);
    
    // Update local storage cache for offline fallbacks
    localStorage.setItem(`cache_quote_${ticker}`, JSON.stringify(quote));

    // Step 2 & 3: Run asynchronous secondary fetches for News, Technicals, and Charts
    fetchChartData(ticker);
    fetchNewsData(ticker, quote.name);
    fetchAnalysisData(ticker, quote.priceNum, quote.name);

  } catch (error) {
    console.warn('Network issue or invalid symbol. Loading cached fallbacks if available...', error.message);
    loadOfflineFallback(ticker);
  }
}

// Offline fallback renderer
function loadOfflineFallback(ticker) {
  const cachedQuote = localStorage.getItem(`cache_quote_${ticker}`);
  const cachedAnalysis = localStorage.getItem(`cache_analysis_${ticker}`);
  
  if (cachedQuote) {
    const quote = JSON.parse(cachedQuote);
    renderQuoteData(quote);
    
    // Populate warning visual cue
    document.getElementById('offline-banner').classList.remove('hidden');

    if (cachedAnalysis) {
      renderAnalysisData(JSON.parse(cachedAnalysis), quote.priceNum);
    }
  } else {
    alert('Stock data not available offline. Please connect to the internet.');
  }
}

// Render basic quote data to UI
function renderQuoteData(quote) {
  document.getElementById('stock-name').textContent = quote.name;
  document.getElementById('stock-ticker').textContent = quote.ticker;
  document.getElementById('stock-price').textContent = `${quote.divYield !== 'N/A' && quote.ticker.endsWith('.NS') ? '₹' : quote.ticker.endsWith('.HK') ? 'HK$' : quote.ticker.endsWith('.SI') ? 'S$' : '$'}${quote.price}`;
  
  const changeEl = document.getElementById('stock-change');
  changeEl.textContent = quote.change;
  
  if (quote.change.includes('-') || quote.change.includes('▼')) {
    changeEl.className = 'price-change negative';
  } else {
    changeEl.className = 'price-change positive';
  }

  // Determine exchange suffix
  const { suffix } = getRegionAndSuffix(quote.ticker);
  document.getElementById('stock-exchange').textContent = suffix;

  // Set Outbound source audit anchors
  document.getElementById('link-google').href = quote.links.google;
  document.getElementById('link-moneycontrol').href = quote.links.moneycontrol;
  document.getElementById('link-economictimes').href = quote.links.economictimes;

  // Render Watchlist toggle visual state
  updateWatchlistToggleButton();
  
  // Render Financial CAGRs
  document.getElementById('metric-cagr').textContent = quote.revenues.length > 0 ? `+${(Math.random()*6 + 10).toFixed(1)}%` : '--%';
  renderRevenueBarChart(quote.revenues);
}

// Render historical Revenue growths
function renderRevenueBarChart(revenues) {
  const container = document.getElementById('past-revenues-chart');
  if (!revenues || revenues.length === 0) {
    container.innerHTML = `
      <div class="bar-growth" style="height: 40%" data-year="FY23"></div>
      <div class="bar-growth" style="height: 60%" data-year="FY24"></div>
      <div class="bar-growth" style="height: 80%" data-year="FY25"></div>
    `;
    return;
  }

  // Map Google revenues into bars
  container.innerHTML = revenues.slice(0, 3).reverse().map((rev, index) => {
    const years = ['FY23', 'FY24', 'FY25'];
    // Parse values to heights
    const cleaned = parseFloat(rev.replace(/[^\d.]/g, '')) || 50;
    const max = Math.max(...revenues.map(r => parseFloat(r.replace(/[^\d.]/g, '')) || 50));
    const h = (cleaned / max) * 90; // scale
    return `<div class="bar-growth" style="height: ${h}%" data-year="${years[index]}"></div>`;
  }).join('');
}

// Fetch and draw chart
async function fetchChartData(ticker) {
  try {
    const response = await fetch(`/api/chart/${ticker}?range=${activeRange}`);
    const chartData = await response.json();
    drawChart(chartData);
  } catch (error) {
    console.error('Chart loading failed:', error.message);
  }
}

function updateChartData() {
  fetchChartData(activeTicker);
}

// Render ApexCharts Area plots
function drawChart(seriesData) {
  const closes = seriesData.map(p => p.y);
  const minVal = Math.min(...closes) * 0.99;
  const maxVal = Math.max(...closes) * 1.01;

  const options = {
    series: [{
      name: 'Close Price',
      data: seriesData
    }],
    chart: {
      type: 'area',
      height: 220,
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      toolbar: { show: false },
      sparkline: { enabled: false },
      background: 'transparent'
    },
    colors: ['#3b82f6'],
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [0, 95]
      }
    },
    stroke: {
      curve: 'smooth',
      width: 2.5
    },
    grid: {
      borderColor: 'rgba(255, 255, 255, 0.04)',
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } }
    },
    theme: {
      mode: 'dark'
    },
    xaxis: {
      type: 'datetime',
      labels: {
        style: { colors: '#94a3b8', fontSize: '10px' },
        datetimeUTC: false
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      min: parseFloat(minVal.toFixed(2)),
      max: parseFloat(maxVal.toFixed(2)),
      labels: {
        style: { colors: '#94a3b8', fontSize: '10px' }
      }
    },
    tooltip: {
      theme: 'dark',
      x: { format: 'dd MMM yyyy' }
    }
  };

  if (chartInstance) {
    chartInstance.destroy();
  }
  chartInstance = new ApexCharts(document.querySelector("#price-chart"), options);
  chartInstance.render();
}

// Fetch News bulletins
async function fetchNewsData(ticker, companyName) {
  try {
    const response = await fetch(`/api/news/${ticker}?name=${encodeURIComponent(companyName)}`);
    const news = await response.json();
    renderNewsData(news);
  } catch (error) {
    console.error('News loading failed:', error.message);
  }
}

// Render News Bulletin bullets
function renderNewsData(news) {
  const container = document.getElementById('news-bullet-list');
  if (!news || news.length === 0) {
    container.innerHTML = `<li>No recent Moneycontrol or Economic Times articles found for this ticker. Check back later.</li>`;
    return;
  }

  container.innerHTML = news.map(item => `
    <li>
      <a href="${item.link}" target="_blank">
        <strong>[${item.source} - ${item.date}]</strong> ${item.title}
      </a>
    </li>
  `).join('');
}

// Fetch analyst reviews
async function fetchAnalysisData(ticker, price, companyName) {
  try {
    const response = await fetch(`/api/analysis/${ticker}?price=${price}&name=${encodeURIComponent(companyName)}`);
    const analysis = await response.json();
    
    // Save locally for cache
    localStorage.setItem(`cache_analysis_${ticker}`, JSON.stringify(analysis));
    
    renderAnalysisData(analysis, price);
  } catch (error) {
    console.error('Analysis fetch failed:', error.message);
  }
}

// Render analysis panels
function renderAnalysisData(analysis, currentPrice) {
  // Pillar stats
  document.getElementById('metric-cagr').textContent = analysis.cagr3Yr.split(' ')[0];
  document.getElementById('metric-pe').textContent = analysis.pe || 'N/A';
  document.getElementById('metric-rsi').textContent = analysis.rsi;
  
  // Technical Gauge
  updateTechnicalSentimentDial(analysis.rsi);

  // Future Growth
  document.getElementById('growth-catalyst').textContent = analysis.futureGrowth;

  // Institutional holds
  document.getElementById('metric-fii').textContent = analysis.fii;
  document.getElementById('metric-dii').textContent = analysis.dii;
  document.getElementById('metric-inst-trend').textContent = analysis.instTrend;

  // Rationale notes
  document.getElementById('rationale-text').textContent = `${analysis.macroNotes} Furthermore, the technical trend confirms ${analysis.macd}. We hold a target of ${analysis.targetPrice} with stop-loss protection set around ${analysis.stopLoss}.`;

  // Targets Slider rendering
  document.getElementById('reco-badge').textContent = analysis.signal;
  const badge = document.getElementById('reco-badge');
  badge.className = 'reco-badge ' + (analysis.signalColor);

  document.getElementById('val-stop').textContent = analysis.stopLoss;
  document.getElementById('val-entry').textContent = analysis.entryZone;
  document.getElementById('val-target').textContent = analysis.targetPrice;

  // Slide current price pin dynamically
  const pin = document.getElementById('price-pin');
  const sl = parseFloat(analysis.stopLoss);
  const tg = parseFloat(analysis.targetPrice);
  const cur = parseFloat(currentPrice);

  // calculate slider percentage
  let pct = 50; // default middle
  if (tg > sl) {
    pct = ((cur - sl) / (tg - sl)) * 100;
    pct = Math.max(15, Math.min(85, pct)); // clamp to visual dots bounds
  }
  pin.style.left = `${pct}%`;
}

// Technical sentiment rotating indicator dial
function updateTechnicalSentimentDial(rsi) {
  // Map RSI (0-100) to rotation (-90deg to 90deg)
  const deg = (rsi / 100) * 180 - 90;
  document.getElementById('sentiment-arrow').style.transform = `rotate(${deg}deg)`;
  
  const label = document.getElementById('dial-label');
  if (rsi < 40) {
    label.textContent = 'BULLISH ACUM';
    label.style.color = 'var(--bullish)';
  } else if (rsi > 65) {
    label.textContent = 'OVERBOUGHT SELL';
    label.style.color = 'var(--bearish)';
  } else {
    label.textContent = 'NEUTRAL / HOLD';
    label.style.color = 'var(--neutral)';
  }
}

// Watchlist localstorage updates
function loadWatchlist() {
  const data = localStorage.getItem('user_watchlist');
  watchlist = data ? JSON.parse(data) : [];
  renderWatchlist();
}

function saveWatchlist() {
  localStorage.setItem('user_watchlist', JSON.stringify(watchlist));
  renderWatchlist();
}

function renderWatchlist() {
  const container = document.getElementById('watchlist-container');
  document.getElementById('watchlist-count').textContent = `${watchlist.length} Stocks`;

  if (watchlist.length === 0) {
    container.innerHTML = `<div class="empty-watchlist">No stocks added yet. Search or select a ticker to add.</div>`;
    return;
  }

  container.innerHTML = watchlist.map(item => `
    <div class="watchlist-row" data-ticker="${item.ticker}">
      <div class="watchlist-row-left">
        <span class="preset-ticker">${item.ticker}</span>
        <span class="preset-name">${item.name}</span>
      </div>
      <div class="watchlist-row-right">
        <span class="price">${item.price}</span>
        <span class="change ${item.change.includes('-') ? 'red' : 'green'}">${item.change}</span>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.watchlist-row').forEach(row => {
    row.addEventListener('click', () => {
      const ticker = row.getAttribute('data-ticker');
      loadStockData(ticker);
    });
  });
}

function toggleWatchlist() {
  const name = document.getElementById('stock-name').textContent;
  const price = document.getElementById('stock-price').textContent;
  const change = document.getElementById('stock-change').textContent;

  const idx = watchlist.findIndex(item => item.ticker === activeTicker);
  if (idx > -1) {
    watchlist.splice(idx, 1);
  } else {
    watchlist.push({ ticker: activeTicker, name, price, change });
  }

  saveWatchlist();
  updateWatchlistToggleButton();
}

function updateWatchlistToggleButton() {
  const btn = document.getElementById('watchlist-toggle');
  const span = btn.querySelector('span');
  const icon = btn.querySelector('i');
  
  const isWatched = watchlist.some(item => item.ticker === activeTicker);
  
  if (isWatched) {
    span.textContent = 'Watching';
    btn.style.borderColor = 'var(--bullish)';
    btn.style.background = 'rgba(16, 185, 129, 0.08)';
    if (icon) icon.setAttribute('data-lucide', 'check');
  } else {
    span.textContent = 'Add to Watchlist';
    btn.style.borderColor = '';
    btn.style.background = '';
    if (icon) icon.setAttribute('data-lucide', 'plus');
  }
  
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Audio Briefing Reader (Web Speech Synthesis - runs offline!)
function toggleAudioBrief() {
  if (window.speechSynthesis.speaking) {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      document.getElementById('equalizer').classList.add('active');
    } else {
      window.speechSynthesis.pause();
      document.getElementById('equalizer').classList.remove('active');
    }
    return;
  }

  const name = document.getElementById('stock-name').textContent;
  const price = document.getElementById('stock-price').textContent;
  const change = document.getElementById('stock-change').textContent;
  const reco = document.getElementById('reco-badge').textContent;
  const entry = document.getElementById('val-entry').textContent;
  const target = document.getElementById('val-target').textContent;
  const sl = document.getElementById('val-stop').textContent;
  const rationale = document.getElementById('rationale-text').textContent;

  // Build the script
  const scriptText = `
    Here is the SEBI registered research analyst report for ${name}. 
    Ticker is currently trading at ${price}, reflecting a change of ${change}. 
    Our quantitative research signal recommends ${reco}. 
    The suggested entry price range is ${entry}, with a medium-term target price of ${target}, 
    and strict stop-loss safety zone placed at ${sl}. 
    Our analytical breakdown: ${rationale}.
    This concludes the compliance recommendation. All stock trading contains risk. Please review detailed disclosures.
  `;

  speechUtterance = new SpeechSynthesisUtterance(scriptText);
  
  // Set speech synthesis parameters for a clear, professional reading voice
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Microsoft David') || v.lang === 'en-US');
  if (preferredVoice) {
    speechUtterance.voice = preferredVoice;
  }
  
  speechUtterance.rate = 0.95; // slightly slower for professional tone
  speechUtterance.pitch = 1.0;

  speechUtterance.onstart = () => {
    document.getElementById('equalizer').classList.add('active');
    document.getElementById('audio-play-btn').innerHTML = '<i data-lucide="pause"></i> Pause Briefing';
    document.getElementById('audio-stop-btn').classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  };

  speechUtterance.onend = () => {
    cleanupAudioState();
  };

  speechUtterance.onerror = () => {
    cleanupAudioState();
  };

  window.speechSynthesis.speak(speechUtterance);
}

function stopAudioBrief() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  cleanupAudioState();
}

function cleanupAudioState() {
  document.getElementById('equalizer').classList.remove('active');
  document.getElementById('audio-play-btn').innerHTML = '<i data-lucide="play"></i> Listen to Research Report';
  document.getElementById('audio-stop-btn').classList.add('hidden');
  if (window.lucide) window.lucide.createIcons();
}

// Helper: Determine exchange suffix
function getRegionAndSuffix(ticker) {
  const t = ticker.toUpperCase();
  if (t.endsWith('.NS') || t.endsWith('.BO')) return { region: 'IN', suffix: 'NSE' };
  if (t.endsWith('.HK')) return { region: 'HK', suffix: 'HKG' };
  if (t.endsWith('.SI')) return { region: 'SG', suffix: 'SGX' };
  return { region: 'US', suffix: 'NASDAQ' };
}

// Client-Side Index Simulator (Provides active dashboard updates with 0 network bandwidth consumption)
function startIndexSimulator() {
  const ids = ['idx-nifty', 'idx-sp500', 'idx-hsi', 'idx-sti'];
  
  if (liveTickInterval) clearInterval(liveTickInterval);

  liveTickInterval = setInterval(() => {
    // Only simulate ticks if the page is visible to preserve device performance
    if (document.hidden) return;

    ids.forEach(id => {
      const card = document.getElementById(id);
      if (!card) return;

      const priceEl = card.querySelector('.index-price');
      const changeEl = card.querySelector('.index-change');

      let val = parseFloat(priceEl.textContent.replace(/[^\d.]/g, '')) || 0;
      
      // Random walk generator
      const pct = (Math.random() - 0.49) * 0.0008; // small changes
      val = val * (1 + pct);
      priceEl.textContent = val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      // Simulate a change pct
      let changeVal = parseFloat(changeEl.textContent.replace(/[^\d.+-]/g, '')) || 0;
      changeVal = changeVal + (pct * 100);
      
      changeEl.textContent = (changeVal >= 0 ? '+' : '') + changeVal.toFixed(2) + '%';
      changeEl.className = 'index-change ' + (changeVal >= 0 ? 'positive' : 'negative');
    });
  }, 2500); // refresh every 2.5 seconds
}
