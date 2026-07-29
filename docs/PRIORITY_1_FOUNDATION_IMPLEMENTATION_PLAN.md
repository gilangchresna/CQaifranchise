# CyberQuote Priority 1: Foundation Implementation Plan
## Week 1-2: RAG Infrastructure & AI Chat Enhancement

---

## Overview

| Item | Detail |
|------|--------|
| **Timeline** | Week 1-2 (14 days) |
| **Goal** | Enable RAG-powered AI chat with enterprise knowledge base |
| **Owner** | Full Stack Team |
| **Budget** | Low (Supabase built-in pgvector) |
| **Dependencies** | None |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     CYBERQUOTE RAG ARCHITECTURE                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  KNOWLEDGE   │───▶│  EMBEDDING   │───▶│   VECTOR     │      │
│  │  DOCUMENTS   │    │  (Gemini)    │    │   (pgvector) │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                                       │               │
│         │                                       ▼               │
│         │                              ┌──────────────┐          │
│         │                              │   SEMANTIC   │          │
│         │                              │   SEARCH     │          │
│         │                              └──────────────┘          │
│         │                                     │                  │
│         ▼                                     ▼                  │
│  ┌──────────────────────────────────────────────────────┐       │
│  │                    ATHENA CHAT                        │       │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │       │
│  │  │   CONTEXT   │  │    LLM      │  │  RESPONSE   │  │       │
│  │  │  (RAG + DB) │  │  (Gemini)   │  │  GENERATOR  │  │       │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Week 1: Infrastructure Setup

### Day 1-2: Enable pgvector in Supabase

#### Task 1.1.1: Enable pgvector Extension

```sql
-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS vector;

-- Create embeddings table
CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(768),
  source_type VARCHAR(50), -- 'sop', 'manual', 'policy', 'incident'
  source_id UUID,
  outlet_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for similarity search
CREATE INDEX ON knowledge_embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index for filtering
CREATE INDEX idx_knowledge_source_type ON knowledge_embeddings(source_type);
CREATE INDEX idx_knowledge_outlet ON knowledge_embeddings(outlet_id);
```

#### Task 1.1.2: Create Knowledge Base Tables

```sql
-- SOPs table
CREATE TABLE IF NOT EXISTS knowledge_sops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100), -- 'operations', 'hr', 'finance', 'compliance'
  content TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  outlet_id INTEGER, -- NULL = global SOP
  region_id INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Franchise Manuals table
CREATE TABLE IF NOT EXISTS knowledge_manuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  chapter VARCHAR(100),
  content TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  franchise_type VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Incident Resolutions table
CREATE TABLE IF NOT EXISTS knowledge_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_type VARCHAR(100),
  description TEXT,
  root_cause TEXT,
  resolution TEXT NOT NULL,
  outlet_id INTEGER,
  region_id INTEGER,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Policies table
CREATE TABLE IF NOT EXISTS knowledge_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  policy_type VARCHAR(100), -- 'hr', 'compliance', 'operations', 'safety'
  content TEXT NOT NULL,
  effective_date DATE,
  outlet_id INTEGER,
  region_id INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Task 1.1.3: Create RLS Policies

```sql
-- Enable RLS on all knowledge tables
ALTER TABLE knowledge_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_manuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_policies ENABLE ROW LEVEL SECURITY;

-- Policy: HQ can see all, Regional sees own region, Franchisee sees own outlet
CREATE POLICY "Knowledge accessible by role" ON knowledge_embeddings
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'HQ_ADMIN'
    OR (
      auth.jwt() ->> 'role' IN ('REGIONAL_MANAGER', 'FRANCHISEE_OWNER', 'FRANCHISEE_STAFF')
      AND (
        outlet_id IS NULL
        OR outlet_id IN (
          SELECT id FROM outlets WHERE 
            CASE 
              WHEN auth.jwt() ->> 'role' = 'REGIONAL_MANAGER' THEN region_id = (SELECT region_id FROM user_profiles WHERE user_id = auth.uid())
              WHEN auth.jwt() ->> 'role' IN ('FRANCHISEE_OWNER', 'FRANCHISEE_STAFF') THEN id = (SELECT outlet_id FROM user_profiles WHERE user_id = auth.uid())
              ELSE FALSE
            END
        )
      )
    )
  );
```

### Day 3-4: Create Embedding Edge Function

#### File: `supabase/functions/embeddings-create/index.ts`

```typescript
/**
 * Create Embeddings for Knowledge Base
 * POST endpoint - Input: { content, source_type, metadata }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmbedRequest {
  content: string;
  source_type: "sop" | "manual" | "incident" | "policy";
  metadata?: Record<string, any>;
  outlet_id?: number;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Verify JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const body: EmbedRequest = await req.json();
    
    if (!body.content || !body.source_type) {
      return new Response(JSON.stringify({ error: "content and source_type required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;

    // Get embedding from Gemini
    const embedRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text: body.content }] }
        })
      }
    );

    if (!embedRes.ok) {
      throw new Error("Failed to create embedding");
    }

    const embedData = await embedRes.json();
    const embedding = embedData.embedding.values;

    // Store in database
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data, error } = await supabase
      .from("knowledge_embeddings")
      .insert({
        content: body.content,
        source_type: body.source_type,
        metadata: body.metadata || {},
        embedding: embedding,
        outlet_id: body.outlet_id
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
```

### Day 5: Create Semantic Search Edge Function

#### File: `supabase/functions/embeddings-search/index.ts`

```typescript
/**
 * Semantic Search for RAG
 * POST endpoint - Input: { query, source_types?, limit? }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SearchRequest {
  query: string;
  source_types?: string[];
  limit?: number;
  outlet_id?: number;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const body: SearchRequest = await req.json();
    const limit = body.limit || 5;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;

    // Get query embedding
    const embedRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text: body.query }] }
        })
      }
    );

    const embedData = await embedRes.json();
    const queryEmbedding = embedData.embedding.values;

    // Semantic search
    const supabase = createClient(supabaseUrl, serviceKey);
    
    let query = supabase
      .from("knowledge_embeddings")
      .select("id, content, source_type, metadata")
      .limit(limit * 2); // Overfetch for filtering

    // Add source type filter
    if (body.source_types && body.source_types.length > 0) {
      query = query.in("source_type", body.source_types);
    }

    const { data: embeddings, error } = await query;

    if (error) throw error;

    // Calculate cosine similarity manually (pgvector does this in SQL)
    const results = embeddings
      .map(doc => ({
        ...doc,
        similarity: cosineSimilarity(queryEmbedding, doc.embedding)
      }))
      .filter(doc => doc.similarity > 0.7) // Threshold
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      query: body.query
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}
```

### Day 6-7: Seed Initial Knowledge Base

#### Task 1.4.1: Create Seed Data Edge Function

#### File: `supabase/functions/seed-knowledge-base/index.ts`

```typescript
/**
 * Seed Initial Knowledge Base
 * Pre-populates SOPs, policies, and sample incidents
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sample SOPs
const SAMPLE_SOPS = [
  {
    title: "Daily Opening Procedures",
    category: "operations",
    content: `DAILY OPENING CHECKLIST
1. Unlock outlet 15 minutes before operating hours
2. Turn on all lights and HVAC
3. Check POS system is operational
4. Count cash drawer - minimum S$200 float
5. Review yesterday's sales report
6. Check today's delivery schedule
7. Inspect inventory levels for top 10 items
8. Brief staff on today's targets
9. Ensure cleanliness standards met
10. Open doors on time`
  },
  {
    title: "Stock Reorder Protocol",
    category: "operations",
    content: `STOCK REORDER GUIDELINES
When to reorder:
- When stock falls below 30% of maximum capacity
- Daily items: reorder when 3 days supply remaining
- Weekly items: reorder when 1 week supply remaining

How to reorder:
1. Open inventory module in POS
2. Select items below reorder point
3. Generate purchase order
4. Submit to approved suppliers only
5. Confirm delivery date with supplier

Emergency reorder:
- Contact regional warehouse
- Use emergency stock transfer form
- Notify regional manager immediately`
  },
  {
    title: "Customer Complaint Handling",
    category: "operations",
    content: `CUSTOMER COMPLAINT RESOLUTION
Step 1: Listen actively
- Let customer explain without interruption
- Show empathy and understanding

Step 2: Apologize sincerely
- "We're sorry this happened"
- Take ownership of the issue

Step 3: Resolve immediately
- Offer replacement, refund, or compensation
- Aim for first-contact resolution

Step 4: Document in system
- Log complaint in CRM
- Assign follow-up if unresolved

Step 5: Follow up
- Contact customer within 24 hours
- Ensure satisfaction

Escalation: If unresolved in 24hrs, escalate to regional manager.`
  },
  {
    title: "Staff Scheduling Guidelines",
    category: "hr",
    content: `WORKFORCE SCHEDULING STANDARDS
Staffing Levels:
- Peak hours (11am-2pm, 6pm-9pm): Minimum 3 staff
- Off-peak: Minimum 2 staff
- Weekend: Add 1 additional staff

Schedule Rules:
- Minimum 8 hours between shifts
- Maximum 10 hours per shift
- 1 day off per week mandatory
- Submit schedule 1 week in advance

Overtime:
- Pre-approved only
- Max 20 hours per month
- Rate: 1.5x base pay`
  },
  {
    title: "Cash Handling Policy",
    category: "finance",
    content: `CASH HANDLING PROCEDURES
Daily Cash Management:
1. Count cash drawer at start and end of shift
2. Use cash register locking system
3. Never leave cash drawer unattended
4. Two-person count for amounts over S$1000

Cash Deposit:
- Make bank deposit daily if over S$500
- Use secure courier service
- Get receipt and file

Petty Cash:
- Maintain S$100 float
- Replenish weekly
- Document all expenditures

Discrepancies:
- Report immediately to manager
- Investigate within 24 hours
- Escalate if over S$50 variance`
  },
  {
    title: "Food Safety Compliance",
    category: "compliance",
    content: `FOOD SAFETY REQUIREMENTS
Daily Checks:
- Temperature logs every 2 hours
- Expiry date verification
- Hygiene inspection

Temperature Standards:
- Refrigerator: 0-4°C
- Freezer: -18°C or below
- Hot holding: Above 60°C
- Cooking: Above 75°C

Staff Hygiene:
- Hand washing every 30 minutes
- Clean uniform daily
- Health declaration required
- Report illness immediately

Incident Response:
- Isolate affected food
- Document temperature breach
- Report to health authority if required`
  }
];

// Sample Incidents
const SAMPLE_INCIDENTS = [
  {
    incident_type: "Stockout",
    description: "Top-selling item unavailable during lunch rush",
    root_cause: "Supplier delivery delayed due to vehicle breakdown",
    resolution: "Emergency transfer from nearby outlet + expedited next-day delivery from supplier. Offered customer alternative menu item with 20% discount."
  },
  {
    incident_type: "Staff Absence",
    description: "Two staff called in sick for same shift",
    root_cause: "Staff not following sick leave notification protocol",
    resolution: "Called in off-duty staff with overtime. Adjusted menu to simpler offerings. Added staff to backup contact list."
  },
  {
    incident_type: "Equipment Failure",
    description: "POS system crashed during peak hours",
    root_cause: "Network connectivity issue",
    resolution: "Switched to manual order taking. Used backup tablet. IT team reset network. Normal operations resumed in 45 minutes."
  },
  {
    incident_type: "Customer Complaint",
    description: "Foreign object found in food",
    root_cause: "Breakage from worn equipment part",
    resolution: "Immediately replaced food, issued full refund + S$50 voucher. Replaced equipment part. Conducted full kitchen inspection."
  }
];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;

  const supabase = createClient(supabaseUrl, serviceKey);
  const results = { sops: 0, incidents: 0, embeddings: 0, errors: [] as string[] };

  // Insert SOPs
  for (const sop of SAMPLE_SOPS) {
    const { data: sopData, error: sopError } = await supabase
      .from("knowledge_sops")
      .insert({
        title: sop.title,
        category: sop.category,
        content: sop.content,
        is_active: true
      })
      .select()
      .single();

    if (sopError) {
      results.errors.push(`SOP ${sop.title}: ${sopError.message}`);
      continue;
    }

    results.sops++;

    // Create embedding
    try {
      const embedRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "models/text-embedding-004",
            content: { parts: [{ text: `${sop.title}\n\n${sop.content}` }] }
          })
        }
      );

      if (embedRes.ok) {
        const embedData = await embedRes.json();
        
        await supabase
          .from("knowledge_embeddings")
          .insert({
            content: `${sop.title}\n\n${sop.content}`,
            source_type: "sop",
            source_id: sopData.id,
            metadata: { category: sop.category },
            embedding: embedData.embedding.values
          });
        
        results.embeddings++;
      }
    } catch (e) {
      results.errors.push(`Embedding for ${sop.title}: ${e.message}`);
    }
  }

  // Insert Incidents
  for (const incident of SAMPLE_INCIDENTS) {
    const fullContent = `${incident.incident_type}: ${incident.description}\n\nRoot Cause: ${incident.root_cause}\n\nResolution: ${incident.resolution}`;
    
    const { data: incidentData, error: incidentError } = await supabase
      .from("knowledge_incidents")
      .insert({
        incident_type: incident.incident_type,
        description: incident.description,
        root_cause: incident.root_cause,
        resolution: incident.resolution,
        resolved_at: new Date().toISOString()
      })
      .select()
      .single();

    if (incidentError) {
      results.errors.push(`Incident ${incident.incident_type}: ${incidentError.message}`);
      continue;
    }

    results.incidents++;

    // Create embedding
    try {
      const embedRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "models/text-embedding-004",
            content: { parts: [{ text: fullContent }] }
          })
        }
      );

      if (embedRes.ok) {
        const embedData = await embedRes.json();
        
        await supabase
          .from("knowledge_embeddings")
          .insert({
            content: fullContent,
            source_type: "incident",
            source_id: incidentData.id,
            metadata: { incident_type: incident.incident_type },
            embedding: embedData.embedding.values
          });
        
        results.embeddings++;
      }
    } catch (e) {
      results.errors.push(`Embedding for ${incident.incident_type}: ${e.message}`);
    }
  }

  return new Response(JSON.stringify({ 
    success: true, 
    results,
    message: `Seeded ${results.sops} SOPs, ${results.incidents} incidents, ${results.embeddings} embeddings`
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});
```

---

## Week 2: Athena RAG Integration

### Day 8-9: Update Athena Chat with RAG

#### Task 2.1: Modify athena-chat to include RAG

```typescript
// Add to athena-chat/index.ts

// New function to retrieve relevant context
async function retrieveContext(query: string, supabase: any, limit = 5): Promise<string> {
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;
  
  // Get query embedding
  const embedRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text: query }] }
      })
    }
  );

  const embedData = await embedRes.json();
  const queryEmbedding = embedData.embedding.values;

  // Search in pgvector (using cosine similarity via RPC or raw SQL)
  const { data: contexts } = await supabase.rpc('match_knowledge_embeddings', {
    query_embedding: queryEmbedding,
    match_threshold: 0.7,
    match_count: limit
  });

  if (!contexts || contexts.length === 0) {
    return "";
  }

  // Format context for prompt
  return contexts.map((ctx: any, i: number) => 
    `[${i + 1}] ${ctx.source_type.toUpperCase()}: ${ctx.content}`
  ).join('\n\n');
}

// Update system prompt
const SYSTEM_PROMPT = `You are Athena, an AI assistant for CyberQuote franchise management platform.

Your role:
- Help HQ, regional managers, and franchisees monitor outlet performance
- Provide insights on sales, inventory, staffing, and operations
- Answer questions using both your training data AND the provided knowledge base
- Be professional, concise, and actionable

When answering:
1. First check the provided context (RAG results)
2. If context is relevant, use it to ground your answer
3. If no relevant context, answer from general knowledge
4. Always be specific to the franchise/region context when possible

Response format:
- Be concise (3-5 sentences max)
- Use bullet points for lists
- Include specific numbers and data when available
- Suggest actions when relevant`;

async function generateResponse(userMessage: string, context: string, userRole: string) {
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;
  
  const prompt = context 
    ? `CONTEXT FROM KNOWLEDGE BASE:\n${context}\n\n---\n\nUSER QUESTION: ${userMessage}\n\nAnswer based on the context provided. If the context doesn't fully answer, use your general knowledge but reference the context.`
    : userMessage;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      })
    }
  );

  return response.json();
}
```

### Day 10-11: Create RAG Admin Panel Component

#### File: `src/components/KnowledgeBaseAdmin.tsx`

```typescript
import React, { useState } from 'react';

interface KnowledgeItem {
  id: string;
  title: string;
  category: string;
  content: string;
  source_type: string;
}

export default function KnowledgeBaseAdmin() {
  const [activeTab, setActiveTab] = useState<'sops' | 'incidents' | 'policies'>('sops');
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch items based on active tab
  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${EDGE_FUNCTIONS_URL}/knowledge-list?type=${activeTab}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      console.error('Failed to fetch:', err);
    }
    setLoading(false);
  };

  // Add new knowledge item
  const addItem = async (item: Partial<KnowledgeItem>) => {
    setLoading(true);
    try {
      await fetch(`${EDGE_FUNCTIONS_URL}/knowledge-create`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(item)
      });
      fetchItems(); // Refresh list
    } catch (err) {
      console.error('Failed to add:', err);
    }
    setLoading(false);
  };

  // Search knowledge base
  const searchKnowledge = async (query: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${EDGE_FUNCTIONS_URL}/embeddings-search`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ query, limit: 10 })
      });
      const data = await res.json();
      setItems(data.results || []);
    } catch (err) {
      console.error('Search failed:', err);
    }
    setLoading(false);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Knowledge Base Admin</h1>
        <button
          onClick={() => {/* Open add modal */}}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Add Knowledge
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search knowledge base..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && searchKnowledge(searchQuery)}
          className="w-full px-4 py-2 border rounded-lg"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        {(['sops', 'incidents', 'policies'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg ${
              activeTab === tab ? 'bg-blue-600 text-white' : 'bg-gray-100'
            }`}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Items List */}
      <div className="space-y-4">
        {items.map(item => (
          <div key={item.id} className="p-4 border rounded-lg">
            <h3 className="font-semibold">{item.title}</h3>
            <p className="text-sm text-gray-600">{item.category}</p>
            <p className="mt-2 text-sm line-clamp-3">{item.content}</p>
            <div className="mt-3 flex gap-2">
              <button className="text-blue-600 text-sm">Edit</button>
              <button className="text-red-600 text-sm">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Day 12-13: Add RAG Toggle to Chat Panel

Update `ChatPanel.tsx` to show RAG sources:

```typescript
// In ChatPanel.tsx, modify the message display
<div className="space-y-4">
  {messages.map((msg, i) => (
    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] rounded-lg p-4 ${
        msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100'
      }`}>
        <p>{msg.content}</p>
        
        {/* Show RAG sources if available */}
        {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs font-semibold mb-2">📚 Sources:</p>
            <div className="space-y-1">
              {msg.sources.map((source, j) => (
                <div key={j} className="text-xs bg-white/50 rounded p-2">
                  <span className="font-medium">{source.type}:</span> {source.preview}
                </div>
              ))}
            </div>
          </div>
        )}
        
        <p className="text-xs mt-2 opacity-70">
          {new Date(msg.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  ))}
</div>
```

### Day 14: Testing & Documentation

#### Checklist

| # | Item | Status |
|---|------|--------|
| 1 | pgvector extension enabled | ⬜ |
| 2 | Knowledge tables created | ⬜ |
| 3 | RLS policies configured | ⬜ |
| 4 | embeddings-create function deployed | ⬜ |
| 5 | embeddings-search function deployed | ⬜ |
| 6 | seed-knowledge-base function deployed | ⬜ |
| 7 | Athena chat updated with RAG | ⬜ |
| 8 | Knowledge base admin UI created | ⬜ |
| 9 | Chat panel shows sources | ⬜ |
| 10 | Integration testing passed | ⬜ |

---

## Files to Create

```
supabase/
├─ migrations/
│  └─ 002_knowledge_base.sql          (Day 1-2)
└─ functions/
   ├─ embeddings-create/
   │  └─ index.ts                      (Day 3-4)
   ├─ embeddings-search/
   │  └─ index.ts                      (Day 5)
   └─ seed-knowledge-base/
      └─ index.ts                      (Day 6-7)

src/
└─ components/
   └─ KnowledgeBaseAdmin.tsx           (Day 10-11)

docs/
└─ RAG_IMPLEMENTATION.md               (This document)
```

---

## Edge Functions Summary

| Function | Purpose | Auth |
|----------|---------|------|
| `embeddings-create` | Create document embeddings | JWT |
| `embeddings-search` | Semantic search | JWT |
| `seed-knowledge-base` | Seed initial KB | Service Role |
| `knowledge-list` | List knowledge items | JWT |
| `knowledge-create` | Add new knowledge | JWT |

---

## Environment Variables Required

```env
# Supabase (already set)
SUPABASE_URL=https://ploqeifazcgzwjzmukgp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<secret>

# Gemini (already set)
GEMINI_API_KEY=<secret>
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| RAG Latency | < 2 seconds | Time from query to response |
| Context Relevance | > 80% | User feedback on answer quality |
| Knowledge Coverage | 20+ SOPs | Number of documents indexed |
| Search Accuracy | > 70% | Relevant results in top 5 |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Embedding cost too high | Batch embedding, cache results |
| Slow semantic search | Add proper indexes, optimize query |
| RAG quality poor | Manual QA of indexed content |
| Token limit exceeded | Truncate context, prioritize recent |

---

## Next Steps (After Week 1-2)

1. **Week 3-4**: Peer Benchmarking
2. **Week 5-6**: Real ML Models (Isolation Forest)
3. **Week 7-8**: Approval Workflows
4. **Week 9-10**: Franchisee Portal

---

*Document Version: 1.0*
*Created: 2026-07-23*
*Status: Ready for Implementation*
