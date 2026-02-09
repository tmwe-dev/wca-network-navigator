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

  // Detect 404 / not found / error pages
  if (/page\s*(not|was not)\s*found|member\s*not\s*found|404|no\s*results?\s*found|please\s*try\s*again/i.test(content)) {
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

  const locationBracket = md.match(/\(([^,)]+),\s*(Head\s*Office|Branch)\)/i)
  if (locationBracket) {
    city = locationBracket[1].trim()
    detectedOfficeType = locationBracket[2].trim()
  }

  const topSection = md.substring(0, 2000)
  const countryLineMatch = topSection.match(/^(United States of America|United Kingdom|Canada|Australia|Germany|France|Italy|Spain|China|India|Japan|Brazil|Mexico|Argentina|Colombia|Chile|Peru|South Korea|Thailand|Indonesia|Malaysia|Vietnam|Philippines|Singapore|Hong Kong|Taiwan|Turkey|Saudi Arabia|United Arab Emirates|South Africa|Nigeria|Kenya|Egypt|Netherlands|Belgium|Switzerland|Austria|Sweden|Norway|Denmark|Finland|Poland|Czech Republic|Portugal|Greece|Ireland|New Zealand|Israel|Russia|Ukraine|Romania|Hungary|Pakistan|Bangladesh|Sri Lanka|Nepal|Panama|Costa Rica|Ecuador|Bolivia|Paraguay|Uruguay|Venezuela|Guatemala|Honduras|Dominican Republic|El Salvador|Nicaragua|Cuba|Jamaica|Trinidad and Tobago|Puerto Rico)$/mi)
  if (countryLineMatch) {
    country = countryLineMatch[1].trim()
  }

  if (!city) {
    city = extractField(content, [
      /class="[^"]*city[^"]*"[^>]*>([^<]+)</i,
    ]) || extractField(md, [
      /(?:City)\s*[:：]\s*(.+)/im,
    ])
  }

  const countryCode = countryNameToCode(country) || extractField(content, [
    /\/flags?\/([a-z]{2})\./i,
    /country[_-]?code["']?\s*[:=]\s*["']?([A-Z]{2})/i,
  ])?.toUpperCase() || 'XX'

  // ── Contact Info ──
  // Validate email: reject garbage like "Members only", "[Members only...]", "Login to view"
  function isGarbageEmail(e: string): boolean {
    return /members\s*only|login\s*to\s*view|please\s*login|view\s*information/i.test(e)
  }
  
  function extractFirstValidEmail(raw: string | null): string | null {
    if (!raw) return null
    // Handle semicolon/comma separated emails - take the first valid one
    const candidates = raw.split(/[;,]/).map(s => s.trim()).filter(Boolean)
    for (const c of candidates) {
      const cleaned = c.replace(/[\[\]()]/g, '').trim()
      if (/\S+@\S+\.\S+/.test(cleaned) && !cleaned.includes('wcaworld.com') && !isGarbageEmail(cleaned)) {
        return cleaned
      }
    }
    return null
  }
  
  const rawEmail = extractField(content, [
    /(?:Email|E-mail)\s*[:：]\s*([^\n<>]{5,120})/i,
  ]) || extractField(md, [
    /(?:Email|E-mail)\s*[:：]\s*\[?([^\n]{5,120})/im,
  ])
  const email = extractFirstValidEmail(rawEmail)

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
  
  const emergencyPhone = extractField(content, [
    /(?:Emergency\s*(?:Call|Phone|Contact))\s*[:：]\s*([+\d\s\-().]{7,30})/i,
  ]) || extractField(md, [
    /(?:Emergency\s*(?:Call|Phone|Contact))\s*[:：]\s*([+\d\s\-().]{7,30})/im,
  ])
  
  const mobile = extractField(content, [
    /(?:Mobile|Cell)\s*[:：]\s*([+\d\s\-().]{7,25})/i,
  ]) || extractField(md, [
    /(?:Mobile|Cell)\s*[:：]\s*([+\d\s\-().]{7,25})/im,
  ])

  // ── Website ──
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
  let profileDescription = extractField(md, [
    /Profile:\s*\n+\|[^\n]*\|\s*\n\|\s*[-–]+\s*\|\s*\n\|\s*([\s\S]{20,3000}?)\s*\|/im,
    /Profile:\s*\n+\|[^\n]*\|\s*\n\|\s*([\s\S]{20,3000}?)\s*\|/im,
  ])
  if (!profileDescription) {
    profileDescription = extractField(content, [
      /class="[^"]*(?:profile|description|about|company-?info)[^"]*"[^>]*>([\s\S]{20,2000}?)<\//i,
    ])
  }
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

  const officeType = detectedOfficeType?.toLowerCase()?.includes('branch') ? 'branch' : 'head_office'
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
  const contacts: { title: string; name?: string; email?: string; phone?: string; mobile?: string }[] = []

  function extractMultiLineField(block: string, fieldName: string): string | null {
    const sameLineRegex = new RegExp(fieldName + '\\s*:\\s*(.+)', 'i')
    const sameLineMatch = block.match(sameLineRegex)
    if (sameLineMatch && sameLineMatch[1].trim().length > 0) {
      return sameLineMatch[1].trim()
    }
    const multiLineRegex = new RegExp(fieldName + '\\s*:\\s*\\n+\\s*(.+)', 'i')
    const multiLineMatch = block.match(multiLineRegex)
    if (multiLineMatch && multiLineMatch[1].trim().length > 0) {
      return multiLineMatch[1].trim()
    }
    return null
  }
  
  // Strategy 1: Split by "Name:" to handle WCA inline format (Name:X Title:Y Email:Z all on one line)
  const nameBasedBlocks = content.split(/(?=Name\s*:)/i).slice(1)
  
  if (nameBasedBlocks.length > 0) {
    for (const block of nameBasedBlocks) {
      // Extract name (between "Name:" and "Title:" or end)
      const nameMatch = block.match(/Name\s*:\s*(?:\*\*)?([^*\n]+?)(?:\*\*)?(?=\s*Title\s*:|$)/i)
      const titleMatch = block.match(/Title\s*:\s*(?:\*\*)?([^*\n]+?)(?:\*\*)?(?=\s*(?:Direct|Email|Mobile|Name\s*:|$))/i)
      const emailMatch = block.match(/Email\s*:\s*(?:\[)?([^\s\]\n]+@[^\s\]\n;,]+)/i)
      const phoneMatch = block.match(/(?:Direct\s*(?:Line|Phone)?|Phone|Tel)\s*:\s*([+\d\s\-().]{7,30})/i)
      const mobileMatch = block.match(/Mobile\s*:\s*([+\d\s\-().]{7,30})/i)
      
      const name = nameMatch?.[1]?.replace(/\*+/g, '').trim()
      const title = titleMatch?.[1]?.replace(/\*+/g, '').trim()
      
      if (!name && !title) continue
      if (name && /Members\s*only|Login|not\s*found/i.test(name)) continue
      if (title && /Members\s*only|Login|not\s*found/i.test(title)) continue
      
      const contact: { title: string; name?: string; email?: string; phone?: string; mobile?: string } = {
        title: title || name || 'Unknown',
      }
      if (name && name !== title) contact.name = name
      
      const contactEmail = emailMatch?.[1]?.replace(/\*+/g, '').trim()
      if (contactEmail && /\S+@\S+\.\S+/.test(contactEmail) && !isGarbageEmail(contactEmail) && !/wcaworld/i.test(contactEmail)) {
        contact.email = contactEmail
      }
      
      const contactPhone = phoneMatch?.[1]?.trim()
      if (contactPhone && /[+\d]/.test(contactPhone) && !/Members\s*only|Login/i.test(contactPhone)) {
        contact.phone = contactPhone
      }
      
      const contactMobile = mobileMatch?.[1]?.trim()
      if (contactMobile && /[+\d]/.test(contactMobile) && !/Members\s*only|Login/i.test(contactMobile)) {
        contact.mobile = contactMobile
      }
      
      contacts.push(contact)
    }
  }
  
  // Strategy 2: Fallback - split by "Title:" for older format (markdown with Title: on its own line)
  if (contacts.length === 0) {
    const titleBlocks = md.split(/^Title:\s*$/mi)
    const blocks = titleBlocks.length > 1 ? titleBlocks.slice(1) : md.split(/Title:\s*/i).slice(1)
    
    for (const block of blocks) {
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
      if (/Members\s*only|please\s*\*?\*?Login\*?\*?|Login\s*to\s*view/i.test(titleLine)) continue
      
      const contact: { title: string; name?: string; email?: string; phone?: string; mobile?: string } = { title: titleLine }
      
      const rawName = extractMultiLineField(block, 'Name')
      if (rawName) {
        const name = rawName.replace(/\*+/g, '').trim()
        if (name && !/Members\s*only|Login/i.test(name)) contact.name = name
      }
      
      const rawContactEmail = extractMultiLineField(block, 'Email')
      if (rawContactEmail) {
        const linkMatch = rawContactEmail.match(/\[([^\]]+@[^\]]+)\]/)
        const contactEmail = linkMatch ? linkMatch[1].trim() : rawContactEmail.replace(/\*+/g, '').trim()
        if (contactEmail && /\S+@\S+\.\S+/.test(contactEmail) && !isGarbageEmail(contactEmail) && !/wcaworld/i.test(contactEmail)) {
          contact.email = contactEmail
        }
      }
      
      const rawPhone = extractMultiLineField(block, '(?:Direct\\s*(?:Line|Phone)|Phone|Tel)')
      if (rawPhone) {
        const contactPhone = rawPhone.replace(/\[.*?\]\(.*?\)/g, '').replace(/\*+/g, '').trim()
        if (contactPhone && /[+\d]/.test(contactPhone) && !/Members\s*only|Login/i.test(contactPhone)) contact.phone = contactPhone
      }
      
      const rawMobile = extractMultiLineField(block, 'Mobile')
      if (rawMobile) {
        const mbl = rawMobile.replace(/\[.*?\]\(.*?\)/g, '').replace(/\*+/g, '').trim()
        if (mbl && /[+\d]/.test(mbl) && !/Members\s*only|Login/i.test(mbl)) contact.mobile = mbl
      }
      
      contacts.push(contact)
    }
  }
  
  // Strategy 3: HTML fallback
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
  const branchRegex = /href="[^"]*\/[Dd]irectory\/[Mm]embers\/(\d+)"[^>]*>[^<]*?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)[^<]*Branch/gi
  let bm
  while ((bm = branchRegex.exec(content)) !== null) {
    const branchId = parseInt(bm[1])
    if (branchId !== wcaId) {
      branchOffices.push({ city: bm[2].trim(), wca_id: branchId })
    }
  }
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
    mobile: mobile || null,
    emergency_phone: emergencyPhone || null,
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

function countryCodeToName(code: string): string {
  const map: Record<string, string> = {
    'US': 'United States of America', 'GB': 'United Kingdom', 'CA': 'Canada',
    'AU': 'Australia', 'DE': 'Germany', 'FR': 'France', 'IT': 'Italy',
    'ES': 'Spain', 'CN': 'China', 'IN': 'India', 'JP': 'Japan', 'BR': 'Brazil',
    'MX': 'Mexico', 'AR': 'Argentina', 'CO': 'Colombia', 'CL': 'Chile',
    'PE': 'Peru', 'KR': 'South Korea', 'TH': 'Thailand', 'ID': 'Indonesia',
    'MY': 'Malaysia', 'VN': 'Vietnam', 'PH': 'Philippines', 'SG': 'Singapore',
    'HK': 'Hong Kong', 'TW': 'Taiwan', 'TR': 'Turkey', 'SA': 'Saudi Arabia',
    'AE': 'United Arab Emirates', 'ZA': 'South Africa', 'NG': 'Nigeria',
    'KE': 'Kenya', 'EG': 'Egypt', 'NL': 'Netherlands', 'BE': 'Belgium',
    'CH': 'Switzerland', 'AT': 'Austria', 'SE': 'Sweden', 'NO': 'Norway',
    'DK': 'Denmark', 'FI': 'Finland', 'PL': 'Poland', 'CZ': 'Czech Republic',
    'PT': 'Portugal', 'GR': 'Greece', 'IE': 'Ireland', 'NZ': 'New Zealand',
    'IL': 'Israel', 'RU': 'Russia', 'UA': 'Ukraine', 'RO': 'Romania',
    'HU': 'Hungary', 'PK': 'Pakistan', 'BD': 'Bangladesh', 'LK': 'Sri Lanka',
    'NP': 'Nepal', 'PA': 'Panama', 'CR': 'Costa Rica', 'EC': 'Ecuador',
    'BO': 'Bolivia', 'PY': 'Paraguay', 'UY': 'Uruguay', 'VE': 'Venezuela',
    'GT': 'Guatemala', 'HN': 'Honduras', 'DO': 'Dominican Republic',
    'SV': 'El Salvador', 'NI': 'Nicaragua', 'CU': 'Cuba', 'JM': 'Jamaica',
    'TT': 'Trinidad and Tobago', 'PR': 'Puerto Rico', 'MA': 'Morocco',
    'TN': 'Tunisia', 'DZ': 'Algeria', 'GH': 'Ghana', 'ET': 'Ethiopia',
    'TZ': 'Tanzania', 'UG': 'Uganda', 'MZ': 'Mozambique', 'KH': 'Cambodia',
    'MM': 'Myanmar', 'LA': 'Laos', 'MN': 'Mongolia', 'JO': 'Jordan',
    'LB': 'Lebanon', 'KW': 'Kuwait', 'QA': 'Qatar', 'BH': 'Bahrain',
    'OM': 'Oman', 'IQ': 'Iraq', 'IR': 'Iran', 'HR': 'Croatia', 'RS': 'Serbia',
    'BG': 'Bulgaria', 'SK': 'Slovakia', 'SI': 'Slovenia', 'LT': 'Lithuania',
    'LV': 'Latvia', 'EE': 'Estonia', 'LU': 'Luxembourg', 'MT': 'Malta',
    'CY': 'Cyprus', 'IS': 'Iceland', 'AF': 'Afghanistan', 'AL': 'Albania',
    'AM': 'Armenia', 'AZ': 'Azerbaijan', 'AW': 'Aruba', 'GM': 'Gambia',
  }
  return map[code.toUpperCase()] || ''
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

// ─── Direct HTTP Login & Fetch (bypasses Firecrawl) ─────────

async function directWcaLogin(username: string, password: string): Promise<{ cookies: string; success: boolean; error?: string }> {
  try {
    console.log('Direct login: fetching login page...')
    const loginPageRes = await fetch('https://www.wcaworld.com/Account/Login', {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
    })
    const loginPageHtml = await loginPageRes.text()
    const setCookies1 = loginPageRes.headers.getSetCookie?.() || []
    const tokenMatch = loginPageHtml.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/)
    const token = tokenMatch?.[1] || ''
    
    if (!token) {
      console.warn('Direct login: no CSRF token found')
      return { cookies: '', success: false, error: 'No CSRF token found on login page' }
    }
    
    const cookieJar: string[] = setCookies1.map(sc => sc.split(';')[0])
    console.log(`Direct login: got ${cookieJar.length} initial cookies, token=${token.substring(0, 20)}...`)

    const formBody = new URLSearchParams({
      usr: username,
      pwd: password,
      __RequestVerificationToken: token,
    })

    const loginRes = await fetch('https://www.wcaworld.com/Account/Login', {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieJar.join('; '),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.wcaworld.com/Account/Login',
        'Origin': 'https://www.wcaworld.com',
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

    const hasAuthCookie = cookieJar.some(c => c.startsWith('.ASPXAUTH=') || c.startsWith('ASP.NET_SessionId='))
    const isRedirect = loginRes.status >= 300 && loginRes.status < 400
    const allCookies = cookieJar.join('; ')
    
    console.log(`Direct login: status=${loginRes.status}, redirect=${isRedirect}, authCookie=${hasAuthCookie}, totalCookies=${cookieJar.length}`)
    
    if (hasAuthCookie || isRedirect) {
      return { cookies: allCookies, success: true }
    }
    
    return { cookies: allCookies, success: false, error: `Login returned status ${loginRes.status}, no auth cookie found` }
  } catch (err) {
    console.error('Direct login error:', err)
    return { cookies: '', success: false, error: err instanceof Error ? err.message : 'Login failed' }
  }
}

async function directFetchPage(url: string, cookies: string): Promise<{ html: string; membersOnly: boolean }> {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Cookie': cookies,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  const html = await res.text()
  
  // Count "Members only" occurrences in contact sections
  const membersOnlyCount = (html.match(/Members\s*only/gi) || []).length
  const hasLoginPrompt = /please\s*Login|Login\s*to\s*view/i.test(html)
  
  console.log(`Direct fetch: status=${res.status}, size=${html.length}c, membersOnly=${membersOnlyCount}x, loginPrompt=${hasLoginPrompt}`)
  
  return { html, membersOnly: membersOnlyCount > 2 || hasLoginPrompt }
}

// Simple HTML-to-markdown converter for profile pages
function htmlToSimpleMarkdown(html: string): string {
  let md = html
  // Remove scripts and styles
  md = md.replace(/<script[\s\S]*?<\/script>/gi, '')
  md = md.replace(/<style[\s\S]*?<\/style>/gi, '')
  // Convert headings
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n')
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n')
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n')
  // Convert links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
  // Convert line breaks
  md = md.replace(/<br\s*\/?>/gi, '\n')
  // Convert paragraphs
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
  // Convert divs to newlines
  md = md.replace(/<\/div>/gi, '\n')
  // Convert strong/bold
  md = md.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**')
  // Strip remaining tags
  md = md.replace(/<[^>]+>/g, '')
  // Decode entities
  md = decodeEntities(md)
  // Clean up whitespace
  md = md.replace(/\n{3,}/g, '\n\n').trim()
  return md
}

// ─── Save & Respond Helper ──────────────────────────────────

async function saveAndRespond(supabase: any, supabaseUrl: string, supabaseKey: string, wcaId: number, parsed: any, callerCountryCode?: string) {
  // Use caller-provided country code if the parsed one is unknown
  let finalCountryCode = parsed.country_code
  if (finalCountryCode === 'XX' && callerCountryCode && callerCountryCode !== 'XX') {
    finalCountryCode = callerCountryCode.toUpperCase()
    console.log(`Country code override: XX -> ${finalCountryCode} (from caller)`)
  }

  const partnerRecord = {
    company_name: parsed.company_name,
    city: parsed.city,
    country_code: finalCountryCode,
    country_name: parsed.country || countryCodeToName(finalCountryCode),
    email: parsed.email,
    phone: parsed.phone,
    fax: parsed.fax,
    mobile: parsed.mobile,
    emergency_phone: parsed.emergency_phone,
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const body = await req.json()
    const { wcaId, preview, countryCode: callerCountryCode } = body

    if (!wcaId || typeof wcaId !== 'number') {
      return new Response(
        JSON.stringify({ success: false, error: 'wcaId (number) is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = `https://www.wcaworld.com/directory/members/${wcaId}`
    console.log(`Scraping WCA member profile: ${url}`)

    // ── Step 1: Get WCA session cookie from app_settings ──
    let wcaSessionCookie: string | null = null
    const { data: settingsData } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['wca_session_cookie', 'wca_auth_cookie'])
    if (settingsData) {
      for (const s of settingsData) {
        // Prefer wca_auth_cookie (contains .ASPXAUTH), fallback to wca_session_cookie
        if (s.key === 'wca_auth_cookie' && s.value) wcaSessionCookie = s.value
        if (s.key === 'wca_session_cookie' && s.value && !wcaSessionCookie) wcaSessionCookie = s.value
      }
    }
    // Also check env variable
    if (!wcaSessionCookie) {
      wcaSessionCookie = Deno.env.get('WCA_SESSION_COOKIE') || null
    }

    // ── Step 2: Direct fetch (primary) or Firecrawl (fallback) ──
    let html = ''
    let markdown = ''
    let authStatus: 'authenticated' | 'members_only' | 'no_credentials' | 'login_failed' = 'no_credentials'
    let loginDetails = ''

    // Try 1: Direct fetch with session cookie (bypasses Firecrawl completely)
    if (wcaSessionCookie) {
      console.log('Direct fetch with session cookie...')
      const result = await directFetchPage(url, wcaSessionCookie)
      html = result.html
      
      if (!result.membersOnly) {
        authStatus = 'authenticated'
        loginDetails = 'Direct fetch with session cookie - contacts visible'
        console.log('AUTH OK: session cookie valid, contacts accessible')
      } else {
        authStatus = 'members_only'
        loginDetails = 'Cookie present but contacts blocked. Update cookie in Settings (copy from browser after login).'
        console.log('AUTH PARTIAL: cookie present but Members only detected - cookie expired or incomplete')
      }
    }

    // Try 3: Firecrawl fallback (unauthenticated)
    if (!html) {
      const apiKey = Deno.env.get('FIRECRAWL_API_KEY')
      if (apiKey) {
        console.log('Falling back to Firecrawl (unauthenticated)...')
        try {
          const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url, formats: ['markdown', 'rawHtml'] }),
          })
          const scrapeData = await scrapeResponse.json()
          if (scrapeResponse.ok) {
            markdown = scrapeData?.data?.markdown || scrapeData?.markdown || ''
            html = scrapeData?.data?.rawHtml || scrapeData?.rawHtml || ''
            if (authStatus === 'no_credentials') {
              loginDetails = 'Firecrawl fallback (no credentials configured)'
            }
            console.log(`Firecrawl fallback: got ${html.length}c HTML, ${markdown.length}c MD`)
          }
        } catch (fcErr) {
          console.error('Firecrawl fallback failed:', fcErr)
        }
      }
      
      if (!html && !markdown) {
        return new Response(
          JSON.stringify({ success: false, error: 'No auth credentials and Firecrawl unavailable', wcaId, authStatus }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Generate markdown from HTML if we used direct fetch
    if (html && !markdown) {
      markdown = htmlToSimpleMarkdown(html)
    }

    console.log(`Content for ID ${wcaId}: html=${html.length}c, markdown=${markdown.length}c`)

    // ── Step 3: Parse ──
    const parsed = parseProfileFromContent(html, markdown, wcaId)

    if (!parsed || !parsed.company_name) {
      const response: any = { success: true, found: false, wcaId, authStatus }
      if (preview) {
        response.authDetails = loginDetails
        response.htmlSnippet = html.substring(0, 3000)
        response.contactsFound = 0
      }
      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Parsed ID ${wcaId}: ${parsed.company_name} (${parsed.city}, ${parsed.country_code}) — ${parsed.contacts.length} contacts`)

    // ── Preview mode: return data without saving ──
    if (preview) {
      const contactsWithData = parsed.contacts.filter((c: any) => c.email || c.phone || c.mobile)
      return new Response(
        JSON.stringify({
          success: true,
          found: true,
          wcaId,
          authStatus,
          authDetails: loginDetails,
          partner: {
            company_name: parsed.company_name,
            city: parsed.city,
            country: parsed.country,
            country_code: parsed.country_code,
            office_type: parsed.office_type,
            email: parsed.email,
            phone: parsed.phone,
            website: parsed.website,
            networks: parsed.networks,
            contacts: parsed.contacts,
          },
          contactsFound: contactsWithData.length,
          totalContacts: parsed.contacts.length,
          htmlSnippet: html.substring(0, 5000),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return await saveAndRespond(supabase, supabaseUrl, supabaseKey, wcaId, parsed, callerCountryCode)
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
