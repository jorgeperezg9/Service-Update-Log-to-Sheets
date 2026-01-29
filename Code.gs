// Configuration
const CONFIG = {
  WORKSPACE: {
    BLOG_URL: 'https://workspaceupdates.googleblog.com/',
    RSS_URL: 'https://workspaceupdates.googleblog.com/feeds/posts/default?max-results=50',
    SHEET_NAME: 'Google Workspace Updates'
  },
  ZOOM: {
    RSS_URL: 'https://developers.zoom.us/changelog/rss.xml',
    SHEET_NAME: 'Zoom Updates'
  },
  NUM_POSTS_TO_CHECK: 4,
  START_YEAR: 2026
};

function syncAllUpdates() {
  fetchWorkspaceUpdates();
  Utilities.sleep(5000); 
  fetchZoomUpdates();
}

/**
 * GOOGLE WORKSPACE
 */
function fetchWorkspaceUpdates() {
  try {
    Logger.log('Fetching Google Workspace posts...');
    let allPosts = [];
    try {
      allPosts = parseGoogleAtom(CONFIG.WORKSPACE.RSS_URL);
    } catch (e) {
      Logger.log('RSS failed, falling back to Scraping...');
      allPosts = scrapeGoogleHtml();
    }
    
    processAndAppend(allPosts, CONFIG.WORKSPACE.SHEET_NAME);
  } catch (error) {
    Logger.log('Google Error: ' + error.toString());
  }
}

/**
 * ZOOM
 */
function fetchZoomUpdates() {
  try {
    Logger.log('Fetching Zoom posts...');
    const allPosts = parseZoomRss(CONFIG.ZOOM.RSS_URL);
    processAndAppend(allPosts, CONFIG.ZOOM.SHEET_NAME);
  } catch (error) {
    Logger.log('Zoom Error: ' + error.toString());
  }
}

function processAndAppend(allPosts, sheetName) {
  const safetyDate = new Date(CONFIG.START_YEAR, 0, 1);
  const existingLinks = getExistingPostLinks(sheetName);
  
  const newPosts = allPosts
    .filter(post => {
      const pDate = new Date(post.date);
      return pDate >= safetyDate && !existingLinks.has(post.link);
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, CONFIG.NUM_POSTS_TO_CHECK);

  if (newPosts.length === 0) {
    Logger.log(`No new posts for ${sheetName}`);
    return;
  }

  const processed = [];
  for (let i = 0; i < newPosts.length; i++) {
    const post = newPosts[i];
    Logger.log(`Analyzing: ${post.title}`);
    const aiAnalysis = analyzeWithGemini(post, sheetName);
    
    processed.push({
      date: post.date,
      adminVsAuto: aiAnalysis.adminVsAuto,
      title: post.title,
      application: aiAnalysis.application || (sheetName.includes('Zoom') ? 'Zoom' : 'Google'),
      summary: aiAnalysis.summary,
      higherEdUseCase: aiAnalysis.higherEdUseCase,
      link: post.link
    });
    if (i < newPosts.length - 1) Utilities.sleep(5000); // working with free tier gemini ai account
  }

  appendToSheet(processed, sheetName);
}
/**
 * Google Parser (atom)
 */
function parseGoogleAtom(url) {
  const response = UrlFetchApp.fetch(url);
  const xml = response.getContentText();
  const document = XmlService.parse(xml);
  const root = document.getRootElement();
  const atom = XmlService.getNamespace('http://www.w3.org/2005/Atom');
  const entries = root.getChildren('entry', atom);
  
  return entries.map(entry => {
    const title = entry.getChild('title', atom).getText();
    if (title.toLowerCase().includes("weekly recap")) return null;
    return {
      title: title,
      link: entry.getChild('link', atom).getAttribute('href').getValue(),
      date: Utilities.formatDate(new Date(entry.getChild('published', atom).getText()), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      content: entry.getChild('content', atom).getText()
    };
  }).filter(p => p !== null);
}

/**
 * Zoom Parser
 */
function parseZoomRss(url) {
  const response = UrlFetchApp.fetch(url, { headers: {"User-Agent": "Mozilla/5.0"} });
  const xml = response.getContentText();
  const document = XmlService.parse(xml);
  const items = document.getRootElement().getChild('channel').getChildren('item');
  
  return items.map(item => ({
    title: item.getChildText('title'),
    link: item.getChildText('link'),
    date: Utilities.formatDate(new Date(item.getChildText('pubDate')), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    content: item.getChildText('description')
  }));
}

function scrapeGoogleHtml() {
  const homeResponse = UrlFetchApp.fetch(CONFIG.WORKSPACE.BLOG_URL);
  const html = homeResponse.getContentText();
  const chunks = html.split('<article');
  chunks.shift();
  
  return chunks.map(chunk => {
    const linkMatch = chunk.match(/href="([^"]+)"/);
    const titleMatch = chunk.match(/class="[^"]*title[^"]*">([^<]+)</);
    if (!linkMatch || !titleMatch) return null;
    return {
      title: titleMatch[1].trim(),
      link: linkMatch[1],
      date: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'), // Approximate
      content: ""
    };
  }).filter(p => p !== null);
}

// gemini
function analyzeWithGemini(post, sheetName) {
  const apiKey = getGeminiApiKey();
  let body = post.content || "";
  
  if (body.length < 500) {
    try {
      const resp = UrlFetchApp.fetch(post.link, {muteHttpExceptions: true});
      body = resp.getContentText();
    } catch (e) {}
  }
  
  const cleanBody = stripHtmlTags(body).substring(0, 8000);
  const prompt = `Analyze this ${sheetName} update for a University.
  Title: ${post.title}
  Content: ${cleanBody}
  
  Return JSON: {"adminVsAuto": "Admin required/Auto-enabled", "application": "App name", "summary": "2-3 sentences", "higherEdUseCase": "2-3 sentences"}`;

  const response = UrlFetchApp.fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });
  
  const text = JSON.parse(response.getContentText()).candidates[0].content.parts[0].text;
  return JSON.parse(text.match(/\{[\s\S]*\}/)[0]);
}

function getGeminiApiKey() {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY not found');
  return key;
}

function getExistingPostLinks(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return new Set();
  return new Set(sheet.getRange(2, 7, sheet.getLastRow() - 1, 1).getValues().flat());
}

function appendToSheet(data, sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  if (sheet.getLastRow() === 0) {
    const headers = ['Date', 'Admin vs Auto', 'Title', 'Application', 'Summary', 'Higher Ed Use Case', 'Link'];
    sheet.getRange(1, 1, 1, 7).setValues([headers]).setFontWeight('bold');
  }
  const rows = data.map(p => [p.date, p.adminVsAuto, p.title, p.application, p.summary, p.higherEdUseCase, p.link]);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 7).setValues(rows);
  sheet.autoResizeColumns(1, 7);
}

function stripHtmlTags(html) {
  return html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
             .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
             .replace(/<[^>]+>/g, ' ')
             .replace(/&nbsp;/g, ' ')
             .replace(/\s+/g, ' ').trim();
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Update Tracker')
    .addItem('Sync All Updates', 'syncAllUpdates')
    .addItem('Fetch Google Workspace', 'fetchWorkspaceUpdates')
    .addItem('Fetch Zoom', 'fetchZoomUpdates')
    .addToUi();
}