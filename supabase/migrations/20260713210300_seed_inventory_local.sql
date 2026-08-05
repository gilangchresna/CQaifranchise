-- Seed inventory data for all outlets
INSERT INTO public.inventory (outlet_id, sku, product_name, category, current_stock, min_stock, max_stock, unit)
SELECT 
  id,
  'SKU-' || code || '-001',
  'Mie Ayam Original',
  '主食',
  (random() * 50 + 20)::integer,
  15,
  100,
  'portion'
FROM public.outlets
ON CONFLICT DO NOTHING;

INSERT INTO public.inventory (outlet_id, sku, product_name, category, current_stock, min_stock, max_stock, unit)
SELECT 
  id,
  'SKU-' || code || '-002',
  'Ayam Geprek',
  '主食',
  (random() * 40 + 10)::integer,
  10,
  80,
  'portion'
FROM public.outlets
ON CONFLICT DO NOTHING;

INSERT INTO public.inventory (outlet_id, sku, product_name, category, current_stock, min_stock, max_stock, unit)
SELECT 
  id,
  'SKU-' || code || '-003',
  'Es Teh Manis',
  'Minuman',
  (random() * 100 + 50)::integer,
  30,
  200,
  'glass'
FROM public.outlets
ON CONFLICT DO NOTHING;
