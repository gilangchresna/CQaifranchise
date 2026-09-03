#!/usr/bin/env python3
"""
Seed realistic SG sales data for last 60 days
10 SG outlets × 60 days × ~100 txns = ~60,000 transactions
"""

import asyncio
import random
import uuid
from datetime import datetime, timedelta
from supabase import create_client, Client
import json

# Supabase config
SUPABASE_URL = "https://ploqeifazcgzwjzmukgp.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3FlaWZhemNnd3p6bXVrZ3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzMjU3MzIwMCwiZXhwIjoxOTQ4MTQ4NjAwfQ.9MmmYhYrlN3qJ3H8xH2y8hZn9qY3r5bJk5X7vJ5ZqE"

# 10 SG Outlets
SG_OUTLETS = [
    {"id": 164, "code": "KT-TMP-001", "name": "Kopitiam Tampines"},
    {"id": 165, "code": "CR-JGP-001", "name": "Chicken Rice Jurong Point"},
    {"id": 167, "code": "LK-PLB-001", "name": "Laksa King Paya Lebar"},
    {"id": 168, "code": "KT-CMT-001", "name": "Kopitiam Clementis"},
    {"id": 169, "code": "MT-WDL-001", "name": "Mookata Woodlands"},
    {"id": 170, "code": "RP-HGM-001", "name": "Roti Prata Hougang"},
    {"id": 171, "code": "ER-BSN-001", "name": "Economic Rice Bishan"},
    {"id": 200, "code": "SG-001", "name": "SG Marina Bay"},
    {"id": 201, "code": "SG-002", "name": "SG Orchard"},
    {"id": 202, "code": "SG-003", "name": "SG Changi"},
]

# SG Menu (realistic SGD prices S$5-S$22)
SG_MENU = [
    {"sku": "LMT_NASI_GORENG", "name": "Nasi Goreng", "price": 18.00},
    {"sku": "LMT_AYAM_GEPREK", "name": "Ayam Geprek Matah", "price": 15.00},
    {"sku": "LMT_MIE_GORENG", "name": "Mie Goreng Jawa", "price": 14.00},
    {"sku": "BEV_KOPI_O", "name": "Kopi O / Teh O", "price": 5.00},
    {"sku": "LMT_AYAM_RICE", "name": "Ayam Rice", "price": 22.00},
    {"sku": "LMT_SOTO_AYAM", "name": "Soto Ayam", "price": 16.00},
    {"sku": "LMT_LAKSA", "name": "Laksa", "price": 15.00},
    {"sku": "LMT_ROTI_PRATA", "name": "Roti Prata + Curry", "price": 12.00},
    {"sku": "BEV_KOPI_C", "name": "Kopi C Siew Dai", "price": 6.00},
    {"sku": "LMT_BAKSO", "name": "Bakso", "price": 15.00},
    {"sku": "BEV_ICED_TEA", "name": "Iced Tea", "price": 5.00},
    {"sku": "BEV_LATTE", "name": "Cafe Latte", "price": 7.00},
    {"sku": "BEV_ORANGE_JUICE", "name": "Fresh Orange Juice", "price": 6.00},
    {"sku": "BEV_MILO", "name": "Milo Dinosaur", "price": 6.00},
    {"sku": "MNL_BEEG_HOON", "name": "Taipei Beeg Hoon", "price": 14.00},
    {"sku": "MNL_KWAY_TEOW", "name": "Char Kway Teow", "price": 12.00},
    {"sku": "LMT_SATE", "name": "Sate Ayam (10 pcs)", "price": 18.00},
]

# Payment methods
PAYMENT_METHODS = ["cash", "card", "qrcode", "ewallet", "shopeefood", "gofood", "grabfood"]
PAYMENT_WEIGHTS = [15, 20, 15, 25, 10, 10, 5]  # percentages

# Platforms
PLATFORMS = ["dine_in", "takeaway", "delivery"]
PLATFORM_WEIGHTS = [50, 30, 20]  # percentages

# Hours distribution (more during meal times)
HOUR_WEIGHTS = {
    7: 2, 8: 5, 9: 4, 10: 3,
    11: 8, 12: 15, 13: 12, 14: 6,
    15: 4, 16: 5, 17: 8, 18: 15,
    19: 12, 20: 8, 21: 4, 22: 2
}

def get_random_hour():
    hours = list(HOUR_WEIGHTS.keys())
    weights = list(HOUR_WEIGHTS.values())
    return random.choices(hours, weights=weights)[0]

def get_payment_method():
    return random.choices(PAYMENT_METHODS, weights=PAYMENT_WEIGHTS)[0]

def get_platform():
    return random.choices(PLATFORMS, weights=PLATFORM_WEIGHTS)[0]

def build_transaction(outlet, date, hour):
    """Build one realistic transaction"""
    # Number of items: 1-4 (most common 1-2)
    num_items = random.choices([1, 2, 3, 4], weights=[40, 35, 15, 10])[0]
    
    items = random.sample(SG_MENU, min(num_items, len(SG_MENU)))
    subtotal = sum(item["price"] for item in items)
    
    # Add GST 8% and Service Charge 10% for dine-in
    platform = get_platform()
    if platform == "dine_in":
        service_charge = round(subtotal * 0.10, 2)
        tax = round(subtotal * 0.08, 2)
    else:
        service_charge = 0
        tax = round(subtotal * 0.08, 2)
    
    amount = round(subtotal + service_charge + tax, 2)
    cost = round(subtotal * 0.35, 2)  # 35% cost margin
    
    # Discount occasionally
    discount = 0
    if random.random() < 0.1:  # 10% chance of discount
        discount = round(amount * random.choice([0.05, 0.10, 0.15]), 2)
        amount = round(amount - discount, 2)
    
    # Payment method based on platform
    if platform == "delivery":
        payment = random.choices(["shopeefood", "gofood", "grabfood", "card"], weights=[40, 30, 20, 10])[0]
    else:
        payment = get_payment_method()
    
    return {
        "outlet_id": outlet["id"],
        "transaction_id": f"TXN-{uuid.uuid4().hex[:10].upper()}",
        "date": date.strftime("%Y-%m-%d"),
        "amount": amount,
        "transaction_count": 1,
        "hour": hour,
        "day_of_week": date.weekday(),
        "anomaly_score": None,
        "is_anomaly": False,
        "metadata": json.dumps({"items": [{"sku": i["sku"], "name": i["name"], "price": i["price"]} for i in items]}),
        "payment_method": payment,
        "customer_id": f"CUST-{random.randint(1, 500)}" if random.random() < 0.3 else None,
        "staff_id": f"{random.randint(100, 999)}",
        "discount": discount,
        "tax": tax,
        "cost": cost,
        "net_amount": round(amount + discount, 2),
        "platform": platform,
        "platform_order_id": f"ORD-{uuid.uuid4().hex[:8].upper()}" if platform == "delivery" else None,
        "platform_fee": round(amount * 0.20, 2) if platform == "delivery" else 0,
        "settlement_amount": round(amount * 0.80, 2) if platform == "delivery" else amount,
        "currency_code": "SGD",
        "created_at": date.replace(hour=hour, minute=random.randint(0, 59), second=random.randint(0, 59)).isoformat() + "+00:00"
    }

async def seed_data():
    print("🚀 Starting SG 60-day realistic seed...")
    
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # 60 days back from today
    end_date = datetime.now()
    start_date = end_date - timedelta(days=60)
    
    print(f"📅 Period: {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")
    print(f"🏪 Outlets: {len(SG_OUTLETS)}")
    
    all_transactions = []
    total_txns = 0
    
    current_date = start_date
    while current_date <= end_date:
        for outlet in SG_OUTLETS:
            # Weekend = busier
            is_weekend = current_date.weekday() >= 5
            base_txns = random.randint(80, 150) if is_weekend else random.randint(50, 100)
            
            for _ in range(base_txns):
                hour = get_random_hour()
                txn = build_transaction(outlet, current_date, hour)
                all_transactions.append(txn)
                total_txns += 1
                
                # Batch insert every 1000
                if len(all_transactions) >= 1000:
                    print(f"  Inserting batch of {len(all_transactions)}...")
                    try:
                        result = supabase.table("sales_transactions").insert(all_transactions).execute()
                        print(f"  ✅ Inserted {len(all_transactions)}, Total: {total_txns}")
                    except Exception as e:
                        print(f"  ❌ Error: {e}")
                    all_transactions = []
        
        current_date += timedelta(days=1)
    
    # Insert remaining
    if all_transactions:
        print(f"  Inserting final batch of {len(all_transactions)}...")
        try:
            result = supabase.table("sales_transactions").insert(all_transactions).execute()
            print(f"  ✅ Final insert: {len(all_transactions)}")
        except Exception as e:
            print(f"  ❌ Error: {e}")
    
    print(f"\n✅ DONE! Total transactions: {total_txns}")
    print(f"📊 Expected: ~{len(SG_OUTLETS)} outlets × 60 days × ~100 txns = ~60,000")
    
    # Verify
    response = supabase.table("sales_transactions").select("id", count="exact").execute()
    print(f"📦 Database now has: {response.count} transactions")

if __name__ == "__main__":
    asyncio.run(seed_data())
