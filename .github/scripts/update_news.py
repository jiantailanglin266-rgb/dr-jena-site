# -*- coding: utf-8 -*-
"""
国内の美容関連ニュースを Google News RSS から取得し、
まだ掲載していない最新の1件を news.json の先頭に追加する（1日1件）。
GitHub Actions の日次ジョブから実行される。標準ライブラリのみ使用。
"""
import json, os, html, datetime, urllib.request
import xml.etree.ElementTree as ET

# 「美容」直近7日の国内ニュース（日本語・日本）
FEED = ("https://news.google.com/rss/search?"
        "q=%E7%BE%8E%E5%AE%B9%20when:7d&hl=ja&gl=JP&ceid=JP:ja")
NEWS_FILE = "news.json"
MAX_ITEMS = 30

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; DrJenaNewsBot/1.0)"})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read()

def parse(xml_bytes):
    root = ET.fromstring(xml_bytes)
    items = []
    for it in root.findall("./channel/item"):
        title = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        pub = (it.findtext("pubDate") or "").strip()
        src_el = it.find("source")
        source = (src_el.text.strip() if src_el is not None and src_el.text else "")
        # Google News の title は「見出し - 提供元」形式。末尾の提供元を除去
        if source and title.endswith(" - " + source):
            title = title[: -(len(source) + 3)].strip()
        title = html.unescape(title)
        if title and link:
            items.append({"title": title, "link": link, "source": source, "pub": pub})
    return items

def load_existing():
    if os.path.exists(NEWS_FILE):
        try:
            with open(NEWS_FILE, encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
        except Exception:
            pass
    return []

def main():
    existing = load_existing()
    seen = set(e.get("link", "") for e in existing) | set(e.get("title", "") for e in existing)
    feed_items = parse(fetch(FEED))
    new_item = None
    for it in feed_items:
        if it["link"] in seen or it["title"] in seen:
            continue
        new_item = it
        break
    if not new_item:
        print("No new item to add.")
        return
    jst = datetime.timezone(datetime.timedelta(hours=9))
    today = datetime.datetime.now(tz=jst).strftime("%Y.%m.%d")
    entry = {"date": today, "title": new_item["title"], "source": new_item["source"], "link": new_item["link"]}
    existing.insert(0, entry)
    existing = existing[:MAX_ITEMS]
    with open(NEWS_FILE, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=1)
    print("Added:", entry["date"], entry["title"], "/", entry["source"])

if __name__ == "__main__":
    main()
