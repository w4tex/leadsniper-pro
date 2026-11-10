#!/usr/bin/env python3
import os
import json
import re
import urllib.request
import urllib.parse

API_KEY = os.environ.get("YOUTUBE_API_KEY", "AIzaSyBVwWx6rfPnpCxzBHad6PQud5NyoBSEG6g")

QUERIES = [
    "google maps lead generation smma",
    "gohighlevel agency client acquisition",
    "how to get local business clients cold email",
    "sell websites to local businesses",
    "ai automation agency local businesses"
]

def yt_get(endpoint, params):
    params["key"] = API_KEY
    url = f"https://www.googleapis.com/youtube/v3/{endpoint}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": "LeadSniperPartnerFinder/1.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))

def extract_emails_and_links(text):
    if not text:
        return "", ""
    emails = re.findall(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", text)
    clean_emails = [e for e in emails if not e.lower().endswith((".png", ".jpg", ".gif"))]
    links = re.findall(r"https?://[^\s)\]>\"']+", text)
    return (", ".join(list(dict.fromkeys(clean_emails)))[:120], ", ".join(list(dict.fromkeys(links))[:3])[:200])

def main():
    channel_ids = {}
    for q in QUERIES:
        try:
            data = yt_get("search", {
                "part": "snippet",
                "q": q,
                "type": "video",
                "maxResults": 12,
                "order": "relevance"
            })
            for item in data.get("items", []):
                cid = item["snippet"]["channelId"]
                vtitle = item["snippet"]["title"]
                vid = item["id"]["videoId"]
                if cid not in channel_ids:
                    channel_ids[cid] = {
                        "sample_video_title": vtitle,
                        "sample_video_url": f"https://www.youtube.com/watch?v={vid}",
                        "query": q
                    }
        except Exception as e:
            print(f"Search error for '{q}': {e}")

    all_cids = list(channel_ids.keys())
    creators = []

    for i in range(0, len(all_cids), 40):
        batch = all_cids[i:i+40]
        try:
            cdata = yt_get("channels", {
                "part": "snippet,statistics",
                "id": ",".join(batch)
            })
            for ch in cdata.get("items", []):
                cid = ch["id"]
                stats = ch.get("statistics", {})
                subs = int(stats.get("subscriberCount", 0))
                views = int(stats.get("viewCount", 0))
                videos = int(stats.get("videoCount", 0))
                # Target sweet spot: 2,000 to 500,000 subs (monetized, responsive to 50/50 rev-share)
                if subs < 2000 or subs > 600000:
                    continue
                snippet = ch.get("snippet", {})
                title = snippet.get("title", "")
                custom_url = snippet.get("customUrl", f"channel/{cid}")
                desc = snippet.get("description", "")
                emails, links = extract_emails_and_links(desc)
                clean_code = re.sub(r"[^A-Z0-9]", "", title.upper())[:10] or "PARTNER"
                vip_key = f"LSP-VIP-{clean_code}"

                creators.append({
                    "channel_name": title,
                    "subscribers": subs,
                    "total_views": views,
                    "video_count": videos,
                    "channel_url": f"https://www.youtube.com/{custom_url}" if custom_url.startswith("@") else f"https://www.youtube.com/channel/{cid}",
                    "recent_hit_video": channel_ids[cid]["sample_video_title"],
                    "video_url": channel_ids[cid]["sample_video_url"],
                    "public_emails": emails or "See Channel About / IG",
                    "External_Links": links,
                    "vip_creator_key": vip_key,
                    "rev_share_offer": "50% Lifetime via Whop ($24.50/sale)"
                })
        except Exception as e:
            print(f"Channel batch error: {e}")

    creators.sort(key=lambda x: x["subscribers"], reverse=True)
    out_path = "/home/wolvx7/.gemini/antigravity/scratch/leadsniper-pro/scripts/creators_discovered.json"
    with open(out_path, "w") as f:
        json.dump(creators, f, indent=2)
    print(f"Saved {len(creators)} high-converting creator partners to {out_path}")

if __name__ == "__main__":
    main()
