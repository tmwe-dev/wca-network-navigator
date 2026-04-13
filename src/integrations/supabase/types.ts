export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          assigned_to: string | null
          campaign_batch_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          email_body: string | null
          email_subject: string | null
          executed_by_agent_id: string | null
          id: string
          message_id_external: string | null
          partner_id: string | null
          priority: string
          response_channel_message_id: string | null
          response_received: boolean | null
          response_received_at: string | null
          response_time_hours: number | null
          reviewed: boolean
          scheduled_at: string | null
          selected_contact_id: string | null
          sent_at: string | null
          source_id: string
          source_meta: Json | null
          source_type: string
          status: Database["public"]["Enums"]["activity_status"]
          thread_id: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          assigned_to?: string | null
          campaign_batch_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          email_body?: string | null
          email_subject?: string | null
          executed_by_agent_id?: string | null
          id?: string
          message_id_external?: string | null
          partner_id?: string | null
          priority?: string
          response_channel_message_id?: string | null
          response_received?: boolean | null
          response_received_at?: string | null
          response_time_hours?: number | null
          reviewed?: boolean
          scheduled_at?: string | null
          selected_contact_id?: string | null
          sent_at?: string | null
          source_id: string
          source_meta?: Json | null
          source_type?: string
          status?: Database["public"]["Enums"]["activity_status"]
          thread_id?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["activity_type"]
          assigned_to?: string | null
          campaign_batch_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          email_body?: string | null
          email_subject?: string | null
          executed_by_agent_id?: string | null
          id?: string
          message_id_external?: string | null
          partner_id?: string | null
          priority?: string
          response_channel_message_id?: string | null
          response_received?: boolean | null
          response_received_at?: string | null
          response_time_hours?: number | null
          reviewed?: boolean
          scheduled_at?: string | null
          selected_contact_id?: string | null
          sent_at?: string | null
          source_id?: string
          source_meta?: Json | null
          source_type?: string
          status?: Database["public"]["Enums"]["activity_status"]
          thread_id?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_response_channel_message_id_fkey"
            columns: ["response_channel_message_id"]
            isOneToOne: false
            referencedRelation: "channel_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_selected_contact_id_fkey"
            columns: ["selected_contact_id"]
            isOneToOne: false
            referencedRelation: "partner_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tasks: {
        Row: {
          agent_id: string
          completed_at: string | null
          created_at: string
          description: string
          execution_log: Json
          id: string
          result_summary: string | null
          scheduled_at: string | null
          started_at: string | null
          status: string
          target_filters: Json
          task_type: string
          user_id: string
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          created_at?: string
          description?: string
          execution_log?: Json
          id?: string
          result_summary?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          target_filters?: Json
          task_type?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string
          execution_log?: Json
          id?: string
          result_summary?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          target_filters?: Json
          task_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_tasks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          assigned_tools: Json
          avatar_emoji: string
          created_at: string
          elevenlabs_agent_id: string | null
          elevenlabs_voice_id: string | null
          id: string
          is_active: boolean
          knowledge_base: Json
          name: string
          role: string
          schedule_config: Json
          signature_html: string | null
          signature_image_url: string | null
          stats: Json
          system_prompt: string
          territory_codes: string[] | null
          updated_at: string
          user_id: string
          voice_call_url: string | null
        }
        Insert: {
          assigned_tools?: Json
          avatar_emoji?: string
          created_at?: string
          elevenlabs_agent_id?: string | null
          elevenlabs_voice_id?: string | null
          id?: string
          is_active?: boolean
          knowledge_base?: Json
          name: string
          role?: string
          schedule_config?: Json
          signature_html?: string | null
          signature_image_url?: string | null
          stats?: Json
          system_prompt?: string
          territory_codes?: string[] | null
          updated_at?: string
          user_id: string
          voice_call_url?: string | null
        }
        Update: {
          assigned_tools?: Json
          avatar_emoji?: string
          created_at?: string
          elevenlabs_agent_id?: string | null
          elevenlabs_voice_id?: string | null
          id?: string
          is_active?: boolean
          knowledge_base?: Json
          name?: string
          role?: string
          schedule_config?: Json
          signature_html?: string | null
          signature_image_url?: string | null
          stats?: Json
          system_prompt?: string
          territory_codes?: string[] | null
          updated_at?: string
          user_id?: string
          voice_call_url?: string | null
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          messages: Json
          page_context: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          page_context?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          page_context?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_daily_plans: {
        Row: {
          completed: Json
          created_at: string | null
          id: string
          notes: string | null
          objectives: Json
          plan_date: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed?: Json
          created_at?: string | null
          id?: string
          notes?: string | null
          objectives?: Json
          plan_date?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed?: Json
          created_at?: string | null
          id?: string
          notes?: string | null
          objectives?: Json
          plan_date?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_edit_patterns: {
        Row: {
          channel: string | null
          country_code: string | null
          created_at: string
          cta_final: string | null
          cta_original: string | null
          email_type: string | null
          formality_shift: string | null
          hook_final: string | null
          hook_original: string | null
          id: string
          length_delta_percent: number | null
          persuasion_pattern: string | null
          significance: string | null
          tone_delta: string | null
          user_id: string
        }
        Insert: {
          channel?: string | null
          country_code?: string | null
          created_at?: string
          cta_final?: string | null
          cta_original?: string | null
          email_type?: string | null
          formality_shift?: string | null
          hook_final?: string | null
          hook_original?: string | null
          id?: string
          length_delta_percent?: number | null
          persuasion_pattern?: string | null
          significance?: string | null
          tone_delta?: string | null
          user_id: string
        }
        Update: {
          channel?: string | null
          country_code?: string | null
          created_at?: string
          cta_final?: string | null
          cta_original?: string | null
          email_type?: string | null
          formality_shift?: string | null
          hook_final?: string | null
          hook_original?: string | null
          id?: string
          length_delta_percent?: number | null
          persuasion_pattern?: string | null
          significance?: string | null
          tone_delta?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_lab_test_results: {
        Row: {
          created_at: string
          debug_info: Json | null
          duration_ms: number
          endpoint: string
          id: string
          issues: Json | null
          output_body: string | null
          output_subject: string | null
          run_id: string
          scenario_id: number
          scenario_name: string
          score: number
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          debug_info?: Json | null
          duration_ms?: number
          endpoint?: string
          id?: string
          issues?: Json | null
          output_body?: string | null
          output_subject?: string | null
          run_id: string
          scenario_id: number
          scenario_name?: string
          score?: number
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          debug_info?: Json | null
          duration_ms?: number
          endpoint?: string
          id?: string
          issues?: Json | null
          output_body?: string | null
          output_subject?: string | null
          run_id?: string
          scenario_id?: number
          scenario_name?: string
          score?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_lab_test_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "ai_lab_test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_lab_test_runs: {
        Row: {
          completed_at: string | null
          fail_count: number
          id: string
          max_score: number
          pass_count: number
          started_at: string
          summary: Json | null
          total_score: number
          user_id: string
          warn_count: number
        }
        Insert: {
          completed_at?: string | null
          fail_count?: number
          id?: string
          max_score?: number
          pass_count?: number
          started_at?: string
          summary?: Json | null
          total_score?: number
          user_id: string
          warn_count?: number
        }
        Update: {
          completed_at?: string | null
          fail_count?: number
          id?: string
          max_score?: number
          pass_count?: number
          started_at?: string
          summary?: Json | null
          total_score?: number
          user_id?: string
          warn_count?: number
        }
        Relationships: []
      }
      ai_memory: {
        Row: {
          access_count: number
          confidence: number
          content: string
          context_page: string | null
          created_at: string
          decay_rate: number
          embedding: string | null
          embedding_model: string | null
          embedding_updated_at: string | null
          expires_at: string | null
          feedback: string | null
          id: string
          importance: number
          last_accessed_at: string | null
          level: number
          memory_type: string
          pending_promotion: boolean
          promoted_at: string | null
          source: string
          tags: string[] | null
          user_id: string
        }
        Insert: {
          access_count?: number
          confidence?: number
          content: string
          context_page?: string | null
          created_at?: string
          decay_rate?: number
          embedding?: string | null
          embedding_model?: string | null
          embedding_updated_at?: string | null
          expires_at?: string | null
          feedback?: string | null
          id?: string
          importance?: number
          last_accessed_at?: string | null
          level?: number
          memory_type?: string
          pending_promotion?: boolean
          promoted_at?: string | null
          source?: string
          tags?: string[] | null
          user_id: string
        }
        Update: {
          access_count?: number
          confidence?: number
          content?: string
          context_page?: string | null
          created_at?: string
          decay_rate?: number
          embedding?: string | null
          embedding_model?: string | null
          embedding_updated_at?: string | null
          expires_at?: string | null
          feedback?: string | null
          id?: string
          importance?: number
          last_accessed_at?: string | null
          level?: number
          memory_type?: string
          pending_promotion?: boolean
          promoted_at?: string | null
          source?: string
          tags?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      ai_plan_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          last_used_at: string | null
          name: string
          steps_template: Json
          tags: string[] | null
          use_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          steps_template?: Json
          tags?: string[] | null
          use_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          steps_template?: Json
          tags?: string[] | null
          use_count?: number
          user_id?: string
        }
        Relationships: []
      }
      ai_request_log: {
        Row: {
          agent_code: string | null
          channel: string | null
          created_at: string | null
          error_message: string | null
          id: string
          intent: string | null
          latency_ms: number | null
          metadata: Json | null
          model: string | null
          routed_to: string | null
          status: string | null
          total_tokens: number | null
          trace_id: string | null
          user_id: string | null
        }
        Insert: {
          agent_code?: string | null
          channel?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          intent?: string | null
          latency_ms?: number | null
          metadata?: Json | null
          model?: string | null
          routed_to?: string | null
          status?: string | null
          total_tokens?: number | null
          trace_id?: string | null
          user_id?: string | null
        }
        Update: {
          agent_code?: string | null
          channel?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          intent?: string | null
          latency_ms?: number | null
          metadata?: Json | null
          model?: string | null
          routed_to?: string | null
          status?: string | null
          total_tokens?: number | null
          trace_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_session_briefings: {
        Row: {
          agent_code: string
          briefing_type: string | null
          content: string
          created_at: string | null
          expires_at: string | null
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          agent_code: string
          briefing_type?: string | null
          content: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          agent_code?: string
          briefing_type?: string | null
          content?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      ai_work_plans: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: number
          description: string | null
          id: string
          metadata: Json | null
          source_template_id: string | null
          status: string
          steps: Json
          tags: string[] | null
          title: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          description?: string | null
          id?: string
          metadata?: Json | null
          source_template_id?: string | null
          status?: string
          steps?: Json
          tags?: string[] | null
          title: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          description?: string | null
          id?: string
          metadata?: Json | null
          source_template_id?: string | null
          status?: string
          steps?: Json
          tags?: string[] | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          user_id: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          user_id: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          user_id?: string
          value?: string | null
        }
        Relationships: []
      }
      authorized_users: {
        Row: {
          added_by: string | null
          created_at: string
          display_name: string | null
          email: string
          id: string
          is_active: boolean
          last_login_at: string | null
          login_count: number
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          login_count?: number
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          login_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      blacklist_entries: {
        Row: {
          blacklist_no: number | null
          city: string | null
          claims: string | null
          company_name: string
          country: string | null
          created_at: string | null
          id: string
          matched_partner_id: string | null
          source: string | null
          status: string | null
          total_owed_amount: number | null
          updated_at: string | null
        }
        Insert: {
          blacklist_no?: number | null
          city?: string | null
          claims?: string | null
          company_name: string
          country?: string | null
          created_at?: string | null
          id?: string
          matched_partner_id?: string | null
          source?: string | null
          status?: string | null
          total_owed_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          blacklist_no?: number | null
          city?: string | null
          claims?: string | null
          company_name?: string
          country?: string | null
          created_at?: string | null
          id?: string
          matched_partner_id?: string | null
          source?: string | null
          status?: string | null
          total_owed_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blacklist_entries_matched_partner_id_fkey"
            columns: ["matched_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      blacklist_sync_log: {
        Row: {
          created_at: string | null
          entries_count: number | null
          id: string
          matched_count: number | null
          sync_type: string
        }
        Insert: {
          created_at?: string | null
          entries_count?: number | null
          id?: string
          matched_count?: number | null
          sync_type: string
        }
        Update: {
          created_at?: string | null
          entries_count?: number | null
          id?: string
          matched_count?: number | null
          sync_type?: string
        }
        Relationships: []
      }
      bridge_tokens: {
        Row: {
          agent_id: string | null
          created_at: string
          created_by: string
          expires_at: string
          external_call_id: string | null
          id: string
          token_hash: string
          used: boolean
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          created_by: string
          expires_at?: string
          external_call_id?: string | null
          id?: string
          token_hash: string
          used?: boolean
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          external_call_id?: string | null
          id?: string
          token_hash?: string
          used?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "bridge_tokens_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      business_cards: {
        Row: {
          company_name: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          event_name: string | null
          id: string
          lead_status: string
          location: string | null
          match_confidence: number | null
          match_status: string
          matched_contact_id: string | null
          matched_partner_id: string | null
          met_at: string | null
          mobile: string | null
          notes: string | null
          phone: string | null
          photo_url: string | null
          position: string | null
          raw_data: Json | null
          tags: string[] | null
          user_id: string
        }
        Insert: {
          company_name?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          event_name?: string | null
          id?: string
          lead_status?: string
          location?: string | null
          match_confidence?: number | null
          match_status?: string
          matched_contact_id?: string | null
          matched_partner_id?: string | null
          met_at?: string | null
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          raw_data?: Json | null
          tags?: string[] | null
          user_id: string
        }
        Update: {
          company_name?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          event_name?: string | null
          id?: string
          lead_status?: string
          location?: string | null
          match_confidence?: number | null
          match_status?: string
          matched_contact_id?: string | null
          matched_partner_id?: string | null
          met_at?: string | null
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          raw_data?: Json | null
          tags?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_cards_matched_contact_id_fkey"
            columns: ["matched_contact_id"]
            isOneToOne: false
            referencedRelation: "imported_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_cards_matched_partner_id_fkey"
            columns: ["matched_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_jobs: {
        Row: {
          assigned_to: string | null
          batch_id: string
          city: string | null
          company_name: string
          completed_at: string | null
          country_code: string
          country_name: string
          created_at: string
          email: string | null
          id: string
          job_type: Database["public"]["Enums"]["campaign_job_type"]
          notes: string | null
          partner_id: string
          phone: string | null
          status: Database["public"]["Enums"]["campaign_job_status"]
          user_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          batch_id: string
          city?: string | null
          company_name: string
          completed_at?: string | null
          country_code: string
          country_name: string
          created_at?: string
          email?: string | null
          id?: string
          job_type?: Database["public"]["Enums"]["campaign_job_type"]
          notes?: string | null
          partner_id: string
          phone?: string | null
          status?: Database["public"]["Enums"]["campaign_job_status"]
          user_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          batch_id?: string
          city?: string | null
          company_name?: string
          completed_at?: string | null
          country_code?: string
          country_name?: string
          created_at?: string
          email?: string | null
          id?: string
          job_type?: Database["public"]["Enums"]["campaign_job_type"]
          notes?: string | null
          partner_id?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["campaign_job_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_jobs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_messages: {
        Row: {
          bcc_addresses: string | null
          body_html: string | null
          body_text: string | null
          category: string | null
          cc_addresses: string | null
          channel: string
          created_at: string
          direction: string
          email_date: string | null
          from_address: string | null
          id: string
          imap_flags: string | null
          imap_uid: number | null
          in_reply_to: string | null
          internal_date: string | null
          message_id_external: string | null
          operator_id: string | null
          parse_status: string | null
          parse_warnings: string[] | null
          partner_id: string | null
          raw_payload: Json | null
          raw_sha256: string | null
          raw_size_bytes: number | null
          raw_storage_path: string | null
          read_at: string | null
          references_header: string | null
          search_vector: unknown
          source_id: string | null
          source_type: string | null
          subject: string | null
          thread_id: string | null
          to_address: string | null
          uidvalidity: number | null
          user_id: string
        }
        Insert: {
          bcc_addresses?: string | null
          body_html?: string | null
          body_text?: string | null
          category?: string | null
          cc_addresses?: string | null
          channel: string
          created_at?: string
          direction: string
          email_date?: string | null
          from_address?: string | null
          id?: string
          imap_flags?: string | null
          imap_uid?: number | null
          in_reply_to?: string | null
          internal_date?: string | null
          message_id_external?: string | null
          operator_id?: string | null
          parse_status?: string | null
          parse_warnings?: string[] | null
          partner_id?: string | null
          raw_payload?: Json | null
          raw_sha256?: string | null
          raw_size_bytes?: number | null
          raw_storage_path?: string | null
          read_at?: string | null
          references_header?: string | null
          search_vector?: unknown
          source_id?: string | null
          source_type?: string | null
          subject?: string | null
          thread_id?: string | null
          to_address?: string | null
          uidvalidity?: number | null
          user_id: string
        }
        Update: {
          bcc_addresses?: string | null
          body_html?: string | null
          body_text?: string | null
          category?: string | null
          cc_addresses?: string | null
          channel?: string
          created_at?: string
          direction?: string
          email_date?: string | null
          from_address?: string | null
          id?: string
          imap_flags?: string | null
          imap_uid?: number | null
          in_reply_to?: string | null
          internal_date?: string | null
          message_id_external?: string | null
          operator_id?: string | null
          parse_status?: string | null
          parse_warnings?: string[] | null
          partner_id?: string | null
          raw_payload?: Json | null
          raw_sha256?: string | null
          raw_size_bytes?: number | null
          raw_storage_path?: string | null
          read_at?: string | null
          references_header?: string | null
          search_vector?: unknown
          source_id?: string | null
          source_type?: string | null
          subject?: string | null
          thread_id?: string | null
          to_address?: string | null
          uidvalidity?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_messages_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      client_assignments: {
        Row: {
          agent_id: string
          assigned_at: string
          id: string
          manager_id: string | null
          source_id: string
          source_type: string
          user_id: string
        }
        Insert: {
          agent_id: string
          assigned_at?: string
          id?: string
          manager_id?: string | null
          source_id: string
          source_type?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          assigned_at?: string
          id?: string
          manager_id?: string | null
          source_id?: string
          source_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_assignments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_assignments_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      cockpit_queue: {
        Row: {
          created_at: string
          id: string
          partner_id: string | null
          source_id: string
          source_type: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          partner_id?: string | null
          source_id: string
          source_type: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          partner_id?: string | null
          source_id?: string
          source_type?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      commercial_playbooks: {
        Row: {
          category: string | null
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_template: boolean | null
          kb_tags: string[] | null
          name: string
          priority: number | null
          prompt_template: string | null
          suggested_actions: Json | null
          trigger_conditions: Json | null
          updated_at: string | null
          user_id: string
          workflow_code: string | null
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_template?: boolean | null
          kb_tags?: string[] | null
          name: string
          priority?: number | null
          prompt_template?: string | null
          suggested_actions?: Json | null
          trigger_conditions?: Json | null
          updated_at?: string | null
          user_id: string
          workflow_code?: string | null
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_template?: boolean | null
          kb_tags?: string[] | null
          name?: string
          priority?: number | null
          prompt_template?: string | null
          suggested_actions?: Json | null
          trigger_conditions?: Json | null
          updated_at?: string | null
          user_id?: string
          workflow_code?: string | null
        }
        Relationships: []
      }
      commercial_workflows: {
        Row: {
          category: string | null
          code: string
          created_at: string | null
          description: string | null
          gates: Json | null
          id: string
          is_active: boolean | null
          is_template: boolean | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string | null
          description?: string | null
          gates?: Json | null
          id?: string
          is_active?: boolean | null
          is_template?: boolean | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string | null
          description?: string | null
          gates?: Json | null
          id?: string
          is_active?: boolean | null
          is_template?: boolean | null
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      contact_interactions: {
        Row: {
          contact_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          interaction_type: string
          outcome: string | null
          title: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          interaction_type: string
          outcome?: string | null
          title: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          interaction_type?: string
          outcome?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "imported_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          operation: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          operation: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          operation?: string
          user_id?: string
        }
        Relationships: []
      }
      directory_cache: {
        Row: {
          country_code: string
          download_verified: boolean
          id: string
          members: Json
          network_name: string
          scanned_at: string
          total_pages: number
          total_results: number
          updated_at: string
          user_id: string | null
          verified_at: string | null
        }
        Insert: {
          country_code: string
          download_verified?: boolean
          id?: string
          members?: Json
          network_name?: string
          scanned_at?: string
          total_pages?: number
          total_results?: number
          updated_at?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Update: {
          country_code?: string
          download_verified?: boolean
          id?: string
          members?: Json
          network_name?: string
          scanned_at?: string
          total_pages?: number
          total_results?: number
          updated_at?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      download_job_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          item_id: string | null
          job_id: string
          payload: Json | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          item_id?: string | null
          job_id: string
          payload?: Json | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          item_id?: string | null
          job_id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "download_job_events_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "download_job_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "download_job_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "download_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      download_job_items: {
        Row: {
          attempt_count: number
          completed_at: string | null
          contacts_found: number
          contacts_missing: number
          created_at: string
          id: string
          job_id: string
          last_error_code: string | null
          last_error_message: string | null
          position: number
          started_at: string | null
          status: string
          wca_id: number
        }
        Insert: {
          attempt_count?: number
          completed_at?: string | null
          contacts_found?: number
          contacts_missing?: number
          created_at?: string
          id?: string
          job_id: string
          last_error_code?: string | null
          last_error_message?: string | null
          position: number
          started_at?: string | null
          status?: string
          wca_id: number
        }
        Update: {
          attempt_count?: number
          completed_at?: string | null
          contacts_found?: number
          contacts_missing?: number
          created_at?: string
          id?: string
          job_id?: string
          last_error_code?: string | null
          last_error_message?: string | null
          position?: number
          started_at?: string | null
          status?: string
          wca_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "download_job_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "download_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      download_jobs: {
        Row: {
          completed_at: string | null
          contacts_found_count: number
          contacts_missing_count: number
          country_code: string
          country_name: string
          created_at: string
          current_index: number
          delay_seconds: number
          error_message: string | null
          failed_ids: Json
          id: string
          job_type: string
          last_contact_result: string | null
          last_processed_company: string | null
          last_processed_wca_id: number | null
          network_name: string
          processed_ids: Json
          status: string
          terminal_log: Json
          total_count: number
          updated_at: string
          user_id: string | null
          wca_ids: Json
        }
        Insert: {
          completed_at?: string | null
          contacts_found_count?: number
          contacts_missing_count?: number
          country_code: string
          country_name: string
          created_at?: string
          current_index?: number
          delay_seconds?: number
          error_message?: string | null
          failed_ids?: Json
          id?: string
          job_type?: string
          last_contact_result?: string | null
          last_processed_company?: string | null
          last_processed_wca_id?: number | null
          network_name?: string
          processed_ids?: Json
          status?: string
          terminal_log?: Json
          total_count?: number
          updated_at?: string
          user_id?: string | null
          wca_ids?: Json
        }
        Update: {
          completed_at?: string | null
          contacts_found_count?: number
          contacts_missing_count?: number
          country_code?: string
          country_name?: string
          created_at?: string
          current_index?: number
          delay_seconds?: number
          error_message?: string | null
          failed_ids?: Json
          id?: string
          job_type?: string
          last_contact_result?: string | null
          last_processed_company?: string | null
          last_processed_wca_id?: number | null
          network_name?: string
          processed_ids?: Json
          status?: string
          terminal_log?: Json
          total_count?: number
          updated_at?: string
          user_id?: string | null
          wca_ids?: Json
        }
        Relationships: []
      }
      download_queue: {
        Row: {
          country_code: string
          country_name: string
          created_at: string
          id: string
          id_range_end: number | null
          id_range_start: number | null
          last_processed_id: number | null
          network_name: string
          priority: number
          status: Database["public"]["Enums"]["download_queue_status"]
          total_found: number
          total_processed: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          country_code: string
          country_name: string
          created_at?: string
          id?: string
          id_range_end?: number | null
          id_range_start?: number | null
          last_processed_id?: number | null
          network_name: string
          priority?: number
          status?: Database["public"]["Enums"]["download_queue_status"]
          total_found?: number
          total_processed?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          country_code?: string
          country_name?: string
          created_at?: string
          id?: string
          id_range_end?: number | null
          id_range_start?: number | null
          last_processed_id?: number | null
          network_name?: string
          priority?: number
          status?: Database["public"]["Enums"]["download_queue_status"]
          total_found?: number
          total_processed?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      email_address_rules: {
        Row: {
          category: string | null
          created_at: string
          display_name: string | null
          email_address: string
          exclusive_agent_id: string | null
          id: string
          notes: string | null
          prompt_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          display_name?: string | null
          email_address: string
          exclusive_agent_id?: string | null
          id?: string
          notes?: string | null
          prompt_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          display_name?: string | null
          email_address?: string
          exclusive_agent_id?: string | null
          id?: string
          notes?: string | null
          prompt_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_address_rules_exclusive_agent_id_fkey"
            columns: ["exclusive_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_address_rules_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "email_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_attachments: {
        Row: {
          content_id: string | null
          content_type: string | null
          created_at: string
          filename: string
          id: string
          is_inline: boolean | null
          message_id: string
          size_bytes: number | null
          storage_path: string
          user_id: string
        }
        Insert: {
          content_id?: string | null
          content_type?: string | null
          created_at?: string
          filename: string
          id?: string
          is_inline?: boolean | null
          message_id: string
          size_bytes?: number | null
          storage_path: string
          user_id: string
        }
        Update: {
          content_id?: string | null
          content_type?: string | null
          created_at?: string
          filename?: string
          id?: string
          is_inline?: boolean | null
          message_id?: string
          size_bytes?: number | null
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "channel_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaign_queue: {
        Row: {
          created_at: string
          draft_id: string | null
          error_message: string | null
          html_body: string
          id: string
          idempotency_key: string
          open_count: number | null
          opened_at: string | null
          partner_id: string
          position: number
          recipient_email: string
          recipient_name: string | null
          retry_count: number
          scheduled_at: string | null
          sent_at: string | null
          status: string
          subject: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          draft_id?: string | null
          error_message?: string | null
          html_body: string
          id?: string
          idempotency_key?: string
          open_count?: number | null
          opened_at?: string | null
          partner_id: string
          position?: number
          recipient_email: string
          recipient_name?: string | null
          retry_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          draft_id?: string | null
          error_message?: string | null
          html_body?: string
          id?: string
          idempotency_key?: string
          open_count?: number | null
          opened_at?: string | null
          partner_id?: string
          position?: number
          recipient_email?: string
          recipient_name?: string | null
          retry_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_queue_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "email_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_drafts: {
        Row: {
          attachment_ids: Json | null
          category: string | null
          created_at: string
          html_body: string | null
          id: string
          link_urls: Json | null
          queue_completed_at: string | null
          queue_delay_seconds: number
          queue_started_at: string | null
          queue_status: string
          recipient_filter: Json | null
          recipient_type: string | null
          sent_at: string | null
          sent_count: number
          status: string
          subject: string | null
          total_count: number
          user_id: string | null
        }
        Insert: {
          attachment_ids?: Json | null
          category?: string | null
          created_at?: string
          html_body?: string | null
          id?: string
          link_urls?: Json | null
          queue_completed_at?: string | null
          queue_delay_seconds?: number
          queue_started_at?: string | null
          queue_status?: string
          recipient_filter?: Json | null
          recipient_type?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
          subject?: string | null
          total_count?: number
          user_id?: string | null
        }
        Update: {
          attachment_ids?: Json | null
          category?: string | null
          created_at?: string
          html_body?: string | null
          id?: string
          link_urls?: Json | null
          queue_completed_at?: string | null
          queue_delay_seconds?: number
          queue_started_at?: string | null
          queue_status?: string
          recipient_filter?: Json | null
          recipient_type?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
          subject?: string | null
          total_count?: number
          user_id?: string | null
        }
        Relationships: []
      }
      email_prompts: {
        Row: {
          created_at: string
          id: string
          instructions: string
          is_active: boolean
          priority: number
          scope: string
          scope_value: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instructions?: string
          is_active?: boolean
          priority?: number
          scope?: string
          scope_value?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instructions?: string
          is_active?: boolean
          priority?: number
          scope?: string
          scope_value?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_sync_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          downloaded_count: number
          error_count: number
          error_message: string | null
          id: string
          last_batch_at: string | null
          skipped_count: number
          started_at: string
          status: string
          total_remaining: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          downloaded_count?: number
          error_count?: number
          error_message?: string | null
          id?: string
          last_batch_at?: string | null
          skipped_count?: number
          started_at?: string
          status?: string
          total_remaining?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          downloaded_count?: number
          error_count?: number
          error_message?: string | null
          id?: string
          last_batch_at?: string | null
          skipped_count?: number
          started_at?: string
          status?: string
          total_remaining?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_sync_state: {
        Row: {
          created_at: string
          id: string
          imap_host: string
          imap_user: string
          last_sync_at: string | null
          last_uid: number
          stored_uidvalidity: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          imap_host?: string
          imap_user?: string
          last_sync_at?: string | null
          last_uid?: number
          stored_uidvalidity?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          imap_host?: string
          imap_user?: string
          last_sync_at?: string | null
          last_uid?: number
          stored_uidvalidity?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          category: string | null
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          file_name: string
          file_size?: number
          file_type?: string
          file_url: string
          id?: string
          name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      import_errors: {
        Row: {
          ai_suggestions: Json | null
          attempted_corrections: number
          corrected_data: Json | null
          created_at: string
          error_message: string | null
          error_type: string
          id: string
          import_log_id: string
          raw_data: Json | null
          row_number: number
          status: string
        }
        Insert: {
          ai_suggestions?: Json | null
          attempted_corrections?: number
          corrected_data?: Json | null
          created_at?: string
          error_message?: string | null
          error_type?: string
          id?: string
          import_log_id: string
          raw_data?: Json | null
          row_number?: number
          status?: string
        }
        Update: {
          ai_suggestions?: Json | null
          attempted_corrections?: number
          corrected_data?: Json | null
          created_at?: string
          error_message?: string | null
          error_type?: string
          id?: string
          import_log_id?: string
          raw_data?: Json | null
          row_number?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_errors_import_log_id_fkey"
            columns: ["import_log_id"]
            isOneToOne: false
            referencedRelation: "import_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_rows: number
          file_name: string
          file_size: number
          file_url: string | null
          group_name: string | null
          id: string
          imported_rows: number
          normalization_method: string
          processing_batch: number
          status: string
          total_batches: number
          total_rows: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_rows?: number
          file_name: string
          file_size?: number
          file_url?: string | null
          group_name?: string | null
          id?: string
          imported_rows?: number
          normalization_method?: string
          processing_batch?: number
          status?: string
          total_batches?: number
          total_rows?: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_rows?: number
          file_name?: string
          file_size?: number
          file_url?: string | null
          group_name?: string | null
          id?: string
          imported_rows?: number
          normalization_method?: string
          processing_batch?: number
          status?: string
          total_batches?: number
          total_rows?: number
          user_id?: string
        }
        Relationships: []
      }
      imported_contacts: {
        Row: {
          address: string | null
          city: string | null
          company_alias: string | null
          company_name: string | null
          contact_alias: string | null
          converted_at: string | null
          country: string | null
          created_at: string
          deep_search_at: string | null
          email: string | null
          enrichment_data: Json | null
          external_id: string | null
          id: string
          import_log_id: string
          interaction_count: number
          is_selected: boolean
          is_transferred: boolean
          last_interaction_at: string | null
          lead_status: string
          mobile: string | null
          name: string | null
          note: string | null
          origin: string | null
          phone: string | null
          position: string | null
          raw_data: Json | null
          row_number: number
          user_id: string | null
          wca_match_confidence: number | null
          wca_partner_id: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_alias?: string | null
          company_name?: string | null
          contact_alias?: string | null
          converted_at?: string | null
          country?: string | null
          created_at?: string
          deep_search_at?: string | null
          email?: string | null
          enrichment_data?: Json | null
          external_id?: string | null
          id?: string
          import_log_id: string
          interaction_count?: number
          is_selected?: boolean
          is_transferred?: boolean
          last_interaction_at?: string | null
          lead_status?: string
          mobile?: string | null
          name?: string | null
          note?: string | null
          origin?: string | null
          phone?: string | null
          position?: string | null
          raw_data?: Json | null
          row_number?: number
          user_id?: string | null
          wca_match_confidence?: number | null
          wca_partner_id?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_alias?: string | null
          company_name?: string | null
          contact_alias?: string | null
          converted_at?: string | null
          country?: string | null
          created_at?: string
          deep_search_at?: string | null
          email?: string | null
          enrichment_data?: Json | null
          external_id?: string | null
          id?: string
          import_log_id?: string
          interaction_count?: number
          is_selected?: boolean
          is_transferred?: boolean
          last_interaction_at?: string | null
          lead_status?: string
          mobile?: string | null
          name?: string | null
          note?: string | null
          origin?: string | null
          phone?: string | null
          position?: string | null
          raw_data?: Json | null
          row_number?: number
          user_id?: string | null
          wca_match_confidence?: number | null
          wca_partner_id?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imported_contacts_import_log_id_fkey"
            columns: ["import_log_id"]
            isOneToOne: false
            referencedRelation: "import_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imported_contacts_wca_partner_id_fkey"
            columns: ["wca_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          interaction_date: string | null
          interaction_type: Database["public"]["Enums"]["interaction_type"]
          notes: string | null
          partner_id: string
          subject: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          interaction_date?: string | null
          interaction_type: Database["public"]["Enums"]["interaction_type"]
          notes?: string | null
          partner_id: string
          subject: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          interaction_date?: string | null
          interaction_type?: Database["public"]["Enums"]["interaction_type"]
          notes?: string | null
          partner_id?: string
          subject?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interactions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_entries: {
        Row: {
          access_count: number | null
          category: string
          chapter: string
          content: string
          created_at: string
          embedding: string | null
          embedding_model: string | null
          embedding_updated_at: string | null
          id: string
          is_active: boolean
          last_accessed_at: string | null
          priority: number
          sort_order: number
          tags: string[]
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_count?: number | null
          category?: string
          chapter?: string
          content?: string
          created_at?: string
          embedding?: string | null
          embedding_model?: string | null
          embedding_updated_at?: string | null
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          priority?: number
          sort_order?: number
          tags?: string[]
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_count?: number | null
          category?: string
          chapter?: string
          content?: string
          created_at?: string
          embedding?: string | null
          embedding_model?: string | null
          embedding_updated_at?: string | null
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          priority?: number
          sort_order?: number
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      linkedin_flow_items: {
        Row: {
          company_name: string | null
          completed_at: string | null
          contact_id: string
          contact_name: string | null
          created_at: string
          enrichment_result: Json | null
          error_message: string | null
          id: string
          job_id: string
          linkedin_url: string | null
          position: number
          scraped_data: Json | null
          source_type: string
          started_at: string | null
          status: string
        }
        Insert: {
          company_name?: string | null
          completed_at?: string | null
          contact_id: string
          contact_name?: string | null
          created_at?: string
          enrichment_result?: Json | null
          error_message?: string | null
          id?: string
          job_id: string
          linkedin_url?: string | null
          position?: number
          scraped_data?: Json | null
          source_type?: string
          started_at?: string | null
          status?: string
        }
        Update: {
          company_name?: string | null
          completed_at?: string | null
          contact_id?: string
          contact_name?: string | null
          created_at?: string
          enrichment_result?: Json | null
          error_message?: string | null
          id?: string
          job_id?: string
          linkedin_url?: string | null
          position?: number
          scraped_data?: Json | null
          source_type?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_flow_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "linkedin_flow_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_flow_jobs: {
        Row: {
          completed_at: string | null
          config: Json
          created_at: string
          delay_seconds: number
          error_count: number
          id: string
          processed_count: number
          status: string
          success_count: number
          total_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          config?: Json
          created_at?: string
          delay_seconds?: number
          error_count?: number
          id?: string
          processed_count?: number
          status?: string
          success_count?: number
          total_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          config?: Json
          created_at?: string
          delay_seconds?: number
          error_count?: number
          id?: string
          processed_count?: number
          status?: string
          success_count?: number
          total_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mission_actions: {
        Row: {
          action_label: string
          action_type: string
          completed_at: string | null
          created_at: string
          danger_level: string
          error_message: string | null
          id: string
          idempotency_key: string | null
          metadata: Json | null
          mission_id: string
          position: number
          recovery_log: Json | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_label?: string
          action_type?: string
          completed_at?: string | null
          created_at?: string
          danger_level?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          mission_id: string
          position?: number
          recovery_log?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_label?: string
          action_type?: string
          completed_at?: string | null
          created_at?: string
          danger_level?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          mission_id?: string
          position?: number
          recovery_log?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      network_configs: {
        Row: {
          created_at: string
          has_contact_emails: boolean
          has_contact_names: boolean
          has_contact_phones: boolean
          id: string
          is_member: boolean
          network_name: string
          notes: string | null
          sample_tested_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          has_contact_emails?: boolean
          has_contact_names?: boolean
          has_contact_phones?: boolean
          id?: string
          is_member?: boolean
          network_name: string
          notes?: string | null
          sample_tested_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          has_contact_emails?: boolean
          has_contact_names?: boolean
          has_contact_phones?: boolean
          id?: string
          is_member?: boolean
          network_name?: string
          notes?: string | null
          sample_tested_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      operative_prompts: {
        Row: {
          context: string
          created_at: string
          criteria: string
          examples: string
          id: string
          is_active: boolean
          name: string
          objective: string
          priority: number
          procedure: string
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          context?: string
          created_at?: string
          criteria?: string
          examples?: string
          id?: string
          is_active?: boolean
          name: string
          objective?: string
          priority?: number
          procedure?: string
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          context?: string
          created_at?: string
          criteria?: string
          examples?: string
          id?: string
          is_active?: boolean
          name?: string
          objective?: string
          priority?: number
          procedure?: string
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      operators: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          imap_host: string | null
          imap_password_encrypted: string | null
          imap_user: string | null
          invited_at: string | null
          invited_by: string | null
          is_active: boolean
          is_admin: boolean
          linkedin_profile_url: string | null
          name: string
          reply_to_email: string | null
          smtp_host: string | null
          smtp_password_encrypted: string | null
          smtp_port: number | null
          smtp_user: string | null
          updated_at: string
          user_id: string | null
          whatsapp_phone: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id?: string
          imap_host?: string | null
          imap_password_encrypted?: string | null
          imap_user?: string | null
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean
          is_admin?: boolean
          linkedin_profile_url?: string | null
          name: string
          reply_to_email?: string | null
          smtp_host?: string | null
          smtp_password_encrypted?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp_phone?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          imap_host?: string | null
          imap_password_encrypted?: string | null
          imap_user?: string | null
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean
          is_admin?: boolean
          linkedin_profile_url?: string | null
          name?: string
          reply_to_email?: string | null
          smtp_host?: string | null
          smtp_password_encrypted?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      outreach_missions: {
        Row: {
          agent_assignments: Json | null
          ai_summary: string | null
          channel: string
          completed_at: string | null
          created_at: string
          danger_level: string | null
          description: string | null
          id: string
          idempotency_key: string | null
          metadata: Json | null
          plan_json: Json | null
          plan_status: string | null
          processed_contacts: number
          schedule_config: Json | null
          status: string
          target_filters: Json
          title: string
          total_contacts: number
          user_id: string
          work_plan_id: string | null
        }
        Insert: {
          agent_assignments?: Json | null
          ai_summary?: string | null
          channel?: string
          completed_at?: string | null
          created_at?: string
          danger_level?: string | null
          description?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          plan_json?: Json | null
          plan_status?: string | null
          processed_contacts?: number
          schedule_config?: Json | null
          status?: string
          target_filters?: Json
          title: string
          total_contacts?: number
          user_id: string
          work_plan_id?: string | null
        }
        Update: {
          agent_assignments?: Json | null
          ai_summary?: string | null
          channel?: string
          completed_at?: string | null
          created_at?: string
          danger_level?: string | null
          description?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          plan_json?: Json | null
          plan_status?: string | null
          processed_contacts?: number
          schedule_config?: Json | null
          status?: string
          target_filters?: Json
          title?: string
          total_contacts?: number
          user_id?: string
          work_plan_id?: string | null
        }
        Relationships: []
      }
      outreach_queue: {
        Row: {
          attempts: number
          body: string
          channel: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          id: string
          last_error: string | null
          max_attempts: number
          partner_id: string | null
          priority: number
          processed_at: string | null
          recipient_email: string | null
          recipient_linkedin_url: string | null
          recipient_name: string | null
          recipient_phone: string | null
          status: string
          subject: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          body: string
          channel: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number
          partner_id?: string | null
          priority?: number
          processed_at?: string | null
          recipient_email?: string | null
          recipient_linkedin_url?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          status?: string
          subject?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          body?: string
          channel?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number
          partner_id?: string | null
          priority?: number
          processed_at?: string | null
          recipient_email?: string | null
          recipient_linkedin_url?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          status?: string
          subject?: string | null
          user_id?: string
        }
        Relationships: []
      }
      partner_certifications: {
        Row: {
          certification: Database["public"]["Enums"]["certification_type"]
          created_at: string | null
          id: string
          partner_id: string
          user_id: string | null
        }
        Insert: {
          certification: Database["public"]["Enums"]["certification_type"]
          created_at?: string | null
          id?: string
          partner_id: string
          user_id?: string | null
        }
        Update: {
          certification?: Database["public"]["Enums"]["certification_type"]
          created_at?: string | null
          id?: string
          partner_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_certifications_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_contacts: {
        Row: {
          contact_alias: string | null
          created_at: string | null
          direct_phone: string | null
          email: string | null
          id: string
          is_primary: boolean | null
          mobile: string | null
          name: string
          partner_id: string
          title: string | null
          user_id: string | null
        }
        Insert: {
          contact_alias?: string | null
          created_at?: string | null
          direct_phone?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          mobile?: string | null
          name: string
          partner_id: string
          title?: string | null
          user_id?: string | null
        }
        Update: {
          contact_alias?: string | null
          created_at?: string | null
          direct_phone?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          mobile?: string | null
          name?: string
          partner_id?: string
          title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_contacts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_networks: {
        Row: {
          created_at: string | null
          expires: string | null
          id: string
          network_id: string | null
          network_name: string
          partner_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires?: string | null
          id?: string
          network_id?: string | null
          network_name: string
          partner_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires?: string | null
          id?: string
          network_id?: string | null
          network_name?: string
          partner_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_networks_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_services: {
        Row: {
          created_at: string | null
          id: string
          partner_id: string
          service_category: Database["public"]["Enums"]["service_category"]
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          partner_id: string
          service_category: Database["public"]["Enums"]["service_category"]
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          partner_id?: string
          service_category?: Database["public"]["Enums"]["service_category"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_services_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_social_links: {
        Row: {
          contact_id: string | null
          created_at: string
          id: string
          partner_id: string
          platform: Database["public"]["Enums"]["social_platform"]
          url: string
          user_id: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          id?: string
          partner_id: string
          platform: Database["public"]["Enums"]["social_platform"]
          url: string
          user_id?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          id?: string
          partner_id?: string
          platform?: Database["public"]["Enums"]["social_platform"]
          url?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_social_links_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "partner_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_social_links_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_workflow_state: {
        Row: {
          completed_at: string | null
          contact_id: string | null
          created_at: string | null
          current_gate: number | null
          id: string
          notes: string | null
          partner_id: string | null
          started_at: string | null
          status: string | null
          updated_at: string | null
          user_id: string
          workflow_id: string
        }
        Insert: {
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          current_gate?: number | null
          id?: string
          notes?: string | null
          partner_id?: string | null
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          current_gate?: number | null
          id?: string
          notes?: string | null
          partner_id?: string | null
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_workflow_state_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_workflow_state_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "commercial_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          address: string | null
          ai_parsed_at: string | null
          branch_cities: Json | null
          city: string
          company_alias: string | null
          company_name: string
          converted_at: string | null
          country_code: string
          country_name: string
          created_at: string | null
          email: string | null
          emergency_phone: string | null
          enriched_at: string | null
          enrichment_data: Json | null
          fax: string | null
          has_branches: boolean | null
          id: string
          interaction_count: number
          is_active: boolean | null
          is_favorite: boolean | null
          last_interaction_at: string | null
          lead_status: string
          logo_url: string | null
          member_since: string | null
          membership_expires: string | null
          mobile: string | null
          office_type: Database["public"]["Enums"]["office_type"] | null
          partner_type: Database["public"]["Enums"]["partner_type"] | null
          phone: string | null
          profile_description: string | null
          rating: number | null
          rating_details: Json | null
          raw_profile_html: string | null
          raw_profile_markdown: string | null
          updated_at: string | null
          user_id: string | null
          wca_id: number | null
          website: string | null
        }
        Insert: {
          address?: string | null
          ai_parsed_at?: string | null
          branch_cities?: Json | null
          city: string
          company_alias?: string | null
          company_name: string
          converted_at?: string | null
          country_code: string
          country_name: string
          created_at?: string | null
          email?: string | null
          emergency_phone?: string | null
          enriched_at?: string | null
          enrichment_data?: Json | null
          fax?: string | null
          has_branches?: boolean | null
          id?: string
          interaction_count?: number
          is_active?: boolean | null
          is_favorite?: boolean | null
          last_interaction_at?: string | null
          lead_status?: string
          logo_url?: string | null
          member_since?: string | null
          membership_expires?: string | null
          mobile?: string | null
          office_type?: Database["public"]["Enums"]["office_type"] | null
          partner_type?: Database["public"]["Enums"]["partner_type"] | null
          phone?: string | null
          profile_description?: string | null
          rating?: number | null
          rating_details?: Json | null
          raw_profile_html?: string | null
          raw_profile_markdown?: string | null
          updated_at?: string | null
          user_id?: string | null
          wca_id?: number | null
          website?: string | null
        }
        Update: {
          address?: string | null
          ai_parsed_at?: string | null
          branch_cities?: Json | null
          city?: string
          company_alias?: string | null
          company_name?: string
          converted_at?: string | null
          country_code?: string
          country_name?: string
          created_at?: string | null
          email?: string | null
          emergency_phone?: string | null
          enriched_at?: string | null
          enrichment_data?: Json | null
          fax?: string | null
          has_branches?: boolean | null
          id?: string
          interaction_count?: number
          is_active?: boolean | null
          is_favorite?: boolean | null
          last_interaction_at?: string | null
          lead_status?: string
          logo_url?: string | null
          member_since?: string | null
          membership_expires?: string | null
          mobile?: string | null
          office_type?: Database["public"]["Enums"]["office_type"] | null
          partner_type?: Database["public"]["Enums"]["partner_type"] | null
          phone?: string | null
          profile_description?: string | null
          rating?: number | null
          rating_details?: Json | null
          raw_profile_html?: string | null
          raw_profile_markdown?: string | null
          updated_at?: string | null
          user_id?: string | null
          wca_id?: number | null
          website?: string | null
        }
        Relationships: []
      }
      partners_no_contacts: {
        Row: {
          city: string | null
          company_name: string
          country_code: string | null
          created_at: string
          id: string
          last_retry_at: string | null
          networks: Json | null
          partner_id: string | null
          resolved: boolean
          retry_count: number
          scraped_at: string
          wca_id: number
        }
        Insert: {
          city?: string | null
          company_name: string
          country_code?: string | null
          created_at?: string
          id?: string
          last_retry_at?: string | null
          networks?: Json | null
          partner_id?: string | null
          resolved?: boolean
          retry_count?: number
          scraped_at?: string
          wca_id: number
        }
        Update: {
          city?: string | null
          company_name?: string
          country_code?: string | null
          created_at?: string
          id?: string
          last_retry_at?: string | null
          networks?: Json | null
          partner_id?: string | null
          resolved?: boolean
          retry_count?: number
          scraped_at?: string
          wca_id?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          language: string
          onboarding_completed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          language?: string
          onboarding_completed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          language?: string
          onboarding_completed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prospect_contacts: {
        Row: {
          codice_fiscale: string | null
          created_at: string
          email: string | null
          id: string
          linkedin_url: string | null
          name: string
          phone: string | null
          prospect_id: string
          role: string | null
          user_id: string | null
        }
        Insert: {
          codice_fiscale?: string | null
          created_at?: string
          email?: string | null
          id?: string
          linkedin_url?: string | null
          name: string
          phone?: string | null
          prospect_id: string
          role?: string | null
          user_id?: string | null
        }
        Update: {
          codice_fiscale?: string | null
          created_at?: string
          email?: string | null
          id?: string
          linkedin_url?: string | null
          name?: string
          phone?: string | null
          prospect_id?: string
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_contacts_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_interactions: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          interaction_type: string
          outcome: string | null
          prospect_id: string
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          interaction_type: string
          outcome?: string | null
          prospect_id: string
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          interaction_type?: string
          outcome?: string | null
          prospect_id?: string
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_interactions_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_social_links: {
        Row: {
          contact_id: string | null
          created_at: string
          id: string
          platform: string
          prospect_id: string
          url: string
          user_id: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          id?: string
          platform: string
          prospect_id: string
          url: string
          user_id?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          id?: string
          platform?: string
          prospect_id?: string
          url?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_social_links_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "prospect_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_social_links_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          address: string | null
          anno_bilancio: number | null
          cap: string | null
          city: string | null
          codice_ateco: string | null
          codice_fiscale: string | null
          company_name: string
          converted_at: string | null
          created_at: string
          credit_score: number | null
          data_costituzione: string | null
          descrizione_ateco: string | null
          dipendenti: number | null
          email: string | null
          enrichment_data: Json | null
          fatturato: number | null
          forma_giuridica: string | null
          id: string
          interaction_count: number
          last_interaction_at: string | null
          lead_status: string
          partita_iva: string | null
          pec: string | null
          phone: string | null
          province: string | null
          rating_affidabilita: string | null
          raw_profile_html: string | null
          region: string | null
          source: string
          updated_at: string
          user_id: string | null
          utile: number | null
          website: string | null
        }
        Insert: {
          address?: string | null
          anno_bilancio?: number | null
          cap?: string | null
          city?: string | null
          codice_ateco?: string | null
          codice_fiscale?: string | null
          company_name: string
          converted_at?: string | null
          created_at?: string
          credit_score?: number | null
          data_costituzione?: string | null
          descrizione_ateco?: string | null
          dipendenti?: number | null
          email?: string | null
          enrichment_data?: Json | null
          fatturato?: number | null
          forma_giuridica?: string | null
          id?: string
          interaction_count?: number
          last_interaction_at?: string | null
          lead_status?: string
          partita_iva?: string | null
          pec?: string | null
          phone?: string | null
          province?: string | null
          rating_affidabilita?: string | null
          raw_profile_html?: string | null
          region?: string | null
          source?: string
          updated_at?: string
          user_id?: string | null
          utile?: number | null
          website?: string | null
        }
        Update: {
          address?: string | null
          anno_bilancio?: number | null
          cap?: string | null
          city?: string | null
          codice_ateco?: string | null
          codice_fiscale?: string | null
          company_name?: string
          converted_at?: string | null
          created_at?: string
          credit_score?: number | null
          data_costituzione?: string | null
          descrizione_ateco?: string | null
          dipendenti?: number | null
          email?: string | null
          enrichment_data?: Json | null
          fatturato?: number | null
          forma_giuridica?: string | null
          id?: string
          interaction_count?: number
          last_interaction_at?: string | null
          lead_status?: string
          partita_iva?: string | null
          pec?: string | null
          phone?: string | null
          province?: string | null
          rating_affidabilita?: string | null
          raw_profile_html?: string | null
          region?: string | null
          source?: string
          updated_at?: string
          user_id?: string | null
          utile?: number | null
          website?: string | null
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string | null
          description: string | null
          due_date: string
          id: string
          partner_id: string
          priority: Database["public"]["Enums"]["reminder_priority"] | null
          status: Database["public"]["Enums"]["reminder_status"] | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          due_date: string
          id?: string
          partner_id: string
          priority?: Database["public"]["Enums"]["reminder_priority"] | null
          status?: Database["public"]["Enums"]["reminder_status"] | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          due_date?: string
          id?: string
          partner_id?: string
          priority?: Database["public"]["Enums"]["reminder_priority"] | null
          status?: Database["public"]["Enums"]["reminder_status"] | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      request_logs: {
        Row: {
          channel: string | null
          created_at: string | null
          error_code: string | null
          error_message: string | null
          function_name: string
          http_status: number | null
          id: string
          latency_ms: number | null
          metadata: Json | null
          status: string | null
          trace_id: string | null
          user_id: string | null
        }
        Insert: {
          channel?: string | null
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          function_name: string
          http_status?: number | null
          id?: string
          latency_ms?: number | null
          metadata?: Json | null
          status?: string | null
          trace_id?: string | null
          user_id?: string | null
        }
        Update: {
          channel?: string | null
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          function_name?: string
          http_status?: number | null
          id?: string
          latency_ms?: number | null
          metadata?: Json | null
          status?: string | null
          trace_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      response_patterns: {
        Row: {
          avg_response_time_hours: number | null
          channel: string | null
          company_size: string | null
          country_code: string | null
          created_at: string | null
          cta_type: string | null
          email_type: string | null
          formality_level: string | null
          hook_strategy: string | null
          id: string
          language: string | null
          last_success_at: string | null
          pattern_confidence: number | null
          response_rate: number | null
          sector: string | null
          tags: string[] | null
          tone: string | null
          total_responses: number | null
          total_sent: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avg_response_time_hours?: number | null
          channel?: string | null
          company_size?: string | null
          country_code?: string | null
          created_at?: string | null
          cta_type?: string | null
          email_type?: string | null
          formality_level?: string | null
          hook_strategy?: string | null
          id?: string
          language?: string | null
          last_success_at?: string | null
          pattern_confidence?: number | null
          response_rate?: number | null
          sector?: string | null
          tags?: string[] | null
          tone?: string | null
          total_responses?: number | null
          total_sent?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avg_response_time_hours?: number | null
          channel?: string | null
          company_size?: string | null
          country_code?: string | null
          created_at?: string | null
          cta_type?: string | null
          email_type?: string | null
          formality_level?: string | null
          hook_strategy?: string | null
          id?: string
          language?: string | null
          last_success_at?: string | null
          pattern_confidence?: number | null
          response_rate?: number | null
          sector?: string | null
          tags?: string[] | null
          tone?: string | null
          total_responses?: number | null
          total_sent?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          role: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          role?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          role?: string | null
        }
        Relationships: []
      }
      user_api_keys: {
        Row: {
          api_key: string
          created_at: string
          id: string
          is_active: boolean
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          is_active?: boolean
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          is_active?: boolean
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          balance: number
          id: string
          total_consumed: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          id?: string
          total_consumed?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          id?: string
          total_consumed?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_wca_credentials: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string
          wca_password: string | null
          wca_username: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          wca_password?: string | null
          wca_username: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          wca_password?: string | null
          wca_username?: string
        }
        Relationships: []
      }
      voice_call_sessions: {
        Row: {
          agent_id: string | null
          caller_context: Json | null
          contact_id: string | null
          created_at: string | null
          direction: string | null
          ended_at: string | null
          external_call_id: string | null
          id: string
          outcome: string | null
          partner_id: string | null
          status: string | null
          transcript: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          caller_context?: Json | null
          contact_id?: string | null
          created_at?: string | null
          direction?: string | null
          ended_at?: string | null
          external_call_id?: string | null
          id?: string
          outcome?: string | null
          partner_id?: string | null
          status?: string | null
          transcript?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string | null
          caller_context?: Json | null
          contact_id?: string | null
          created_at?: string | null
          direction?: string | null
          ended_at?: string | null
          external_call_id?: string | null
          id?: string
          outcome?: string | null
          partner_id?: string | null
          status?: string | null
          transcript?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      workspace_documents: {
        Row: {
          created_at: string
          extracted_text: string | null
          file_name: string
          file_size: number
          file_url: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          file_name: string
          file_size?: number
          file_url: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          file_name?: string
          file_size?: number
          file_url?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      workspace_presets: {
        Row: {
          base_proposal: string | null
          created_at: string | null
          document_ids: Json | null
          goal: string | null
          id: string
          name: string
          reference_links: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          base_proposal?: string | null
          created_at?: string | null
          document_ids?: Json | null
          goal?: string | null
          id?: string
          name: string
          reference_links?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          base_proposal?: string | null
          created_at?: string | null
          document_ids?: Json | null
          goal?: string | null
          id?: string
          name?: string
          reference_links?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      ai_memory_pending_embedding: {
        Row: {
          content: string | null
          created_at: string | null
          id: string | null
          level: number | null
          memory_type: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string | null
          level?: number | null
          memory_type?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string | null
          level?: number | null
          memory_type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      decrypt_wca_password: { Args: { p_encrypted: string }; Returns: string }
      deduct_credits: {
        Args: {
          p_amount: number
          p_description?: string
          p_operation?: string
          p_user_id: string
        }
        Returns: {
          new_balance: number
          success: boolean
        }[]
      }
      encrypt_wca_password: { Args: { p_password: string }; Returns: string }
      get_contact_filter_options: {
        Args: never
        Returns: {
          filter_type: string
          filter_value: string
        }[]
      }
      get_contact_group_counts: {
        Args: never
        Returns: {
          contact_count: number
          group_key: string
          group_label: string
          group_type: string
          with_alias: number
          with_deep_search: number
          with_email: number
          with_phone: number
        }[]
      }
      get_country_stats: {
        Args: never
        Returns: {
          branch_count: number
          country_code: string
          hq_count: number
          total_partners: number
          with_both: number
          with_company_alias: number
          with_contact_alias: number
          with_deep_search: number
          with_email: number
          with_phone: number
          with_profile: number
          without_profile: number
        }[]
      }
      get_directory_counts: {
        Args: never
        Returns: {
          country_code: string
          is_verified: boolean
          member_count: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_agent_stat: {
        Args: { p_agent_id: string; p_stat_key: string }
        Returns: undefined
      }
      increment_contact_interaction: {
        Args: { p_contact_id: string }
        Returns: undefined
      }
      increment_kb_access: { Args: { entry_ids: string[] }; Returns: undefined }
      increment_memory_access: {
        Args: { memory_ids: string[] }
        Returns: undefined
      }
      increment_partner_interaction: {
        Args: { p_partner_id: string }
        Returns: undefined
      }
      is_email_authorized: { Args: { p_email: string }; Returns: boolean }
      is_operator_admin: { Args: never; Returns: boolean }
      link_response_to_activity: {
        Args: {
          p_activity_id: string
          p_channel_message_id: string
          p_response_time_hours?: number
        }
        Returns: boolean
      }
      match_ai_memory_enhanced: {
        Args: {
          filter_levels?: number[]
          filter_types?: string[]
          filter_user_id?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          confidence: number
          content: string
          id: string
          importance: number
          level: number
          memory_type: string
          similarity: number
          tags: string[]
        }[]
      }
      match_contacts_to_wca: {
        Args: never
        Returns: {
          matched_count: number
          total_processed: number
        }[]
      }
      match_kb_entries: {
        Args: {
          filter_categories?: string[]
          filter_min_priority?: number
          match_count?: number
          match_threshold?: number
          only_active?: boolean
          query_embedding: string
        }
        Returns: {
          category: string
          chapter: string
          content: string
          id: string
          priority: number
          similarity: number
          tags: string[]
          title: string
        }[]
      }
      record_user_login: { Args: { p_email: string }; Returns: undefined }
    }
    Enums: {
      activity_status: "pending" | "in_progress" | "completed" | "cancelled"
      activity_type:
        | "send_email"
        | "phone_call"
        | "add_to_campaign"
        | "meeting"
        | "follow_up"
        | "other"
        | "whatsapp_message"
        | "linkedin_message"
      app_role: "admin" | "moderator" | "user"
      campaign_job_status: "pending" | "in_progress" | "completed" | "skipped"
      campaign_job_type: "email" | "call"
      certification_type: "IATA" | "BASC" | "ISO" | "C-TPAT" | "AEO"
      download_queue_status: "pending" | "in_progress" | "completed" | "paused"
      interaction_type: "call" | "email" | "meeting" | "note"
      office_type: "head_office" | "branch"
      partner_type:
        | "freight_forwarder"
        | "customs_broker"
        | "carrier"
        | "nvocc"
        | "3pl"
        | "courier"
      reminder_priority: "low" | "medium" | "high"
      reminder_status: "pending" | "completed"
      service_category:
        | "air_freight"
        | "ocean_fcl"
        | "ocean_lcl"
        | "road_freight"
        | "rail_freight"
        | "project_cargo"
        | "dangerous_goods"
        | "perishables"
        | "pharma"
        | "ecommerce"
        | "relocations"
        | "customs_broker"
        | "warehousing"
        | "nvocc"
      social_platform:
        | "linkedin"
        | "facebook"
        | "instagram"
        | "twitter"
        | "whatsapp"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_status: ["pending", "in_progress", "completed", "cancelled"],
      activity_type: [
        "send_email",
        "phone_call",
        "add_to_campaign",
        "meeting",
        "follow_up",
        "other",
        "whatsapp_message",
        "linkedin_message",
      ],
      app_role: ["admin", "moderator", "user"],
      campaign_job_status: ["pending", "in_progress", "completed", "skipped"],
      campaign_job_type: ["email", "call"],
      certification_type: ["IATA", "BASC", "ISO", "C-TPAT", "AEO"],
      download_queue_status: ["pending", "in_progress", "completed", "paused"],
      interaction_type: ["call", "email", "meeting", "note"],
      office_type: ["head_office", "branch"],
      partner_type: [
        "freight_forwarder",
        "customs_broker",
        "carrier",
        "nvocc",
        "3pl",
        "courier",
      ],
      reminder_priority: ["low", "medium", "high"],
      reminder_status: ["pending", "completed"],
      service_category: [
        "air_freight",
        "ocean_fcl",
        "ocean_lcl",
        "road_freight",
        "rail_freight",
        "project_cargo",
        "dangerous_goods",
        "perishables",
        "pharma",
        "ecommerce",
        "relocations",
        "customs_broker",
        "warehousing",
        "nvocc",
      ],
      social_platform: [
        "linkedin",
        "facebook",
        "instagram",
        "twitter",
        "whatsapp",
      ],
    },
  },
} as const
