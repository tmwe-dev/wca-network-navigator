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
      ab_tests: {
        Row: {
          completed_at: string | null
          confidence_level: number | null
          created_at: string | null
          id: string
          open_rate_a: number | null
          open_rate_b: number | null
          operator_id: string | null
          responses_a: number | null
          responses_b: number | null
          started_at: string | null
          status: string
          test_name: string
          test_type: string
          total_sent_a: number | null
          total_sent_b: number | null
          user_id: string
          variant_a: Json
          variant_b: Json
          winner: string | null
        }
        Insert: {
          completed_at?: string | null
          confidence_level?: number | null
          created_at?: string | null
          id?: string
          open_rate_a?: number | null
          open_rate_b?: number | null
          operator_id?: string | null
          responses_a?: number | null
          responses_b?: number | null
          started_at?: string | null
          status?: string
          test_name: string
          test_type?: string
          total_sent_a?: number | null
          total_sent_b?: number | null
          user_id: string
          variant_a?: Json
          variant_b?: Json
          winner?: string | null
        }
        Update: {
          completed_at?: string | null
          confidence_level?: number | null
          created_at?: string | null
          id?: string
          open_rate_a?: number | null
          open_rate_b?: number | null
          operator_id?: string | null
          responses_a?: number | null
          responses_b?: number | null
          started_at?: string | null
          status?: string
          test_name?: string
          test_type?: string
          total_sent_a?: number | null
          total_sent_b?: number | null
          user_id?: string
          variant_a?: Json
          variant_b?: Json
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ab_tests_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          ab_test_id: string | null
          ab_variant: string | null
          activity_type: Database["public"]["Enums"]["activity_type"]
          assigned_to: string | null
          campaign_batch_id: string | null
          completed_at: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          due_date: string | null
          email_body: string | null
          email_subject: string | null
          executed_by_agent_id: string | null
          id: string
          message_id_external: string | null
          operator_id: string | null
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
          ab_test_id?: string | null
          ab_variant?: string | null
          activity_type: Database["public"]["Enums"]["activity_type"]
          assigned_to?: string | null
          campaign_batch_id?: string | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          due_date?: string | null
          email_body?: string | null
          email_subject?: string | null
          executed_by_agent_id?: string | null
          id?: string
          message_id_external?: string | null
          operator_id?: string | null
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
          ab_test_id?: string | null
          ab_variant?: string | null
          activity_type?: Database["public"]["Enums"]["activity_type"]
          assigned_to?: string | null
          campaign_batch_id?: string | null
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          due_date?: string | null
          email_body?: string | null
          email_subject?: string | null
          executed_by_agent_id?: string | null
          id?: string
          message_id_external?: string | null
          operator_id?: string | null
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
            foreignKeyName: "activities_ab_test_id_fkey"
            columns: ["ab_test_id"]
            isOneToOne: false
            referencedRelation: "ab_tests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
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
            foreignKeyName: "activities_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "vw_partner_quality_scores"
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
      agent_action_log: {
        Row: {
          args: Json
          conversation_id: string | null
          created_at: string
          id: string
          operator_id: string | null
          result: Json
          tool_name: string
          user_id: string
        }
        Insert: {
          args?: Json
          conversation_id?: string | null
          created_at?: string
          id?: string
          operator_id?: string | null
          result?: Json
          tool_name: string
          user_id: string
        }
        Update: {
          args?: Json
          conversation_id?: string | null
          created_at?: string
          id?: string
          operator_id?: string | null
          result?: Json
          tool_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_action_log_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_knowledge_links: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          kb_entry_id: string
          operator_id: string | null
          priority: number
          user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          kb_entry_id: string
          operator_id?: string | null
          priority?: number
          user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          kb_entry_id?: string
          operator_id?: string | null
          priority?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_knowledge_links_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_knowledge_links_kb_entry_id_fkey"
            columns: ["kb_entry_id"]
            isOneToOne: false
            referencedRelation: "kb_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_knowledge_links_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_mission_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          mission_id: string
          payload: Json
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          mission_id: string
          payload?: Json
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          mission_id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "agent_mission_events_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "agent_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_missions: {
        Row: {
          agent_id: string
          approval_only_for: string[]
          autopilot: boolean
          budget: Json
          budget_consumed: Json
          completed_at: string | null
          created_at: string
          goal_description: string | null
          goal_type: string
          id: string
          kpi_current: Json
          kpi_target: Json
          owner_user_id: string
          started_at: string | null
          status: string
          title: string
        }
        Insert: {
          agent_id: string
          approval_only_for?: string[]
          autopilot?: boolean
          budget?: Json
          budget_consumed?: Json
          completed_at?: string | null
          created_at?: string
          goal_description?: string | null
          goal_type?: string
          id?: string
          kpi_current?: Json
          kpi_target?: Json
          owner_user_id: string
          started_at?: string | null
          status?: string
          title: string
        }
        Update: {
          agent_id?: string
          approval_only_for?: string[]
          autopilot?: boolean
          budget?: Json
          budget_consumed?: Json
          completed_at?: string | null
          created_at?: string
          goal_description?: string | null
          goal_type?: string
          id?: string
          kpi_current?: Json
          kpi_target?: Json
          owner_user_id?: string
          started_at?: string | null
          status?: string
          title?: string
        }
        Relationships: []
      }
      agent_personas: {
        Row: {
          agent_id: string
          created_at: string
          custom_tone_prompt: string | null
          example_messages: Json | null
          id: string
          kb_filter: Json | null
          language: string
          operator_id: string | null
          signature_template: string | null
          style_rules: string[] | null
          tone: string
          updated_at: string
          user_id: string
          vocabulary_do: string[] | null
          vocabulary_dont: string[] | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          custom_tone_prompt?: string | null
          example_messages?: Json | null
          id?: string
          kb_filter?: Json | null
          language?: string
          operator_id?: string | null
          signature_template?: string | null
          style_rules?: string[] | null
          tone?: string
          updated_at?: string
          user_id: string
          vocabulary_do?: string[] | null
          vocabulary_dont?: string[] | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          custom_tone_prompt?: string | null
          example_messages?: Json | null
          id?: string
          kb_filter?: Json | null
          language?: string
          operator_id?: string | null
          signature_template?: string | null
          style_rules?: string[] | null
          tone?: string
          updated_at?: string
          user_id?: string
          vocabulary_do?: string[] | null
          vocabulary_dont?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_personas_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_personas_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
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
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
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
          {
            foreignKeyName: "agent_tasks_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          assigned_tools: Json
          assigned_tutor_id: string | null
          avatar_emoji: string
          can_access_inbox: boolean | null
          can_send_email: boolean | null
          can_send_whatsapp: boolean | null
          created_at: string
          daily_send_limit: number | null
          deleted_at: string | null
          deleted_by: string | null
          elevenlabs_agent_id: string | null
          elevenlabs_voice_id: string | null
          id: string
          is_active: boolean
          knowledge_base: Json
          name: string
          operator_id: string | null
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
          assigned_tutor_id?: string | null
          avatar_emoji?: string
          can_access_inbox?: boolean | null
          can_send_email?: boolean | null
          can_send_whatsapp?: boolean | null
          created_at?: string
          daily_send_limit?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          elevenlabs_agent_id?: string | null
          elevenlabs_voice_id?: string | null
          id?: string
          is_active?: boolean
          knowledge_base?: Json
          name: string
          operator_id?: string | null
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
          assigned_tutor_id?: string | null
          avatar_emoji?: string
          can_access_inbox?: boolean | null
          can_send_email?: boolean | null
          can_send_whatsapp?: boolean | null
          created_at?: string
          daily_send_limit?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          elevenlabs_agent_id?: string | null
          elevenlabs_voice_id?: string | null
          id?: string
          is_active?: boolean
          knowledge_base?: Json
          name?: string
          operator_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "agents_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          messages: Json
          operator_id: string | null
          page_context: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          operator_id?: string | null
          page_context?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          operator_id?: string | null
          page_context?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_daily_plans: {
        Row: {
          completed: Json
          created_at: string | null
          id: string
          notes: string | null
          objectives: Json
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
          plan_date?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_daily_plans_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_decision_log: {
        Row: {
          ai_reasoning: string | null
          confidence: number | null
          contact_id: string | null
          created_at: string | null
          decision_output: Json | null
          decision_type: string
          email_address: string | null
          execution_time_ms: number | null
          id: string
          input_context: Json | null
          model_used: string | null
          operator_id: string | null
          partner_id: string | null
          tokens_used: number | null
          user_correction: string | null
          user_id: string
          user_review: string | null
          was_auto_executed: boolean | null
        }
        Insert: {
          ai_reasoning?: string | null
          confidence?: number | null
          contact_id?: string | null
          created_at?: string | null
          decision_output?: Json | null
          decision_type: string
          email_address?: string | null
          execution_time_ms?: number | null
          id?: string
          input_context?: Json | null
          model_used?: string | null
          operator_id?: string | null
          partner_id?: string | null
          tokens_used?: number | null
          user_correction?: string | null
          user_id: string
          user_review?: string | null
          was_auto_executed?: boolean | null
        }
        Update: {
          ai_reasoning?: string | null
          confidence?: number | null
          contact_id?: string | null
          created_at?: string | null
          decision_output?: Json | null
          decision_type?: string
          email_address?: string | null
          execution_time_ms?: number | null
          id?: string
          input_context?: Json | null
          model_used?: string | null
          operator_id?: string | null
          partner_id?: string | null
          tokens_used?: number | null
          user_correction?: string | null
          user_id?: string
          user_review?: string | null
          was_auto_executed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_decision_log_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_decision_log_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_decision_log_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "vw_partner_quality_scores"
            referencedColumns: ["id"]
          },
        ]
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
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
          persuasion_pattern?: string | null
          significance?: string | null
          tone_delta?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_edit_patterns_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_lab_test_results: {
        Row: {
          created_at: string
          debug_info: Json | null
          duration_ms: number
          endpoint: string
          id: string
          issues: Json | null
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
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
            foreignKeyName: "ai_lab_test_results_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
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
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
          pass_count?: number
          started_at?: string
          summary?: Json | null
          total_score?: number
          user_id?: string
          warn_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_lab_test_runs_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_memory: {
        Row: {
          access_count: number
          confidence: number
          content: string
          context_page: string | null
          created_at: string
          decay_rate: number
          deleted_at: string | null
          deleted_by: string | null
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
          operator_id: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
          operator_id?: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
          operator_id?: string | null
          pending_promotion?: boolean
          promoted_at?: string | null
          source?: string
          tags?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_memory_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_pending_actions: {
        Row: {
          action_payload: Json | null
          action_type: string
          autonomy_level: string | null
          confidence: number | null
          contact_id: string | null
          created_at: string | null
          decision_log_id: string | null
          email_address: string | null
          execute_after: string | null
          executed_at: string | null
          expires_at: string | null
          id: string
          operator_id: string | null
          partner_id: string | null
          priority: number | null
          reasoning: string | null
          source: string | null
          status: string | null
          suggested_content: string | null
          user_id: string
        }
        Insert: {
          action_payload?: Json | null
          action_type: string
          autonomy_level?: string | null
          confidence?: number | null
          contact_id?: string | null
          created_at?: string | null
          decision_log_id?: string | null
          email_address?: string | null
          execute_after?: string | null
          executed_at?: string | null
          expires_at?: string | null
          id?: string
          operator_id?: string | null
          partner_id?: string | null
          priority?: number | null
          reasoning?: string | null
          source?: string | null
          status?: string | null
          suggested_content?: string | null
          user_id: string
        }
        Update: {
          action_payload?: Json | null
          action_type?: string
          autonomy_level?: string | null
          confidence?: number | null
          contact_id?: string | null
          created_at?: string | null
          decision_log_id?: string | null
          email_address?: string | null
          execute_after?: string | null
          executed_at?: string | null
          expires_at?: string | null
          id?: string
          operator_id?: string | null
          partner_id?: string | null
          priority?: number | null
          reasoning?: string | null
          source?: string | null
          status?: string | null
          suggested_content?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_pending_actions_decision_log_id_fkey"
            columns: ["decision_log_id"]
            isOneToOne: false
            referencedRelation: "ai_decision_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_pending_actions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_pending_actions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_pending_actions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "vw_partner_quality_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_plan_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          last_used_at: string | null
          name: string
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
          steps_template?: Json
          tags?: string[] | null
          use_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_plan_templates_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
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
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
          routed_to?: string | null
          status?: string | null
          total_tokens?: number | null
          trace_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_request_log_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
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
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_session_briefings_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_token_usage: {
        Row: {
          cost_estimate: number | null
          created_at: string | null
          function_name: string
          id: string
          input_tokens: number | null
          model: string | null
          output_tokens: number | null
          total_tokens: number | null
          user_id: string
        }
        Insert: {
          cost_estimate?: number | null
          created_at?: string | null
          function_name: string
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          total_tokens?: number | null
          user_id: string
        }
        Update: {
          cost_estimate?: number | null
          created_at?: string | null
          function_name?: string
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          total_tokens?: number | null
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
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
          source_template_id?: string | null
          status?: string
          steps?: Json
          tags?: string[] | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_work_plans_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_config: {
        Row: {
          alert_on_degraded: boolean | null
          alert_on_error_rate: number | null
          cooldown_minutes: number | null
          created_at: string | null
          email_alert: string | null
          enabled: boolean | null
          id: string
          last_alert_at: string | null
          operator_id: string | null
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          alert_on_degraded?: boolean | null
          alert_on_error_rate?: number | null
          cooldown_minutes?: number | null
          created_at?: string | null
          email_alert?: string | null
          enabled?: boolean | null
          id?: string
          last_alert_at?: string | null
          operator_id?: string | null
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          alert_on_degraded?: boolean | null
          alert_on_error_rate?: number | null
          cooldown_minutes?: number | null
          created_at?: string | null
          email_alert?: string | null
          enabled?: boolean | null
          id?: string
          last_alert_at?: string | null
          operator_id?: string | null
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_config_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      app_error_logs: {
        Row: {
          component_stack: string | null
          created_at: string | null
          edge_function_name: string | null
          error_message: string | null
          error_stack: string | null
          error_type: string
          http_status: number | null
          id: string
          metadata: Json | null
          operator_id: string | null
          page_url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          component_stack?: string | null
          created_at?: string | null
          edge_function_name?: string | null
          error_message?: string | null
          error_stack?: string | null
          error_type: string
          http_status?: number | null
          id?: string
          metadata?: Json | null
          operator_id?: string | null
          page_url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          component_stack?: string | null
          created_at?: string | null
          edge_function_name?: string | null
          error_message?: string | null
          error_stack?: string | null
          error_type?: string
          http_status?: number | null
          id?: string
          metadata?: Json | null
          operator_id?: string | null
          page_url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_error_logs_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          operator_id: string | null
          updated_at: string
          user_id: string | null
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          operator_id?: string | null
          updated_at?: string
          user_id?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          operator_id?: string | null
          updated_at?: string
          user_id?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
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
      blacklist: {
        Row: {
          created_at: string
          domain: string | null
          email: string | null
          id: string
          reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          domain?: string | null
          email?: string | null
          id?: string
          reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          domain?: string | null
          email?: string | null
          id?: string
          reason?: string | null
          updated_at?: string
          user_id?: string
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
          {
            foreignKeyName: "blacklist_entries_matched_partner_id_fkey"
            columns: ["matched_partner_id"]
            isOneToOne: false
            referencedRelation: "vw_partner_quality_scores"
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
      block_versions: {
        Row: {
          block_id: string
          changed_by: string | null
          changed_by_label: string | null
          communication_context: Json | null
          content: string
          created_at: string | null
          id: string
          previous_content: string | null
          run_id: string | null
          source_field: string | null
          source_kind: string
          source_table: string
          version_num: number
        }
        Insert: {
          block_id: string
          changed_by?: string | null
          changed_by_label?: string | null
          communication_context?: Json | null
          content: string
          created_at?: string | null
          id?: string
          previous_content?: string | null
          run_id?: string | null
          source_field?: string | null
          source_kind: string
          source_table: string
          version_num: number
        }
        Update: {
          block_id?: string
          changed_by?: string | null
          changed_by_label?: string | null
          communication_context?: Json | null
          content?: string
          created_at?: string | null
          id?: string
          previous_content?: string | null
          run_id?: string | null
          source_field?: string | null
          source_kind?: string
          source_table?: string
          version_num?: number
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
      browser_action_log: {
        Row: {
          actions: Json
          created_at: string
          id: string
          operator_id: string | null
          result: Json | null
          status: string
          target_url: string | null
          user_id: string
        }
        Insert: {
          actions?: Json
          created_at?: string
          id?: string
          operator_id?: string | null
          result?: Json | null
          status?: string
          target_url?: string | null
          user_id: string
        }
        Update: {
          actions?: Json
          created_at?: string
          id?: string
          operator_id?: string | null
          result?: Json | null
          status?: string
          target_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "browser_action_log_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      business_cards: {
        Row: {
          company_name: string | null
          contact_name: string | null
          correction_notes: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          event_name: string | null
          id: string
          lead_status: string
          location: string | null
          manually_corrected: boolean | null
          match_confidence: number | null
          match_status: string
          matched_contact_id: string | null
          matched_partner_id: string | null
          met_at: string | null
          mobile: string | null
          notes: string | null
          ocr_confidence: Json | null
          operator_id: string | null
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
          correction_notes?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          event_name?: string | null
          id?: string
          lead_status?: string
          location?: string | null
          manually_corrected?: boolean | null
          match_confidence?: number | null
          match_status?: string
          matched_contact_id?: string | null
          matched_partner_id?: string | null
          met_at?: string | null
          mobile?: string | null
          notes?: string | null
          ocr_confidence?: Json | null
          operator_id?: string | null
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
          correction_notes?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          event_name?: string | null
          id?: string
          lead_status?: string
          location?: string | null
          manually_corrected?: boolean | null
          match_confidence?: number | null
          match_status?: string
          matched_contact_id?: string | null
          matched_partner_id?: string | null
          met_at?: string | null
          mobile?: string | null
          notes?: string | null
          ocr_confidence?: Json | null
          operator_id?: string | null
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
          {
            foreignKeyName: "business_cards_matched_partner_id_fkey"
            columns: ["matched_partner_id"]
            isOneToOne: false
            referencedRelation: "vw_partner_quality_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_cards_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean | null
          color: string | null
          contact_id: string | null
          created_at: string | null
          deal_id: string | null
          description: string | null
          end_at: string | null
          event_type: string
          id: string
          location: string | null
          metadata: Json | null
          partner_id: string | null
          recurrence: string | null
          reminder_minutes: number | null
          start_at: string
          status: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          all_day?: boolean | null
          color?: string | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          description?: string | null
          end_at?: string | null
          event_type?: string
          id?: string
          location?: string | null
          metadata?: Json | null
          partner_id?: string | null
          recurrence?: string | null
          reminder_minutes?: number | null
          start_at: string
          status?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          all_day?: boolean | null
          color?: string | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          description?: string | null
          end_at?: string | null
          event_type?: string
          id?: string
          location?: string | null
          metadata?: Json | null
          partner_id?: string | null
          recurrence?: string | null
          reminder_minutes?: number | null
          start_at?: string
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "imported_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "vw_partner_quality_scores"
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
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
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
          {
            foreignKeyName: "campaign_jobs_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_backfill_state: {
        Row: {
          channel: string
          chat_display_name: string | null
          created_at: string
          external_chat_id: string
          id: string
          last_attempt_at: string | null
          last_attempt_status: string | null
          last_error: string | null
          messages_imported: number
          newest_message_at: string | null
          newest_message_external_id: string | null
          oldest_message_at: string | null
          oldest_message_external_id: string | null
          operator_id: string
          reached_beginning: boolean
          updated_at: string
        }
        Insert: {
          channel: string
          chat_display_name?: string | null
          created_at?: string
          external_chat_id: string
          id?: string
          last_attempt_at?: string | null
          last_attempt_status?: string | null
          last_error?: string | null
          messages_imported?: number
          newest_message_at?: string | null
          newest_message_external_id?: string | null
          oldest_message_at?: string | null
          oldest_message_external_id?: string | null
          operator_id: string
          reached_beginning?: boolean
          updated_at?: string
        }
        Update: {
          channel?: string
          chat_display_name?: string | null
          created_at?: string
          external_chat_id?: string
          id?: string
          last_attempt_at?: string | null
          last_attempt_status?: string | null
          last_error?: string | null
          messages_imported?: number
          newest_message_at?: string | null
          newest_message_external_id?: string | null
          oldest_message_at?: string | null
          oldest_message_external_id?: string | null
          operator_id?: string
          reached_beginning?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_backfill_state_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
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
          deleted_at: string | null
          deleted_by: string | null
          direction: string
          email_date: string | null
          folder: string | null
          from_address: string | null
          hidden_by_rule: boolean | null
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
          deleted_at?: string | null
          deleted_by?: string | null
          direction: string
          email_date?: string | null
          folder?: string | null
          from_address?: string | null
          hidden_by_rule?: boolean | null
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
          deleted_at?: string | null
          deleted_by?: string | null
          direction?: string
          email_date?: string | null
          folder?: string | null
          from_address?: string | null
          hidden_by_rule?: boolean | null
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
          operator_id: string | null
          source_id: string
          source_type: string
          user_id: string
        }
        Insert: {
          agent_id: string
          assigned_at?: string
          id?: string
          manager_id?: string | null
          operator_id?: string | null
          source_id: string
          source_type?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          assigned_at?: string
          id?: string
          manager_id?: string | null
          operator_id?: string | null
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
          {
            foreignKeyName: "client_assignments_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      cockpit_queue: {
        Row: {
          created_at: string
          id: string
          operator_id: string | null
          partner_id: string | null
          source_id: string
          source_type: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          operator_id?: string | null
          partner_id?: string | null
          source_id: string
          source_type: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          operator_id?: string | null
          partner_id?: string | null
          source_id?: string
          source_type?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cockpit_queue_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      command_conversations: {
        Row: {
          archived: boolean
          id: string
          last_message_at: string
          operator_id: string | null
          started_at: string
          title: string | null
          user_id: string
        }
        Insert: {
          archived?: boolean
          id?: string
          last_message_at?: string
          operator_id?: string | null
          started_at?: string
          title?: string | null
          user_id: string
        }
        Update: {
          archived?: boolean
          id?: string
          last_message_at?: string
          operator_id?: string | null
          started_at?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "command_conversations_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      command_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          tool_id: string | null
          tool_result: Json | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          tool_id?: string | null
          tool_result?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          tool_id?: string | null
          tool_result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "command_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "command_conversations"
            referencedColumns: ["id"]
          },
        ]
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
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
          priority?: number | null
          prompt_template?: string | null
          suggested_actions?: Json | null
          trigger_conditions?: Json | null
          updated_at?: string | null
          user_id?: string
          workflow_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_playbooks_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
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
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_workflows_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_conversation_context: {
        Row: {
          avg_response_time_hours: number | null
          contact_id: string | null
          conversation_summary: string | null
          created_at: string | null
          dominant_sentiment: string | null
          email_address: string
          id: string
          interaction_count: number | null
          last_exchanges: Json | null
          last_interaction_at: string | null
          operator_id: string | null
          partner_id: string | null
          preferred_language: string | null
          response_rate: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avg_response_time_hours?: number | null
          contact_id?: string | null
          conversation_summary?: string | null
          created_at?: string | null
          dominant_sentiment?: string | null
          email_address: string
          id?: string
          interaction_count?: number | null
          last_exchanges?: Json | null
          last_interaction_at?: string | null
          operator_id?: string | null
          partner_id?: string | null
          preferred_language?: string | null
          response_rate?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avg_response_time_hours?: number | null
          contact_id?: string | null
          conversation_summary?: string | null
          created_at?: string | null
          dominant_sentiment?: string | null
          email_address?: string
          id?: string
          interaction_count?: number | null
          last_exchanges?: Json | null
          last_interaction_at?: string | null
          operator_id?: string | null
          partner_id?: string | null
          preferred_language?: string | null
          response_rate?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_conversation_context_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_conversation_context_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_conversation_context_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "vw_partner_quality_scores"
            referencedColumns: ["id"]
          },
        ]
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
          input_tokens: number | null
          operation: string
          operator_id: string | null
          output_tokens: number | null
          provider: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          input_tokens?: number | null
          operation: string
          operator_id?: string | null
          output_tokens?: number | null
          provider?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          input_tokens?: number | null
          operation?: string
          operator_id?: string | null
          output_tokens?: number | null
          provider?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_runs: {
        Row: {
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          job_name: string
          result: string | null
          started_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          job_name: string
          result?: string | null
          started_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          job_name?: string
          result?: string | null
          started_at?: string
        }
        Relationships: []
      }
      deal_activities: {
        Row: {
          activity_type: string
          created_at: string | null
          deal_id: string
          description: string | null
          id: string
          new_value: string | null
          old_value: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          deal_id: string
          description?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          deal_id?: string
          description?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          actual_close_date: string | null
          amount: number | null
          contact_id: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          expected_close_date: string | null
          id: string
          lost_reason: string | null
          metadata: Json | null
          partner_id: string | null
          probability: number | null
          stage: string
          tags: string[] | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          actual_close_date?: string | null
          amount?: number | null
          contact_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          expected_close_date?: string | null
          id?: string
          lost_reason?: string | null
          metadata?: Json | null
          partner_id?: string | null
          probability?: number | null
          stage?: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          actual_close_date?: string | null
          amount?: number | null
          contact_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          expected_close_date?: string | null
          id?: string
          lost_reason?: string | null
          metadata?: Json | null
          partner_id?: string | null
          probability?: number | null
          stage?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "imported_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "vw_partner_quality_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      directory_cache: {
        Row: {
          country_code: string
          download_verified: boolean
          id: string
          members: Json
          network_name: string
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
          scanned_at?: string
          total_pages?: number
          total_results?: number
          updated_at?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "directory_cache_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
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
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
          processed_ids?: Json
          status?: string
          terminal_log?: Json
          total_count?: number
          updated_at?: string
          user_id?: string | null
          wca_ids?: Json
        }
        Relationships: [
          {
            foreignKeyName: "download_jobs_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
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
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
          priority?: number
          status?: Database["public"]["Enums"]["download_queue_status"]
          total_found?: number
          total_processed?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "download_queue_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_function_logs: {
        Row: {
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          function_name: string
          id: string
          metadata: Json | null
          operator_id: string | null
          status_code: number
          success: boolean
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          function_name: string
          id?: string
          metadata?: Json | null
          operator_id?: string | null
          status_code: number
          success?: boolean
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          function_name?: string
          id?: string
          metadata?: Json | null
          operator_id?: string | null
          status_code?: number
          success?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edge_function_logs_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      email_address_rules: {
        Row: {
          address: string | null
          ai_confidence_threshold: number | null
          ai_suggested_group: string | null
          ai_suggestion_accepted: boolean | null
          ai_suggestion_confidence: number | null
          applied_count: number | null
          applied_rules: Json | null
          auto_action: string | null
          auto_action_params: Json | null
          auto_execute: boolean | null
          category: string | null
          company_name: string | null
          created_at: string
          custom_prompt: string | null
          deleted_at: string | null
          deleted_by: string | null
          display_name: string | null
          domain: string | null
          domain_pattern: string | null
          domain_type: string | null
          email_address: string
          email_count: number | null
          exclusive_agent_id: string | null
          group_color: string | null
          group_description: string | null
          group_icon: string | null
          group_id: string | null
          group_name: string | null
          id: string
          interaction_count: number | null
          is_active: boolean | null
          last_applied_at: string | null
          last_email_at: string | null
          last_interaction_at: string | null
          notes: string | null
          operator_id: string | null
          preferred_channel: string | null
          priority: number | null
          prompt_id: string | null
          prompt_template_id: string | null
          success_rate: number | null
          tone_override: string | null
          topics_to_avoid: string[] | null
          topics_to_emphasize: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          ai_confidence_threshold?: number | null
          ai_suggested_group?: string | null
          ai_suggestion_accepted?: boolean | null
          ai_suggestion_confidence?: number | null
          applied_count?: number | null
          applied_rules?: Json | null
          auto_action?: string | null
          auto_action_params?: Json | null
          auto_execute?: boolean | null
          category?: string | null
          company_name?: string | null
          created_at?: string
          custom_prompt?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          display_name?: string | null
          domain?: string | null
          domain_pattern?: string | null
          domain_type?: string | null
          email_address: string
          email_count?: number | null
          exclusive_agent_id?: string | null
          group_color?: string | null
          group_description?: string | null
          group_icon?: string | null
          group_id?: string | null
          group_name?: string | null
          id?: string
          interaction_count?: number | null
          is_active?: boolean | null
          last_applied_at?: string | null
          last_email_at?: string | null
          last_interaction_at?: string | null
          notes?: string | null
          operator_id?: string | null
          preferred_channel?: string | null
          priority?: number | null
          prompt_id?: string | null
          prompt_template_id?: string | null
          success_rate?: number | null
          tone_override?: string | null
          topics_to_avoid?: string[] | null
          topics_to_emphasize?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          ai_confidence_threshold?: number | null
          ai_suggested_group?: string | null
          ai_suggestion_accepted?: boolean | null
          ai_suggestion_confidence?: number | null
          applied_count?: number | null
          applied_rules?: Json | null
          auto_action?: string | null
          auto_action_params?: Json | null
          auto_execute?: boolean | null
          category?: string | null
          company_name?: string | null
          created_at?: string
          custom_prompt?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          display_name?: string | null
          domain?: string | null
          domain_pattern?: string | null
          domain_type?: string | null
          email_address?: string
          email_count?: number | null
          exclusive_agent_id?: string | null
          group_color?: string | null
          group_description?: string | null
          group_icon?: string | null
          group_id?: string | null
          group_name?: string | null
          id?: string
          interaction_count?: number | null
          is_active?: boolean | null
          last_applied_at?: string | null
          last_email_at?: string | null
          last_interaction_at?: string | null
          notes?: string | null
          operator_id?: string | null
          preferred_channel?: string | null
          priority?: number | null
          prompt_id?: string | null
          prompt_template_id?: string | null
          success_rate?: number | null
          tone_override?: string | null
          topics_to_avoid?: string[] | null
          topics_to_emphasize?: string[] | null
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
            foreignKeyName: "email_address_rules_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "email_sender_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_address_rules_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
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
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
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
          {
            foreignKeyName: "email_attachments_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaign_queue: {
        Row: {
          created_at: string
          draft_id: string | null
          error_message: string | null
          failed_at: string | null
          html_body: string
          id: string
          idempotency_key: string
          message_id: string | null
          open_count: number | null
          opened_at: string | null
          operator_id: string | null
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
          failed_at?: string | null
          html_body: string
          id?: string
          idempotency_key?: string
          message_id?: string | null
          open_count?: number | null
          opened_at?: string | null
          operator_id?: string | null
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
          failed_at?: string | null
          html_body?: string
          id?: string
          idempotency_key?: string
          message_id?: string | null
          open_count?: number | null
          opened_at?: string | null
          operator_id?: string | null
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
          {
            foreignKeyName: "email_campaign_queue_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      email_classifications: {
        Row: {
          action_suggested: string | null
          ai_summary: string | null
          body_preview: string | null
          category: string
          classified_at: string | null
          confidence: number
          contact_id: string | null
          created_at: string | null
          detected_patterns: string[] | null
          direction: string
          domain: string | null
          email_address: string
          id: string
          keywords: string[] | null
          operator_id: string | null
          partner_id: string | null
          reasoning: string | null
          sentiment: string | null
          source_activity_id: string | null
          subject: string | null
          urgency: string | null
          user_id: string
        }
        Insert: {
          action_suggested?: string | null
          ai_summary?: string | null
          body_preview?: string | null
          category?: string
          classified_at?: string | null
          confidence?: number
          contact_id?: string | null
          created_at?: string | null
          detected_patterns?: string[] | null
          direction?: string
          domain?: string | null
          email_address: string
          id?: string
          keywords?: string[] | null
          operator_id?: string | null
          partner_id?: string | null
          reasoning?: string | null
          sentiment?: string | null
          source_activity_id?: string | null
          subject?: string | null
          urgency?: string | null
          user_id: string
        }
        Update: {
          action_suggested?: string | null
          ai_summary?: string | null
          body_preview?: string | null
          category?: string
          classified_at?: string | null
          confidence?: number
          contact_id?: string | null
          created_at?: string | null
          detected_patterns?: string[] | null
          direction?: string
          domain?: string | null
          email_address?: string
          id?: string
          keywords?: string[] | null
          operator_id?: string | null
          partner_id?: string | null
          reasoning?: string | null
          sentiment?: string | null
          source_activity_id?: string | null
          subject?: string | null
          urgency?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_classifications_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_classifications_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_classifications_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "vw_partner_quality_scores"
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
          operator_id: string | null
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
          user_id: string
        }
        Insert: {
          attachment_ids?: Json | null
          category?: string | null
          created_at?: string
          html_body?: string | null
          id?: string
          link_urls?: Json | null
          operator_id?: string | null
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
          user_id: string
        }
        Update: {
          attachment_ids?: Json | null
          category?: string | null
          created_at?: string
          html_body?: string | null
          id?: string
          link_urls?: Json | null
          operator_id?: string | null
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
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_drafts_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      email_prompts: {
        Row: {
          created_at: string
          id: string
          instructions: string
          is_active: boolean
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
          priority?: number
          scope?: string
          scope_value?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_prompts_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          activity_id: string | null
          campaign_queue_id: string | null
          channel: string
          draft_id: string | null
          error_message: string | null
          id: string
          idempotency_key: string | null
          message_id: string | null
          partner_id: string | null
          recipient_email: string
          send_method: string
          sent_at: string
          status: string
          subject: string
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          campaign_queue_id?: string | null
          channel?: string
          draft_id?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          message_id?: string | null
          partner_id?: string | null
          recipient_email: string
          send_method: string
          sent_at?: string
          status: string
          subject: string
          user_id: string
        }
        Update: {
          activity_id?: string | null
          campaign_queue_id?: string | null
          channel?: string
          draft_id?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          message_id?: string | null
          partner_id?: string | null
          recipient_email?: string
          send_method?: string
          sent_at?: string
          status?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      email_sender_groups: {
        Row: {
          auto_action: string | null
          auto_action_params: Json | null
          colore: string
          created_at: string
          descrizione: string | null
          icon: string | null
          id: string
          is_default: boolean | null
          nome_gruppo: string
          operator_id: string | null
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_action?: string | null
          auto_action_params?: Json | null
          colore?: string
          created_at?: string
          descrizione?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean | null
          nome_gruppo: string
          operator_id?: string | null
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_action?: string | null
          auto_action_params?: Json | null
          colore?: string
          created_at?: string
          descrizione?: string | null
          icon?: string | null
          id?: string
          is_default?: boolean | null
          nome_gruppo?: string
          operator_id?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sender_groups_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
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
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
          skipped_count?: number
          started_at?: string
          status?: string
          total_remaining?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sync_jobs_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sync_state: {
        Row: {
          created_at: string
          id: string
          imap_host: string
          imap_user: string
          last_sync_at: string | null
          last_uid: number
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
          stored_uidvalidity?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sync_state_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
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
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      extension_dispatch_queue: {
        Row: {
          channel: string
          contact_id: string | null
          created_at: string
          delivered_at: string | null
          dispatched_at: string | null
          error: string | null
          id: string
          max_retries: number
          message_text: string
          mission_id: string | null
          operator_id: string | null
          outreach_queue_id: string | null
          partner_id: string | null
          recipient: string
          retry_count: number
          scheduled_for: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: string
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          dispatched_at?: string | null
          error?: string | null
          id?: string
          max_retries?: number
          message_text: string
          mission_id?: string | null
          operator_id?: string | null
          outreach_queue_id?: string | null
          partner_id?: string | null
          recipient: string
          retry_count?: number
          scheduled_for?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          dispatched_at?: string | null
          error?: string | null
          id?: string
          max_retries?: number
          message_text?: string
          mission_id?: string | null
          operator_id?: string | null
          outreach_queue_id?: string | null
          partner_id?: string | null
          recipient?: string
          retry_count?: number
          scheduled_for?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "extension_dispatch_queue_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_log: {
        Row: {
          action: string
          actor_operator_id: string | null
          actor_user_id: string
          created_at: string
          id: string
          target_operator_id: string | null
        }
        Insert: {
          action: string
          actor_operator_id?: string | null
          actor_user_id: string
          created_at?: string
          id?: string
          target_operator_id?: string | null
        }
        Update: {
          action?: string
          actor_operator_id?: string | null
          actor_user_id?: string
          created_at?: string
          id?: string
          target_operator_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_log_actor_operator_id_fkey"
            columns: ["actor_operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_log_target_operator_id_fkey"
            columns: ["target_operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
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
          deleted_at: string | null
          deleted_by: string | null
          error_rows: number
          file_name: string
          file_size: number
          file_url: string | null
          group_name: string | null
          id: string
          imported_rows: number
          normalization_method: string
          operator_id: string | null
          processing_batch: number
          status: string
          total_batches: number
          total_rows: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          error_rows?: number
          file_name: string
          file_size?: number
          file_url?: string | null
          group_name?: string | null
          id?: string
          imported_rows?: number
          normalization_method?: string
          operator_id?: string | null
          processing_batch?: number
          status?: string
          total_batches?: number
          total_rows?: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          error_rows?: number
          file_name?: string
          file_size?: number
          file_url?: string | null
          group_name?: string | null
          id?: string
          imported_rows?: number
          normalization_method?: string
          operator_id?: string | null
          processing_batch?: number
          status?: string
          total_batches?: number
          total_rows?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_logs_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
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
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          email_status: string
          enrichment_data: Json | null
          external_id: string | null
          id: string
          import_log_id: string
          interaction_count: number
          is_selected: boolean
          is_transferred: boolean
          last_interaction_at: string | null
          lead_score: number | null
          lead_score_breakdown: Json | null
          lead_score_updated_at: string | null
          lead_status: string
          mobile: string | null
          name: string | null
          note: string | null
          operator_id: string | null
          origin: string | null
          phone: string | null
          position: string | null
          raw_data: Json | null
          row_number: number
          status_reason: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          email_status?: string
          enrichment_data?: Json | null
          external_id?: string | null
          id?: string
          import_log_id: string
          interaction_count?: number
          is_selected?: boolean
          is_transferred?: boolean
          last_interaction_at?: string | null
          lead_score?: number | null
          lead_score_breakdown?: Json | null
          lead_score_updated_at?: string | null
          lead_status?: string
          mobile?: string | null
          name?: string | null
          note?: string | null
          operator_id?: string | null
          origin?: string | null
          phone?: string | null
          position?: string | null
          raw_data?: Json | null
          row_number?: number
          status_reason?: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          email_status?: string
          enrichment_data?: Json | null
          external_id?: string | null
          id?: string
          import_log_id?: string
          interaction_count?: number
          is_selected?: boolean
          is_transferred?: boolean
          last_interaction_at?: string | null
          lead_score?: number | null
          lead_score_breakdown?: Json | null
          lead_score_updated_at?: string | null
          lead_status?: string
          mobile?: string | null
          name?: string | null
          note?: string | null
          operator_id?: string | null
          origin?: string | null
          phone?: string | null
          position?: string | null
          raw_data?: Json | null
          row_number?: number
          status_reason?: string | null
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
            foreignKeyName: "imported_contacts_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imported_contacts_wca_partner_id_fkey"
            columns: ["wca_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imported_contacts_wca_partner_id_fkey"
            columns: ["wca_partner_id"]
            isOneToOne: false
            referencedRelation: "vw_partner_quality_scores"
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
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
          partner_id?: string
          subject?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interactions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "vw_partner_quality_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_entries: {
        Row: {
          access_count: number | null
          category: string
          chapter: string
          communication_context: Json | null
          content: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          embedding: string | null
          embedding_model: string | null
          embedding_updated_at: string | null
          id: string
          is_active: boolean
          last_accessed_at: string | null
          operator_id: string | null
          priority: number
          sort_order: number
          source_path: string | null
          tags: string[]
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          access_count?: number | null
          category?: string
          chapter?: string
          communication_context?: Json | null
          content?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          embedding?: string | null
          embedding_model?: string | null
          embedding_updated_at?: string | null
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          operator_id?: string | null
          priority?: number
          sort_order?: number
          source_path?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          access_count?: number | null
          category?: string
          chapter?: string
          communication_context?: Json | null
          content?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          embedding?: string | null
          embedding_model?: string | null
          embedding_updated_at?: string | null
          id?: string
          is_active?: boolean
          last_accessed_at?: string | null
          operator_id?: string | null
          priority?: number
          sort_order?: number
          source_path?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_entries_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
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
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
          processed_count?: number
          status?: string
          success_count?: number
          total_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_flow_jobs_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_actions: {
        Row: {
          action_label: string
          action_type: string
          cadence_rule: Json | null
          classification_id: string | null
          completed_at: string | null
          created_at: string
          danger_level: string
          deleted_at: string | null
          deleted_by: string | null
          error_message: string | null
          id: string
          idempotency_key: string | null
          last_error: string | null
          metadata: Json | null
          mission_id: string
          next_retry_at: string | null
          operator_id: string | null
          parent_action_id: string | null
          position: number
          recovery_log: Json | null
          retry_count: number | null
          scheduled_at: string | null
          slot_acquired_at: string | null
          slot_released_at: string | null
          started_at: string | null
          status: string
          trigger_condition: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_label?: string
          action_type?: string
          cadence_rule?: Json | null
          classification_id?: string | null
          completed_at?: string | null
          created_at?: string
          danger_level?: string
          deleted_at?: string | null
          deleted_by?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          metadata?: Json | null
          mission_id: string
          next_retry_at?: string | null
          operator_id?: string | null
          parent_action_id?: string | null
          position?: number
          recovery_log?: Json | null
          retry_count?: number | null
          scheduled_at?: string | null
          slot_acquired_at?: string | null
          slot_released_at?: string | null
          started_at?: string | null
          status?: string
          trigger_condition?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_label?: string
          action_type?: string
          cadence_rule?: Json | null
          classification_id?: string | null
          completed_at?: string | null
          created_at?: string
          danger_level?: string
          deleted_at?: string | null
          deleted_by?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          metadata?: Json | null
          mission_id?: string
          next_retry_at?: string | null
          operator_id?: string | null
          parent_action_id?: string | null
          position?: number
          recovery_log?: Json | null
          retry_count?: number | null
          scheduled_at?: string | null
          slot_acquired_at?: string | null
          slot_released_at?: string | null
          started_at?: string | null
          status?: string
          trigger_condition?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_actions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_actions_parent_action_id_fkey"
            columns: ["parent_action_id"]
            isOneToOne: false
            referencedRelation: "mission_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_slot_config: {
        Row: {
          channel: string
          concurrent_slots: number
          created_at: string
          id: string
          max_per_day: number
          max_per_hour: number
          operator_id: string | null
          retry_backoff_minutes: number
          retry_max: number
          user_id: string
        }
        Insert: {
          channel: string
          concurrent_slots?: number
          created_at?: string
          id?: string
          max_per_day?: number
          max_per_hour?: number
          operator_id?: string | null
          retry_backoff_minutes?: number
          retry_max?: number
          user_id: string
        }
        Update: {
          channel?: string
          concurrent_slots?: number
          created_at?: string
          id?: string
          max_per_day?: number
          max_per_hour?: number
          operator_id?: string | null
          retry_backoff_minutes?: number
          retry_max?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_slot_config_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
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
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
          sample_tested_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "network_configs_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string | null
          created_at: string | null
          dismissed: boolean | null
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          priority: string | null
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          created_at?: string | null
          dismissed?: boolean | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          priority?: string | null
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          created_at?: string | null
          dismissed?: boolean | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          priority?: string | null
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
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
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
          priority?: number
          procedure?: string
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operative_prompts_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
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
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          branding: Json | null
          created_at: string
          custom_domain: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          plan: string
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          branding?: Json | null
          created_at?: string
          custom_domain?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          plan?: string
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          branding?: Json | null
          created_at?: string
          custom_domain?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          plan?: string
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
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
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          id: string
          idempotency_key: string | null
          metadata: Json | null
          operator_id: string | null
          plan_json: Json | null
          plan_status: string | null
          processed_contacts: number
          progress_snapshot: Json | null
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
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          operator_id?: string | null
          plan_json?: Json | null
          plan_status?: string | null
          processed_contacts?: number
          progress_snapshot?: Json | null
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
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          operator_id?: string | null
          plan_json?: Json | null
          plan_status?: string | null
          processed_contacts?: number
          progress_snapshot?: Json | null
          schedule_config?: Json | null
          status?: string
          target_filters?: Json
          title?: string
          total_contacts?: number
          user_id?: string
          work_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_missions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_queue: {
        Row: {
          attempts: number
          body: string
          channel: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          last_error: string | null
          max_attempts: number
          operator_id: string | null
          partner_id: string | null
          priority: number
          processed_at: string | null
          recipient_email: string | null
          recipient_linkedin_url: string | null
          recipient_name: string | null
          recipient_phone: string | null
          replied_at: string | null
          reply_message_id: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number
          operator_id?: string | null
          partner_id?: string | null
          priority?: number
          processed_at?: string | null
          recipient_email?: string | null
          recipient_linkedin_url?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          replied_at?: string | null
          reply_message_id?: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number
          operator_id?: string | null
          partner_id?: string | null
          priority?: number
          processed_at?: string | null
          recipient_email?: string | null
          recipient_linkedin_url?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          replied_at?: string | null
          reply_message_id?: string | null
          status?: string
          subject?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_queue_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_schedules: {
        Row: {
          action: string
          attempt: number
          contact_id: string | null
          created_at: string
          id: string
          last_error: string | null
          max_attempts: number
          mission_id: string
          operator_id: string | null
          result: Json | null
          run_at: string
          scheduled_for_followup_step: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action?: string
          attempt?: number
          contact_id?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          mission_id: string
          operator_id?: string | null
          result?: Json | null
          run_at?: string
          scheduled_for_followup_step?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: string
          attempt?: number
          contact_id?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          mission_id?: string
          operator_id?: string | null
          result?: Json | null
          run_at?: string
          scheduled_for_followup_step?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_schedules_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "outreach_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_schedules_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_timing_templates: {
        Row: {
          auto_translate: boolean | null
          created_at: string | null
          description: string | null
          goal: string
          id: string
          is_system: boolean | null
          max_attempts: number | null
          operator_id: string | null
          preferred_language: string | null
          sequence: Json
          source_type: string
          template_name: string
          total_duration_days: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          auto_translate?: boolean | null
          created_at?: string | null
          description?: string | null
          goal: string
          id?: string
          is_system?: boolean | null
          max_attempts?: number | null
          operator_id?: string | null
          preferred_language?: string | null
          sequence?: Json
          source_type: string
          template_name: string
          total_duration_days?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          auto_translate?: boolean | null
          created_at?: string | null
          description?: string | null
          goal?: string
          id?: string
          is_system?: boolean | null
          max_attempts?: number | null
          operator_id?: string | null
          preferred_language?: string | null
          sequence?: Json
          source_type?: string
          template_name?: string
          total_duration_days?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_timing_templates_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      page_events: {
        Row: {
          created_at: string
          duration_ms: number | null
          entity_id: string | null
          entity_type: string | null
          event_name: string
          id: string
          page: string
          props: Json
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          entity_id?: string | null
          entity_type?: string | null
          event_name: string
          id?: string
          page: string
          props?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          entity_id?: string | null
          entity_type?: string | null
          event_name?: string
          id?: string
          page?: string
          props?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      partner_certifications: {
        Row: {
          certification: Database["public"]["Enums"]["certification_type"]
          created_at: string | null
          id: string
          operator_id: string | null
          partner_id: string
          user_id: string | null
        }
        Insert: {
          certification: Database["public"]["Enums"]["certification_type"]
          created_at?: string | null
          id?: string
          operator_id?: string | null
          partner_id: string
          user_id?: string | null
        }
        Update: {
          certification?: Database["public"]["Enums"]["certification_type"]
          created_at?: string | null
          id?: string
          operator_id?: string | null
          partner_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_certifications_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_certifications_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_certifications_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "vw_partner_quality_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_contacts: {
        Row: {
          contact_alias: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          direct_phone: string | null
          email: string | null
          id: string
          is_primary: boolean | null
          mobile: string | null
          name: string
          operator_id: string | null
          partner_id: string
          title: string | null
          user_id: string | null
        }
        Insert: {
          contact_alias?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          direct_phone?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          mobile?: string | null
          name: string
          operator_id?: string | null
          partner_id: string
          title?: string | null
          user_id?: string | null
        }
        Update: {
          contact_alias?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          direct_phone?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          mobile?: string | null
          name?: string
          operator_id?: string | null
          partner_id?: string
          title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_contacts_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_contacts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_contacts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "vw_partner_quality_scores"
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
          operator_id: string | null
          partner_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires?: string | null
          id?: string
          network_id?: string | null
          network_name: string
          operator_id?: string | null
          partner_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires?: string | null
          id?: string
          network_id?: string | null
          network_name?: string
          operator_id?: string | null
          partner_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_networks_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_networks_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_networks_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "vw_partner_quality_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_services: {
        Row: {
          created_at: string | null
          id: string
          operator_id: string | null
          partner_id: string
          service_category: Database["public"]["Enums"]["service_category"]
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          operator_id?: string | null
          partner_id: string
          service_category: Database["public"]["Enums"]["service_category"]
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          operator_id?: string | null
          partner_id?: string
          service_category?: Database["public"]["Enums"]["service_category"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_services_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_services_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_services_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "vw_partner_quality_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_social_links: {
        Row: {
          contact_id: string | null
          created_at: string
          id: string
          operator_id: string | null
          partner_id: string
          platform: Database["public"]["Enums"]["social_platform"]
          url: string
          user_id: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          id?: string
          operator_id?: string | null
          partner_id: string
          platform: Database["public"]["Enums"]["social_platform"]
          url: string
          user_id?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          id?: string
          operator_id?: string | null
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
            foreignKeyName: "partner_social_links_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_social_links_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_social_links_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "vw_partner_quality_scores"
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
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
          partner_id?: string | null
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_workflow_state_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_workflow_state_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_workflow_state_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "vw_partner_quality_scores"
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
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          email_status: string
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
          linkedin_url: string | null
          logo_url: string | null
          member_since: string | null
          membership_expires: string | null
          mobile: string | null
          office_type: Database["public"]["Enums"]["office_type"] | null
          operator_id: string | null
          partner_type: Database["public"]["Enums"]["partner_type"] | null
          phone: string | null
          profile_description: string | null
          rating: number | null
          rating_details: Json | null
          raw_profile_html: string | null
          raw_profile_markdown: string | null
          status_reason: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          email_status?: string
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
          linkedin_url?: string | null
          logo_url?: string | null
          member_since?: string | null
          membership_expires?: string | null
          mobile?: string | null
          office_type?: Database["public"]["Enums"]["office_type"] | null
          operator_id?: string | null
          partner_type?: Database["public"]["Enums"]["partner_type"] | null
          phone?: string | null
          profile_description?: string | null
          rating?: number | null
          rating_details?: Json | null
          raw_profile_html?: string | null
          raw_profile_markdown?: string | null
          status_reason?: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          email_status?: string
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
          linkedin_url?: string | null
          logo_url?: string | null
          member_since?: string | null
          membership_expires?: string | null
          mobile?: string | null
          office_type?: Database["public"]["Enums"]["office_type"] | null
          operator_id?: string | null
          partner_type?: Database["public"]["Enums"]["partner_type"] | null
          phone?: string | null
          profile_description?: string | null
          rating?: number | null
          rating_details?: Json | null
          raw_profile_html?: string | null
          raw_profile_markdown?: string | null
          status_reason?: string | null
          updated_at?: string | null
          user_id?: string | null
          wca_id?: number | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partners_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
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
      permissions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          key: string
          module: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          module?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          module?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ai_config: Json | null
          created_at: string
          display_name: string | null
          id: string
          language: string
          onboarding_completed: boolean
          operator_role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_config?: Json | null
          created_at?: string
          display_name?: string | null
          id?: string
          language?: string
          onboarding_completed?: boolean
          operator_role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_config?: Json | null
          created_at?: string
          display_name?: string | null
          id?: string
          language?: string
          onboarding_completed?: boolean
          operator_role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prompt_lab_global_runs: {
        Row: {
          completed_at: string | null
          deleted_at: string | null
          doctrine_full: string | null
          goal: string | null
          id: string
          progress_current: number
          progress_total: number
          proposals: Json
          started_at: string
          status: string
          system_map: string | null
          system_mission: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          deleted_at?: string | null
          doctrine_full?: string | null
          goal?: string | null
          id?: string
          progress_current?: number
          progress_total?: number
          proposals?: Json
          started_at?: string
          status?: string
          system_map?: string | null
          system_mission?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          deleted_at?: string | null
          doctrine_full?: string | null
          goal?: string | null
          id?: string
          progress_current?: number
          progress_total?: number
          proposals?: Json
          started_at?: string
          status?: string
          system_map?: string | null
          system_mission?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prompt_templates: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          is_system: boolean | null
          name: string
          prompt_text: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          prompt_text: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          prompt_text?: string
          updated_at?: string | null
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
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
          phone?: string | null
          prospect_id?: string
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_contacts_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
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
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
          outcome?: string | null
          prospect_id?: string
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospect_interactions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
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
          operator_id: string | null
          platform: string
          prospect_id: string
          url: string
          user_id: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          id?: string
          operator_id?: string | null
          platform: string
          prospect_id: string
          url: string
          user_id?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          id?: string
          operator_id?: string | null
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
            foreignKeyName: "prospect_social_links_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
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
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "prospects_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          due_date: string
          id: string
          operator_id: string | null
          partner_id: string
          priority: Database["public"]["Enums"]["reminder_priority"] | null
          status: Database["public"]["Enums"]["reminder_status"] | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          due_date: string
          id?: string
          operator_id?: string | null
          partner_id: string
          priority?: Database["public"]["Enums"]["reminder_priority"] | null
          status?: Database["public"]["Enums"]["reminder_status"] | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          due_date?: string
          id?: string
          operator_id?: string | null
          partner_id?: string
          priority?: Database["public"]["Enums"]["reminder_priority"] | null
          status?: Database["public"]["Enums"]["reminder_status"] | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "vw_partner_quality_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      reply_classifications: {
        Row: {
          channel: string
          classification: string
          confidence: number
          created_at: string
          id: string
          intent: string | null
          message_id: string
          model: string | null
          reasoning: string | null
          sentiment: string | null
          urgency: string | null
        }
        Insert: {
          channel?: string
          classification: string
          confidence?: number
          created_at?: string
          id?: string
          intent?: string | null
          message_id: string
          model?: string | null
          reasoning?: string | null
          sentiment?: string | null
          urgency?: string | null
        }
        Update: {
          channel?: string
          classification?: string
          confidence?: number
          created_at?: string
          id?: string
          intent?: string | null
          message_id?: string
          model?: string | null
          reasoning?: string | null
          sentiment?: string | null
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reply_classifications_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "channel_messages"
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
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
          status?: string | null
          trace_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_logs_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
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
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "response_patterns_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
        }
        Insert: {
          permission_id: string
          role_id: string
        }
        Update: {
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_system: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
        }
        Relationships: []
      }
      scrape_cache: {
        Row: {
          mode: string
          payload: Json
          scraped_at: string
          url: string
        }
        Insert: {
          mode?: string
          payload?: Json
          scraped_at?: string
          url: string
        }
        Update: {
          mode?: string
          payload?: Json
          scraped_at?: string
          url?: string
        }
        Relationships: []
      }
      scraper_agent_log: {
        Row: {
          ai_latency_ms: number | null
          ai_model: string | null
          ai_tokens_in: number | null
          ai_tokens_out: number | null
          channel: string
          created_at: string
          dom_snapshot_hash: string | null
          dom_snapshot_size: number | null
          error_message: string | null
          execution_result: string | null
          extraction_plan: Json | null
          id: string
          items_extracted: number | null
          items_found: number | null
          memory_id: string | null
          operator_id: string
          page_type: string
          screenshot_included: boolean | null
          used_cached_plan: boolean
        }
        Insert: {
          ai_latency_ms?: number | null
          ai_model?: string | null
          ai_tokens_in?: number | null
          ai_tokens_out?: number | null
          channel: string
          created_at?: string
          dom_snapshot_hash?: string | null
          dom_snapshot_size?: number | null
          error_message?: string | null
          execution_result?: string | null
          extraction_plan?: Json | null
          id?: string
          items_extracted?: number | null
          items_found?: number | null
          memory_id?: string | null
          operator_id?: string
          page_type: string
          screenshot_included?: boolean | null
          used_cached_plan?: boolean
        }
        Update: {
          ai_latency_ms?: number | null
          ai_model?: string | null
          ai_tokens_in?: number | null
          ai_tokens_out?: number | null
          channel?: string
          created_at?: string
          dom_snapshot_hash?: string | null
          dom_snapshot_size?: number | null
          error_message?: string | null
          execution_result?: string | null
          extraction_plan?: Json | null
          id?: string
          items_extracted?: number | null
          items_found?: number | null
          memory_id?: string | null
          operator_id?: string
          page_type?: string
          screenshot_included?: boolean | null
          used_cached_plan?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "scraper_agent_log_memory_id_fkey"
            columns: ["memory_id"]
            isOneToOne: false
            referencedRelation: "scraper_agent_memory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scraper_agent_log_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      scraper_agent_memory: {
        Row: {
          channel: string
          consecutive_failures: number
          consecutive_successes: number
          created_at: string
          dom_structure_hash: string | null
          extraction_plan: Json
          id: string
          last_failure_at: string | null
          last_success_at: string | null
          operator_id: string
          page_type: string
          plan_version: number
          total_ai_calls: number
          total_invocations: number
          updated_at: string
        }
        Insert: {
          channel: string
          consecutive_failures?: number
          consecutive_successes?: number
          created_at?: string
          dom_structure_hash?: string | null
          extraction_plan?: Json
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          operator_id?: string
          page_type: string
          plan_version?: number
          total_ai_calls?: number
          total_invocations?: number
          updated_at?: string
        }
        Update: {
          channel?: string
          consecutive_failures?: number
          consecutive_successes?: number
          created_at?: string
          dom_structure_hash?: string | null
          extraction_plan?: Json
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          operator_id?: string
          page_type?: string
          plan_version?: number
          total_ai_calls?: number
          total_invocations?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scraper_agent_memory_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      sherlock_investigations: {
        Row: {
          completed_at: string | null
          contact_id: string | null
          created_at: string
          duration_ms: number | null
          findings: Json
          id: string
          level: number
          operator_id: string | null
          partner_id: string | null
          playbook_id: string | null
          started_at: string
          status: string
          step_log: Json
          summary: string | null
          target_label: string | null
          updated_at: string
          user_id: string
          vars: Json
        }
        Insert: {
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          duration_ms?: number | null
          findings?: Json
          id?: string
          level: number
          operator_id?: string | null
          partner_id?: string | null
          playbook_id?: string | null
          started_at?: string
          status?: string
          step_log?: Json
          summary?: string | null
          target_label?: string | null
          updated_at?: string
          user_id: string
          vars?: Json
        }
        Update: {
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          duration_ms?: number | null
          findings?: Json
          id?: string
          level?: number
          operator_id?: string | null
          partner_id?: string | null
          playbook_id?: string | null
          started_at?: string
          status?: string
          step_log?: Json
          summary?: string | null
          target_label?: string | null
          updated_at?: string
          user_id?: string
          vars?: Json
        }
        Relationships: [
          {
            foreignKeyName: "sherlock_investigations_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "sherlock_playbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      sherlock_playbooks: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          estimated_seconds: number
          id: string
          is_active: boolean
          level: number
          name: string
          sort_order: number
          steps: Json
          target_fields: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_seconds?: number
          id?: string
          is_active?: boolean
          level: number
          name: string
          sort_order?: number
          steps?: Json
          target_fields?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_seconds?: number
          id?: string
          is_active?: boolean
          level?: number
          name?: string
          sort_order?: number
          steps?: Json
          target_fields?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      supervisor_audit_log: {
        Row: {
          action_category: string
          action_detail: string
          actor_id: string | null
          actor_name: string | null
          actor_type: string
          ai_decision_log_id: string | null
          contact_id: string | null
          created_at: string | null
          decision_origin: string
          email_address: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          operator_id: string | null
          partner_id: string | null
          session_id: string | null
          target_id: string | null
          target_label: string | null
          target_type: string | null
          user_id: string
        }
        Insert: {
          action_category: string
          action_detail: string
          actor_id?: string | null
          actor_name?: string | null
          actor_type: string
          ai_decision_log_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          decision_origin?: string
          email_address?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          operator_id?: string | null
          partner_id?: string | null
          session_id?: string | null
          target_id?: string | null
          target_label?: string | null
          target_type?: string | null
          user_id: string
        }
        Update: {
          action_category?: string
          action_detail?: string
          actor_id?: string | null
          actor_name?: string | null
          actor_type?: string
          ai_decision_log_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          decision_origin?: string
          email_address?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          operator_id?: string | null
          partner_id?: string | null
          session_id?: string | null
          target_id?: string | null
          target_label?: string | null
          target_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supervisor_audit_log_ai_decision_log_id_fkey"
            columns: ["ai_decision_log_id"]
            isOneToOne: false
            referencedRelation: "ai_decision_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_audit_log_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_audit_log_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_audit_log_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "vw_partner_quality_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
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
      usage_daily_budget: {
        Row: {
          ai_token_cap: number
          ai_tokens_used: number
          created_at: string
          id: string
          operator_id: string | null
          tts_char_cap: number
          tts_chars_used: number
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          ai_token_cap?: number
          ai_tokens_used?: number
          created_at?: string
          id?: string
          operator_id?: string | null
          tts_char_cap?: number
          tts_chars_used?: number
          updated_at?: string
          usage_date?: string
          user_id: string
        }
        Update: {
          ai_token_cap?: number
          ai_tokens_used?: number
          created_at?: string
          id?: string
          operator_id?: string | null
          tts_char_cap?: number
          tts_chars_used?: number
          updated_at?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_daily_budget_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_metering: {
        Row: {
          id: string
          missions_count: number
          month: string
          organization_id: string
          tokens_used: number
          tts_chars_used: number
          updated_at: string
        }
        Insert: {
          id?: string
          missions_count?: number
          month: string
          organization_id: string
          tokens_used?: number
          tts_chars_used?: number
          updated_at?: string
        }
        Update: {
          id?: string
          missions_count?: number
          month?: string
          organization_id?: string
          tokens_used?: number
          tts_chars_used?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_metering_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      user_automation_settings: {
        Row: {
          automation_type: string
          created_at: string
          id: string
          is_paused: boolean
          paused_at: string | null
          paused_reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          automation_type: string
          created_at?: string
          id?: string
          is_paused?: boolean
          paused_at?: string | null
          paused_reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          automation_type?: string
          created_at?: string
          id?: string
          is_paused?: boolean
          paused_at?: string | null
          paused_reason?: string | null
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
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
          outcome?: string | null
          partner_id?: string | null
          status?: string | null
          transcript?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_call_sessions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_documents: {
        Row: {
          created_at: string
          extracted_text: string | null
          file_name: string
          file_size: number
          file_url: string
          id: string
          operator_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          file_name: string
          file_size?: number
          file_url: string
          id?: string
          operator_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          file_name?: string
          file_size?: number
          file_url?: string
          id?: string
          operator_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_documents_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_presets: {
        Row: {
          base_proposal: string | null
          created_at: string | null
          document_ids: Json | null
          goal: string | null
          id: string
          name: string
          operator_id: string | null
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
          operator_id?: string | null
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
          operator_id?: string | null
          reference_links?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_presets_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
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
      vw_partner_quality_scores: {
        Row: {
          calculated_at: string | null
          city: string | null
          company_name: string | null
          country_name: string | null
          data_completeness: number | null
          id: string | null
          is_active: boolean | null
          rating: number | null
          total_score: number | null
          updated_at: string | null
        }
        Insert: {
          calculated_at?: never
          city?: string | null
          company_name?: string | null
          country_name?: string | null
          data_completeness?: never
          id?: string | null
          is_active?: boolean | null
          rating?: number | null
          total_score?: never
          updated_at?: string | null
        }
        Update: {
          calculated_at?: never
          city?: string | null
          company_name?: string | null
          country_name?: string | null
          data_completeness?: never
          id?: string | null
          is_active?: boolean | null
          rating?: number | null
          total_score?: never
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _cron_invoke_edge_sql: { Args: { fn_name: string }; Returns: string }
      acquire_mission_slot: {
        Args: {
          p_channel: string
          p_max_concurrent?: number
          p_mission_id: string
          p_user_id: string
        }
        Returns: string
      }
      acquire_outreach_batch: {
        Args: { p_limit?: number }
        Returns: {
          action: string
          attempt: number
          contact_id: string | null
          created_at: string
          id: string
          last_error: string | null
          max_attempts: number
          mission_id: string
          operator_id: string | null
          result: Json | null
          run_at: string
          scheduled_for_followup_step: number | null
          status: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "outreach_schedules"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      check_channel_rate_limit: {
        Args: { _channel: string; _user_id: string }
        Returns: Json
      }
      check_domain_group_pattern: {
        Args: { p_domain: string; p_min_count?: number; p_user_id: string }
        Returns: {
          count: number
          group_id: string
          group_name: string
        }[]
      }
      count_inbound_activities: { Args: never; Returns: Json }
      cron_job_status: {
        Args: never
        Returns: {
          active: boolean
          jobname: string
          last_run: string
          last_status: string
          schedule: string
        }[]
      }
      cron_service_headers: { Args: never; Returns: Json }
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
      get_active_operator_id: { Args: never; Returns: string }
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
      get_current_operator_id: { Args: never; Returns: string }
      get_dashboard_snapshot: { Args: never; Returns: Json }
      get_directory_counts: {
        Args: never
        Returns: {
          country_code: string
          is_verified: boolean
          member_count: number
        }[]
      }
      get_effective_operator_ids: { Args: never; Returns: string[] }
      get_operator_id_by_identifier: {
        Args: { p_channel: string; p_identifier: string }
        Returns: string
      }
      get_system_diagnostics: { Args: never; Returns: Json }
      get_system_paused: { Args: never; Returns: boolean }
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
      is_org_admin: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: boolean
      }
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
      match_email_sender: {
        Args: { p_domain: string; p_email: string; p_user_id: string }
        Returns: {
          company_name: string
          display_name: string
          email_confidence: number
          partner_id: string
          source_id: string
          source_type: string
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
      purge_inbound_activities: {
        Args: { p_only_orphans?: boolean }
        Returns: Json
      }
      record_user_login: { Args: { p_email: string }; Returns: undefined }
      release_mission_slot: {
        Args: { p_action_id: string; p_error?: string; p_success: boolean }
        Returns: undefined
      }
      set_system_paused: { Args: { p_paused: boolean }; Returns: Json }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      topup_credits: {
        Args: { p_amount: number; p_description?: string; p_user_id: string }
        Returns: number
      }
      update_mission_progress: { Args: { p_mission_id: string }; Returns: Json }
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
