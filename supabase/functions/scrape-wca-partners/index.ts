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
  const countryLineMatch = topSection.match(/^(United States of America|United Kingdom|Canada|Australia|Germany|France|Italy|Spain|China|India|Japan|Brazil|Mexico|Argentina|Colombia|Chile|Peru|South Korea|Thailand|Indonesia|Malaysia|Vietnam|Philippines|Singapore|Hong Kong|Taiwan|Turkey|Saudi Arabia|United Arab Emirates|South Africa|Nigeria|Kenya|Egypt|Netherlands|Belgium|Switzerland|Austria|Sweden|Norway|Denmark|Finland|Poland|Czech Republic|Portugal|Greece|Ireland|New Zealand|Israel|Russia|Ukraine|Romania|Hungary|Pakistan|Bangladesh|Sri Lanka|Nepal|Panama|Costa Rica|Ecuador|Bolivia|Paraguay|Uruguay|Venezuela|Guatemala|Honduras|Dominican Republic|El Salvador|Nicaragua|Cuba|Jamaica|Trinidad and Tobago|Puerto Rico|Albania|Kosovo|Bosnia and Herzegovina|North Macedonia|Montenegro|Georgia|Uzbekistan|Kazakhstan|Kyrgyzstan|Tajikistan|Turkmenistan|Belarus|Moldova|Senegal|Ivory Coast|Cameroon|Congo|Madagascar|Namibia|Botswana|Zimbabwe|Zambia|Malawi|Rwanda|Burundi|Libya|Sudan|Somalia|Djibouti|Mauritius|Maldives|Brunei|Fiji|Papua New Guinea|Bahamas|Barbados|Belize|Guyana|Suriname|Haiti|Bermuda|Cayman Islands|Curacao|Reunion)$/mi)
  if (countryLineMatch) {
    country = countryLineMatch[1].trim()
  }
  
  // Also try to extract country from address line (e.g., "2001, Durres, Albania")
  if (!country) {
    const addressCountryMatch = content.match(/,\s*(Albania|Kosovo|Montenegro|North Macedonia|Bosnia and Herzegovina|Serbia|Croatia|Slovenia|Georgia|Armenia|Azerbaijan|Belarus|Moldova|Kazakhstan|Uzbekistan|Kyrgyzstan|Tajikistan|Turkmenistan|Afghanistan|Myanmar|Laos|Cambodia|Mongolia|Brunei|Fiji|Papua New Guinea|Bahamas|Barbados|Belize|Guyana|Suriname|Haiti|Bermuda|Djibouti|Somalia|Sudan|Libya|Rwanda|Burundi|Malawi|Zambia|Zimbabwe|Botswana|Namibia|Madagascar|Cameroon|Senegal|Ivory Coast|Mauritius|Maldives|United States of America|United Kingdom|Canada|Australia|Germany|France|Italy|Spain|China|India|Japan|Brazil|Mexico|Argentina|Colombia|Chile|Peru|South Korea|Thailand|Indonesia|Malaysia|Vietnam|Philippines|Singapore|Hong Kong|Taiwan|Turkey|Saudi Arabia|United Arab Emirates|South Africa|Nigeria|Kenya|Egypt|Netherlands|Belgium|Switzerland|Austria|Sweden|Norway|Denmark|Finland|Poland|Czech Republic|Portugal|Greece|Ireland|New Zealand|Israel|Russia|Ukraine|Romania|Hungary|Pakistan|Bangladesh|Sri Lanka|Nepal|Panama|Costa Rica|Ecuador|Bolivia|Paraguay|Uruguay|Venezuela|Guatemala|Honduras|Dominican Republic|El Salvador|Nicaragua|Cuba|Jamaica|Trinidad and Tobago|Puerto Rico|Morocco|Tunisia|Algeria|Ghana|Ethiopia|Tanzania|Uganda|Mozambique|Jordan|Lebanon|Kuwait|Qatar|Bahrain|Oman|Iraq|Iran|Luxembourg|Malta|Cyprus|Iceland)\s*(?:<|$)/i)
    if (addressCountryMatch) {
      country = addressCountryMatch[1].trim()
    }
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
  let profileDescription = extractField(content, [
    /class="profile_table"[\s\S]*?<td[^>]*>([\s\S]{20,3000}?)<\/td>/i,
    /class="[^"]*(?:profile|description|about|company-?info)[^"]*"[^>]*>([\s\S]{20,2000}?)<\//i,
  ])
  if (!profileDescription) {
    profileDescription = extractField(md, [
      /Profile:\s*\n+\|[^\n]*\|\s*\n\|\s*[-–]+\s*\|\s*\n\|\s*([\s\S]{20,3000}?)\s*\|/im,
      /Profile:\s*\n+\|[^\n]*\|\s*\n\|\s*([\s\S]{20,3000}?)\s*\|/im,
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
  // IMPORTANT: Only search within the "Member(s) of" section, NOT the full page
  // The footer contains ALL network names as links, causing false positives
  const networks: { name: string; expires?: string }[] = []
  const memberofMatch = content.match(/memberprofile_memberof[\s\S]*?(?=<div class="clear"|<\/div>\s*<\/div>\s*<\/div>\s*<div class="clear")/)
  const memberofSection = memberofMatch ? memberofMatch[0] : ''
  
  // Also extract from memberof_entry links — the domain tells us the network
  const networkDomainMap: Record<string, string> = {
    'wcafirst': 'WCA First',
    'wcaadvancedprofessionals': 'WCA Advanced Professionals',
    'wcachinaglobal': 'WCA China Global',
    'wcainterglobal': 'WCA Inter Global',
    'wcaprojects': 'WCA Projects',
    'wcadangerousgoods': 'WCA Dangerous Goods',
    'wcaperishables': 'WCA Perishables',
    'wcatimecritical': 'WCA Time Critical',
    'wcapharma': 'WCA Pharma',
    'wcaecommerce': 'WCA eCommerce',
  }
  
  // Strategy A: Parse memberof_entry links from HTML
  const entryLinkRegex = /href="https?:\/\/(?:www\.)?(\w+)\.com\/directory\/members/gi
  let linkMatch
  while ((linkMatch = entryLinkRegex.exec(memberofSection)) !== null) {
    const domain = linkMatch[1].toLowerCase()
    const netName = networkDomainMap[domain]
    if (netName && !networks.find(n => n.name === netName)) {
      // Extract expiry from the same memberof_entry block
      const entryStart = memberofSection.lastIndexOf('memberof_entry', linkMatch.index)
      const entryBlock = memberofSection.substring(entryStart, linkMatch.index + 500)
      const expiryMatch = entryBlock.match(/Expires?:?\s*(\w+\s+\d{1,2},?\s*\d{4})/i)
      networks.push({ name: netName, expires: expiryMatch?.[1] || undefined })
    }
  }
  
  // Strategy B: Fallback — check markdown "Member(s) of" section only
  if (networks.length === 0) {
    const mdMemberSection = md.match(/Member\(s\)\s*of[\s\S]*?(?=Profile:|Contact|$)/i)
    const mdSection = mdMemberSection ? mdMemberSection[0] : ''
    const wcaNetworks = ['WCA Inter Global', 'WCA China Global', 'WCA First', 'WCA Advanced Professionals', 'WCA Projects', 'WCA Dangerous Goods', 'WCA Perishables', 'WCA Time Critical', 'WCA Pharma', 'WCA eCommerce']
    for (const net of wcaNetworks) {
      if (mdSection.includes(net)) {
        const expiryRegex = new RegExp(net.replace(/\s+/g, '\\s+') + '[^\\n]*?(?:Expires?\\s*[:：]?\\s*|[-–]\\s*)(\\w+\\s+\\d{1,2},?\\s*\\d{4})', 'i')
        const expiryMatch = mdSection.match(expiryRegex)
        networks.push({ name: net, expires: expiryMatch?.[1] || undefined })
      }
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
  
  // Strategy 0: WCA structured HTML (profile_label/profile_val divs)
  const contactPersonBlocks = content.split(/contactperson_row/).slice(1)
  
  if (contactPersonBlocks.length > 0) {
    console.log(`[parseProfile] Strategy 0: Found ${contactPersonBlocks.length} contactperson_row blocks in HTML`)
    
    for (const block of contactPersonBlocks) {
      const getProfileVal = (label: string): string | null => {
        const regex = new RegExp(
          'profile_label">[^<]*' + label + '[^<]*</div>[\\s\\S]*?profile_val">[\\s\\S]*?(?:<a[^>]*>)?([^<]+)',
          'i'
        )
        const m = block.match(regex)
        return m?.[1]?.trim() || null
      }

      const name = getProfileVal('Name')
      const title = getProfileVal('Title')
      const email = getProfileVal('Email')
      const directLine = getProfileVal('Direct Line')
      const mobile = getProfileVal('Mobile')

      if (!name && !title) continue
      if (name && /Members\s*only|Login/i.test(name)) continue

      const contact: { title: string; name?: string; email?: string; phone?: string; mobile?: string } = {
        title: title || name || 'Unknown',
      }
      if (name && name !== title) contact.name = name
      if (email && /\S+@\S+\.\S+/.test(email) && !isGarbageEmail(email) && !/wcaworld/i.test(email)) {
        contact.email = email
      }
      if (directLine && !/Members\s*only|Login/i.test(directLine) && /[+\d]/.test(directLine)) {
        contact.phone = directLine
      }
      if (mobile && !/Members\s*only|Login/i.test(mobile) && /[+\d]/.test(mobile)) {
        contact.mobile = mobile
      }

      contacts.push(contact)
    }
    
    if (contacts.length > 0) {
      console.log(`[parseProfile] Strategy 0 extracted ${contacts.length} contacts from HTML structure`)
    }
  }

  // Strategy 1: Split by "Name:" to handle WCA inline format (Name:X Title:Y Email:Z all on one line)
  if (contacts.length === 0) {
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
    _rawHtml: html,
    _rawMarkdown: md,
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
    'albania': 'AL', 'kosovo': 'XK', 'bosnia and herzegovina': 'BA', 'north macedonia': 'MK',
    'montenegro': 'ME', 'georgia': 'GE', 'uzbekistan': 'UZ', 'kazakhstan': 'KZ',
    'kyrgyzstan': 'KG', 'tajikistan': 'TJ', 'turkmenistan': 'TM', 'belarus': 'BY',
    'moldova': 'MD', 'senegal': 'SN', 'ivory coast': 'CI', 'cameroon': 'CM',
    'congo': 'CG', 'madagascar': 'MG', 'namibia': 'NA', 'botswana': 'BW',
    'zimbabwe': 'ZW', 'zambia': 'ZM', 'malawi': 'MW', 'rwanda': 'RW',
    'burundi': 'BI', 'libya': 'LY', 'sudan': 'SD', 'somalia': 'SO',
    'djibouti': 'DJ', 'mauritius': 'MU', 'maldives': 'MV', 'brunei': 'BN',
    'fiji': 'FJ', 'papua new guinea': 'PG', 'bahamas': 'BS', 'barbados': 'BB',
    'belize': 'BZ', 'guyana': 'GY', 'suriname': 'SR', 'haiti': 'HT',
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
    'XK': 'Kosovo', 'BA': 'Bosnia and Herzegovina', 'MK': 'North Macedonia',
    'ME': 'Montenegro', 'GE': 'Georgia', 'BY': 'Belarus', 'MD': 'Moldova',
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

// ─── Direct HTTP Fetch (bypasses Firecrawl) ─────────

async function directFetchPage(url: string, cookies: string): Promise<{ html: string; membersOnly: boolean; loginPrompt: boolean; contactsAuthenticated: boolean }> {
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
  
  const membersOnlyCount = (html.match(/Members\s*only/gi) || []).length
  const hasLoginPrompt = /please\s*Login|Login\s*to\s*view/i.test(html)
  
  // Deep check: are private contact names visible?
  const contactBlocks = html.split(/contactperson_row/).slice(1)
  let contactsWithRealName = 0
  for (const block of contactBlocks) {
    const nameMatch = block.match(/profile_label">[^<]*Name[^<]*<\/div>[\s\S]*?profile_val">\s*([^<]+)/i)
    const name = nameMatch?.[1]?.trim()
    if (name && !/Members\s*only|Login/i.test(name) && name.length > 2) {
      contactsWithRealName++
    }
  }
  
  let contactsWithEmail = 0
  for (const block of contactBlocks) {
    const emailMatch = block.match(/profile_label">[^<]*Email[^<]*<\/div>[\s\S]*?profile_val">[\s\S]*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
    if (emailMatch) contactsWithEmail++
  }
  const contactsAuthenticated = contactBlocks.length > 0 && (contactsWithRealName > 0 || contactsWithEmail > 0)
  
  console.log(`Direct fetch: status=${res.status}, size=${html.length}c, membersOnly=${membersOnlyCount}x, loginPrompt=${hasLoginPrompt}, contactBlocks=${contactBlocks.length}, realNames=${contactsWithRealName}, contactsAuth=${contactsAuthenticated}`)
  
  return { html, membersOnly: membersOnlyCount > 2 || hasLoginPrompt, loginPrompt: hasLoginPrompt, contactsAuthenticated }
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

async function saveAndRespond(supabase: any, supabaseUrl: string, supabaseKey: string, wcaId: number, parsed: any, callerCountryCode?: string, aiParse?: boolean) {
  // Use caller-provided country code if the parsed one is unknown
  let finalCountryCode = parsed.country_code
  if (finalCountryCode === 'XX' && callerCountryCode && callerCountryCode !== 'XX') {
    finalCountryCode = callerCountryCode.toUpperCase()
    console.log(`Country code override: XX -> ${finalCountryCode} (from caller)`)
  }

  const partnerRecord: Record<string, any> = {
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

  // Save raw HTML and markdown for later AI re-parsing
  if (parsed._rawHtml) partnerRecord.raw_profile_html = parsed._rawHtml
  if (parsed._rawMarkdown) partnerRecord.raw_profile_markdown = parsed._rawMarkdown

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

  // Fire-and-forget AI analysis (classify partner type, rating, etc.)
  const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-partner`
  fetch(analyzeUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ partnerId, profileData: fullPartner }),
  }).catch(err => console.error('AI analysis fire-and-forget error:', err))

  // Fire-and-forget AI parse (extract contacts with AI from raw HTML/markdown)
  if (aiParse && partnerId) {
    const parseUrl = `${supabaseUrl}/functions/v1/parse-profile-ai`
    fetch(parseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ partnerId, forceReparse: true }),
    }).catch(err => console.error('AI parse fire-and-forget error:', err))
  }

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
    // ── Auth check ──
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(authHeader.replace('Bearer ', ''))
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const body = await req.json()
    const { wcaId, preview, countryCode: callerCountryCode, aiParse } = body

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
      
      if (result.contactsAuthenticated) {
        authStatus = 'authenticated'
        loginDetails = 'Direct fetch with session cookie - private contacts visible'
        console.log('AUTH OK: session cookie valid, private contacts accessible')
      } else if (!result.membersOnly && !result.loginPrompt) {
        // Page loaded fine, no "Members only" or login prompts — cookie works,
        // this member just has no contacts or no contact rows
        authStatus = 'authenticated'
        loginDetails = 'Direct fetch with session cookie - page accessible (no contact rows on this profile)'
        console.log('AUTH OK: no login prompt, no members-only — treating as authenticated (member may have no contacts)')
      } else {
        authStatus = 'members_only'
        loginDetails = 'Session cookie present but private contact names NOT visible (Members only)'
        console.log(`AUTH FAILED: cookie doesn't grant access to private contacts. Members only detected.`)
      }
    }

    // Try 2: Firecrawl fallback (unauthenticated)
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

    return await saveAndRespond(supabase, supabaseUrl, supabaseKey, wcaId, parsed, callerCountryCode, aiParse)
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

  // --- bestEmail: pick email whose prefix matches person's surname/initial ---
  const pickBestEmail = (personName: string, emails: string[]): string | null => {
    const valid = emails.filter(e => e && /\S+@\S+\.\S+/.test(e))
    if (valid.length === 0) return null
    if (valid.length === 1) return valid[0]
    const parts = personName.replace(/^(Mr\.?|Ms\.?|Mrs\.?|Dr\.?)\s*/i, '').trim().split(/\s+/)
    const surname = (parts[parts.length - 1] || '').toLowerCase()
    const initial = (parts[0] || '').charAt(0).toLowerCase()
    let best = valid[0], bestScore = 0
    for (const e of valid) {
      const prefix = e.split('@')[0].toLowerCase()
      let score = 0
      if (surname && prefix.includes(surname)) score += 2
      if (initial && prefix.includes(initial)) score += 1
      if (score > bestScore) { bestScore = score; best = e }
    }
    return best
  }

  // --- Step 1: Deduplicate incoming by email ---
  const dedupByEmail: (typeof contacts[0] & { _emails: string[] })[] = []
  const seenEmails = new Map<string, number>()
  for (const c of contacts) {
    if (!c.title && !c.name) continue
    const emailKey = c.email?.trim().toLowerCase()
    if (emailKey && seenEmails.has(emailKey)) {
      const idx = seenEmails.get(emailKey)!
      const existing = dedupByEmail[idx]
      if (c.name && !existing.name) existing.name = c.name
      if (c.phone && !existing.phone) existing.phone = c.phone
      if (c.mobile && !existing.mobile) existing.mobile = c.mobile
      if (c.title && c.title !== existing.title) existing.title = `${existing.title} / ${c.title}`
    } else {
      if (emailKey) seenEmails.set(emailKey, dedupByEmail.length)
      dedupByEmail.push({ ...c, _emails: c.email ? [c.email] : [] })
    }
  }

  // --- Step 2: Deduplicate by NAME (merge same person with different emails) ---
  const deduped: (typeof dedupByEmail[0])[] = []
  const seenNames = new Map<string, number>()
  for (const c of dedupByEmail) {
    const nameKey = (c.name || c.title || '').trim().toLowerCase()
    if (!nameKey) { deduped.push(c); continue }
    if (seenNames.has(nameKey)) {
      const idx = seenNames.get(nameKey)!
      const ex = deduped[idx]
      if (c.title && c.title !== ex.title && !ex.title.includes(c.title)) ex.title = `${ex.title} / ${c.title}`
      if (c.email) ex._emails.push(c.email)
      if (c.phone && !ex.phone) ex.phone = c.phone
      if (c.mobile && !ex.mobile) ex.mobile = c.mobile
    } else {
      seenNames.set(nameKey, deduped.length)
      deduped.push({ ...c })
    }
  }

  // Resolve best email per person
  for (const c of deduped) {
    if (c._emails.length > 0) {
      c.email = pickBestEmail(c.name || c.title || '', c._emails) || undefined
    }
  }

  const { data: existingRows } = await supabase
    .from('partner_contacts')
    .select('id, title, name, email, direct_phone, mobile')
    .eq('partner_id', partnerId)

  // Build lookup indices (name-first priority)
  const existingByName = new Map<string, any>()
  const existingByEmail = new Map<string, any>()
  const existingByTitle = new Map<string, any>()
  for (const e of (existingRows || [])) {
    if (e.name) existingByName.set(e.name.trim().toLowerCase(), e)
    if (e.email) existingByEmail.set(e.email.trim().toLowerCase(), e)
    if (e.title) existingByTitle.set(e.title, e)
  }
  
  const toInsert: any[] = []
  const toUpdate: any[] = []
  const usedIds = new Set<string>()
  
  for (const c of deduped) {
    if (!c.title && !c.name) continue
    const title = c.title || c.name || 'Unknown'
    const emailKey = c.email?.trim().toLowerCase()
    const nameKey = (c.name || '').trim().toLowerCase()

    // Match priority: name -> email -> title
    let ex = nameKey ? existingByName.get(nameKey) : undefined
    if (!ex && emailKey) ex = existingByEmail.get(emailKey)
    if (!ex) ex = existingByTitle.get(title)

    if (ex && !usedIds.has(ex.id)) {
      usedIds.add(ex.id)
      const updates: any = {}
      if (c.name && c.name !== ex.name && ex.name === ex.title) updates.name = c.name
      // Merge titles
      if (c.title && c.title !== ex.title && !ex.title?.includes(c.title)) {
        updates.title = ex.title ? `${ex.title} / ${c.title}` : c.title
      }
      // Email: replace if new one better matches the person's name
      if (c.email && /\S+@\S+\.\S+/.test(c.email)) {
        if (!ex.email) {
          updates.email = c.email
        } else if (c.email.trim().toLowerCase() !== ex.email.trim().toLowerCase()) {
          const best = pickBestEmail(c.name || ex.name || '', [ex.email, c.email])
          if (best && best.trim().toLowerCase() !== ex.email.trim().toLowerCase()) {
            updates.email = best
          }
        }
      }
      if (c.phone && !ex.direct_phone) updates.direct_phone = c.phone
      if (c.mobile && !ex.mobile) updates.mobile = c.mobile
      if (Object.keys(updates).length > 0) {
        toUpdate.push({ id: ex.id, ...updates })
      }
    } else if (!ex) {
      toInsert.push({
        partner_id: partnerId,
        name: c.name || title,
        title,
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
