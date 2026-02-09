import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// ─── Regex Parsing Helpers ───────────────────────────────────

function extractField(content: string, patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const m = content.match(p)
    if (m && m[1]?.trim()) return m[1].trim()
  }
  return null
}

function parseProfileFromContent(html: string, markdown: string, wcaId: number) {
  const content = html || markdown || ''
  const md = markdown || ''

  // Detect 404 / not found

  // Detect 404 / not found
  if (/page\s*(not|was not)\s*found|member\s*not\s*found|404|no\s*results?\s*found/i.test(content)) {
    return null
  }

  // ── Company Name ──
  const companyName = extractField(content, [
    /<h1[^>]*class="[^"]*company[^"]*"[^>]*>([^<]+)</i,
    /<h1[^>]*>([^<]{3,100})<\/h1>/i,
    /class="[^"]*member-?name[^"]*"[^>]*>([^<]+)</i,
    /class="[^"]*company-?name[^"]*"[^>]*>([^<]+)</i,
  ]) || extractField(md, [
    /^#\s+(.{3,100})$/m,
    /^##\s+(.{3,100})$/m,
  ])

  if (!companyName) return null
  if (/not\s*found|try\s*again/i.test(companyName)) return null

  // ── City & Office Type from "(City, Head Office)" pattern ──
  let city: string | null = null
  let country: string | null = null
  let detectedOfficeType: string | null = null

  // Pattern: "(Chattanooga, Head Office)" right after the heading
  const locationBracket = md.match(/\(([^,)]+),\s*(Head\s*Office|Branch)\)/i)
  if (locationBracket) {
    city = locationBracket[1].trim()
    detectedOfficeType = locationBracket[2].trim()
  }

  // Country: standalone line like "United States of America" near the top
  // Look for country names in the first 2000 chars of markdown
  const topSection = md.substring(0, 2000)
  const countryLineMatch = topSection.match(/^(United States of America|United Kingdom|Canada|Australia|Germany|France|Italy|Spain|China|India|Japan|Brazil|Mexico|Argentina|Colombia|Chile|Peru|South Korea|Thailand|Indonesia|Malaysia|Vietnam|Philippines|Singapore|Hong Kong|Taiwan|Turkey|Saudi Arabia|United Arab Emirates|South Africa|Nigeria|Kenya|Egypt|Netherlands|Belgium|Switzerland|Austria|Sweden|Norway|Denmark|Finland|Poland|Czech Republic|Portugal|Greece|Ireland|New Zealand|Israel|Russia|Ukraine|Romania|Hungary|Pakistan|Bangladesh|Sri Lanka|Nepal|Panama|Costa Rica|Ecuador|Bolivia|Paraguay|Uruguay|Venezuela|Guatemala|Honduras|Dominican Republic|El Salvador|Nicaragua|Cuba|Jamaica|Trinidad and Tobago|Puerto Rico)$/mi)
  if (countryLineMatch) {
    country = countryLineMatch[1].trim()
  }

  // Fallback city: try "City:" or HTML patterns
  if (!city) {
    city = extractField(content, [
      /class="[^"]*city[^"]*"[^>]*>([^<]+)</i,
    ]) || extractField(md, [
      /(?:City)\s*[:：]\s*(.+)/im,
    ])
  }

  // ── Country Code ──
  // Try to derive from country name or from existing partner data
  const countryCode = countryNameToCode(country) || extractField(content, [
    /\/flags?\/([a-z]{2})\./i,
    /country[_-]?code["']?\s*[:=]\s*["']?([A-Z]{2})/i,
  ])?.toUpperCase() || 'XX'

  // ── Contact Info ──
  // Exclude wcaworld.com emails
  const rawEmail = extractField(content, [
    /mailto:([^\s"'<>]+@[^\s"'<>]+)/i,
    /(?:Email|E-mail)\s*[:：]\s*([^\s<>"]+@[^\s<>"]+)/i,
  ]) || extractField(md, [
    /(?:Email|E-mail)\s*[:：]\s*\[?([^\s\]<>]+@[^\s\]<>]+)/im,
    /\[([^\]]+@[^\]]+)\]\(mailto:/im,
  ])
  const email = rawEmail && !rawEmail.includes('wcaworld.com') ? rawEmail : null

  const phone = extractField(content, [
    /(?:Phone|Tel|Telephone)\s*[:：]\s*([+\d\s\-().]{7,25})/i,
  ]) || extractField(md, [
    /(?:Phone|Tel|Telephone)\s*[:：]\s*([+\d\s\-().]{7,25})/im,
  ])

  const fax = extractField(content, [
    /(?:Fax)\s*[:：]\s*([+\d\s\-().]{7,25})/i,
  ]) || extractField(md, [
    /(?:Fax)\s*[:：]\s*([+\d\s\-().]{7,25})/im,
  ])

  // ── Website ──
  // Handle markdown link format [url](url) and extract clean URL
  let website: string | null = null
  const websiteMatch = md.match(/(?:Website|Web|URL|Homepage)\s*[:：]\s*\[([^\]]+)\]\(([^)]+)\)/im)
  if (websiteMatch) {
    website = websiteMatch[2] || websiteMatch[1]
  }
  if (!website) {
    website = extractField(content, [
      /href="(https?:\/\/(?!(?:www\.)?wcaworld)[^\s"]+)"[^>]*>\s*(?:Visit\s*Website|Website|www\.)/i,
      /(?:Website|Web|URL|Homepage)\s*[:：]\s*(?:<a[^>]*href=")?([^"<\s]+(?:https?:\/\/(?!(?:www\.)?wcaworld)[^\s"<]+))/i,
    ]) || extractField(md, [
      /(?:Website|Web|URL|Homepage)\s*[:：]\s*(https?:\/\/(?!(?:www\.)?wcaworld)[^\s\]]+)/im,
    ])
  }

  // ── Address ──
  const address = extractField(content, [
    /class="[^"]*address[^"]*"[^>]*>([\s\S]{5,200}?)<\//i,
    /(?:Address)\s*[:：]\s*([^<\n]{5,200})/i,
  ]) || extractField(md, [
    /(?:Address)\s*[:：]\s*(.{5,200})/im,
  ])

  // ── Profile Description ──
  // WCA format: inside a markdown table "| description text |" after "Profile:"
  let profileDescription = extractField(md, [
    /Profile:\s*\n+\|[^\n]*\|\s*\n\|\s*[-–]+\s*\|\s*\n\|\s*([\s\S]{20,3000}?)\s*\|/im,
    /Profile:\s*\n+\|[^\n]*\|\s*\n\|\s*([\s\S]{20,3000}?)\s*\|/im,
  ])
  // HTML fallback
  if (!profileDescription) {
    profileDescription = extractField(content, [
      /class="[^"]*(?:profile|description|about|company-?info)[^"]*"[^>]*>([\s\S]{20,2000}?)<\//i,
    ])
  }
  // Clean up table formatting and skip navigation text
  if (profileDescription) {
    profileDescription = profileDescription.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/\|\s*$/gm, '').replace(/\s+/g, ' ').trim()
  }
  if (profileDescription && (profileDescription.length < 15 || /^[«»<>←→]/m.test(profileDescription))) {
    profileDescription = null
  }

  // ── Member Since ──
  const memberSince = extractField(content, [
    /(?:Member\s*Since|Joined|Since)\s*[:：]?\s*([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i,
    /(?:Member\s*Since|Joined|Since)\s*[:：]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
  ]) || extractField(md, [
    /(?:Member\s*Since|Joined|Since)\s*[:：]?\s*([A-Za-z]+\s+\d{1,2},?\s*\d{4})/im,
  ])

  // ── Office Type ──
  const officeType = detectedOfficeType?.toLowerCase()?.includes('branch') ? 'branch' : 'head_office'

  // ── Gold Medallion ──
  const goldMedallion = /gold\s*medallion/i.test(content)

  // ── Networks ──
  const networks: { name: string; expires?: string }[] = []
  const wcaNetworks = ['WCA Inter Global', 'WCA China Global', 'WCA First', 'WCA Advanced Professionals', 'WCA Projects', 'WCA Dangerous Goods', 'WCA Perishables', 'WCA Time Critical', 'WCA Pharma', 'WCA eCommerce']
  for (const net of wcaNetworks) {
    if (content.includes(net) || md.includes(net)) {
      const expiryRegex = new RegExp(net.replace(/\s+/g, '\\s+') + '[^\\n]*?(?:Expires?\\s*[:：]?\\s*|[-–]\\s*)(\\w+\\s+\\d{1,2},?\\s*\\d{4})', 'i')
      const expiryMatch = content.match(expiryRegex) || md.match(expiryRegex)
      networks.push({ name: net, expires: expiryMatch?.[1] || undefined })
    }
  }

  // ── Certifications ──
  const certifications: string[] = []
  const validCerts = ['IATA', 'BASC', 'ISO', 'C-TPAT', 'AEO']
  for (const cert of validCerts) {
    if (content.includes(cert) || md.includes(cert)) {
      certifications.push(cert)
    }
  }

  // ── Contacts ──
  // WCA markdown format has fields on separate lines:
  // Title:\n\nManaging Director\n\nName:\n\nJohn Smith\n\nEmail:\n\njohn@example.com
  const contacts: { title: string; name?: string; email?: string; phone?: string; mobile?: string }[] = []
  
  // Helper: extract value after a field label in multi-line format
  // Handles both "Field: value" (same line) and "Field:\n\nvalue" (next non-empty line)
  function extractMultiLineField(block: string, fieldName: string): string | null {
    // Pattern 1: "Field: value" on same line
    const sameLineRegex = new RegExp(fieldName + '\\s*:\\s*(.+)', 'i')
    const sameLineMatch = block.match(sameLineRegex)
    if (sameLineMatch && sameLineMatch[1].trim().length > 0) {
      return sameLineMatch[1].trim()
    }
    
    // Pattern 2: "Field:\n\nvalue" on separate lines
    const multiLineRegex = new RegExp(fieldName + '\\s*:\\s*\\n+\\s*(.+)', 'i')
    const multiLineMatch = block.match(multiLineRegex)
    if (multiLineMatch && multiLineMatch[1].trim().length > 0) {
      return multiLineMatch[1].trim()
    }
    
    return null
  }
  
  // Split by "Title:" to get each contact block
  const titleBlocks = md.split(/^Title:\s*$/mi)
  // If no match with strict line boundary, try looser split
  const blocks = titleBlocks.length > 1 ? titleBlocks.slice(1) : md.split(/Title:\s*/i).slice(1)
  
  for (const block of blocks) {
    // Title value is the first non-empty line in the block
    const lines = block.split('\n')
    let titleLine: string | null = null
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.length >= 2) {
        titleLine = trimmed
        break
      }
    }
    if (!titleLine || titleLine.length < 3) continue
    // Skip placeholder text from non-authenticated scraping
    if (/Members\s*only|please\s*\*?\*?Login\*?\*?|Login\s*to\s*view/i.test(titleLine)) continue
    
    const contact: { title: string; name?: string; email?: string; phone?: string; mobile?: string } = { title: titleLine }
    
    // Extract Name
    const rawName = extractMultiLineField(block, 'Name')
    if (rawName) {
      const name = rawName.replace(/\*+/g, '').trim()
      if (name && !/Members\s*only|Login/i.test(name)) contact.name = name
    }
    
    // Extract Email - handle markdown link format [email](mailto:email) and plain
    const rawEmail = extractMultiLineField(block, 'Email')
    if (rawEmail) {
      // Extract from markdown link: [email@domain.com](mailto:email@domain.com)
      const linkMatch = rawEmail.match(/\[([^\]]+@[^\]]+)\]/)
      const email = linkMatch ? linkMatch[1].trim() : rawEmail.replace(/\*+/g, '').trim()
      if (email && /\S+@\S+\.\S+/.test(email) && !/Members\s*only|Login|wcaworld/i.test(email)) {
        contact.email = email
      }
    }
    
    // Extract Direct Line / Direct Phone / Phone
    const rawPhone = extractMultiLineField(block, '(?:Direct\\s*(?:Line|Phone)|Phone|Tel)')
    if (rawPhone) {
      const phone = rawPhone.replace(/\[.*?\]\(.*?\)/g, '').replace(/\*+/g, '').trim()
      if (phone && /[+\d]/.test(phone) && !/Members\s*only|Login/i.test(phone)) contact.phone = phone
    }
    
    // Extract Mobile
    const rawMobile = extractMultiLineField(block, 'Mobile')
    if (rawMobile) {
      const mobile = rawMobile.replace(/\[.*?\]\(.*?\)/g, '').replace(/\*+/g, '').trim()
      if (mobile && /[+\d]/.test(mobile) && !/Members\s*only|Login/i.test(mobile)) contact.mobile = mobile
    }
    
    contacts.push(contact)
  }
  
  // HTML fallback
  if (contacts.length === 0) {
    const htmlContactRegex = /Title:\s*<\/[^>]+>\s*<[^>]+>([^<]+)/gi
    let hcm
    while ((hcm = htmlContactRegex.exec(content)) !== null) {
      const title = hcm[1].trim()
      if (title.length >= 3 && !/Members\s*only|Login/i.test(title)) {
        contacts.push({ title })
      }
    }
  }

  // ── Branch Offices ──
  const branchOffices: { city: string; wca_id?: number }[] = []
  // Look for links to other member profiles
  const branchRegex = /href="[^"]*\/[Dd]irectory\/[Mm]embers\/(\d+)"[^>]*>[^<]*?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)[^<]*Branch/gi
  let bm
  while ((bm = branchRegex.exec(content)) !== null) {
    const branchId = parseInt(bm[1])
    if (branchId !== wcaId) {
      branchOffices.push({ city: bm[2].trim(), wca_id: branchId })
    }
  }
  // Markdown fallback
  if (branchOffices.length === 0) {
    const mdBranchRegex = /\[([^\]]*Branch[^\]]*)\]\([^)]*\/[Dd]irectory\/[Mm]embers\/(\d+)/gi
    let mbm
    while ((mbm = mdBranchRegex.exec(md)) !== null) {
      const branchId = parseInt(mbm[2])
      if (branchId !== wcaId) {
        const cityMatch = mbm[1].match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*[-–]/)?.[1]
        branchOffices.push({ city: cityMatch || mbm[1].trim(), wca_id: branchId })
      }
    }
  }

  return {
    company_name: decodeEntities(companyName),
    city: city ? decodeEntities(city) : 'Unknown',
    country: country ? decodeEntities(country) : '',
    country_code: countryCode,
    office_type: officeType,
    email: email || null,
    phone: phone || null,
    fax: fax || null,
    website: cleanWebsite(website),
    address: address ? decodeEntities(address.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()) : null,
    profile_description: profileDescription ? decodeEntities(profileDescription.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()) : null,
    member_since: memberSince || null,
    gold_medallion: goldMedallion,
    networks,
    certifications,
    contacts,
    branch_offices: branchOffices,
    has_branches: branchOffices.length > 0,
  }
}

function decodeEntities(str: string): string {
  return str.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

function cleanWebsite(url: string | null): string | null {
  if (!url) return null
  let cleaned = url.trim()
  if (!cleaned.startsWith('http')) cleaned = 'https://' + cleaned
  // Remove wcaworld references
  if (cleaned.includes('wcaworld.com')) return null
  return cleaned
}

function countryNameToCode(name: string | null): string | null {
  if (!name) return null
  const map: Record<string, string> = {
    'united states of america': 'US', 'united states': 'US', 'usa': 'US',
    'united kingdom': 'GB', 'great britain': 'GB', 'england': 'GB',
    'canada': 'CA', 'australia': 'AU', 'germany': 'DE', 'france': 'FR',
    'italy': 'IT', 'spain': 'ES', 'china': 'CN', 'india': 'IN',
    'japan': 'JP', 'brazil': 'BR', 'mexico': 'MX', 'argentina': 'AR',
    'colombia': 'CO', 'chile': 'CL', 'peru': 'PE', 'south korea': 'KR',
    'thailand': 'TH', 'indonesia': 'ID', 'malaysia': 'MY', 'vietnam': 'VN',
    'philippines': 'PH', 'singapore': 'SG', 'hong kong': 'HK', 'taiwan': 'TW',
    'turkey': 'TR', 'saudi arabia': 'SA', 'united arab emirates': 'AE',
    'south africa': 'ZA', 'nigeria': 'NG', 'kenya': 'KE', 'egypt': 'EG',
    'netherlands': 'NL', 'belgium': 'BE', 'switzerland': 'CH', 'austria': 'AT',
    'sweden': 'SE', 'norway': 'NO', 'denmark': 'DK', 'finland': 'FI',
    'poland': 'PL', 'czech republic': 'CZ', 'portugal': 'PT', 'greece': 'GR',
    'ireland': 'IE', 'new zealand': 'NZ', 'israel': 'IL', 'russia': 'RU',
    'ukraine': 'UA', 'romania': 'RO', 'hungary': 'HU', 'pakistan': 'PK',
    'bangladesh': 'BD', 'sri lanka': 'LK', 'nepal': 'NP', 'panama': 'PA',
    'costa rica': 'CR', 'ecuador': 'EC', 'bolivia': 'BO', 'paraguay': 'PY',
    'uruguay': 'UY', 'venezuela': 'VE', 'guatemala': 'GT', 'honduras': 'HN',
    'dominican republic': 'DO', 'el salvador': 'SV', 'nicaragua': 'NI',
    'cuba': 'CU', 'jamaica': 'JM', 'trinidad and tobago': 'TT', 'puerto rico': 'PR',
    'morocco': 'MA', 'tunisia': 'TN', 'algeria': 'DZ', 'ghana': 'GH',
    'ethiopia': 'ET', 'tanzania': 'TZ', 'uganda': 'UG', 'mozambique': 'MZ',
    'cambodia': 'KH', 'myanmar': 'MM', 'laos': 'LA', 'mongolia': 'MN',
    'jordan': 'JO', 'lebanon': 'LB', 'kuwait': 'KW', 'qatar': 'QA',
    'bahrain': 'BH', 'oman': 'OM', 'iraq': 'IQ', 'iran': 'IR',
    'croatia': 'HR', 'serbia': 'RS', 'bulgaria': 'BG', 'slovakia': 'SK',
    'slovenia': 'SI', 'lithuania': 'LT', 'latvia': 'LV', 'estonia': 'EE',
    'luxembourg': 'LU', 'malta': 'MT', 'cyprus': 'CY', 'iceland': 'IS',
  }
  return map[name.toLowerCase().trim()] || null
}

function parseDateString(dateStr: string): string | null {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    return d.toISOString().split('T')[0]
  } catch {
    return null
  }
}

// ─── Save & Respond Helper ──────────────────────────────────

async function saveAndRespond(supabase: any, supabaseUrl: string, supabaseKey: string, wcaId: number, parsed: any) {
  const partnerRecord = {
    company_name: parsed.company_name,
    city: parsed.city,
    country_code: parsed.country_code,
    country_name: parsed.country,
    email: parsed.email,
    phone: parsed.phone,
    fax: parsed.fax,
    website: parsed.website,
    wca_id: wcaId,
    address: parsed.address,
    profile_description: parsed.profile_description,
    office_type: parsed.office_type,
    member_since: parsed.member_since ? parseDateString(parsed.member_since) : null,
    has_branches: parsed.has_branches,
    branch_cities: parsed.branch_offices.length > 0 ? JSON.stringify(parsed.branch_offices) : '[]',
    is_active: true,
  }

  const { data: existingById } = await supabase
    .from('partners')
    .select('id')
    .eq('wca_id', wcaId)
    .maybeSingle()

  let action = 'skipped'
  let partnerId = existingById?.id

  if (existingById) {
    const { error } = await supabase
      .from('partners')
      .update({ ...partnerRecord, updated_at: new Date().toISOString() })
      .eq('id', existingById.id)
    if (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message, wcaId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    action = 'updated'
  } else {
    const { data: inserted, error } = await supabase
      .from('partners')
      .insert(partnerRecord)
      .select('id')
      .single()
    if (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message, wcaId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    partnerId = inserted.id
    action = 'inserted'
  }

  if (partnerId) {
    await saveCertificationsBatch(supabase, partnerId, parsed.certifications)
    await saveNetworksBatch(supabase, partnerId, parsed.networks)
    await saveContactsBatch(supabase, partnerId, parsed.contacts)
  }

  const fullPartner = {
    ...partnerRecord,
    gold_medallion: parsed.gold_medallion,
    networks: parsed.networks,
    certifications: parsed.certifications,
    contacts: parsed.contacts,
    branch_offices: parsed.branch_offices,
  }

  // Fire-and-forget AI analysis
  const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-partner`
  fetch(analyzeUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ partnerId, profileData: fullPartner }),
  }).catch(err => console.error('AI analysis fire-and-forget error:', err))

  return new Response(
    JSON.stringify({
      success: true,
      found: true,
      wcaId,
      action,
      partnerId,
      partner: fullPartner,
      aiClassification: null,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// ─── Main Handler ────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('FIRECRAWL_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { wcaId } = await req.json()

    if (!wcaId || typeof wcaId !== 'number') {
      return new Response(
        JSON.stringify({ success: false, error: 'wcaId (number) is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = `https://www.wcaworld.com/directory/members/${wcaId}`
    console.log(`Scraping WCA member profile: ${url}`)

    // ── Step 1: Get WCA settings from app_settings ──
    let wcaUsername: string | null = null
    let wcaPassword: string | null = null
    let wcaSessionCookie: string | null = null
    const { data: settingsData } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['wca_username', 'wca_password', 'wca_session_cookie'])
    if (settingsData) {
      for (const s of settingsData) {
        if (s.key === 'wca_username') wcaUsername = s.value
        if (s.key === 'wca_password') wcaPassword = s.value
        if (s.key === 'wca_session_cookie') wcaSessionCookie = s.value
      }
    }

    // ── Step 2: Determine auth method (priority: DB cookie > env cookie > HTTP login > none) ──
    const scrapeBody: any = {
      url,
      formats: ['markdown', 'rawHtml'],
    }

    if (wcaSessionCookie) {
      // Priority 1: Session cookie from Settings page
      scrapeBody.headers = { 'Cookie': wcaSessionCookie }
      console.log('Using WCA session cookie from app_settings for authenticated scraping')
    } else {
      const envCookie = Deno.env.get('WCA_SESSION_COOKIE')
      if (envCookie) {
        // Priority 2: Environment variable
        scrapeBody.headers = { 'Cookie': envCookie }
        console.log('Using WCA session cookie from env for authenticated scraping')
      } else if (wcaUsername && wcaPassword) {
        // Priority 3: HTTP login attempt
        console.log('Attempting HTTP login with WCA credentials')
        try {
          const loginPageRes = await fetch('https://www.wcaworld.com/Account/Login', {
            method: 'GET',
            redirect: 'manual',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          })
          const loginPageHtml = await loginPageRes.text()
          const setCookies1 = loginPageRes.headers.getSetCookie?.() || []
          const tokenMatch = loginPageHtml.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/)
          const token = tokenMatch?.[1] || ''
          const cookieJar: string[] = setCookies1.map(sc => sc.split(';')[0])

          const formBody = new URLSearchParams({
            usr: wcaUsername,
            pwd: wcaPassword,
            __RequestVerificationToken: token,
          })

          const loginRes = await fetch('https://www.wcaworld.com/Account/Login', {
            method: 'POST',
            redirect: 'manual',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Cookie': cookieJar.join('; '),
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Referer': 'https://www.wcaworld.com/Account/Login',
            },
            body: formBody.toString(),
          })

          const setCookies2 = loginRes.headers.getSetCookie?.() || []
          for (const sc of setCookies2) {
            const val = sc.split(';')[0]
            const name = val.split('=')[0]
            const idx = cookieJar.findIndex(c => c.startsWith(name + '='))
            if (idx >= 0) cookieJar[idx] = val
            else cookieJar.push(val)
          }

          scrapeBody.headers = { 'Cookie': cookieJar.join('; ') }
          console.log(`HTTP login status: ${loginRes.status}, cookies: ${cookieJar.length}`)
        } catch (loginErr) {
          console.warn('HTTP login failed, scraping without auth:', loginErr)
        }
      } else {
        console.log('No WCA auth available - scraping without auth')
      }
    }

    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(scrapeBody),
    })

    const scrapeData = await scrapeResponse.json()

    if (!scrapeResponse.ok) {
      console.error(`Firecrawl error for ID ${wcaId}:`, scrapeData)
      return new Response(
        JSON.stringify({ success: false, error: `Firecrawl error: ${scrapeData?.error || scrapeResponse.status}`, wcaId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const markdown = scrapeData?.data?.markdown || scrapeData?.markdown || ''
    const html = scrapeData?.data?.rawHtml || scrapeData?.rawHtml || ''
    console.log(`Got content for ID ${wcaId}: markdown=${markdown.length}c, html=${html.length}c`)

    // ── Step 2: Parse with regex (instant) ──
    const parsed = parseProfileFromContent(html, markdown, wcaId)

    if (!parsed || !parsed.company_name) {
      return new Response(
        JSON.stringify({ success: true, found: false, wcaId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Parsed ID ${wcaId}: ${parsed.company_name} (${parsed.city}, ${parsed.country_code})`)

    return await saveAndRespond(supabase, supabaseUrl, supabaseKey, wcaId, parsed)
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ─── Batch DB Helpers ────────────────────────────────────────

async function saveCertificationsBatch(supabase: any, partnerId: string, certifications: string[]) {
  if (!certifications.length) return
  const validCerts = ['IATA', 'BASC', 'ISO', 'C-TPAT', 'AEO']
  const matched = [...new Set(certifications.filter(c => validCerts.includes(c)))]
  if (!matched.length) return

  // Get existing in one query
  const { data: existing } = await supabase
    .from('partner_certifications')
    .select('certification')
    .eq('partner_id', partnerId)

  const existingSet = new Set((existing || []).map((e: any) => e.certification))
  const toInsert = matched.filter(c => !existingSet.has(c)).map(c => ({ partner_id: partnerId, certification: c }))

  if (toInsert.length > 0) {
    await supabase.from('partner_certifications').insert(toInsert)
  }
}

async function saveNetworksBatch(supabase: any, partnerId: string, networks: { name: string; expires?: string }[]) {
  if (!networks.length) return

  const { data: existing } = await supabase
    .from('partner_networks')
    .select('network_name')
    .eq('partner_id', partnerId)

  const existingSet = new Set((existing || []).map((e: any) => e.network_name))
  const toInsert = networks
    .filter(n => n.name && !existingSet.has(n.name))
    .map(n => ({
      partner_id: partnerId,
      network_name: n.name,
      expires: n.expires ? parseDateString(n.expires) : null,
    }))

  if (toInsert.length > 0) {
    await supabase.from('partner_networks').insert(toInsert)
  }
}

async function saveContactsBatch(supabase: any, partnerId: string, contacts: { title: string; name?: string; email?: string; phone?: string; mobile?: string }[]) {
  if (!contacts.length) return

  const { data: existing } = await supabase
    .from('partner_contacts')
    .select('id, title, name, email, direct_phone, mobile')
    .eq('partner_id', partnerId)

  const existingByTitle = new Map((existing || []).map((e: any) => [e.title, e]))
  
  const toInsert: any[] = []
  const toUpdate: any[] = []
  
  for (const c of contacts) {
    if (!c.title) continue
    const ex = existingByTitle.get(c.title)
    if (ex) {
      // Update existing contact if we have new data (e.g. from authenticated scraping)
      const updates: any = {}
      if (c.name && c.name !== ex.name && ex.name === ex.title) updates.name = c.name
      if (c.email && !ex.email) updates.email = c.email
      if (c.phone && !ex.direct_phone) updates.direct_phone = c.phone
      if (c.mobile && !ex.mobile) updates.mobile = c.mobile
      if (Object.keys(updates).length > 0) {
        toUpdate.push({ id: ex.id, ...updates })
      }
    } else {
      toInsert.push({
        partner_id: partnerId,
        name: c.name || c.title,
        title: c.title,
        email: c.email || null,
        direct_phone: c.phone || null,
        mobile: c.mobile || null,
      })
    }
  }

  if (toInsert.length > 0) {
    await supabase.from('partner_contacts').insert(toInsert)
  }
  for (const u of toUpdate) {
    const { id, ...fields } = u
    await supabase.from('partner_contacts').update(fields).eq('id', id)
  }
}
