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
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          partner_id: string
          priority: string
          status: Database["public"]["Enums"]["activity_status"]
          title: string
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          partner_id: string
          priority?: string
          status?: Database["public"]["Enums"]["activity_status"]
          title: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["activity_type"]
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          partner_id?: string
          priority?: string
          status?: Database["public"]["Enums"]["activity_status"]
          title?: string
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
          priority: number
          status: Database["public"]["Enums"]["download_queue_status"]
          total_found: number
          total_processed: number
          updated_at: string
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
        }
        Relationships: []
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
        }
        Relationships: []
      }
      partner_certifications: {
        Row: {
          certification: Database["public"]["Enums"]["certification_type"]
          created_at: string | null
          id: string
          partner_id: string
        }
        Insert: {
          certification: Database["public"]["Enums"]["certification_type"]
          created_at?: string | null
          id?: string
          partner_id: string
        }
        Update: {
          certification?: Database["public"]["Enums"]["certification_type"]
          created_at?: string | null
          id?: string
          partner_id?: string
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
          created_at: string | null
          direct_phone: string | null
          email: string | null
          id: string
          is_primary: boolean | null
          mobile: string | null
          name: string
          partner_id: string
          title: string | null
        }
        Insert: {
          created_at?: string | null
          direct_phone?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          mobile?: string | null
          name: string
          partner_id: string
          title?: string | null
        }
        Update: {
          created_at?: string | null
          direct_phone?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          mobile?: string | null
          name?: string
          partner_id?: string
          title?: string | null
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
        }
        Insert: {
          created_at?: string | null
          expires?: string | null
          id?: string
          network_id?: string | null
          network_name: string
          partner_id: string
        }
        Update: {
          created_at?: string | null
          expires?: string | null
          id?: string
          network_id?: string | null
          network_name?: string
          partner_id?: string
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
        }
        Insert: {
          created_at?: string | null
          id?: string
          partner_id: string
          service_category: Database["public"]["Enums"]["service_category"]
        }
        Update: {
          created_at?: string | null
          id?: string
          partner_id?: string
          service_category?: Database["public"]["Enums"]["service_category"]
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
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          id?: string
          partner_id: string
          platform: Database["public"]["Enums"]["social_platform"]
          url: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          id?: string
          partner_id?: string
          platform?: Database["public"]["Enums"]["social_platform"]
          url?: string
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
      partners: {
        Row: {
          address: string | null
          branch_cities: Json | null
          city: string
          company_name: string
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
          is_active: boolean | null
          is_favorite: boolean | null
          member_since: string | null
          membership_expires: string | null
          mobile: string | null
          office_type: Database["public"]["Enums"]["office_type"] | null
          partner_type: Database["public"]["Enums"]["partner_type"] | null
          phone: string | null
          profile_description: string | null
          rating: number | null
          rating_details: Json | null
          updated_at: string | null
          wca_id: number | null
          website: string | null
        }
        Insert: {
          address?: string | null
          branch_cities?: Json | null
          city: string
          company_name: string
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
          is_active?: boolean | null
          is_favorite?: boolean | null
          member_since?: string | null
          membership_expires?: string | null
          mobile?: string | null
          office_type?: Database["public"]["Enums"]["office_type"] | null
          partner_type?: Database["public"]["Enums"]["partner_type"] | null
          phone?: string | null
          profile_description?: string | null
          rating?: number | null
          rating_details?: Json | null
          updated_at?: string | null
          wca_id?: number | null
          website?: string | null
        }
        Update: {
          address?: string | null
          branch_cities?: Json | null
          city?: string
          company_name?: string
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
          is_active?: boolean | null
          is_favorite?: boolean | null
          member_since?: string | null
          membership_expires?: string | null
          mobile?: string | null
          office_type?: Database["public"]["Enums"]["office_type"] | null
          partner_type?: Database["public"]["Enums"]["partner_type"] | null
          phone?: string | null
          profile_description?: string | null
          rating?: number | null
          rating_details?: Json | null
          updated_at?: string | null
          wca_id?: number | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
      ],
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
