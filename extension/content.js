/**
 * LeadSniper Pro — Google Maps Content Script
 * Extracts local business cards from Google Maps search results feed in real time
 * and supports automated feed scrolling.
 */

let isScraping = false;
let scrollInterval = null;
const seenIds = new Set();

function parseCardsFromDOM() {
  const cards = document.querySelectorAll('div[role="article"], div.Nv2PK');
  const extracted = [];

  cards.forEach((card) => {
    try {
      const linkEl = card.querySelector('a.hfpxzc') || card.querySelector('a[href*="/maps/place/"]');
      const mapsUrl = linkEl ? linkEl.href : "";
      const name = (
        (linkEl && linkEl.getAttribute("aria-label")) ||
        (card.querySelector(".qBF1Pd") && card.querySelector(".qBF1Pd").textContent) ||
        ""
      ).trim();

      if (!name) return;
      const uniqueKey = `${name}::${mapsUrl.split("?")[0]}`;
      if (seenIds.has(uniqueKey)) return;

      // Rating & review count
      let rating = 0;
      let reviews = 0;
      const ratingEl = card.querySelector('span.MW4etd');
      if (ratingEl) {
        rating = parseFloat(ratingEl.textContent.replace(",", ".")) || 0;
      }
      const reviewEl = card.querySelector('span.UY7F9');
      if (reviewEl) {
        reviews = parseInt(reviewEl.textContent.replace(/[^0-9]/g, ""), 10) || 0;
      } else {
        const ariaStar = card.querySelector('span[role="img"][aria-label*="stars"], span[role="img"][aria-label*="étoiles"]');
        if (ariaStar) {
          const lbl = ariaStar.getAttribute("aria-label") || "";
          const m = lbl.match(/([\d.,]+)\s+\S+\s+([\d,.]+)/);
          if (m) {
            rating = parseFloat(m[1].replace(",", ".")) || rating;
            reviews = parseInt(m[2].replace(/[^0-9]/g, ""), 10) || reviews;
          }
        }
      }

      // Phone number
      let phone = "";
      const phoneEl = card.querySelector('span.UsdlK');
      if (phoneEl) {
        phone = phoneEl.textContent.trim();
      } else {
        const textContent = card.innerText || "";
        const phoneMatch = textContent.match(/(\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]\d{2,4}[\s.-]\d{2,4}([\s.-]\d{1,4})?/);
        if (phoneMatch && phoneMatch[0].replace(/\D/g, "").length >= 8) {
          phone = phoneMatch[0].trim();
        }
      }

      // External website URL
      let website = "";
      const websiteEl = card.querySelector('a[data-value="Website"], a.lcr4fd[href^="http"]');
      if (websiteEl) {
        const href = websiteEl.getAttribute("href") || "";
        if (href && !href.includes("google.com/maps")) {
          website = href;
        }
      }

      // Category & Address snippet
      const infoSpans = Array.from(card.querySelectorAll('.W4Efsd span'))
        .map((s) => s.textContent.trim())
        .filter((t) => t && t !== "·" && !t.includes("(") && t.length > 2);

      const category = infoSpans[0] || "Local Business";
      const address = infoSpans.find((s) => /\d+/.test(s) && s !== phone) || infoSpans[1] || "";

      seenIds.add(uniqueKey);
      extracted.push({
        id: "lead_" + Math.random().toString(36).slice(2, 10),
        name,
        category,
        address,
        rating,
        reviews,
        phone,
        website,
        mapsUrl
      });
    } catch (_) {}
  });

  if (extracted.length > 0) {
    chrome.runtime.sendMessage({
      type: "NEW_LEADS_BATCH",
      leads: extracted
    }).catch(() => {});
  }
}

function startAutoScroll() {
  if (isScraping) return;
  isScraping = true;
  parseCardsFromDOM();

  scrollInterval = setInterval(() => {
    if (!isScraping) return;
    parseCardsFromDOM();
    const feed = document.querySelector('div[role="feed"]') || document.querySelector('.m6QErb[aria-label]');
    if (feed) {
      feed.scrollBy({ top: 750, behavior: "smooth" });
    } else {
      window.scrollBy({ top: 750, behavior: "smooth" });
    }
  }, 1600);
}

function stopAutoScroll() {
  isScraping = false;
  if (scrollInterval) {
    clearInterval(scrollInterval);
    scrollInterval = null;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "START_SCRAPE") {
    startAutoScroll();
    sendResponse({ status: "started" });
  } else if (msg.type === "STOP_SCRAPE") {
    stopAutoScroll();
    sendResponse({ status: "stopped" });
  } else if (msg.type === "SCAN_ONCE") {
    parseCardsFromDOM();
    sendResponse({ status: "scanned", total: seenIds.size });
  } else if (msg.type === "RESET_SEEN") {
    seenIds.clear();
    sendResponse({ status: "reset" });
  }
  return true;
});
