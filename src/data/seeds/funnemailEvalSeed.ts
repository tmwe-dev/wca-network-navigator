/**
 * Sprint D — 50 realistic freight forwarding eval emails.
 *
 * Categories: inquiry | quote_request | booking | complaint | follow_up | info | spam | internal
 * Intents:    request_info | negotiate | confirm | complain | follow_up | spam | other
 * Priorities: high | normal | low
 */

export interface FunnemailEvalSeedRow {
  email_subject: string;
  email_body: string;
  expected_category: string;
  expected_intent: string;
  expected_priority: string;
}

export const FUNNEMAIL_EVAL_SEED: FunnemailEvalSeedRow[] = [
  // ── inquiry (7) ──
  {
    email_subject: "LCL consolidation service to West Africa",
    email_body:
      "We are looking for a reliable partner for LCL consolidation from Italy to Lagos and Accra. Could you share your service coverage and transit times for these destinations?",
    expected_category: "inquiry",
    expected_intent: "request_info",
    expected_priority: "normal",
  },
  {
    email_subject: "Reefer container availability July",
    email_body:
      "Do you have 40HC reefer containers available for loading in Genoa during the first two weeks of July? We need temperature-controlled transport for pharmaceutical goods.",
    expected_category: "inquiry",
    expected_intent: "request_info",
    expected_priority: "high",
  },
  {
    email_subject: "Customs clearance capabilities in Turkey",
    email_body:
      "We have a client requiring import clearance in Mersin and Istanbul. Can your local office handle full customs brokerage including duty drawback processing?",
    expected_category: "inquiry",
    expected_intent: "request_info",
    expected_priority: "normal",
  },
  {
    email_subject: "Overweight container handling options",
    email_body:
      "We have a 28-ton cargo that exceeds standard container weight limits. What options do you offer for flat rack or open top shipments from Milan to Jeddah?",
    expected_category: "inquiry",
    expected_intent: "request_info",
    expected_priority: "normal",
  },
  {
    email_subject: "Inland transport network in Southern Italy",
    email_body:
      "Could you provide details on your inland haulage network covering Campania and Calabria? We need regular weekly pickups from three different factories.",
    expected_category: "inquiry",
    expected_intent: "request_info",
    expected_priority: "normal",
  },
  {
    email_subject: "Warehousing and distribution in Genoa area",
    email_body:
      "We are evaluating third-party logistics providers near Genoa port. Do you offer bonded warehousing with pick-and-pack services? What is your storage capacity?",
    expected_category: "inquiry",
    expected_intent: "request_info",
    expected_priority: "normal",
  },
  {
    email_subject: "Project cargo handling experience",
    email_body:
      "We have an upcoming project shipment of wind turbine blades, each 65 meters long. Does your team have experience with breakbulk and project cargo of this nature?",
    expected_category: "inquiry",
    expected_intent: "request_info",
    expected_priority: "high",
  },

  // ── quote_request (7) ──
  {
    email_subject: "Rate request FCL Shanghai to Naples",
    email_body:
      "Please provide your best rates for 3x40HC from Shanghai to Naples, loading week 28. Include THC, documentation fees, and any applicable surcharges.",
    expected_category: "quote_request",
    expected_intent: "request_info",
    expected_priority: "high",
  },
  {
    email_subject: "Urgent quotation for air freight spare parts",
    email_body:
      "We need an urgent air freight quote for 450 kg of automotive spare parts from Stuttgart to our warehouse in Caserta. Door-to-door pricing needed by EOD.",
    expected_category: "quote_request",
    expected_intent: "request_info",
    expected_priority: "high",
  },
  {
    email_subject: "Annual tender ocean freight Mediterranean",
    email_body:
      "We are issuing our annual ocean freight tender for Mediterranean routes. Expected volume is 800 TEU per year. Please complete the attached rate matrix by July 15.",
    expected_category: "quote_request",
    expected_intent: "negotiate",
    expected_priority: "high",
  },
  {
    email_subject: "LCL rate to Santos Brazil",
    email_body:
      "Could you quote LCL rates from Genoa to Santos for approximately 8 CBM of ceramic tiles? We need all-in pricing including destination charges.",
    expected_category: "quote_request",
    expected_intent: "request_info",
    expected_priority: "normal",
  },
  {
    email_subject: "Multimodal quote rail plus sea to China",
    email_body:
      "We are exploring rail-sea options from our factory in Verona to Qingdao. Can you provide a competitive multimodal quotation including rail to a European hub port?",
    expected_category: "quote_request",
    expected_intent: "request_info",
    expected_priority: "normal",
  },
  {
    email_subject: "Spot rate 2x20GP to Durban",
    email_body:
      "Need a spot rate for 2x20GP Genoa to Durban, ready to load next Monday. Cargo is non-hazardous machinery parts, total weight 18 tons per container.",
    expected_category: "quote_request",
    expected_intent: "request_info",
    expected_priority: "high",
  },
  {
    email_subject: "Insurance quote for high-value electronics shipment",
    email_body:
      "We need cargo insurance for a shipment of consumer electronics valued at EUR 320,000 from Shenzhen to Rome. Please quote all-risk coverage including war risk.",
    expected_category: "quote_request",
    expected_intent: "request_info",
    expected_priority: "normal",
  },

  // ── booking (6) ──
  {
    email_subject: "Booking confirmation BKG-2024-4571",
    email_body:
      "Please confirm our booking for 1x40HC on vessel MSC LEANDRA V.032E, loading Genoa July 8. Cutoff is July 6 at 12:00. SI attached.",
    expected_category: "booking",
    expected_intent: "confirm",
    expected_priority: "high",
  },
  {
    email_subject: "Amendment to booking HLCU-88234",
    email_body:
      "We need to amend our booking to change the consignee details. New consignee is Atlas Trading LLC, Dubai. All other details remain unchanged.",
    expected_category: "booking",
    expected_intent: "request_info",
    expected_priority: "high",
  },
  {
    email_subject: "Booking request 5x40HC to Colombo",
    email_body:
      "Please book 5x40HC on the earliest available vessel from La Spezia to Colombo. Cargo ready date is July 20. Prefer direct service if possible.",
    expected_category: "booking",
    expected_intent: "confirm",
    expected_priority: "high",
  },
  {
    email_subject: "Cancel booking BKG-9912 due to cargo delay",
    email_body:
      "Unfortunately we must cancel booking BKG-9912 as our factory has delayed production by two weeks. We will rebook once cargo is ready. Apologies for the inconvenience.",
    expected_category: "booking",
    expected_intent: "request_info",
    expected_priority: "normal",
  },
  {
    email_subject: "Roll-over request for container MSKU7654321",
    email_body:
      "Container MSKU7654321 missed the cutoff for vessel EVER GLORY. Please roll it over to the next available sailing and confirm the new ETD.",
    expected_category: "booking",
    expected_intent: "request_info",
    expected_priority: "high",
  },
  {
    email_subject: "Confirmed booking details for BL instructions",
    email_body:
      "Booking OOLU-45123 is confirmed on CMA CGM THALASSA, ETD July 14. Please send BL instructions by July 12. Shipper and consignee details as per our previous email.",
    expected_category: "booking",
    expected_intent: "confirm",
    expected_priority: "normal",
  },

  // ── complaint (6) ──
  {
    email_subject: "Unacceptable delay on shipment SHP-2024-892",
    email_body:
      "Our shipment was supposed to arrive two weeks ago and we still have no ETA. Our client is threatening to cancel the order. This level of service is unacceptable.",
    expected_category: "complaint",
    expected_intent: "complain",
    expected_priority: "high",
  },
  {
    email_subject: "Damaged cargo received - claim notification",
    email_body:
      "We received container TCLU4456789 with severe water damage to 12 cartons of textile goods. Total estimated loss is EUR 8,500. Surveyor report will follow.",
    expected_category: "complaint",
    expected_intent: "complain",
    expected_priority: "high",
  },
  {
    email_subject: "Overcharged on demurrage invoice DEM-2024-334",
    email_body:
      "Your demurrage invoice includes charges for 5 days but our records show only 2 days of detention. The port was closed for 3 days due to a strike. We dispute EUR 1,200.",
    expected_category: "complaint",
    expected_intent: "complain",
    expected_priority: "high",
  },
  {
    email_subject: "Wrong documentation on BL MSCUXY987654",
    email_body:
      "The bill of lading contains incorrect consignee details and wrong HS codes. This caused customs rejection at destination. Please issue an amended BL immediately.",
    expected_category: "complaint",
    expected_intent: "complain",
    expected_priority: "high",
  },
  {
    email_subject: "Repeated invoicing errors",
    email_body:
      "This is the third time this month we have received incorrect invoices. The amounts do not match the agreed rates. Please review your billing process and issue corrected invoices.",
    expected_category: "complaint",
    expected_intent: "complain",
    expected_priority: "normal",
  },
  {
    email_subject: "Missing container at destination port",
    email_body:
      "Container CMAU5567890 was supposed to arrive in Jeddah on July 1 but the terminal reports it was never discharged. Please investigate and provide an update urgently.",
    expected_category: "complaint",
    expected_intent: "complain",
    expected_priority: "high",
  },

  // ── follow_up (6) ──
  {
    email_subject: "Re: Quotation QT-2024-0456 status",
    email_body:
      "Just following up on the quotation we sent last week for the Asia-Med lanes. Have you had a chance to review? We would like to finalize before the rate validity expires.",
    expected_category: "follow_up",
    expected_intent: "follow_up",
    expected_priority: "normal",
  },
  {
    email_subject: "Reminder: Outstanding payment INV-2024-1123",
    email_body:
      "This is a friendly reminder that invoice INV-2024-1123 for EUR 5,670 is now 15 days overdue. Could you please arrange payment at your earliest convenience?",
    expected_category: "follow_up",
    expected_intent: "follow_up",
    expected_priority: "normal",
  },
  {
    email_subject: "Re: Pending BL release for HLCU9988776",
    email_body:
      "We are still waiting for the original BL release for container HLCU9988776. The consignee cannot clear customs without it. Could you please expedite?",
    expected_category: "follow_up",
    expected_intent: "follow_up",
    expected_priority: "high",
  },
  {
    email_subject: "Following up on partnership discussion",
    email_body:
      "Thank you for the productive meeting last Tuesday. As discussed, I am following up to schedule the next call and share the draft MOU for your review.",
    expected_category: "follow_up",
    expected_intent: "follow_up",
    expected_priority: "normal",
  },
  {
    email_subject: "Re: Container tracking update MSKU1122334",
    email_body:
      "Any update on the tracking for container MSKU1122334? The last status showed it at the transhipment port in Colombo five days ago with no further movement.",
    expected_category: "follow_up",
    expected_intent: "follow_up",
    expected_priority: "normal",
  },
  {
    email_subject: "Second reminder: Certificate of origin needed",
    email_body:
      "This is our second request for the certificate of origin for shipment EXP-2024-567. The destination customs authority will not release goods without it.",
    expected_category: "follow_up",
    expected_intent: "follow_up",
    expected_priority: "high",
  },

  // ── info (6) ──
  {
    email_subject: "Peak season surcharge update Q3 2024",
    email_body:
      "Please be advised that effective July 1, a peak season surcharge of USD 450 per TEU will apply on all Asia-Mediterranean routes. See attached tariff circular.",
    expected_category: "info",
    expected_intent: "other",
    expected_priority: "normal",
  },
  {
    email_subject: "Port of Genoa holiday schedule August",
    email_body:
      "The Port of Genoa will observe reduced operations from August 14-16 due to national holidays. Gate hours will be limited to 08:00-12:00. Plan your deliveries accordingly.",
    expected_category: "info",
    expected_intent: "other",
    expected_priority: "low",
  },
  {
    email_subject: "New IMO 2025 fuel regulations summary",
    email_body:
      "Attached is a summary of the upcoming IMO 2025 fuel regulations and their expected impact on ocean freight pricing. This is for your information and planning purposes.",
    expected_category: "info",
    expected_intent: "other",
    expected_priority: "low",
  },
  {
    email_subject: "Vessel schedule update CMA CGM THALASSA",
    email_body:
      "Due to weather conditions in the Bay of Biscay, CMA CGM THALASSA V.045E will arrive in Genoa two days late. Revised ETA is July 18. All bookings affected.",
    expected_category: "info",
    expected_intent: "other",
    expected_priority: "normal",
  },
  {
    email_subject: "Updated SOLAS VGM requirements reminder",
    email_body:
      "A reminder that all shippers must provide verified gross mass declarations before vessel cutoff. Non-compliant containers will be rejected. Guidelines attached.",
    expected_category: "info",
    expected_intent: "other",
    expected_priority: "low",
  },
  {
    email_subject: "Carrier alliance restructuring announcement",
    email_body:
      "Ocean Alliance has announced service restructuring on Asia-Europe routes effective September. Some direct calls to Mediterranean ports will be replaced by feeder connections.",
    expected_category: "info",
    expected_intent: "other",
    expected_priority: "normal",
  },

  // ── spam (6) ──
  {
    email_subject: "GUARANTEED LOWEST FREIGHT RATES!!!",
    email_body:
      "Get the LOWEST rates in the industry! 50% cheaper than your current provider! No contracts, no commitments! Reply now for instant savings! Limited time offer!",
    expected_category: "spam",
    expected_intent: "spam",
    expected_priority: "low",
  },
  {
    email_subject: "Your Maersk account needs verification",
    email_body:
      "We detected unusual activity on your Maersk account. Click the link below to verify your identity within 24 hours or your account will be permanently suspended.",
    expected_category: "spam",
    expected_intent: "spam",
    expected_priority: "low",
  },
  {
    email_subject: "Earn $5000/day as a freight broker from home",
    email_body:
      "No experience needed! Our proven system helps you earn thousands daily as an independent freight broker. Sign up now and get our exclusive training for free!",
    expected_category: "spam",
    expected_intent: "spam",
    expected_priority: "low",
  },
  {
    email_subject: "Re: Your shipment delivery failed",
    email_body:
      "We tried to deliver your package but nobody was available. Please download the attached delivery notice and reschedule. If you do not respond within 48 hours, the package will be returned.",
    expected_category: "spam",
    expected_intent: "spam",
    expected_priority: "low",
  },
  {
    email_subject: "Cheap container tracking software - 90% off",
    email_body:
      "Revolutionary AI-powered container tracking at unbeatable prices! Track all your shipments in real time. Use code SHIP90 for 90% discount. Buy now before the offer expires!",
    expected_category: "spam",
    expected_intent: "spam",
    expected_priority: "low",
  },
  {
    email_subject: "URGENT: Unclaimed freight payment of $42,000",
    email_body:
      "Our records show an unclaimed freight payment of $42,000 in your name. To claim your funds, please provide your banking details and a copy of your business registration.",
    expected_category: "spam",
    expected_intent: "spam",
    expected_priority: "low",
  },

  // ── internal (6) ──
  {
    email_subject: "Weekly ops meeting agenda - July 8",
    email_body:
      "Agenda for Monday meeting: 1) Outstanding shipments review 2) Q3 volume forecast 3) New client onboarding status 4) IT system update. Please prepare your reports.",
    expected_category: "internal",
    expected_intent: "other",
    expected_priority: "normal",
  },
  {
    email_subject: "Updated SOP for dangerous goods handling",
    email_body:
      "Please find attached the updated standard operating procedure for DG cargo handling. All operations staff must review and acknowledge by end of this week.",
    expected_category: "internal",
    expected_intent: "other",
    expected_priority: "normal",
  },
  {
    email_subject: "New employee onboarding - Marco Rossi",
    email_body:
      "Marco Rossi will join the operations team on Monday. Please ensure his workstation, email account, and TMS access are set up. His manager is Lucia Bianchi.",
    expected_category: "internal",
    expected_intent: "other",
    expected_priority: "low",
  },
  {
    email_subject: "Q2 performance review results",
    email_body:
      "The Q2 performance dashboard is now available in the shared drive. Overall shipment volume increased by 12% but on-time delivery dropped to 87%. Department heads please review.",
    expected_category: "internal",
    expected_intent: "other",
    expected_priority: "normal",
  },
  {
    email_subject: "Office closure August 15 - Ferragosto",
    email_body:
      "A reminder that the office will be closed on August 15 for Ferragosto. Emergency contacts will be available via the duty phone. Please update your auto-replies.",
    expected_category: "internal",
    expected_intent: "other",
    expected_priority: "low",
  },
  {
    email_subject: "IT maintenance: TMS upgrade this weekend",
    email_body:
      "The transport management system will be offline Saturday 22:00 to Sunday 06:00 for a major version upgrade. Please complete all urgent bookings before Friday evening.",
    expected_category: "internal",
    expected_intent: "other",
    expected_priority: "normal",
  },
];
