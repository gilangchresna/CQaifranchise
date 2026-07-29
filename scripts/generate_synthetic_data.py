#!/usr/bin/env python3
"""
CyberQuote - Synthetic Test Data Generator
Generates 30 days of test data for 30 pilot outlets
"""
import random
import json
from datetime import datetime, timedelta
from supabase import create_client, Client

# Supabase connection
SUPABASE_URL = "https://ploqeifazcgzwjzmukgp.supabase.co"
# Note: Use service_role key for bulk insert
SUPABASE_KEY = ""  # Set your service role key here

# Configuration
NUM_OUTLETS = 30
NUM_DAYS = 30
REGIONS = ['JKT', 'JBR', 'JTG', 'JTM', 'SUM']

# Store names for variety
STORE_NAMES = [
    "Warung Kopi Nusantara", "Mie Ayam Barokah", "Nasi Goreng Mas Jono",
    "Sate Ayam Pak Somad", "Rawon Setan Budi", "Soto Ayam Mba Sri",
    "Bakso Mantap Jaya", "Pempek Lenning", "Gado-Gado Surabaya",
    "Ayam Geprek Bu Tuti", "Nasi Padang Minang", "Soto Lamongan",
    "Mie Yamin Sedap", "Nasi Uduk Kebayoran", "Bakmi Jawa Manggarai",
    "Warung Bebek Goreng", "Nasi Kucing Kucing", "Rendang Mama Lisa",
    "Sate Klatak Wae", "Mie Kocok Bandung", "Nasi Liwet Solo",
    "Ayam Pop Madura", "Gudeg Yu Djomok", "Coto Makassar",
    "Nasi Timbel Koko", "Mie Aceh Bujang", "Soto Bening Boyolali",
    "Rawon Kadhatuan", "Bakso Mataram"
]

def generate_outlets():
    """Generate 30 outlet records"""
    outlets = []
    for i in range(NUM_OUTLETS):
        region = random.choice(REGIONS)
        outlets.append({
            "id": i + 1,
            "region_id": REGIONS.index(region) + 1,
            "name": STORE_NAMES[i] if i < len(STORE_NAMES) else f"Outlet {i + 1}",
            "code": f"OUT-{region}-{str(i+1).zfill(3)}",
            "address": f"Jl. Raya {region} No. {i+1}",
            "city": f"Kota {region}",
            "status": "ACTIVE",
            "daily_target": random.randint(5000000, 15000000)
        })
    return outlets

def generate_sales_transactions(outlets):
    """Generate sales transactions for each outlet"""
    transactions = []
    base_date = datetime.now() - timedelta(days=NUM_DAYS)
    
    for outlet in outlets:
        outlet_id = outlet['id']
        # Historical average for this outlet
        base_avg = random.randint(5000000, 12000000)
        
        for day in range(NUM_DAYS):
            current_date = base_date + timedelta(days=day)
            date_str = current_date.strftime('%Y-%m-%d')
            
            # Daily sales with seasonality
            day_of_week = current_date.weekday()
            
            # Weekend boost
            multiplier = 1.3 if day_of_week >= 5 else 1.0
            
            # Random variation
            daily_amount = int(base_avg * multiplier * random.uniform(0.7, 1.4))
            
            # Check if anomaly (5% chance)
            is_anomaly = random.random() < 0.05
            if is_anomaly:
                # Either very high or very low
                daily_amount = int(daily_amount * random.choice([0.2, 0.3, 2.5, 3.0]))
            
            # Transaction count
            transaction_count = random.randint(50, 300)
            
            # Anomaly score
            z_score = abs((daily_amount - base_avg) / (base_avg * 0.3))
            anomaly_score = min(z_score / 3, 1.0) if z_score > 0 else 0
            
            transactions.append({
                "outlet_id": outlet_id,
                "transaction_id": f"TXN-{outlet['code']}-{date_str}-{random.randint(1000, 9999)}",
                "date": date_str,
                "amount": daily_amount,
                "transaction_count": transaction_count,
                "hour": random.randint(8, 21),
                "day_of_week": day_of_week,
                "anomaly_score": round(anomaly_score, 4),
                "is_anomaly": is_anomaly
            })
    
    return transactions

def generate_inventory(outlets):
    """Generate inventory data for each outlet"""
    inventory = []
    product_templates = [
        ("Beras 5kg", "Makanan", 50),
        ("Minyak Goreng 2L", "Makanan", 30),
        ("Gula Pasir 1kg", "Makanan", 40),
        ("Telur Ayam 1kg", "Makanan", 60),
        ("Mie Instan", "Makanan", 100),
        ("Kopi Bubuk 500g", "Minuman", 25),
        ("Teh Celup 100pcs", "Minuman", 40),
        ("Gas LPG 3kg", "Utilitas", 10),
        ("Plastik Bungkus", "Kemasan", 200),
        ("Tissue Box", "Kemasan", 50),
    ]
    
    for outlet in outlets:
        for sku, category, base_stock in product_templates:
            # Random current stock
            current_stock = random.randint(0, base_stock * 2)
            min_stock = int(base_stock * 0.3)
            max_stock = base_stock * 3
            
            # Low stock risk
            days_until_stockout = current_stock / (base_stock / 7) if base_stock > 0 else 999
            
            inventory.append({
                "outlet_id": outlet['id'],
                "sku": f"{outlet['code']}-{sku[:3].upper()}-{random.randint(100, 999)}",
                "product_name": sku,
                "category": category,
                "current_stock": current_stock,
                "min_stock": min_stock,
                "max_stock": max_stock,
                "unit": "pcs"
            })
    
    return inventory

def generate_alerts(outlets, transactions):
    """Generate sample alerts"""
    alerts = []
    alert_types = ['SALES_ANOMALY', 'STOCKOUT_RISK', 'ATTENDANCE_ISSUE']
    severities = ['P0_CRITICAL', 'P1_HIGH', 'P2_MEDIUM', 'P3_LOW']
    statuses = ['NEW', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED']
    
    alert_count = 0
    for outlet in outlets:
        if outlet['id'] > 5:  # Only first 5 outlets have alerts
            break
            
        # Generate 2-5 alerts per outlet
        num_alerts = random.randint(2, 5)
        for _ in range(num_alerts):
            alert_count += 1
            alert_type = random.choice(alert_types)
            
            # Severity based on type
            if alert_type == 'SALES_ANOMALY':
                severity = random.choice(['P0_CRITICAL', 'P1_HIGH', 'P2_MEDIUM'])
            elif alert_type == 'STOCKOUT_RISK':
                severity = random.choice(['P1_HIGH', 'P2_MEDIUM', 'P3_LOW'])
            else:
                severity = random.choice(['P2_MEDIUM', 'P3_LOW'])
            
            status = random.choice(statuses)
            
            # Title based on type
            titles = {
                'SALES_ANOMALY': 'Penjualan Anomaly Terdeteksi',
                'STOCKOUT_RISK': 'Risiko Stockout Tinggi',
                'ATTENDANCE_ISSUE': 'Masalah Kehadiran Karyawan'
            }
            
            alerts.append({
                "outlet_id": outlet['id'],
                "type": alert_type,
                "severity": severity,
                "status": status,
                "title": titles[alert_type],
                "description": f"Alert #{alert_count} untuk {outlet['name']}",
                "score": round(random.uniform(0.5, 1.0), 4)
            })
    
    return alerts

def main():
    """Main function to generate and save test data"""
    print("🎯 CyberQuote Test Data Generator")
    print("=" * 50)
    
    # Generate data
    print("📊 Generating outlets...")
    outlets = generate_outlets()
    print(f"   Generated {len(outlets)} outlets")
    
    print("💰 Generating sales transactions...")
    transactions = generate_sales_transactions(outlets)
    print(f"   Generated {len(transactions)} transactions")
    
    print("📦 Generating inventory...")
    inventory = generate_inventory(outlets)
    print(f"   Generated {len(inventory)} inventory items")
    
    print("⚠️  Generating alerts...")
    alerts = generate_alerts(outlets, transactions)
    print(f"   Generated {len(alerts)} alerts")
    
    # Save to JSON for inspection
    output = {
        "generated_at": datetime.now().isoformat(),
        "outlets": outlets,
        "transactions": transactions,
        "inventory": inventory,
        "alerts": alerts
    }
    
    output_file = "synthetic_data.json"
    with open(output_file, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"\n✅ Data saved to {output_file}")
    print("\nTo upload to Supabase, run:")
    print(f"  supabase db seed --file={output_file}")
    
    # Also print SQL INSERT statements
    print("\n" + "=" * 50)
    print("📋 SQL INSERT Statements (sample)")
    print("=" * 50)
    
    # Sample outlet insert
    print("\n-- Sample Outlet Insert --")
    print(f"""
INSERT INTO public.outlets (region_id, name, code, address, city, status, daily_target)
VALUES (1, '{outlets[0]['name']}', '{outlets[0]['code']}', '{outlets[0]['address']}', '{outlets[0]['city']}', 'ACTIVE', {outlets[0]['daily_target']});
""")
    
    # Summary stats
    print("\n📈 Summary Statistics:")
    total_sales = sum(t['amount'] for t in transactions)
    avg_sales = total_sales / len(transactions) if transactions else 0
    anomaly_count = sum(1 for t in transactions if t['is_anomaly'])
    
    print(f"   Total Sales: Rp {total_sales:,.0f}")
    print(f"   Average Daily: Rp {avg_sales:,.0f}")
    print(f"   Anomalies: {anomaly_count} ({anomaly_count/len(transactions)*100:.1f}%)")

if __name__ == "__main__":
    main()
