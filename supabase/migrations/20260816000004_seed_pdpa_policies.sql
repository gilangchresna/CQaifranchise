-- ============================================================
-- PDPA Compliance: Seed Placeholder Policies per Region
-- Date: 2026-08-16
-- Purpose: 3 region-specific PDPA consent placeholders
-- Note: Content requires legal review before production
-- ============================================================

-- Insert PDPA policies (one per region)
-- region_id: 1 = Singapore, 2 = Indonesia (Jakarta), NULL = Malaysia (not seeded yet)

INSERT INTO public.knowledge_policies (title, policy_type, content, region_id, effective_date, is_active, created_at, updated_at)
VALUES
  (
    'PDPA Privacy Notice — Singapore',
    'pdpa',
    '[PENDING LEGAL REVIEW] This Privacy Notice is issued pursuant to the Personal Data Protection Act 2012 (PDPA) of Singapore. CyberQuote Pte Ltd ("we", "us", "our") collects, uses, and discloses personal data of franchisees for the purpose of processing financing applications submitted to our lending partners. By submitting your financing application, you consent to: (1) the collection of your business and financial data; (2) the disclosure of such data to our authorized lending partners; (3) the retention of such data for a period of up to 7 years in accordance with IRAS requirements. For enquiries, contact: dpo@cyberquote.co.id',
    1,
    CURRENT_DATE,
    TRUE,
    NOW(),
    NOW()
  ),
  (
    'PDPA Privacy Notice — Indonesia',
    'pdpa',
    '[PENDING LEGAL REVIEW] Pemberitahuan Privasi ini diterbitkan berdasarkan Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP). PT CyberQuote Indonesia ("kami") mengumpulkan, menggunakan, dan mengungkapkan data pribadi pelaku usaha franchise untuk memproses aplikasi pembiayaan. Dengan mengajukan aplikasi pembiayaan, Anda memberikan persetujuan untuk: (1) pengumpulan data usaha dan keuangan Anda; (2) pengungkapan data tersebut kepada mitra pemberi pinjaman kami; (3) penyimpanan data tersebut sesuai ketentuan perpajakan yang berlaku (5 tahun). Untuk pertanyaan, hubungi: dpo@cyberquote.co.id',
    2,
    CURRENT_DATE,
    TRUE,
    NOW(),
    NOW()
  ),
  (
    'PDPA Privacy Notice — Malaysia',
    'pdpa',
    '[PENDING LEGAL REVIEW] This Privacy Notice is issued pursuant to the Personal Data Protection Act 2010 (PDPA) of Malaysia. CyberQuote Malaysia Sdn Bhd ("we", "us", "our") collects, uses, and discloses personal data of franchisees for the purpose of processing financing applications submitted to our lending partners. By submitting your financing application, you consent to: (1) the collection of your business and financial data; (2) the disclosure of such data to our authorized lending partners; (3) the retention of such data for a period of up to 7 years in accordance with LHDN requirements. For enquiries, contact: dpo@cyberquote.co.id',
    NULL,
    CURRENT_DATE,
    TRUE,
    NOW(),
    NOW()
  )
ON CONFLICT DO NOTHING;

-- Verify
SELECT id, title, policy_type, region_id, effective_date, is_active
FROM public.knowledge_policies
WHERE policy_type = 'pdpa'
ORDER BY region_id NULLS LAST;
