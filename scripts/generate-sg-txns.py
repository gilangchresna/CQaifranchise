#!/usr/bin/env python3
"""
Generate SG realistic transactions - output as JSON for curl
"""

import random
import uuid
import json
from datetime import datetime, timedelta

# 10 SG Outlets
SG_OUTLETS = [
    {"id": 164, "code": "KT-TMP-001"},
    {"id": 165, "code": "CR-JGP-001"},
    {"id": 167, "code": "LK-PLB-001"},
    {"id": 168, "code": "KT-CMT-001"},
    {"id": 169, "code": "MT-WDL-001"},
    {"id": 170, "code": "RP-HGM-001"},
    {"id": 171, "code": "ER-BSN-001"},
    {"id": 200, "code": "SG-001"},
    {"id": 201, "code": "SG-002"},
    {"id": 202, "code": "SG-003"},
]

# SG Menu
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

PAYMENT_METHODS = ["cash", "card", "qrcode", "ewallet", "shopeefood", "gofood", "grabfood"]
PLATFORMS = ["dine_in", "takeaway", "delivery"]
HOUR_WEIGHTS = {7: 2, 8: 5, 9: 4, 10: 3, 11: 8, 12: 15, 13: 12, 14: 6, 15: 4, 16: 5, 17: 8, 18: 15, 19: 12, 20: 8, 21: 4, 22: 2}

def get_random_hour():
    hours = list(HOUR_WEIGHTS.keys())
    weights = list(HOUR_WEIGHTS.values())
    return random.choices(hours, weights=weights)[0]

def build_transaction(outlet, date, hour):
    num_items = random.choices([1, 2, 3, 4], weights=[40, 35, 15, 10])[0]
    items = random.sample(SG_MENU, min(num_items, len(SG_MENU)))
    subtotal = sum(item["price"] for item in items)
    
    platform = random.choices(PLATFORMS, weights=[50, 30, 20])[0]
    if platform == "dine_in":
        service_charge = round(subtotal * 0.10, 2)
        tax = round(subtotal * 0.08, 2)
    else:
        service_charge = 0
        tax = round(subtotal * 0.08, 2)
    
    amount = round(subtotal + service_charge + tax, 2)
    cost = round(subtotal * 0.35, 2)
    discount = round(amount * random.choice([0.05, 0.10, 0.15]), 2) if random.random() < 0.1 else 0
    if discount:
        amount = round(amount - discount, 2)
    
    if platform == "delivery":
        payment = random.choices(["shopeefood", "gofood", "grabfood", "card"], weights=[40, 30, 20, 10])[0]
    else:
        payment = random.choices(PAYMENT_METHODS, weights=[15, 20, 15, 25, 0, 0, 0])[0]
    
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

def generate_data():
    print("Generating 60 days of SG data...")
    all_txns = []
    end_date = datetime.now()
    start_date = end_date - timedelta(days=60)
    
    current_date = start_date
    while current_date <= end_date:
        for outlet in SG_OUTLETS:
            is_weekend = current_date.weekday() >= 5
            num_txns = random.randint(80, 150) if is_weekend else random.randint(50, 100)
            
            for _ in range(num_txns):
                hour = get_random_hour()
                all_txns.append(build_transaction(outlet, current_date, hour))
        
        current_date += timedelta(days=1)
    
    # Save to file
    with open("sg_txns_60d.json", "w") as f:
        json.dump(all_txns, f)
    
    print(f"Generated {len(all_txns)} transactions")
    print(f"Saved to sg_txns_60d.json")

if __name__ == "__main__":
    generate_data()
