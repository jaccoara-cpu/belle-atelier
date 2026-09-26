import urllib.request
import re
import json

url = "https://www.instagram.com/belle.atelier.boutique/"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7"
}

req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as response:
        content = response.read().decode('utf-8', errors='ignore')
        
        # Save raw HTML to debug
        with open('ig_dump.html', 'w', encoding='utf-8') as f:
            f.write(content)
            
        print("HTML saved, length:", len(content))
        
        # Extract shortcodes / posts
        shortcodes = set(re.findall(r'\"shortcode\":\"([A-Za-z0-9_-]+)\"', content))
        print("Found shortcodes:", shortcodes)
        
        # Extract captions
        captions = re.findall(r'\"accessibility_caption\":\"([^\"]+)\"', content)
        print("Found accessibility captions:", len(captions))
        for c in captions[:5]:
            print("-", c)
            
except Exception as e:
    print("Error:", e)
