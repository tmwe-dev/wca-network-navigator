update ai_routing_config
set provider = 'google',
    model = 'gemini-2.5-flash',
    tier = 'light',
    notes = 'Query planner SQL semantico (spostato su Google Gemini: OpenAI quota esaurita)',
    updated_at = now()
where scope = 'ai_query_planner';