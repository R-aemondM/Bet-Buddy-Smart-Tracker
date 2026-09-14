import struct
import zlib
import os
import math

def make_png(width, height, get_pixel_rgba):
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0)  # Filter byte 0 (None)
        for x in range(width):
            r, g, b, a = get_pixel_rgba(x, y, width, height)
            raw_data.extend((r, g, b, a))
    
    compressed = zlib.compress(bytes(raw_data), 6)
    
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    
    return header + chunk(b'IHDR', ihdr) + chunk(b'IDAT', compressed) + chunk(b'IEND', b'')

def render_icon(x, y, w, h, is_maskable=False):
    # Normalized coordinates (-1 to 1)
    nx = (x / (w - 1)) * 2 - 1
    ny = (y / (h - 1)) * 2 - 1
    
    # In maskable mode, keep content within inner 65% radius
    scale = 0.7 if is_maskable else 0.88
    sx = nx / scale
    sy = ny / scale
    
    # Background color: Dark Slate gradient
    # #0f172a (15, 23, 42) to #1e293b (30, 41, 59)
    grad_t = (ny + 1) / 2
    bg_r = int(15 + 15 * grad_t)
    bg_g = int(23 + 18 * grad_t)
    bg_b = int(42 + 17 * grad_t)
    
    # Shield shape or rounded badge
    dist_sq = sx*sx + sy*sy
    in_outer = abs(sx) < 0.9 and abs(sy) < 0.9 and (abs(sx) < 0.7 or abs(sy) < 0.7 or dist_sq < 1.1)
    
    # Checkmark and trend line coordinates
    # Primary blue: #3b82f6 (59, 130, 246)
    # Emerald: #10b981 (16, 185, 129)
    # White: (255, 255, 255)
    
    # Shield outline
    shield_top = -0.6
    shield_bottom = 0.65
    shield_w = 0.65 * (1.0 - max(0.0, (sy - 0.1) * 1.4))
    in_shield = (sy >= shield_top) and (sy <= shield_bottom) and (abs(sx) <= shield_w)
    
    # Trending bar chart inside
    bar1 = (abs(sx - (-0.3)) < 0.08) and (sy > 0.0 and sy < 0.4)
    bar2 = (abs(sx - (-0.1)) < 0.08) and (sy > -0.2 and sy < 0.4)
    bar3 = (abs(sx - 0.1) < 0.08) and (sy > -0.4 and sy < 0.4)
    bar4 = (abs(sx - 0.3) < 0.08) and (sy > -0.55 and sy < 0.4)
    
    # Checkmark
    # Seg 1: (-0.3, 0.05) to (-0.05, 0.3)
    # Seg 2: (-0.05, 0.3) to (0.4, -0.3)
    def dist_to_seg(px, py, x1, y1, x2, y2):
        dx, dy = x2 - x1, y2 - y1
        l2 = dx*dx + dy*dy
        if l2 == 0:
            return math.hypot(px - x1, py - y1)
        t = max(0, min(1, ((px - x1)*dx + (py - y1)*dy) / l2))
        proj_x = x1 + t * dx
        proj_y = y1 + t * dy
        return math.hypot(px - proj_x, py - proj_y)
        
    d1 = dist_to_seg(sx, sy, -0.32, 0.0, -0.05, 0.28)
    d2 = dist_to_seg(sx, sy, -0.05, 0.28, 0.38, -0.25)
    in_check = min(d1, d2) < 0.08
    
    if in_check:
        return (255, 255, 255, 255)
    elif bar4 or bar3:
        return (16, 185, 129, 255)  # emerald green
    elif bar1 or bar2:
        return (59, 130, 246, 255)  # blue
    elif in_shield:
        return (30, 58, 138, 255)  # deep blue fill
    else:
        return (bg_r, bg_g, bg_b, 255)

def render_wide_screenshot(x, y, w, h):
    # Desktop dashboard mockup (1280x720)
    # Top bar (0 to 60px)
    if y < 60:
        if 40 < x < 180 and 20 < y < 45:
            return (59, 130, 246, 255) # Brand
        return (30, 41, 59, 255) # slate-800 header
    
    # Background
    bg_color = (15, 23, 42, 255) # slate-900
    
    # 4 KPI cards across the top (y: 90 to 180)
    if 90 <= y <= 180:
        card_w = 260
        gap = 20
        start_x = 80
        for i in range(4):
            cx = start_x + i * (card_w + gap)
            if cx <= x <= cx + card_w:
                if y > 165:
                    return (16, 185, 129, 255) if i != 1 else (59, 130, 246, 255)
                return (30, 41, 59, 255)
                
    # Main content panels (y: 210 to 670)
    # Left wide panel: Recent Slips (x: 80 to 780)
    if 210 <= y <= 670 and 80 <= x <= 780:
        # Card rows
        row_idx = (y - 250) // 75
        if 250 <= y <= 650:
            row_rel = (y - 250) % 75
            if row_rel < 65:
                if x > 700:
                    return (16, 185, 129, 255) # Won badge
                return (15, 23, 42, 255) # inner item
        return (30, 41, 59, 255) # container
        
    # Right panel: Folder Analytics & Charts (x: 810 to 1200)
    if 210 <= y <= 670 and 810 <= x <= 1200:
        # chart bars
        if 320 <= y <= 550 and 850 <= x <= 1160:
            bar_w = 40
            bar_gap = 25
            for bi, bh in enumerate([140, 90, 180, 110]):
                bx = 870 + bi * (bar_w + bar_gap)
                if bx <= x <= bx + bar_w and y >= 550 - bh:
                    return (59, 130, 246, 255)
        return (30, 41, 59, 255)
        
    return bg_color

def render_narrow_screenshot(x, y, w, h):
    # Mobile app view mockup (720x1280)
    # Top bar
    if y < 90:
        if 30 < x < 220 and 35 < y < 65:
            return (59, 130, 246, 255)
        return (30, 41, 59, 255)
        
    # Bottom nav bar
    if y > 1180:
        return (30, 41, 59, 255)
        
    # 2x2 stats cards (y: 120 to 360)
    if 120 <= y <= 360:
        cw = 310
        gap = 20
        # Row 1
        if 120 <= y <= 225:
            if 40 <= x <= 350 or 370 <= x <= 680:
                return (30, 41, 59, 255)
        # Row 2
        elif 245 <= y <= 350:
            if 40 <= x <= 350 or 370 <= x <= 680:
                return (30, 41, 59, 255)
                
    # Slips cards (y: 390 to 1150)
    if 390 <= y <= 1150:
        card_rel = (y - 410) % 150
        if 410 <= y <= 1100 and card_rel < 135 and 40 <= x <= 680:
            if x > 560 and card_rel < 40:
                return (16, 185, 129, 255) # green status badge
            return (30, 41, 59, 255)
            
    return (15, 23, 42, 255)

os.makedirs('public/icons', exist_ok=True)
os.makedirs('public/screenshots', exist_ok=True)

print("Generating 192x192 icon...")
with open('public/icons/icon-192.png', 'wb') as f:
    f.write(make_png(192, 192, lambda x, y, w, h: render_icon(x, y, w, h, False)))

print("Generating 512x512 icon...")
with open('public/icons/icon-512.png', 'wb') as f:
    f.write(make_png(512, 512, lambda x, y, w, h: render_icon(x, y, w, h, False)))

print("Generating 512x512 maskable icon...")
with open('public/icons/icon-maskable-512.png', 'wb') as f:
    f.write(make_png(512, 512, lambda x, y, w, h: render_icon(x, y, w, h, True)))

print("Generating desktop screenshot (1280x720)...")
with open('public/screenshots/screenshot-wide.png', 'wb') as f:
    f.write(make_png(1280, 720, render_wide_screenshot))

print("Generating mobile screenshot (720x1280)...")
with open('public/screenshots/screenshot-narrow.png', 'wb') as f:
    f.write(make_png(720, 1280, render_narrow_screenshot))

print("All PWA image assets generated successfully!")
