# Update Tracker with AI Analysis (Google Apps Script)

## Overview
This project automatically tracks product updates from **Google Workspace** and **Zoom**, analyzes each update using **Google Gemini AI**, and logs structured, higher-education-focused insights into **Google Sheets**.

It is designed to help IT administrators and universities quickly understand:
- Whether updates are admin-controlled or auto-enabled
- Which application is affected
- A concise summary of the change
- Practical higher-education use cases

---

## Key Features
- Fetches updates from RSS feeds (Google Workspace & Zoom)
- Uses Gemini AI to analyze and summarize updates
- Generates Higher Ed–specific use cases
- Automatically appends structured data into Google Sheets
- Prevents duplicate entries
- Fallback scraping when RSS is unavailable
- Custom spreadsheet menu for manual runs

---

## Tech Stack
- **Google Apps Script**
- **Google Sheets**
- **RSS & HTML scraping**
- **Google Gemini API**
- **XML parsing**
- **REST API calls**

---

## How It Works
1. Pulls recent updates from:
   - Google Workspace Updates blog (Atom RSS + HTML fallback)
   - Zoom Developer Changelog (RSS)
2. Filters out already-processed posts and old content
3. Sends update content to Gemini AI for structured analysis
4. Extracts:
   - Admin vs Auto-enabled status
   - Application name
   - Summary
   - Higher education use case
5. Appends results into dedicated Google Sheets tabs

---

## Spreadsheet Output
Each row contains:
- Date
- Admin vs Auto-enabled
- Title
- Application
- Summary
- Higher Ed Use Case
- Source Link


